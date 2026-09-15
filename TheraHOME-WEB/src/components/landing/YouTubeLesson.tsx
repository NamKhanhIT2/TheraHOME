"use client";

// The day's video, using the YouTube IFrame Player API rather than a bare
// <iframe>.
//
// This is not decoration. Completion is "the customer watched it", and the app
// records that on `state === 'playing'` from react-native-youtube-iframe. A
// plain <iframe> gives no playback events, so the first version of this page
// recorded on the iframe's `load` — which fires the instant the day opens.
// That marked every opened day complete without a second of video being
// watched, and the phone would then show it done. The IFrame API restores the
// app's actual rule: PLAYING, once, and only then.
import { useEffect, useRef } from "react";

// Minimal shape of the bits of the IFrame API this uses.
interface YTPlayer {
  destroy: () => void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";

/** Load the API once per page and resolve when it is usable. The API calls a
 * single global callback, so concurrent callers share one promise. */
let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error("YouTube IFrame API loaded without YT"));
    };
    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const tag = document.createElement("script");
      tag.src = API_SRC;
      tag.async = true;
      tag.onerror = () => reject(new Error("YouTube IFrame API failed to load"));
      document.head.appendChild(tag);
    }
  });
  return apiPromise;
}

export function YouTubeLesson({
  videoId,
  title,
  onPlay,
}: {
  videoId: string;
  title: string;
  /** Fired once, the first time playback actually starts. */
  onPlay: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // A ref, not state: the handler must not be re-registered on every render,
  // and "already reported" has to survive without causing one.
  const firedRef = useRef(false);
  const onPlayRef = useRef(onPlay);
  // Assigned in an effect, not during render: writing a ref while rendering is
  // the "cannot access refs during render" case, and this only has to be
  // current by the time a playback event fires, which is always after commit.
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
    firedRef.current = false;

    void loadApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        player = new YT.Player(hostRef.current, {
          videoId,
          playerVars: { rel: 0, playsinline: 1, controls: 1 },
          events: {
            onStateChange: (e: { data: number }) => {
              if (e.data === YT.PlayerState.PLAYING && !firedRef.current) {
                firedRef.current = true;
                onPlayRef.current();
              }
            },
          },
        });
      })
      .catch((error) => {
        // Blocked or offline. The "Xem trên YouTube" link beside this player is
        // the fallback path, and it records the watch on click — same as the
        // app's error-fallback link.
        console.error("Unable to start the YouTube player", error);
      });

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [videoId]);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 20, overflow: "hidden", background: "#000", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div ref={hostRef} title={title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}
