#!/usr/bin/env python3
# Find the movements in a thirty-minute session video.
#
# WHY THIS EXISTS. Day 1's reference was assembled by hand: scene-detect the
# video, pull a frame from the middle of every uncut stretch, lay them out in
# a contact sheet, and look. That works, and it does not scale to fourteen
# videos — and most of what the eye is doing is mechanical. A talking head, a
# close-up that crops the body, a full-screen text card and a wide shot of
# somebody exercising are not hard to tell apart from the skeleton alone.
#
# So this proposes; a human still disposes. It prints ranges with the numbers
# behind them, and the operator looks at the frames before anything is built.
# It is deliberately not wired into pose-track.py: picking which movements a
# customer is taught is a judgement, and a script should not make it quietly.
#
# WHAT IT MEASURES, per uncut stretch, sampled a couple of frames a second
# with the fast model:
#   coverage  how often the WHOLE body is visible — kills close-ups, which
#             crop the legs and make the detector invent them
#   stable    whether the camera holds still — the push-in that ruined three
#             of the owner's clips shows up here as the torso changing length
#   motion    how much the joint angles move — separates a demonstration
#             from somebody sitting and explaining
#   posture   median torso angle and knee angle, used to tell one movement
#             from another so the output is five DIFFERENT exercises rather
#             than five takes of the best-lit one
#
# Usage:
#   .venv/bin/python scripts/pick-segments.py video.mp4 --budget 110
#   .venv/bin/python scripts/pick-segments.py video.mp4 --budget 110 --json out.json
import argparse
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# The fast model, not the accurate one pose-track.py uses. This is a triage
# pass over twenty minutes of video per day; the accurate model is for the
# ninety seconds that survive it.
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)
MODEL_PATH = os.path.join(HERE, ".models", "pose_landmarker_lite.task")

CANONICAL = {
    0: "nose", 7: "earL", 8: "earR",
    11: "shoulderL", 12: "shoulderR", 13: "elbowL", 14: "elbowR",
    15: "wristL", 16: "wristR", 23: "hipL", 24: "hipR",
    25: "kneeL", 26: "kneeR", 27: "ankleL", 28: "ankleR",
}

# Every joint an exercise can be scored on must be visible for the whole
# body to count as in frame.
WHOLE_BODY = ["shoulderL", "shoulderR", "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR"]
CONFIDENT = 0.5

SCENE_THRESHOLD = 0.22
SAMPLE_FPS = 2.0


def ensure_model() -> str:
    if os.path.exists(MODEL_PATH):
        return MODEL_PATH
    import urllib.request

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    print("downloading pose_landmarker_lite.task (~6 MB) …", file=sys.stderr)
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


def scene_cuts(path: str) -> list[float]:
    """Hard cuts, from ffmpeg, on a thumbnail-sized copy.

    Cheap and incomplete on purpose: it finds the cuts, and misses the slow
    push-ins, which is what the `stable` measure below is for."""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-an",
         "-vf", f"scale=256:-2,select='gt(scene,{SCENE_THRESHOLD})',metadata=print:file=-",
         "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    times = []
    for line in out.stdout.splitlines():
        if "pts_time:" in line:
            times.append(float(line.split("pts_time:")[1].split()[0]))
    return times


