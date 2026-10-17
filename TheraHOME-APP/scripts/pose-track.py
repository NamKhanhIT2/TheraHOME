#!/usr/bin/env python3
# Turn a specialist's demo clip into the keypoint track the app compares
# customers against.
#
# WHY THIS IS OFFLINE. The app could run a second detector on the reference
# video at the same time as the customer's camera, and it would be wrong
# twice over: it would double the per-frame cost on the cheapest phone we
# support, and it would make the "correct" answer slightly different every
# time the clip played. Computing it once, here, on a Mac, with the slow
# accurate model, means every customer is measured against the same ruler.
#
# WHAT IT PRODUCES
#   • a .json track: the eleven canonical points, sampled at a fixed rate,
#     normalized 0..1 against the clip's own frame.
#   • optionally a .mp4 with the skeleton burned in, so a human can SEE
#     whether the detector understood the movement before anyone ships it.
#     Always look at this. A track that is quietly wrong for two seconds in
#     the middle will tell a customer their perfectly good form is bad.
#
# SETUP (once)
#   uv venv .venv && uv pip install --python .venv/bin/python mediapipe opencv-python numpy
#
# USE
#   .venv/bin/python scripts/pose-track.py "clip.mp4" --out track.json --qc qc.mp4
#   .venv/bin/python scripts/pose-track.py "clip.mp4" --out track.json --start 0 --end 5.2
#
# THE CLIP HAS TO COOPERATE. The detector is good; framing is what breaks
# tracks in practice. One continuous shot, camera on a tripod, no zoom, no
# cut, whole body in frame for the whole clip, and the specialist in the
# same plane as the camera. `--start/--end` exist because an edited clip
# usually contains exactly one usable shot; the script detects the cuts and
# tells you where they are.
import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# The offline model is the FULL variant, not the `lite` one the phones run.
# Accuracy is free here — this runs once, on a Mac, and nobody is waiting —
# and the reference track is the thing everything else is measured against,
# so it should be the best reading we can take.
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_full/float16/latest/pose_landmarker_full.task"
)
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".models")
MODEL_PATH = os.path.join(MODEL_DIR, "pose_landmarker_full.task")

# MediaPipe landmark index -> canonical key. Must stay identical to
# modules/therahome-pose/android/.../Canonical.kt and to the Vision mapping
# in .../ios/PoseCanonical.swift: this is the contract that lets a track
# computed here be compared with a skeleton measured on a phone.
CANONICAL = {
    0: "nose",
    7: "earL",
    8: "earR",
    11: "shoulderL",
    12: "shoulderR",
    13: "elbowL",
    14: "elbowR",
    15: "wristL",
    16: "wristR",
    23: "hipL",
    24: "hipR",
    25: "kneeL",
    26: "kneeR",
    27: "ankleL",
    28: "ankleR",
}

EDGES = [
    ("earL", "shoulderL"),
    ("earR", "shoulderR"),
    ("shoulderL", "shoulderR"),
    ("shoulderL", "elbowL"),
    ("elbowL", "wristL"),
    ("shoulderR", "elbowR"),
    ("elbowR", "wristR"),
    ("shoulderL", "hipL"),
    ("shoulderR", "hipR"),
    ("hipL", "hipR"),
    ("hipL", "kneeL"),
    ("kneeL", "ankleL"),
    ("hipR", "kneeR"),
    ("kneeR", "ankleR"),
]

# The same white, the same proportions and the same confidence rule as the
# app's PoseSkeleton (src/components/pose/PoseSkeleton.tsx and the
# POSE_STYLE constants in src/lib/pose.ts). The QC render is what a human
# approves a track on, so it must look like what the customer will see —
# a prettier or a cruder drawing here would be reviewing the wrong thing.
WHITE = (255, 255, 255)
HALO = (0, 0, 0)
WEAK = (178, 164, 154)     # #9AA4B2 in BGR

