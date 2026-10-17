// The specialist's movement for one day: the clip to copy, and the
// keypoints that say what copying it correctly looks like.
//
// Read only by the training screen, never by the roadmap or the day screen
// — which is why it is its own table and its own query rather than two more
// columns on `program_days`. A 50 KB keypoint track has no business being
// fetched by a screen that only wants to know whether day 4 is unlocked.
//
// The clip lives in a PRIVATE bucket and this is where the paid gate is
// actually enforced: `createSignedUrl` is refused by the storage policy for
// an account with no plan, so there is no clip to play, whatever the UI
// does. `usePlanGate` is the polite version of the same no. Review
// accounts pass, because `active_plan_code()` returns a plan for them.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isPoseTrack, type PoseTrack } from '@/lib/poseTrack';
import type { CompareConfig } from '@/lib/poseCompare';

/** An hour. Long enough for any session; the query refetches before then
 * anyway, and a URL that outlives the screen is a URL that can be shared. */
const SIGNED_URL_SECONDS = 3600;

export type ExerciseReference = {
  id: string;
  programDayId: string;
  /** Signed, expiring, and null when the row has no clip yet — a track can
   * be uploaded and reviewed before its video is in place. */
  clipUrl: string | null;
  track: PoseTrack;
  /** Per-exercise scoring overrides. The `view` always comes from the
   * track, which is the thing that was actually measured. */
  config: Omit<CompareConfig, 'view'>;
};

/**
 * Which days have a demonstration at all — readable by everyone, including
 * the customers who cannot read the demonstration itself.
 *
 * The card that offers this feature has to appear for people who have NOT
 * paid (that is the point of it) while the track stays unreadable without
 * a plan. RLS cannot do both, so the server answers this one question
 * through a function of its own.
 */
export function useDaysWithReference(userId: string | undefined) {
  return useQuery({
    queryKey: ['days_with_exercise_reference'],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.rpc('days_with_exercise_reference');
      // A failure here means no card, not a broken screen: the feature is
      // an offer, and an offer that cannot be made is simply not made.
      if (error) return new Set();
      return new Set(data ?? []);
    },
  });
}

export function useExerciseReference(programDayId: string | undefined) {
  return useQuery({
    queryKey: ['exercise_reference', programDayId],
    enabled: !!programDayId,
    // Catalogue content, not per-user state: it changes when the team
    // publishes a new track, which is not something to poll for.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ExerciseReference | null> => {
      const { data, error } = await supabase
        .from('exercise_references')
        .select('id, program_day_id, clip_path, track, config')
        .eq('program_day_id', programDayId!)
        // Belt and braces with the RLS policy: an unpublished track is a
        // draft somebody is still checking, and staff accounts CAN read it.
        .eq('published', true)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      // JSON off the network, so this is a real boundary. A half-written
      // track must read as "this day has no reference yet", not as a screen
      // that crashes mid-exercise.
      if (!isPoseTrack(data.track)) return null;

      let clipUrl: string | null = null;
      if (data.clip_path) {
        const signed = await supabase.storage
          .from('exercise-reference')
          .createSignedUrl(data.clip_path, SIGNED_URL_SECONDS);
        clipUrl = signed.data?.signedUrl ?? null;
      }

      return {
        id: data.id,
        programDayId: data.program_day_id,
        clipUrl,
        track: data.track,
        config: (data.config ?? {}) as Omit<CompareConfig, 'view'>,
      };
    },
  });
}
