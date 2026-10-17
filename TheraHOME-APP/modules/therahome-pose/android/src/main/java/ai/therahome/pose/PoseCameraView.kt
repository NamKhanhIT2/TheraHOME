package ai.therahome.pose

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Log
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import android.view.ViewGroup

private const val TAG = "TheraHOME:pose"
private const val MODEL_ASSET = "pose_landmarker_lite.task"

// A camera preview that also says where the body is — the twin of
// ios/PoseCameraView.swift. Read that file first: it explains why the
// camera and the detector live in ONE view (the skeleton is drawn on top of
// this preview, so the two have to agree about geometry to the pixel) and
// why the preview is mirrored while the analysed frames are not.
//
// Android's detector is MediaPipe's pose landmarker, `lite` variant, in
// LIVE_STREAM mode. iOS uses Apple's Vision instead; see the podspec.
class PoseCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onPose by EventDispatcher()
  private val onPoseStatus by EventDispatcher()

  private val previewView = PreviewView(context).apply {
    // COMPATIBLE is a TextureView. The default (PERFORMANCE) is a
    // SurfaceView, which punches a hole through the window and therefore
    // renders BEHIND anything React Native draws on top of it — and the
    // whole point of this view is that a skeleton is drawn on top of it.
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
    )
  }

  // Props
  var isActive = false
    set(value) {
      if (field == value) return
      field = value
      applyState()
    }

  var facing = "front"
    set(value) {
      if (field == value) return
      field = value
      applyState(reconfigure = true)
    }

  /** Frames per second handed to MediaPipe, not frames captured. */
  var targetFps = 12.0

  private var cameraProvider: ProcessCameraProvider? = null
  private var preview: Preview? = null
  private var analysis: ImageAnalysis? = null
  private var landmarker: PoseLandmarker? = null
  private var analysisExecutor: ExecutorService? = null

  private var running = false
  private var lastFrameAt = 0L
  private var lastTimestamp = 0L

  /** Written from `onLayout` (main), read from the analysis thread. */
  @Volatile private var viewW = 0
  @Volatile private var viewH = 0

  init {
    addView(previewView)
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    super.onLayout(changed, l, t, r, b)
    previewView.layout(0, 0, r - l, b - t)
    viewW = r - l
    viewH = b - t
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    applyState()
  }

  override fun onDetachedFromWindow() {
    // A back-swipe unmounts the view without `active` ever going false. A
    // camera left bound keeps the hardware open and the privacy indicator
    // lit over an app that is no longer looking at anything.
    stop()
    super.onDetachedFromWindow()
  }

  // MARK: State

  private fun applyState(reconfigure: Boolean = false) {
    val shouldRun = isActive && isAttachedToWindow
    if (!shouldRun) {
      stop()
      return
    }
    if (running && !reconfigure) return
    if (running) stop()
    start()
  }

  private fun start() {
    val activity = appContext.currentActivity
    if (activity !is LifecycleOwner) {
      emitStatus("unavailable")
      return
    }
    if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.CAMERA) !=
      android.content.pm.PackageManager.PERMISSION_GRANTED
    ) {
      emitStatus("denied")
      return
    }

    running = true
    val executor = analysisExecutor ?: Executors.newSingleThreadExecutor().also { analysisExecutor = it }

    // Building the landmarker reads a 5.8 MB model and compiles a graph —
    // a visible stall if it happened on the main thread while a screen was
    // animating in.
    executor.execute {
      if (landmarker == null) {
        landmarker = buildLandmarker()
        if (landmarker == null) {
          post { emitStatus("unavailable") }
          return@execute
        }
      }
      post { bindCamera(activity, executor) }
    }
  }

  private fun stop() {
    running = false
    cameraProvider?.let { provider ->
      preview?.let { provider.unbind(it) }
      analysis?.let { provider.unbind(it) }
    }
    preview = null
    analysis = null
    emitStatus("stopped")
  }

  private fun buildLandmarker(): PoseLandmarker? = try {
    // `setModelAssetBuffer` rather than `setModelAssetPath`: an asset read
    // into a direct buffer works whatever the APK did to the file, while
    // the path form needs the `.task` left uncompressed by the APP module's
    // packaging options — a setting this library module cannot set and a
    // `expo prebuild` could silently drop.
    val bytes = context.assets.open(MODEL_ASSET).use { it.readBytes() }
    val buffer = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).apply {
      put(bytes)
      rewind()
    }
    val base = BaseOptions.builder().setModelAssetBuffer(buffer).build()
    PoseLandmarker.createFromOptions(
      context,
      PoseLandmarker.PoseLandmarkerOptions.builder()
        .setBaseOptions(base)
        .setRunningMode(RunningMode.LIVE_STREAM)
        .setNumPoses(1)
        .setMinPoseDetectionConfidence(0.5f)
        .setMinPosePresenceConfidence(0.5f)
        .setMinTrackingConfidence(0.5f)
        .setResultListener { result, input -> onResult(result, input.width, input.height) }
        .setErrorListener { error -> Log.w(TAG, "pose landmarker error", error) }
        .build(),
    )
  } catch (error: Throwable) {
    // A device whose ABI the model's native code does not cover, or an
    // asset that failed to pack. The feature switches itself off; it never
    // takes the screen down with it.
    Log.w(TAG, "could not create pose landmarker", error)
    null
  }

  private fun bindCamera(owner: LifecycleOwner, executor: ExecutorService) {
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (!running) return@addListener
      val provider = try {
        future.get()
      } catch (error: Throwable) {
        Log.w(TAG, "no camera provider", error)
        emitStatus("unavailable")
        return@addListener
      }
      cameraProvider = provider

      // Preview and analysis MUST agree on aspect ratio. They are separate
      // streams and CameraX is free to pick 4:3 for one and 16:9 for the
      // other; when it does, the crop the preview applies is not the crop
      // the keypoints were measured in, and the skeleton sits a centimetre
      // off the body. Pinning both to 16:9 is what keeps them honest.
      val aspect = AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY
      val previewUseCase = Preview.Builder()
        .setResolutionSelector(ResolutionSelector.Builder().setAspectRatioStrategy(aspect).build())
        .build()
        .also { it.surfaceProvider = previewView.surfaceProvider }

      val analysisUseCase = ImageAnalysis.Builder()
        .setResolutionSelector(
          ResolutionSelector.Builder()
            .setAspectRatioStrategy(aspect)
            // 640x360 is already more than the model's 256x256 input wants;
            // anything larger is pixels converted to a Bitmap and thrown
            // away, which on a Galaxy A12 is the difference between 12 fps
            // and 6.
            .setResolutionStrategy(
              ResolutionStrategy(Size(640, 360), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER),
            )
            .build(),
        )
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
        .build()
        .also { it.setAnalyzer(executor, ::analyze) }

      val selector = if (facing == "back") CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA

      try {
        provider.unbindAll()
        provider.bindToLifecycle(owner, selector, previewUseCase, analysisUseCase)
      } catch (error: Throwable) {
        Log.w(TAG, "could not bind camera", error)
        emitStatus("unavailable")
        return@addListener
      }

      preview = previewUseCase
      analysis = analysisUseCase
      emitStatus("running")
    }, ContextCompat.getMainExecutor(context))
  }

  // MARK: Frames

  private fun analyze(imageProxy: ImageProxy) {
    try {
      val now = SystemClock.uptimeMillis()
      val interval = if (targetFps > 0) (1000.0 / targetFps).toLong() else 0L
      if (now - lastFrameAt < interval) return
      lastFrameAt = now

      val detector = landmarker ?: return
      val upright = imageProxy.toBitmap().rotated(imageProxy.imageInfo.rotationDegrees)

      // MediaPipe rejects a timestamp that does not advance, and
      // `uptimeMillis` can repeat inside one millisecond.
      val timestamp = if (now <= lastTimestamp) lastTimestamp + 1 else now
      lastTimestamp = timestamp

      detector.detectAsync(BitmapImageBuilder(upright).build(), timestamp)
    } catch (error: Throwable) {
      Log.w(TAG, "frame dropped", error)
    } finally {
      imageProxy.close()
    }
  }

  private fun onResult(result: PoseLandmarkerResult, frameW: Int, frameH: Int) {
    val mirrored = facing != "back"
    val points = mutableListOf<Map<String, Any>>()
    val landmarks = result.landmarks().firstOrNull()

    if (landmarks != null) {
      for ((index, key) in Canonical.landmarkMap) {
        val landmark = landmarks.getOrNull(index) ?: continue
        val confidence = landmark.visibility().orElse(0f)
        if (confidence <= 0f) continue
        val point = viewPoint(landmark.x(), landmark.y(), frameW, frameH, mirrored) ?: continue
        points.add(
          mapOf(
            "k" to key,
            "x" to point.first,
            "y" to point.second,
            "c" to confidence.toDouble(),
          ),
        )
      }
    }

    val payload = mapOf(
      "t" to SystemClock.uptimeMillis().toDouble(),
      "points" to points,
      "mirrored" to mirrored,
      "frameWidth" to frameW.toDouble(),
      "frameHeight" to frameH.toDouble(),
    )
    post { onPose(payload) }
  }

  /**
   * Frame-normalized point → view-normalized point, accounting for the crop
   * `FILL_CENTER` applies and for the mirrored preview.
   *
   * The same arithmetic as iOS's `viewPoint`, and for the same reason: the
   * preview fills the view and throws the edges of the frame away, so a
   * keypoint reported as a fraction of the FRAME is not that fraction of the
   * VIEW. Both platforms must agree, or the two halves of the feature
   * disagree about where a shoulder is.
   */
  private fun viewPoint(x: Float, y: Float, frameW: Int, frameH: Int, mirrored: Boolean): Pair<Double, Double>? {
    val vw = viewW.toDouble()
    val vh = viewH.toDouble()
    if (vw <= 0 || vh <= 0 || frameW <= 0 || frameH <= 0) return null

    val scale = maxOf(vw / frameW, vh / frameH)
    val drawnW = frameW * scale
    val drawnH = frameH * scale
    val offsetX = (vw - drawnW) / 2
    val offsetY = (vh - drawnH) / 2
    // The preview is mirrored and the analysed frame is not.
    val frameX = if (mirrored) 1.0 - x else x.toDouble()

    return Pair(
      (frameX * drawnW + offsetX) / vw,
      (y * drawnH + offsetY) / vh,
    )
  }

  private fun emitStatus(state: String) {
    onPoseStatus(mapOf("state" to state))
  }
}

private fun Bitmap.rotated(degrees: Int): Bitmap {
  if (degrees == 0) return this
  val matrix = Matrix().apply { postRotate(degrees.toFloat()) }
  return Bitmap.createBitmap(this, 0, 0, width, height, matrix, true)
}