# The bones the app actually draws for each kind of camera: the ones
# carrying an angle it scores. Mirrors `edgesFor` in src/lib/poseCompare.ts
# — the two are one decision in two languages, so a change to the measure
# sets there belongs here too.
SCORED_EDGES = {
    "front": {
        ("earL", "shoulderL"), ("earR", "shoulderR"), ("shoulderL", "shoulderR"),
        ("shoulderL", "hipL"), ("shoulderR", "hipR"),
        ("shoulderL", "elbowL"), ("shoulderR", "elbowR"),
        ("elbowL", "wristL"), ("elbowR", "wristR"),
    },
    "side": {
        ("earL", "shoulderL"), ("earR", "shoulderR"),
        ("shoulderL", "hipL"), ("shoulderR", "hipR"),
        ("shoulderL", "elbowL"), ("shoulderR", "elbowR"),
        ("elbowL", "wristL"), ("elbowR", "wristR"),
        ("hipL", "kneeL"), ("hipR", "kneeR"),
        ("kneeL", "ankleL"), ("kneeR", "ankleR"),
    },
}
DOT_RATIO = 0.0065
LINE_RATIO = 0.0026
CONFIDENT = 0.5
# A limb the camera cannot see is not drawn at all. The detector still
# returns plausible coordinates for the far arm in a side-on exercise, and
# a faint line running through the torso reads as the feature being broken.
HIDDEN = 0.3

# What counts as the camera moving rather than the body moving.
#
# Measured on the SKELETON, not on the pixels. A histogram comparison was
# the first attempt and it missed the thing it was written to catch: the
# first real clip contained a one-second push-in, which changes the picture
# gradually enough to stay under any sane pixel threshold while changing the
# body's size on screen by half. The skeleton cannot hide that — the torso
# simply gets 50% longer — and the same two numbers also catch hard cuts and
# the detector losing the person altogether.
#
# A shoulder midpoint that moves more than 3% of the frame in one sample
# (at 15fps) is a body that teleported; a torso that changes length by more
# than 12% between samples is the camera, not the customer.
JUMP_THRESHOLD = 0.03
SCALE_THRESHOLD = 0.12


def ensure_model() -> str:
    if os.path.exists(MODEL_PATH):
        return MODEL_PATH
    os.makedirs(MODEL_DIR, exist_ok=True)
    print(f"downloading {os.path.basename(MODEL_PATH)} (~9 MB) …", file=sys.stderr)
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


def midpoint(points: dict, a: str, b: str):
    left, right = points.get(a), points.get(b)
    if not left or not right:
        return None
    return ((left[0] + right[0]) / 2, (left[1] + right[1]) / 2)


def unstable_moments(samples: list[dict]) -> list[float]:
    """Seconds at which the camera moved, cut, or lost the person.

    Returned so the operator can pick a range INSIDE one shot. A track that
    spans a cut is nonsense: the body teleports, and every angle it feeds
    the app is measured against a different camera."""
    moments: list[float] = []
    previous_mid = None
    previous_torso = None
    for sample in samples:
        shoulders = midpoint(sample["p"], "shoulderL", "shoulderR")
        hips = midpoint(sample["p"], "hipL", "hipR")
        torso = None
        if shoulders and hips:
            torso = ((shoulders[0] - hips[0]) ** 2 + (shoulders[1] - hips[1]) ** 2) ** 0.5

        suspect = False
        if previous_mid and shoulders:
            jump = ((shoulders[0] - previous_mid[0]) ** 2 + (shoulders[1] - previous_mid[1]) ** 2) ** 0.5
            suspect = jump > JUMP_THRESHOLD
        if torso and previous_torso and previous_torso > 0:
            suspect = suspect or abs(torso - previous_torso) / previous_torso > SCALE_THRESHOLD
        if not sample["p"]:
            suspect = True
        if suspect:
            moments.append(sample["t"] / 1000.0)

        previous_mid = shoulders or previous_mid
        previous_torso = torso or previous_torso
    return moments


def group(moments: list[float], gap: float = 0.5) -> list[tuple[float, float]]:
    """Consecutive unstable samples are one event, not twenty."""
    spans: list[tuple[float, float]] = []
    for moment in moments:
        if spans and moment - spans[-1][1] <= gap:
            spans[-1] = (spans[-1][0], moment)
        else:
            spans.append((moment, moment))
    return spans


