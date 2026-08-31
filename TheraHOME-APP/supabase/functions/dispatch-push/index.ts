// `npm:` is resolved by Supabase Edge Runtime's package cache. The JSR
// registry may reject anonymous manifest fetches during CLI bundling.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody =
  | { mode: 'broadcast'; userIds?: string[]; all?: boolean; title: string; body: string; data?: Record<string, unknown> }
  | { mode: 'chat'; threadId: string; senderType: 'user' | 'specialist'; preview?: string }
  | { mode: 'social'; event: 'reaction' | 'comment' | 'reply'; postId: string; commentId?: string; parentCommentId?: string; targetType?: 'post' | 'comment'; preview?: string };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = request.headers.get('Authorization') ?? '';
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, serviceKey);
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: 'unauthorized' }, 401);

    const input = await request.json() as RequestBody;
    const { data: callerRoles } = await callerClient.rpc('current_web_roles');
    const isStaff = Array.isArray(callerRoles) && (callerRoles.includes('admin') || callerRoles.includes('cskh'));
    let recipientIds: string[] = [];
    let title = '';
    let body = '';
    let data: Record<string, unknown> = {};

    if (input.mode === 'broadcast') {
      if (!isStaff) return json({ error: 'staff_required' }, 403);
      if (input.all) {
        const { data: profiles, error } = await admin.from('profiles').select('id').is('deleted_at', null);
        if (error) throw error;
        recipientIds = (profiles ?? []).map((profile) => profile.id);
      } else recipientIds = input.userIds ?? [];
      title = input.title;
      body = input.body;
      data = input.data ?? {};
    } else if (input.mode === 'social') {
      const { data: post, error: postError } = await admin
        .from('community_posts')
        .select('author_id')
        .eq('id', input.postId)
        .eq('hidden', false)
        .single();
      if (postError) throw postError;

      const { data: actor } = await admin.from('profiles').select('full_name').eq('id', user.id).single();
      const actorName = actor?.full_name || 'Ai đó';
      if (input.event === 'reaction') {
        if (input.targetType === 'comment' && input.commentId) {
          const { data: reaction } = await admin.from('comment_likes').select('comment_id').eq('comment_id', input.commentId).eq('user_id', user.id).maybeSingle();
          if (!reaction) return json({ error: 'reaction_required' }, 403);
          const { data: comment } = await admin.from('post_comments').select('author_id, parent_comment_id').eq('id', input.commentId).single();
          recipientIds = comment?.author_id ? [comment.author_id] : [];
          title = `${actorName} đã bày tỏ cảm xúc về bình luận của bạn`;
          data = { type: input.event, postId: input.postId, commentId: input.commentId, ...(comment?.parent_comment_id ? { parentCommentId: comment.parent_comment_id } : {}) };
        } else {
          const { data: reaction } = await admin.from('post_likes').select('post_id').eq('post_id', input.postId).eq('user_id', user.id).maybeSingle();
          if (!reaction) return json({ error: 'reaction_required' }, 403);
          recipientIds = post.author_id ? [post.author_id] : [];
          title = `${actorName} đã bày tỏ cảm xúc về bài viết của bạn`;
          data = { type: input.event, postId: input.postId };
        }
        body = input.preview?.slice(0, 180) || 'Mở TheraHOME để xem';
      } else {
        let commentQuery = admin.from('post_comments').select('id').eq('post_id', input.postId).eq('author_id', user.id);
        commentQuery = input.commentId
          ? commentQuery.eq('id', input.commentId)
          : input.parentCommentId
            ? commentQuery.eq('parent_comment_id', input.parentCommentId)
            : commentQuery.is('parent_comment_id', null);
        const { data: authoredComment } = await commentQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!authoredComment) return json({ error: 'comment_required' }, 403);

        recipientIds = post.author_id ? [post.author_id] : [];
        if (input.event === 'reply' && input.parentCommentId) {
          const { data: parent } = await admin.from('post_comments').select('author_id').eq('id', input.parentCommentId).single();
          if (parent?.author_id) recipientIds.push(parent.author_id);
        }
        title = input.event === 'reply' ? `${actorName} đã trả lời một bình luận` : `${actorName} đã bình luận bài viết của bạn`;
        body = input.preview?.slice(0, 180) || 'Mở TheraHOME để xem bình luận';
      }
      recipientIds = recipientIds.filter((recipientId) => recipientId !== user.id);
      if (input.event !== 'reaction') data = {
        type: input.event,
        postId: input.postId,
        ...(input.commentId ? { commentId: input.commentId } : {}),
        ...(input.parentCommentId ? { parentCommentId: input.parentCommentId } : {}),
      };
    } else {
      const { data: thread, error } = await admin.from('chat_threads').select('user_id').eq('id', input.threadId).single();
      if (error) throw error;
      if (input.senderType === 'specialist') {
        if (!isStaff) return json({ error: 'staff_required' }, 403);
        recipientIds = [thread.user_id];
        title = 'Đội ngũ hỗ trợ TheraHOME';
      } else {
        if (thread.user_id !== user.id) return json({ error: 'thread_owner_required' }, 403);
        const { data: staff, error: staffError } = await admin
          .from('web_access_contacts')
          .select('claimed_by_user_id, roles')
          .eq('disabled', false)
          .not('claimed_by_user_id', 'is', null);
        if (staffError) throw staffError;
        recipientIds = (staff ?? [])
          .filter((contact) => contact.roles?.some((role: string) => role === 'admin' || role === 'cskh'))
          .map((contact) => contact.claimed_by_user_id as string);
        title = 'Tin nhắn hỗ trợ mới';
      }
      body = input.preview?.slice(0, 180) || 'Bạn có một tin nhắn mới';
      data = { type: 'chat', threadId: input.threadId };
    }

    recipientIds = [...new Set(recipientIds)].filter(Boolean);
    if (!recipientIds.length) return json({ sent: 0 });
    const { data: tokens, error: tokenError } = await admin.from('push_tokens').select('expo_push_token').in('user_id', recipientIds);
    if (tokenError) throw tokenError;
    const messages = [...new Set((tokens ?? []).map((row) => row.expo_push_token))].map((to) => ({
      to, title, body, data, sound: 'ting.wav', channelId: 'default-v2', priority: 'high',
    }));

    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const tickets: unknown[] = [];
    for (let index = 0; index < messages.length; index += 100) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(messages.slice(index, index + 100)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(result));
      tickets.push(result);
    }
    return json({ sent: messages.length, tickets });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