def midpoint(points, a, b):
    if a not in points or b not in points:
        return None
    pa, pb = points[a], points[b]
    return ((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)


def joint_angle(points, a, vertex, b):
    if a not in points or vertex not in points or b not in points:
        return None
    ax, ay = points[a][0] - points[vertex][0], points[a][1] - points[vertex][1]
    bx, by = points[b][0] - points[vertex][0], points[b][1] - points[vertex][1]
    scale = math.hypot(ax, ay) * math.hypot(bx, by)
    if scale < 1e-6:
        return None
    return math.degrees(math.acos(max(-1.0, min(1.0, (ax * bx + ay * by) / scale))))


def torso_tilt(points):
    """0° upright, 90° flat on the floor."""
    neck = midpoint(points, "shoulderL", "shoulderR")
    hips = midpoint(points, "hipL", "hipR")
    if not neck or not hips:
        return None
    return abs(math.degrees(math.atan2(neck[0] - hips[0], hips[1] - neck[1])))


def measure_segment(capture, landmarker, source_fps, start, end, aspect):
    frames = []
    capture.set(cv2.CAP_PROP_POS_FRAMES, int(round(start * source_fps)))
    step = max(1, int(round(source_fps / SAMPLE_FPS)))
    index = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        elapsed = index / source_fps
        if elapsed > end - start:
            break
        if index % step == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect(image)
            points = {}
            if result.pose_landmarks:
                for mp_index, key in CANONICAL.items():
                    landmarks = result.pose_landmarks[0]
                    if mp_index >= len(landmarks):
                        continue
                    landmark = landmarks[mp_index]
                    confidence = getattr(landmark, "visibility", 0.0) or 0.0
                    if confidence < CONFIDENT:
                        continue
                    # x scaled by the aspect so angles are angles and not
                    # whatever shape the frame happens to be.
                    points[key] = (landmark.x * aspect, landmark.y, confidence)
            frames.append(points)
        index += 1
    return frames


def summarize(frames):
    if not frames:
        return None
    whole = sum(1 for f in frames if all(k in f for k in WHOLE_BODY)) / len(frames)

    tilts, knees, hips, shoulders, torsos, mids = [], [], [], [], [], []
    for f in frames:
        tilt = torso_tilt(f)
        if tilt is not None:
            tilts.append(tilt)
        for store, args in (
            (knees, ("hipL", "kneeL", "ankleL")),
            (hips, ("shoulderL", "hipL", "kneeL")),
            (shoulders, ("elbowL", "shoulderL", "hipL")),
        ):
            angle = joint_angle(f, *args)
            if angle is not None:
                store.append(angle)
        neck = midpoint(f, "shoulderL", "shoulderR")
        hip = midpoint(f, "hipL", "hipR")
        if neck and hip:
            mids.append(neck)
            torsos.append(math.hypot(neck[0] - hip[0], neck[1] - hip[1]))

    if not tilts or not knees:
        return None

    # The camera, not the customer: a shoulder midpoint that wanders, or a
    # torso that changes length, across a stretch that should be one shot.
    stable = True
    if len(mids) > 2:
        xs = [m[0] for m in mids]
        ys = [m[1] for m in mids]
        drift = math.hypot(max(xs) - min(xs), max(ys) - min(ys))
        scale = (max(torsos) - min(torsos)) / max(1e-6, float(np.median(torsos)))
        stable = drift < 0.18 and scale < 0.30

    motion = float(np.std(knees)) + float(np.std(shoulders or [0.0]))
    return {
        "coverage": round(whole, 2),
        "stable": stable,
        "motion": round(motion, 1),
        "tilt": round(float(np.median(tilts)), 1),
        "knee": round(float(np.median(knees)), 1),
        "hip": round(float(np.median(hips or [0.0])), 1),
        "shoulder": round(float(np.median(shoulders or [0.0])), 1),
    }


def distinct(candidate, chosen):
    """Is this a different movement from everything already picked?

    Four numbers, and a candidate only counts as a repeat when ALL of them
    match something already chosen. The hip angle is in there because
    leaving it out cost real material: a leg raise and a flat slide are both
    "lying down, legs straight, moving a lot", and the first version
    discarded the leg raise as a duplicate of the slide. What separates them
    is the hip — about 90° with a leg in the air, about 170° with it on the
    floor."""
    gaps = {"knee": 18.0, "hip": 25.0, "tilt": 20.0, "motion": 8.0}
    for other in chosen:
        if all(abs(candidate[key] - other[key]) < gap for key, gap in gaps.items()):
            return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Propose the exercise ranges in a session video.")
    parser.add_argument("input")
    parser.add_argument("--budget", type=float, default=110.0, help="seconds the reference may total")
    parser.add_argument("--slice", type=float, default=24.0, help="longest piece taken from one stretch")
    parser.add_argument("--min", type=float, default=14.0, help="ignore stretches shorter than this")
    parser.add_argument("--coverage", type=float, default=0.8, help="how often the whole body must be visible")
    parser.add_argument(
        "--min-tilt",
        type=float,
        default=55.0,
        help=(
            "how far from upright the torso must be, in degrees. Every TheraNECK exercise is "
            "done lying down — the device goes under the neck — so an upright torso is the "
            "specialist SITTING AND TALKING, which is the one thing a demonstration must not "
            "be. Set it to 0 for a programme with seated exercises, and check what comes back."
        ),
    )
    parser.add_argument("--json", help="write the chosen ranges here")
    args = parser.parse_args()

    capture = cv2.VideoCapture(args.input)
    source_fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width = capture.get(cv2.CAP_PROP_FRAME_WIDTH)
    height = capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
    total = capture.get(cv2.CAP_PROP_FRAME_COUNT) / source_fps
    aspect = width / height

    cuts = scene_cuts(args.input)
    bounds = [0.0] + cuts + [total]
    stretches = [
        (bounds[i], bounds[i + 1])
        for i in range(len(bounds) - 1)
        if bounds[i + 1] - bounds[i] >= args.min
    ]
    print(f"{len(cuts)} cuts, {len(stretches)} stretches of {args.min:.0f}s or more", file=sys.stderr)

    # IMAGE mode, not VIDEO. Windows overlap, so the timestamps a VIDEO
    # landmarker demands would have to go backwards — and frame-to-frame
    # tracking buys nothing at two samples a second anyway.
    landmarker = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=ensure_model()),
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
        )
    )

    # WINDOWS, not whole stretches. The first version measured each uncut
    # stretch as one thing and took a slice from its middle, which quietly
    # destroyed the best material: day 1 has an 87-second stretch holding
    # three different movements, whose average is a posture that occurs in
    # none of them, and whose middle straddles two. Sliding a window of the
    # length we actually intend to take means every candidate is measured as
    # the piece it would become.
    step = args.slice / 1.5
    scored = []
    for start, end in stretches:
        # Trim the ends: a dissolve from the previous shot often bleeds in.
        inner_start = start + min(1.5, (end - start) * 0.1)
        inner_end = end - min(1.5, (end - start) * 0.1)
        position = inner_start
        while position + min(args.slice, 10) <= inner_end:
            window_end = min(position + args.slice, inner_end)
            summary = summarize(measure_segment(capture, landmarker, source_fps, position, window_end, aspect))
            if summary:
                summary.update({"start": round(position, 1), "end": round(window_end, 1),
                                "length": round(window_end - position, 1)})
                scored.append(summary)
            position += step
    capture.release()

    usable = [
        s for s in scored
        if s["coverage"] >= args.coverage and s["stable"] and s["tilt"] >= args.min_tilt
    ]
    # Most movement first — a demonstration beats somebody holding a pose,
    # and if the budget runs out it should run out on the dullest one — but
    # length breaks near-ties, because a longer piece of the same movement
    # teaches it better.
    usable.sort(key=lambda s: -(s["motion"] + s["length"] * 0.3))

    def overlaps(candidate):
        return any(
            candidate["start"] < other["take_end"] and other["take_start"] < candidate["end"]
            for other in chosen
        )

    chosen = []
    budget = args.budget
    for candidate in usable:
        if budget <= 8:
            break
        # Windows overlap by design, so neighbours of a good one are good
        # too — and are the same few seconds of video.
        if overlaps(candidate) or not distinct(candidate, chosen):
            continue
        take = min(args.slice, candidate["length"], budget)
        if take < 8:
            continue
        middle = (candidate["start"] + candidate["end"]) / 2
        candidate = dict(candidate, take_start=round(middle - take / 2, 1), take_end=round(middle + take / 2, 1))
        chosen.append(candidate)
        budget -= take

    chosen.sort(key=lambda s: s["take_start"])

    upright = sum(1 for s in scored if s["tilt"] < args.min_tilt)
    print(
        f"\n{len(scored)} windows measured, {upright} upright (talking), "
        f"{len(usable)} usable, {len(chosen)} chosen\n"
    )
    print("   range            take        len  cover  motion  tilt  knee")
    for c in chosen:
        print(f"  {c['take_start']:7.1f}–{c['take_end']:7.1f}s  "
              f"{int(c['take_start']//60):02d}:{c['take_start']%60:04.1f}  "
              f"{c['take_end']-c['take_start']:5.1f}  {c['coverage']:5.2f}  "
              f"{c['motion']:6.1f}  {c['tilt']:4.0f}  {c['knee']:4.0f}")
    segments = ",".join(f"{c['take_start']}-{c['take_end']}" for c in chosen)
    print(f"\ntotal {sum(c['take_end'] - c['take_start'] for c in chosen):.0f}s")
    print(f"--segments \"{segments}\"")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump({"input": os.path.basename(args.input), "chosen": chosen, "segments": segments}, handle, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