def smooth(samples: list[dict], window: int = 3) -> None:
    """Centred moving average, per point, in place.

    The detector jitters by a pixel or two even on a motionless body, and
    that jitter becomes a wobbling joint ANGLE, which is what the app
    actually compares. Three samples is enough to settle it without rounding
    off the ends of a real movement."""
    if window < 3 or len(samples) < window:
        return
    half = window // 2
    originals = [dict(s["p"]) for s in samples]
    for i, sample in enumerate(samples):
        for key in list(sample["p"].keys()):
            xs, ys, cs = [], [], []
            for j in range(max(0, i - half), min(len(samples), i + half + 1)):
                point = originals[j].get(key)
                if point:
                    xs.append(point[0])
                    ys.append(point[1])
                    cs.append(point[2])
            if xs:
                sample["p"][key] = [
                    # Three decimals is a thousandth of the frame — about a
                    # pixel and a half on a 1280-wide clip, well under what
                    # the detector itself wobbles by. A fourth decimal is
                    # bytes spent on noise.
                    round(float(np.mean(xs)), 3),
                    round(float(np.mean(ys)), 3),
                    round(float(np.mean(cs)), 2),
                ]


def parse_segments(text: str) -> list[tuple[float, float]]:
    """`"690-710,1130-1154"` → [(690.0, 710.0), (1130.0, 1154.0)]."""
    segments = []
    for part in text.split(","):
        piece = part.strip()
        if not piece:
            continue
        a, _, b = piece.partition("-")
        segments.append((float(a), float(b)))
    return segments


