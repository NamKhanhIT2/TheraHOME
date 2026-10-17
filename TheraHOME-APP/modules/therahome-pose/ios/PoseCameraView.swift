import AVFoundation
import ExpoModulesCore
import Vision

// A camera preview that also says where the body is.
//
// One view rather than "a camera library plus a pose library" because the
// two halves have to agree about geometry down to the pixel: the skeleton is
// drawn ON TOP of this preview, so a keypoint that is right in the frame's
// coordinates and wrong in the view's coordinates lands on the customer's
// ear instead of their shoulder. Owning both ends means the conversion
// happens once, here, where the real numbers are (see `viewPoint`).
//
// Pose comes from Apple's Vision. No model file, no pod, nothing added to
// the binary — see the podspec for why that mattered more than matching
// Android's model exactly.
final class PoseCameraView: ExpoView {
  // MARK: Events

  /// Every processed frame, at roughly `targetFps`. Fires with an empty
  /// `points` array when nobody is found, which is information the UI needs
  /// ("step back into frame") rather than something to swallow.
  let onPose = EventDispatcher()

  /// State changes only: running, stopped, denied, unavailable. Not an error
  /// channel — a phone with no camera permission is a thing to explain, not
  /// a crash.
  let onPoseStatus = EventDispatcher()

  // MARK: Props

  var isActive = false {
    didSet { if isActive != oldValue { applyState() } }
  }

  var facing = "front" {
    didSet { if facing != oldValue { applyState(reconfigure: true) } }
  }

  /// Frames per second handed to Vision, not frames captured. The camera
  /// runs at 30; anything past ~15 buys nothing a human can see in a
  /// skeleton overlay and costs battery and heat on a cheap handset.
  var targetFps: Double = 12

  // MARK: Private

  private let session = AVCaptureSession()
  private let previewLayer: AVCaptureVideoPreviewLayer
  private let videoOutput = AVCaptureVideoDataOutput()
  private let request = VNDetectHumanBodyPoseRequest()

  /// Session mutation is serialized off the main thread: `startRunning()`
  /// blocks for a few hundred milliseconds on a cold camera, and on the main
  /// thread that is a visible freeze in the middle of a screen transition.
  private let sessionQueue = DispatchQueue(label: "ai.therahome.pose.session")
  private let frameQueue = DispatchQueue(label: "ai.therahome.pose.frames")

  private var configuredFacing: String?
  private var lastFrameAt: CFTimeInterval = 0

  /// The frame callback needs the view's size to map keypoints into view
  /// space, and it runs on `frameQueue` while `layoutSubviews` writes from
  /// the main thread. One lock around two floats is cheaper than bouncing
  /// every frame through the main queue.
  private let sizeLock = NSLock()
  private var cachedSize: CGSize = .zero

