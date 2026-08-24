// Invoked by a protected scheduler once per day. It delivers the
// 2/3/4/5/7/10/14-day inactive-user reminders as both inbox records and
// Expo pushes. Daily workout reminders are deliberately scheduled locally
// on each device at the time the user selected, so this server worker
// never guesses their timezone.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-notification-secret',
};

const INACTIVITY_TIERS = [2, 3, 4, 5, 7, 10, 14];

type Profile = { id: string; language: string | null; last_login_at: string | null };
type Template = { template_key: string; title: string; body: string };

function copy(language: string | null, days: number) {
  if (language === 'en') return {
    title: 'We miss you at TheraHOME',
    body: `${days} days without a session — take a gentle moment for yourself today.`,
  };
  if (language === 'ms') return {
    title: 'Kami rindu anda di TheraHOME',
    body: `${days} hari tanpa sesi — luangkan sedikit masa untuk diri anda hari ini.`,
  };
  return {
    title: 'TheraHOME nhớ bạn',
    body: `Đã ${days} ngày bạn chưa ghé lại. Dành vài phút nhẹ nhàng cho bản thân hôm nay nhé.`,
  };
}

function interpolate(value: string, values: Record<string, string | number>) {
  return value.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => String(values[key] ?? ''));
}

async function sendExpo(messages: Array<{ to: string; title: string; body: string; data: Record<string, unknown> }>) {
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  for (let index = 0; index < messages.length; index += 100) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(messages.slice(index, index + 100).map((message) => ({
        ...message,
        sound: 'default',
        channelId: 'default',
        priority: 'high',
      }))),
    });
    if (!response.ok) throw new Error(`Expo push failed: ${await response.text()}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const expectedSecret = Deno.env.get('SYSTEM_NOTIFICATIONS_CRON_SECRET');
  if (!expectedSecret || request.headers.get('x-system-notification-secret') !== expectedSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id, language, last_login_at')
      .is('deleted_at', null)
      .eq('locked', false);
    if (error) throw error;
    const { data: templateRows, error: templateError } = await admin
      .from('system_notification_templates')
      .select('template_key, title, body')
      .in('template_key', INACTIVITY_TIERS.map((days) => `inactive_${days}`));
    if (templateError) throw templateError;
    const templates = new Map((templateRows ?? []).map((template: Template) => [template.template_key, template]));

    const now = Date.now();
    const delivered: Array<{ userId: string; days: number; title: string; body: string }> = [];
    for (const profile of (profiles ?? []) as Profile[]) {
      if (!profile.last_login_at) continue;
      const inactiveDays = Math.floor((now - new Date(profile.last_login_at).getTime()) / 86_400_000);
      if (!INACTIVITY_TIERS.includes(inactiveDays)) continue;
      const fallback = copy(profile.language, inactiveDays);
      const template = templates.get(`inactive_${inactiveDays}`);
      const message = template
        ? { title: interpolate(template.title, { days: inactiveDays }), body: interpolate(template.body, { days: inactiveDays }) }
        : fallback;
      const { data: notificationId, error: deliveryError } = await admin.rpc('create_inactivity_notification', {
        p_user_id: profile.id,
        p_inactive_days: inactiveDays,
        p_title: message.title,
        p_body: message.body,
      });
      if (deliveryError) throw deliveryError;
      if (notificationId) delivered.push({ userId: profile.id, days: inactiveDays, ...message });
    }

    const userIds = delivered.map((item) => item.userId);
    const { data: tokens, error: tokenError } = userIds.length
      ? await admin.from('push_tokens').select('user_id, expo_push_token').in('user_id', userIds)
      : { data: [], error: null };
    if (tokenError) throw tokenError;
    const copyByUser = new Map(delivered.map((item) => [item.userId, item]));
    const uniqueTokens = new Map<string, string>();
    for (const row of tokens ?? []) if (!uniqueTokens.has(row.expo_push_token)) uniqueTokens.set(row.expo_push_token, row.user_id);
    await sendExpo([...uniqueTokens].map(([to, userId]) => {
      const message = copyByUser.get(userId)!;
      return { to, title: message.title, body: message.body, data: { type: 'inactivity', destination: 'home', days: message.days } };
    }));

    return json({ delivered: delivered.length, pushes: uniqueTokens.size });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