def cut_clip(source: str, segments: list[tuple[float, float]], out: str) -> None:
    """The video the customer sees, cut to the same ranges as the track.

    ffmpeg rather than OpenCV because the specialist is TALKING: the app
    plays this with sound, and OpenCV's writer has no idea audio exists.

    Each range is re-encoded before being joined, which costs a minute and
    buys frame-accurate starts — a concat of copied streams starts each
    range at the nearest keyframe instead, which can be a second early.
    Even so the join is only accurate to within a frame of what this script
    measured, and that is fine: the comparison matches across a ±600ms
    window, twenty times that."""
    import subprocess
    import tempfile

    with tempfile.TemporaryDirectory() as work:
        parts = []
        for index, (a, b) in enumerate(segments):
            part = os.path.join(work, f"{index:02d}.mp4")
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-ss", f"{a}", "-to", f"{b}", "-i", source,
                 # 960 wide, or the source's own width if it is narrower:
                 # the pane is a few hundred points across on a phone, so
                 # 720p was sending pixels nobody can see — and upscaling a
                 # 480p source to 960 would spend bytes inventing them.
                 # (Day 13's video would only download at 480p.) The aspect
                 # ratio is unchanged either way, which is all the track
                 # cares about: it stores the SOURCE frame size and only
                 # ever uses the ratio.
                 "-vf", "scale='min(960,iw)':-2",
                 "-c:v", "libx264", "-crf", "25", "-preset", "medium", "-pix_fmt", "yuv420p",
                 "-c:a", "aac", "-b:a", "80k", "-ar", "44100", "-ac", "1", part],
                check=True,
            )
            parts.append(part)
        listing = os.path.join(work, "list.txt")
        with open(listing, "w", encoding="utf-8") as handle:
            for part in parts:
                handle.write(f"file '{part}'\n")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing,
             "-c", "copy", out],
            check=True,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a reference keypoint track from a demo clip.")
    parser.add_argument("input")
    parser.add_argument("--out", required=True, help="where to write the .json track")
    parser.add_argument("--qc", help="also write an .mp4 with the skeleton drawn on it")
    parser.add_argument("--clip-out", help="also cut the clip itself, to exactly the same ranges")
    parser.add_argument("--fps", type=float, default=15.0, help="samples per second (default 15)")
    parser.add_argument("--start", type=float, default=0.0, help="seconds into the clip to start")
    parser.add_argument("--end", type=float, default=None, help="seconds into the clip to stop")
    parser.add_argument(
        "--segments",
        help=(
            "several ranges joined end to end, e.g. 690-710,1130-1154. For a session video "
            "that demonstrates one movement after another: each range is checked for camera "
            "movement ON ITS OWN, so the joins between them are not mistaken for a cut."
        ),
    )
    parser.add_argument(
        "--view",
        choices=["front", "side"],
        default="front",
        help="how the specialist is filmed; decides which angles the app scores",
    )
    parser.add_argument("--label", default="", help="human name for this exercise, stored in the track")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"no such file: {args.input}", file=sys.stderr)
        return 1

    capture = cv2.VideoCapture(args.input)
    source_fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = capture.get(cv2.CAP_PROP_FRAME_COUNT) / source_fps if source_fps else 0

    segments = parse_segments(args.segments) if args.segments else [(args.start, args.end if args.end is not None else total)]

    writer = None
    if args.qc:
        writer = cv2.VideoWriter(args.qc, cv2.VideoWriter_fourcc(*"mp4v"), source_fps, (width, height))

    model = ensure_model()
    samples: list[dict] = []
    missing = 0
    offset_ms = 0.0
    spans_by_segment: list[tuple[int, list[tuple[float, float]]]] = []

    for number, (seg_start, seg_end) in enumerate(segments, 1):
        # A landmarker of its own per range. In VIDEO mode the model tracks
        # a body from frame to frame, and carrying that state across a join
        # would have it looking for the previous exercise's pose in the
        # first frames of the next one.
        landmarker = vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=mp_python.BaseOptions(model_asset_path=model),
                running_mode=vision.RunningMode.VIDEO,
                num_poses=1,
                min_pose_detection_confidence=0.5,
                min_pose_presence_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        )

        first_frame = int(round(seg_start * source_fps))
        capture.set(cv2.CAP_PROP_POS_FRAMES, first_frame)
        segment_samples: list[dict] = []
        next_sample = 0.0
        interval = 1.0 / args.fps
        last_points: dict[str, list[float]] = {}
        index = 0

        while True:
            ok, frame = capture.read()
            if not ok:
                break
            elapsed = index / source_fps
            index += 1
            if elapsed > seg_end - seg_start:
                break

            if elapsed + 1e-6 >= next_sample:
                next_sample += interval
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                # The OUTPUT timeline, so timestamps rise across joins even
                # if the ranges were given out of order.
                result = landmarker.detect_for_video(image, int(round(offset_ms + elapsed * 1000)))

                points: dict[str, list[float]] = {}
                if result.pose_landmarks:
                    landmarks = result.pose_landmarks[0]
                    for mp_index, key in CANONICAL.items():
                        if mp_index >= len(landmarks):
                            continue
                        landmark = landmarks[mp_index]
                        confidence = getattr(landmark, "visibility", 0.0) or 0.0
                        # Below POSE_HIDDEN the app neither draws the joint
                        # nor measures any angle through it — it is a guess
                        # about a limb the camera cannot see. Storing it
                        # would be paying to send something nothing reads.
                        if confidence < HIDDEN:
                            continue
                        points[key] = [round(landmark.x, 3), round(landmark.y, 3), round(confidence, 2)]
                if not points:
                    missing += 1
                last_points = points
                segment_samples.append({"t": round(elapsed * 1000, 1), "p": points})

            if writer is not None:
                draw(frame, last_points, width, height, args.view)
                writer.write(frame)

        if not segment_samples:
            print(f"no frames in range {seg_start}-{seg_end}", file=sys.stderr)
            return 1

        # Smoothed and checked WITHIN the range: a join is a deliberate cut,
        # not a camera that wandered, and must not be reported as one.
        smooth(segment_samples)
        spans = group(unstable_moments(segment_samples))
        if spans:
            spans_by_segment.append((number, [(a + seg_start, b + seg_start) for a, b in spans]))

        for sample in segment_samples:
            samples.append({"t": round(offset_ms + sample["t"], 1), "p": sample["p"]})
        offset_ms += (seg_end - seg_start) * 1000

    capture.release()
    if writer is not None:
        writer.release()

    if spans_by_segment:
        lines = []
        for number, spans in spans_by_segment:
            where = ", ".join(f"{a:.1f}s" if a == b else f"{a:.1f}–{b:.1f}s" for a, b in spans)
            lines.append(f"         range {number}: {where}")
        print(
            "WARNING: the camera moves, cuts or loses the person inside a range —\n"
            + "\n".join(lines)
            + "\n         Each range must be ONE continuous shot with the whole body in\n"
            "         frame. Narrow the range, or pick another.",
            file=sys.stderr,
        )

    duration = (samples[-1]["t"] + 1000.0 / args.fps) / 1000.0
    track = {
        "version": 1,
        "label": args.label or os.path.splitext(os.path.basename(args.input))[0],
        "source": os.path.basename(args.input),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "view": args.view,
        "fps": args.fps,
        "duration": round(duration, 3),
        "frameWidth": width,
        "frameHeight": height,
        # Where each piece came from in the source, so a track can be
        # rebuilt or audited without guessing.
        "segments": [{"start": a, "end": b} for a, b in segments],
        "samples": samples,
    }
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(track, handle, ensure_ascii=False, separators=(",", ":"))

    if args.clip_out:
        cut_clip(args.input, segments, args.clip_out)

    size_kb = os.path.getsize(args.out) / 1024
    found = len(samples) - missing
    print(
        f"{len(samples)} samples over {duration:.1f}s from {len(segments)} range(s) "
        f"→ {args.out} ({size_kb:.0f} KB)\n"
        f"body found in {found}/{len(samples)} samples"
        + (f"  ← {missing} BLANK, check the QC video" if missing else "")
    )
    if args.clip_out:
        print(f"clip: {args.clip_out} ({os.path.getsize(args.clip_out) / 1048576:.1f} MB, with sound)")
    if args.qc:
        print(f"QC video: {args.qc} — watch it before publishing this track")
    return 0


