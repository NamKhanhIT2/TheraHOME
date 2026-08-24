// Phase 6: real expo-notifications wiring. Two independent things live here:
// 1) remote push token registration (`push_tokens` table) — only actually
//    works from an EAS dev/production client, not plain Expo Go (Expo Go
//    dropped remote push support in recent SDKs), so failures here are
//    caught and swallowed rather than surfaced as errors. See CLAUDE.md.
// 2) a local, device-scheduled daily reminder — works everywhere, no
//    server/credentials needed, driven by profiles.daily_reminder_enabled/
//    daily_reminder_time.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { translate } from '@/lib/i18n';
import type { AppLanguage } from '@/store/useAppStore';
import { TEST_BLOG_ARTICLE_ID } from '@/lib/officialArticles';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAILY_REMINDER_ID = 'daily-reminder';
const EVENING_REMINDER_ID = 'daily-reminder-evening';
// Category identifiers must not contain `:` or `-` for reliable iOS/Android
// interactive notification handling.
export const UPSALE_NOTIFICATION_CATEGORY = 'upsaleoffer';
export const UPSALE_OPEN_ACTION = 'upsaleopen';

/** Registers the native action shown for marketing pushes. On iOS this is
 * revealed by expanding/long-pressing a notification; Android shows it in
 * the expanded notification UI. */
export async function registerUpsaleNotificationActions(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(
    UPSALE_NOTIFICATION_CATEGORY,
    [{ identifier: UPSALE_OPEN_ACTION, buttonTitle: 'Mở TheraHOME', options: { opensAppToForeground: true } }],
  );
}

/** Requests notification permission and, if granted, registers this
 * device's Expo push token in `push_tokens`. Returns whether permission was
 * granted (independent of whether the token round-trip itself succeeded). */
export async function registerForPushNotifications(userId: string): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Thông báo TheraHOME',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 180, 250],
      sound: 'default',
    });
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, expo_push_token: token, device_info: `${Platform.OS} ${Platform.Version}` },
        { onConflict: 'expo_push_token' },
      );
  } catch (err) {
    if (__DEV__) console.warn('Push token registration failed (expected in plain Expo Go):', err);
  }

  return true;
}

/** Refreshes an existing granted device token without showing a permission prompt. */
export async function syncPushTokenIfGranted(userId: string): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') await registerForPushNotifications(userId);
}

function interpolateTemplate(value: string, values: Record<string, string | number>) {
  return value.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => String(values[key] ?? ''));
}

/** Reads the admin-authored template matching both the key and the
 * caller's own language, falling back to the 'vi' row (mirrors
 * `translate()`'s vi-fallback) if that language hasn't been translated
 * yet, and finally to the hardcoded `fallback` if the row is missing
 * entirely (e.g. before any admin edit) or the query fails. */
async function resolveSystemTemplate(templateKey: string, language: AppLanguage, fallback: { title: string; body: string }, values: Record<string, string | number>) {
  try {
    const { data, error } = await supabase
      .from('system_notification_templates')
      .select('title, body, language')
      .eq('template_key', templateKey)
      .in('language', [language, 'vi']);
    if (error || !data?.length) return fallback;
    const row = data.find((r) => r.language === language) ?? data.find((r) => r.language === 'vi');
    if (!row) return fallback;
    return { title: interpolateTemplate(row.title, values), body: interpolateTemplate(row.body, values) };
  } catch {
    return fallback;
  }
}

// Marks a scheduled notification as one of the two local, device-only
// reminders — used by `registerLocalReminderInboxSync` below to recognize
// them (and only them) among whatever else `addNotificationReceivedListener`
// might see, since every *other* notification type already has its
// `notifications` row written server-side before it's ever sent as a push
// (see dispatch-push/dispatch-system-notifications) and must not get a
// second, duplicate row here.
type ReminderKind = 'daily' | 'evening';

async function scheduleReminder(identifier: string, enabled: boolean, time: string, title: string, body: string, reminderKind: ReminderKind): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  if (!enabled) return;

  const [hour, minute] = time.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: 'default',
      data: { type: 'schedule', destination: 'roadmap', reminderKind },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

/** Schedules (or cancels) the local morning workout reminder. `dayNumber` is
 * the user's current roadmap day at the time of scheduling — since this is a
 * device-local repeating trigger (not a server push), the OS fires the same
 * baked-in content every day until this is called again, so the day count
 * only stays accurate as long as the app gets reopened and this reschedules
 * (see the reschedule effect in `app/_layout.tsx`). Safe to call repeatedly —
 * always clears the previous schedule first. */
export async function scheduleDailyReminder(enabled: boolean, time: string, language: AppLanguage = 'vi', dayNumber?: number): Promise<void> {
  const fallback = { title: translate(language, 'dailyReminderTitle'), body: translate(language, 'dailyReminderBody', { day: dayNumber ?? '' }) };
  const copy = await resolveSystemTemplate('daily_workout', language, fallback, { day: dayNumber ?? '' });
  await scheduleReminder(DAILY_REMINDER_ID, enabled, time, copy.title, copy.body, 'daily');
}

/** Independent evening counterpart — same local-notification mechanism,
 * separate identifier so morning/evening can be toggled independently. Its
 * copy doesn't reference a day number, so no rescheduling is needed to stay
 * accurate. */
