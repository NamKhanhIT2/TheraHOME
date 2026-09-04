// Runs on a Supabase schedule (for example every five minutes). It turns due
// `upsell_campaigns` records into per-user in-app notifications and then
// sends Expo push notifications to the devices which have registered a token.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-upsell-cron-secret',
};

type Campaign = {
  id: string;
  title: string;
  body: string;
  target: string;
  destination: 'store' | 'home' | 'roadmap' | 'community';
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const expectedSecret = Deno.env.get('UPSELL_CRON_SECRET');
  const customSecretIsValid = !!expectedSecret && request.headers.get('x-upsell-cron-secret') === expectedSecret;
  const serviceRoleIsValid = !!serviceKey && request.headers.get('Authorization') === `Bearer ${serviceKey}`;
  if (!customSecretIsValid && !serviceRoleIsValid) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, serviceKey!);
    const now = new Date().toISOString();

    // A terminated run should not permanently strand a campaign in
    // `processing`; re-queue only records that have had no progress for 15m.
    await admin
      .from('upsell_campaigns')
      .update({ status: 'scheduled', processing_started_at: null })
      .eq('status', 'processing')
      .lt('processing_started_at', new Date(Date.now() - 15 * 60_000).toISOString());

    const { data: due, error: dueError } = await admin
      .from('upsell_campaigns')
      .select('id, title, body, target, destination')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .order('scheduled_for')
      .limit(25);
    if (dueError) throw dueError;

    const results: Array<{ id: string; recipients: number; pushes: number }> = [];
    for (const campaign of (due ?? []) as Campaign[]) {
      // Atomic claim prevents two scheduled invocations from sending the same
      // campaign. If it was cancelled after the select, no row is returned.
      const { data: claimed, error: claimError } = await admin
        .from('upsell_campaigns')
        .update({ status: 'processing', processing_started_at: new Date().toISOString() })
        .eq('id', campaign.id)
        .eq('status', 'scheduled')
        .select('id');
      if (claimError) throw claimError;
      if (!claimed?.length) continue;

      try {
        let recipientIds: string[] = [];
        if (campaign.target === 'all') {
          const { data, error } = await admin.from('profiles').select('id').is('deleted_at', null);
          if (error) throw error;
          recipientIds = (data ?? []).map((profile) => profile.id);
        } else {
          const { data, error } = await admin.from('user_programs').select('user_id').eq('product_id', campaign.target);
          if (error) throw error;
          recipientIds = (data ?? []).map((program) => program.user_id);
        }
        recipientIds = [...new Set(recipientIds)];

        if (recipientIds.length) {
          const { data: existingNotifications, error: existingError } = await admin
            .from('notifications')
            .select('user_id')
            .eq('upsell_campaign_id', campaign.id);
          if (existingError) throw existingError;
          const alreadyNotified = new Set((existingNotifications ?? []).map((notification) => notification.user_id));
          const missingRecipients = recipientIds.filter((userId) => !alreadyNotified.has(userId));
          const { error: notificationError } = missingRecipients.length ? await admin.from('notifications').insert(
            missingRecipients.map((user_id) => ({
              user_id,
              type: 'ad',
              title: campaign.title,
              body: campaign.body,
              related_product_id: campaign.target === 'all' ? null : campaign.target,
              upsell_campaign_id: campaign.id,
              destination: campaign.destination,
            })),
          ) : { error: null };
          if (notificationError) throw notificationError;
        }

        const { data: tokens, error: tokenError } = recipientIds.length
          ? await admin.from('push_tokens').select('expo_push_token').in('user_id', recipientIds)
          : { data: [], error: null };
        if (tokenError) throw tokenError;
        const messages = [...new Set((tokens ?? []).map((row) => row.expo_push_token))].map((to) => ({
          to,
          title: campaign.title,
          body: campaign.body,
          data: { type: 'ad', campaignId: campaign.id, destination: campaign.destination, productId: campaign.target === 'all' ? undefined : campaign.target },
          categoryId: 'upsaleoffer',
          sound: 'ting.wav',
          channelId: 'default-v2',
          priority: 'high',
        }));

        const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
        for (let index = 0; index < messages.length; index += 100) {
          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
            body: JSON.stringify(messages.slice(index, index + 100)),
          });
          if (!response.ok) throw new Error(`Expo push failed: ${await response.text()}`);
        }

        const { error: doneError } = await admin
          .from('upsell_campaigns')
          .update({ status: 'sent', processing_started_at: null, sent_at: new Date().toISOString(), recipient_count: recipientIds.length })
          .eq('id', campaign.id);
        if (doneError) throw doneError;
        results.push({ id: campaign.id, recipients: recipientIds.length, pushes: messages.length });
      } catch (error) {
        // Leave it eligible for the next schedule instead of losing a campaign
        // due to a temporary Expo/Supabase network failure.
        await admin.from('upsell_campaigns').update({ status: 'scheduled', processing_started_at: null }).eq('id', campaign.id);
        throw error;
      }
    }
    return json({ processed: results.length, results });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