def draw(frame, points: dict[str, list[float]], width: int, height: int, view: str) -> None:
    """Draws what the customer will see, plus what they will not.

    Scored bones are drawn exactly as the app draws them — white, haloed,
    at the app's own proportions. The rest of the skeleton is drawn faint,
    because this is the picture somebody APPROVES a track on and a joint
    going wrong outside the scored set is still a sign the track is bad."""
    dot = max(3, int(round(width * DOT_RATIO)))
    line = max(2, int(round(width * LINE_RATIO)))
    halo = max(line + 2, int(round(line * 2.6)))
    scored = SCORED_EDGES.get(view, SCORED_EDGES["front"])

    def xy(key: str):
        point = points.get(key)
        if not point:
            return None
        return int(point[0] * width), int(point[1] * height)

    def visible(a: str, b: str) -> bool:
        return a in points and b in points and points[a][2] >= HIDDEN and points[b][2] >= HIDDEN

    # Anything faint goes on a separate layer blended back, which is how the
    # app draws it (SVG `opacity`) and OpenCV has no alpha.
    faint = frame.copy()
    joints: set[str] = set()

    # Halos first, under everything, or white vanishes against a white wall.
    for a, b in EDGES:
        if (a, b) not in scored or not visible(a, b):
            continue
        cv2.line(frame, xy(a), xy(b), HALO, halo, cv2.LINE_AA)
        joints.update((a, b))
    for key in joints:
        cv2.circle(frame, xy(key), int(dot * 1.5), HALO, -1, cv2.LINE_AA)

    for a, b in EDGES:
        if not visible(a, b):
            continue
        # A limb is only as trustworthy as its worse end.
        weak = points[a][2] < CONFIDENT or points[b][2] < CONFIDENT
        if (a, b) in scored and not weak:
            cv2.line(frame, xy(a), xy(b), WHITE, line, cv2.LINE_AA)
        else:
            cv2.line(faint, xy(a), xy(b), WEAK if weak else WHITE, line, cv2.LINE_AA)

    for key, point in points.items():
        position = xy(key)
        if not position or point[2] < HIDDEN:
            continue
        weak = point[2] < CONFIDENT
        if key in joints and not weak:
            cv2.circle(frame, position, dot, WHITE, -1, cv2.LINE_AA)
        else:
            cv2.circle(faint, position, dot, WEAK if weak else WHITE, -1, cv2.LINE_AA)

    cv2.addWeighted(faint, 0.40, frame, 0.60, 0, frame)


if __name__ == "__main__":
    sys.exit(main())