export async function scheduleEveningReminder(enabled: boolean, time: string, language: AppLanguage = 'vi'): Promise<void> {
  const fallback = { title: translate(language, 'dailyReminderTitle'), body: translate(language, 'eveningReminderBody') };
  const copy = await resolveSystemTemplate('evening_reminder', language, fallback, {});
  await scheduleReminder(EVENING_REMINDER_ID, enabled, time, copy.title, copy.body, 'evening');
}

/** Writes an inbox row (`record_local_reminder_notification` RPC) the
 * moment a local daily/evening reminder is actually delivered — these are
 * the only two notifications in the app that are purely device-scheduled
 * with no server round-trip, so unlike every other type, they had no
 * `notifications` row at all and could never be found again in the in-app
 * center once dismissed. Registered once from `app/_layout.tsx`.
 *
 * Known limitation: `addNotificationReceivedListener` only fires while
 * this listener is actually alive (foreground, or backgrounded but not
 * killed) — a reminder that fires while the app is fully closed and gets
 * swiped away unopened has no event this code can observe, so it won't be
 * backfilled into the inbox. That's an inherent limit of a purely local,
 * credential-free reminder (see CLAUDE.md's Push/local notifications
 * section) rather than something fixable client-side without turning this
 * into a server-sent push. */
export function registerLocalReminderInboxSync(getUserId: () => string | undefined): () => void {
  const subscription = Notifications.addNotificationReceivedListener((event) => {
    const data = event.request.content.data as { type?: string; reminderKind?: ReminderKind; destination?: string } | undefined;
    if (data?.type !== 'schedule' || (data.reminderKind !== 'daily' && data.reminderKind !== 'evening')) return;
    const userId = getUserId();
    if (!userId) return;
    const { title, body } = event.request.content;
    void supabase
      .rpc('record_local_reminder_notification', { p_title: title ?? '', p_body: body ?? '', p_destination: data.destination ?? 'roadmap' })
      .then(({ error }) => {
        if (error && __DEV__) console.warn('Failed to record local reminder in notification center:', error);
      });
  });
  return () => subscription.remove();
}

const REMINDER_BACKFILL_KEY_PREFIX = 'thera_reminder_backfilled_';

/** A local reminder's OS trigger only fires while the device is on, and
 * `registerLocalReminderInboxSync`'s listener above only observes that if
 * the app happens to be alive (foreground or backgrounded-but-not-killed)
 * at that exact moment — in practice the common case for a 7am/8:30pm
 * reminder, since most people aren't holding the app open then, which is
 * why reminders were reported as "fired, but never show up in the
 * notification center." This fills the gap the next time the app is
 * actually opened: if today's scheduled time has already passed and
 * nothing has recorded today's occurrence yet, write the inbox row now.
 * Dedupes via AsyncStorage (there's no cheap way to ask the server
 * "does today's row already exist" without an extra round trip on every
 * check) — safe to call as often as needed, it's a no-op once today's key
 * is set or before the scheduled time has actually passed. */
async function backfillTodayReminderIfDue(kind: ReminderKind, enabled: boolean, time: string, title: string, body: string, destination: string): Promise<void> {
  if (!enabled) return;
  const [hour, minute] = time.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return;

  const now = new Date();
  if (now.getHours() < hour || (now.getHours() === hour && now.getMinutes() < minute)) return;

  const dateKey = now.toISOString().slice(0, 10);
  const storageKey = `${REMINDER_BACKFILL_KEY_PREFIX}${kind}_${dateKey}`;
  const already = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (already) return;

  const { error } = await supabase.rpc('record_local_reminder_notification', { p_title: title, p_body: body, p_destination: destination });
  if (!error) {
    await AsyncStorage.setItem(storageKey, '1').catch(() => {});
  } else if (__DEV__) {
    console.warn('Failed to backfill local reminder in notification center:', error);
  }
}

/** Call on mount and on every app foreground (see `app/_layout.tsx`) —
 * resolves the same copy `scheduleDailyReminder`/`scheduleEveningReminder`
 * would have scheduled, then backfills each into the inbox if due. */
export async function backfillTodaysReminders(
  dailyEnabled: boolean,
  dailyTime: string,
  eveningEnabled: boolean,
  eveningTime: string,
  language: AppLanguage = 'vi',
  dayNumber?: number,
): Promise<void> {
  const dailyFallback = { title: translate(language, 'dailyReminderTitle'), body: translate(language, 'dailyReminderBody', { day: dayNumber ?? '' }) };
  const dailyCopy = await resolveSystemTemplate('daily_workout', language, dailyFallback, { day: dayNumber ?? '' });
  await backfillTodayReminderIfDue('daily', dailyEnabled, dailyTime, dailyCopy.title, dailyCopy.body, 'roadmap');

  const eveningFallback = { title: translate(language, 'dailyReminderTitle'), body: translate(language, 'eveningReminderBody') };
  const eveningCopy = await resolveSystemTemplate('evening_reminder', language, eveningFallback, {});
  await backfillTodayReminderIfDue('evening', eveningEnabled, eveningTime, eveningCopy.title, eveningCopy.body, 'roadmap');
}

/** Development/test notification for validating the blog → Community deep link
 * without requiring the future admin push sender. */
export async function scheduleTestBlogNotification(language: AppLanguage): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: translate(language, 'testBlogNotificationTitle'),
      body: translate(language, 'testBlogNotificationBody'),
      sound: 'default',
      data: { type: 'blog', articleId: TEST_BLOG_ARTICLE_ID },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  });
}