  required init(appContext: AppContext? = nil) {
    previewLayer = AVCaptureVideoPreviewLayer(session: session)
    super.init(appContext: appContext)

    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
    backgroundColor = .black

    videoOutput.alwaysDiscardsLateVideoFrames = true
    videoOutput.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
    ]
    videoOutput.setSampleBufferDelegate(self, queue: frameQueue)
  }

  deinit {
    // The view can go away without `isActive` ever being set back to false
    // (a back-swipe unmounts it mid-session). A session left running holds
    // the camera and the orange indicator stays lit over an app that is not
    // looking at anything.
    let session = self.session
    DispatchQueue.global(qos: .userInitiated).async {
      if session.isRunning { session.stopRunning() }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
    sizeLock.lock()
    cachedSize = bounds.size
    sizeLock.unlock()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    // Leaving the screen stops the camera even if the view object survives
    // in a navigation cache.
    if window == nil {
      sessionQueue.async { [weak self] in self?.stop() }
    } else {
      applyState()
    }
  }

  // MARK: Session

  private func applyState(reconfigure: Bool = false) {
    let shouldRun = isActive && window != nil
    sessionQueue.async { [weak self] in
      guard let self else { return }
      if shouldRun {
        if reconfigure { self.stop() }
        self.start()
      } else {
        self.stop()
      }
    }
  }

  private func start() {
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      emitStatus("denied")
      return
    }
    if configuredFacing != facing {
      guard configure(for: facing) else {
        emitStatus("unavailable")
        return
      }
      configuredFacing = facing
    }
    guard !session.isRunning else { return }
    session.startRunning()
    emitStatus("running")
  }

  private func stop() {
    guard session.isRunning else { return }
    session.stopRunning()
    emitStatus("stopped")
  }

  private func configure(for facing: String) -> Bool {
    let position: AVCaptureDevice.Position = facing == "back" ? .back : .front
    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
          let input = try? AVCaptureDeviceInput(device: device) else {
      return false
    }

    session.beginConfiguration()

    // 720p: enough detail for Vision to find a shoulder, and a quarter of
    // the pixels of the 1080p the camera would otherwise hand over.
    session.sessionPreset = session.canSetSessionPreset(.hd1280x720) ? .hd1280x720 : .high

    for existing in session.inputs { session.removeInput(existing) }
    guard session.canAddInput(input) else {
      session.commitConfiguration()
      return false
    }
    session.addInput(input)

    if !session.outputs.contains(videoOutput) {
      guard session.canAddOutput(videoOutput) else {
        session.commitConfiguration()
        return false
      }
      session.addOutput(videoOutput)
    }

    // Commit BEFORE touching the connections.
    //
    // A connection is formed by the session, and the shape it ends up with
    // is only settled once the configuration is committed. Reading
    // `videoOutput.connection(with: .video)` between begin and commit is
    // reading a half-built object — at best it answers nil and the
    // orientation below is silently never applied, which would hand Vision
    // a landscape buffer and hang the skeleton sideways off the body.
    session.commitConfiguration()

    // The app is portrait-locked (app.json `orientation: "portrait"`), so
    // the connection can simply be told portrait rather than tracking
    // device rotation. If that ever changes, this is the line that has to
    // learn about `AVCaptureDevice.RotationCoordinator` — and the crop maths
    // in `viewPoint` has to learn with it.
    let mirrored = position == .front
    for connection in [videoOutput.connection(with: .video), previewLayer.connection] {
      guard let connection else { continue }
      if connection.isVideoOrientationSupported {
        connection.videoOrientation = .portrait
      }
    }

    // ONLY the preview is mirrored, and only for the front camera: a selfie
    // view that does not behave like a mirror is disorienting to copy a
    // movement in.
    //
    // The frames handed to Vision stay unmirrored on purpose. Vision labels
    // joints anatomically — it decides which shoulder is the LEFT one from
    // how the body looks — and a mirrored person reads as having swapped
    // sides, so the labels come back inverted and the app paints the wrong
    // arm red. Feeding it the real image and flipping x afterwards (see
    // `viewPoint`) costs nothing and cannot be wrong about anatomy.
    if let preview = previewLayer.connection, preview.isVideoMirroringSupported {
      preview.automaticallyAdjustsVideoMirroring = false
      preview.isVideoMirrored = mirrored
    }
    if let analysis = videoOutput.connection(with: .video), analysis.isVideoMirroringSupported {
      analysis.automaticallyAdjustsVideoMirroring = false
      analysis.isVideoMirrored = false
    }

    return true
  }

  private func emitStatus(_ state: String) {
    DispatchQueue.main.async { [weak self] in
      self?.onPoseStatus(["state": state])
    }
  }

  // MARK: Geometry

  /// Vision's normalized point (origin bottom-left of the frame) → this
  /// view's normalized point (origin top-left), accounting for the crop
  /// `resizeAspectFill` applies.
  ///
  /// This is the conversion the whole module exists to get right. The
  /// preview fills the view and therefore throws away the edges of the
  /// frame; a keypoint reported as a fraction of the FRAME is not the same
  /// fraction of the VIEW, and the difference is tens of pixels — enough to
  /// hang a shoulder marker in mid-air.
  private func viewPoint(x: CGFloat, y: CGFloat, frame size: CGSize, mirrored: Bool) -> CGPoint? {
    sizeLock.lock()
    let view = cachedSize
    sizeLock.unlock()
    guard view.width > 0, view.height > 0, size.width > 0, size.height > 0 else { return nil }

    let scale = max(view.width / size.width, view.height / size.height)
    let drawnWidth = size.width * scale
    let drawnHeight = size.height * scale
    let offsetX = (view.width - drawnWidth) / 2
    let offsetY = (view.height - drawnHeight) / 2
    // The preview is mirrored and these frames are not, so the x the
    // detector reports is the x of the real room, not of the picture on
    // screen. The crop is horizontally symmetric, so flipping here is the
    // same as having flipped the pixels.
    let frameX = mirrored ? 1 - x : x

    return CGPoint(
      x: (frameX * drawnWidth + offsetX) / view.width,
      // Vision counts up from the bottom; UIKit, and every drawing API
      // above this, counts down from the top.
      y: ((1 - y) * drawnHeight + offsetY) / view.height
    )
  }
}

extension PoseCameraView: AVCaptureVideoDataOutputSampleBufferDelegate {
  func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    let now = CACurrentMediaTime()
    let interval = targetFps > 0 ? 1.0 / targetFps : 0
    guard now - lastFrameAt >= interval else { return }
    lastFrameAt = now

    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    let size = CGSize(
      width: CGFloat(CVPixelBufferGetWidth(pixelBuffer)),
      height: CGFloat(CVPixelBufferGetHeight(pixelBuffer))
    )

    // `.up`: the connection above already rotated the buffer to portrait,
    // so there is no orientation left for Vision to undo.
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return
    }

    let mirrored = (configuredFacing ?? facing) != "back"
    var points: [[String: Any]] = []

    if let observation = request.results?.first as? VNHumanBodyPoseObservation,
       let recognized = try? observation.recognizedPoints(.all) {
      for (joint, key) in visionJointMap {
        guard let point = recognized[joint], point.confidence > 0 else { continue }
        guard let converted = viewPoint(
          x: point.location.x,
          y: point.location.y,
          frame: size,
          mirrored: mirrored
        ) else { continue }
        points.append([
          "k": key,
          "x": converted.x,
          "y": converted.y,
          "c": CGFloat(point.confidence),
        ])
      }
    }

    let payload: [String: Any] = [
      "t": now * 1000,
      "points": points,
      "mirrored": mirrored,
      "frameWidth": size.width,
      "frameHeight": size.height,
    ]
    DispatchQueue.main.async { [weak self] in
      self?.onPose(payload)
    }
  }
}
