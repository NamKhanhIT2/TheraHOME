import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isHealthDataAvailable,
  queryActivitySummary,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

/**
 * Today's three Apple Activity rings and the step count, read from HealthKit.
 *
 * iOS only. Android's equivalent is Health Connect — a different library, a
 * different permission model and its own Play Store declaration; the owner
 * chose to do one platform first (2026-10-25), so the card hides itself
 * there rather than pretending.
 *
 * HealthKit never reports whether READ access was granted — by design, so an
 * app cannot infer a condition from a refusal. That shapes everything here:
 * we can only remember that we asked, run the queries, and treat "nothing
 * came back" as its own state. A zero-filled card would be a lie; an empty
 * one with a way into Settings is not.
 */
// v2: distance and flights were added to the read set after the first
// authorisation sheet had already been shown. HealthKit rejects a query for a
// type that was never requested, which took the whole `Promise.all` with it
// and left a card saying there was no data at all — on a phone that had just
// counted 672 steps (owner, 2026-10-25). Bumping the key asks again; iOS only
// shows the sheet for the types it has not already decided.
// v3: keyed by ACCOUNT, not by device. It used to be one flag for the
// phone, so a brand-new account signed in on a phone that had already
// agreed once found its activity card filled in with the previous account's
// steps before it had agreed to anything (owner, 2026-10-27). iOS will not
// show its sheet twice for types it has already decided, so this costs the
// returning account nothing — it is this app asking, not HealthKit.
const askedKeyFor = (userId: string) => `therahome-health-asked-v3:${userId}`;

/** The three rings, in the units Apple shows them in. */
export interface HealthRings {
  /** Active energy, kcal. */
  move: number;
  moveGoal: number;
  /** Exercise minutes. */
  exercise: number;
  exerciseGoal: number;
  /** Stand hours. */
  stand: number;
  standGoal: number;
}

export interface HealthActivity {
  /**
   * Null on a phone with no Apple Watch. Exercise and Stand are the Watch's
   * measurements — without one, iOS has no activity summary to give and the
   * card would otherwise show three rings of zero against goals nobody set.
   * What the phone DOES count is below.
   */
  rings: HealthRings | null;
  steps: number;
  /** Walking + running, km. */
  distance: number;
  flights: number;
}

export type HealthStatus =
  /** Not iOS, or a device with no Health app (iPad). */
  | 'unsupported'
  /** Never asked — the card shows its connect button. */
  | 'needsPermission'
  | 'loading'
  /** Asked and answered, but Health has nothing to give. */
  | 'empty'
  | 'ready';

const READ_TYPES = [
  'HKActivitySummaryTypeIdentifier',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierFlightsClimbed',
] as const;

function today() {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

export function useHealthActivity(userId: string | undefined) {
  const supported = Platform.OS === 'ios' && isHealthDataAvailable() && !!userId;
  const [status, setStatus] = useState<HealthStatus>(supported ? 'loading' : 'unsupported');
  const [activity, setActivity] = useState<HealthActivity | null>(null);
  const asked = useRef(false);

  const read = useCallback(async () => {
    const range = today();
    // Every read is allowed to fail ON ITS OWN. HealthKit throws rather than
    // returning nothing when a type was never authorised, and one rejection
    // inside a `Promise.all` is enough to blank a card that had four other
    // answers ready.
    const sum = async (
      identifier:
        | 'HKQuantityTypeIdentifierStepCount'
        | 'HKQuantityTypeIdentifierDistanceWalkingRunning'
        | 'HKQuantityTypeIdentifierFlightsClimbed',
    ) => {
      try {
        const result = await queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
          filter: { date: range },
        });
        return result.sumQuantity?.quantity ?? 0;
      } catch {
        return 0;
      }
    };
    const [summaries, stepCount, metres, floors] = await Promise.all([
      queryActivitySummary({ date: range }).catch(() => []),
      sum('HKQuantityTypeIdentifierStepCount').then(Math.round),
      sum('HKQuantityTypeIdentifierDistanceWalkingRunning'),
      sum('HKQuantityTypeIdentifierFlightsClimbed').then(Math.round),
    ]);
    const summary = summaries[summaries.length - 1];
    if (!summary && stepCount === 0 && metres === 0) {
      setActivity(null);
      setStatus('empty');
      return;
    }
    setActivity({
      rings: summary
        ? {
            move: Math.round(summary.activeEnergyBurned.quantity),
            moveGoal: Math.round(summary.activeEnergyBurnedGoal.quantity) || 400,
            exercise: Math.round(summary.appleExerciseTime.quantity),
            exerciseGoal: Math.round(summary.appleExerciseTimeGoal.quantity) || 30,
            stand: Math.round(summary.appleStandHours.quantity),
            standGoal: Math.round(summary.appleStandHoursGoal.quantity) || 12,
          }
        : null,
      steps: stepCount,
      distance: Math.round((metres / 1000) * 10) / 10,
      flights: floors,
    });
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!supported || !userId) return;
    let cancelled = false;
    void (async () => {
      const seen = await AsyncStorage.getItem(askedKeyFor(userId)).catch(() => null);
      if (cancelled) return;
      if (!seen) {
        setStatus('needsPermission');
        return;
      }
      asked.current = true;
      try {
        await read();
      } catch {
        if (!cancelled) setStatus('empty');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [read, supported, userId]);

  /** Re-read when the app comes back — the numbers move while it is closed. */
  useEffect(() => {
    if (!supported) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !asked.current) return;
      void read().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [read, supported]);

  const connect = useCallback(async () => {
    setStatus('loading');
    try {
      await requestAuthorization({ toRead: READ_TYPES });
    } catch {
      // The sheet can only fail for reasons the user cannot act on; fall
      // through and let the read below decide what to show.
    }
    asked.current = true;
    if (userId) void AsyncStorage.setItem(askedKeyFor(userId), '1').catch(() => undefined);
    try {
      await read();
    } catch {
      setStatus('empty');
    }
  }, [read, userId]);

  return { status, activity, connect };
}
