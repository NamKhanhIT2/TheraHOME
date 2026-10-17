// The camera view, with its events unwrapped.
//
// WHY THIS FILE EXISTS. A view made with `requireNativeView` delivers its
// events the React Native way — `{ nativeEvent: payload }` — and every Expo
// package unwraps that before handing the payload to the app
// (`expo-image`'s `onLoad` does exactly this). The first version of this
// feature did not, so `frame.points` was `undefined`, the screen called
// `.filter` on it, and the app was killed by the unhandled error the
// instant the first frame arrived. It looked exactly like a native camera
// crash and was a one-line JavaScript mistake.
//
// So the unwrapping lives here, once, and everything above keeps the clean
// `PoseFrame` the types promise.
import React, { useCallback } from 'react';
import {
  NativePoseCameraView,
  type PoseCameraViewProps,
  type PoseFrame,
  type PoseStatus,
} from '@/lib/pose';

/** Accepts BOTH shapes on purpose.
 *
 * Which one arrives depends on the architecture the view is rendered
 * under, and being wrong about it costs a device build to find out — this
 * is a camera screen, so a malformed event must never be able to take the
 * app down again. */
function payloadOf<T>(event: T | { nativeEvent: T }): T | undefined {
  if (event && typeof event === 'object' && 'nativeEvent' in event) {
    return (event as { nativeEvent: T }).nativeEvent;
  }
  return event as T;
}

export function PoseCamera({ onPose, onPoseStatus, ...rest }: PoseCameraViewProps) {
  const handlePose = useCallback(
    (event: PoseFrame | { nativeEvent: PoseFrame }) => {
      const frame = payloadOf(event);
      if (!frame || !Array.isArray(frame.points)) return;
      onPose?.(frame);
    },
    [onPose],
  );

  const handleStatus = useCallback(
    (event: { state: PoseStatus } | { nativeEvent: { state: PoseStatus } }) => {
      const status = payloadOf(event);
      if (!status?.state) return;
      onPoseStatus?.(status);
    },
    [onPoseStatus],
  );

  if (!NativePoseCameraView) return null;
  return <NativePoseCameraView {...rest} onPose={handlePose} onPoseStatus={handleStatus} />;
}

/** False on web, and on a build made before the native module existed. */
export const isPoseCameraAvailable = () => NativePoseCameraView != null;
