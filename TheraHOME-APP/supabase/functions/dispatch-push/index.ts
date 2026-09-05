// `npm:` is resolved by Supabase Edge Runtime's package cache. The JSR
// registry may reject anonymous manifest fetches during CLI bundling.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Push copy is built PER RECIPIENT (owner rule 2026-09-05): wording follows
// the recipient's app language (profiles.language); which market variant of
// an official post they get — and whether they get it at all — follows
// their market (profiles.country). v25 and earlier sent one Vietnamese
// message to everyone and ignored the WEB composer's targetMarkets/titleUs.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Lang = 'vi' | 'en' | 'ms';
type Market = 'VN' | 'US' | 'MALAY';

type RequestBody =
  | {
      mode: 'broadcast'; userIds?: string[]; all?: boolean; title: string; body: string; data?: Record<string, unknown>;
      targetMarkets?: Market[]; titleUs?: string; bodyUs?: string; titleMalay?: string; bodyMalay?: string;
    }
  | { mode: 'chat'; threadId: string; senderType: 'user' | 'specialist'; preview?: string; attachment?: boolean }
  // Admin published a roadmap: tell every customer who owns that device.
  | { mode: 'roadmap_ready'; productId: string }
  | { mode: 'social'; event: 'reaction' | 'comment' | 'reply'; postId: string; commentId?: string; parentCommentId?: string; targetType?: 'post' | 'comment'; preview?: string };

const COPY: Record<Lang, {
  someone: string; reactedPost: (a: string) => string; reactedComment: (a: string) => string; openToSee: string;
  commented: (a: string) => string; replied: (a: string) => string; openComment: string;
  supportTeam: string; newMessage: string; sentImage: string;
}> = {
  vi: {
    someone: 'Ai đó',
    reactedPost: (a) => `${a} đã bày tỏ cảm xúc về bài viết của bạn`,
    reactedComment: (a) => `${a} đã bày tỏ cảm xúc về bình luận của bạn`,
    openToSee: 'Mở TheraHOME để xem',
    commented: (a) => `${a} đã bình luận bài viết của bạn`,
    replied: (a) => `${a} đã trả lời một bình luận`,
    openComment: 'Mở TheraHOME để xem bình luận',
    supportTeam: 'Đội ngũ hỗ trợ TheraHOME',
    newMessage: 'Bạn có một tin nhắn mới',
    sentImage: 'Đã gửi một ảnh',
  },
  en: {
    someone: 'Someone',
    reactedPost: (a) => `${a} reacted to your post`,
    reactedComment: (a) => `${a} reacted to your comment`,
    openToSee: 'Open TheraHOME to see it',
    commented: (a) => `${a} commented on your post`,
    replied: (a) => `${a} replied to a comment`,
    openComment: 'Open TheraHOME to see the comment',
    supportTeam: 'TheraHOME Support Team',
    newMessage: 'You have a new message',
    sentImage: 'Sent a photo',
  },
  ms: {
    someone: 'Seseorang',
    reactedPost: (a) => `${a} bertindak balas terhadap siaran anda`,
    reactedComment: (a) => `${a} bertindak balas terhadap komen anda`,
    openToSee: 'Buka TheraHOME untuk melihat',
    commented: (a) => `${a} mengulas siaran anda`,
    replied: (a) => `${a} membalas satu komen`,
    openComment: 'Buka TheraHOME untuk melihat komen',
    supportTeam: 'Pasukan Sokongan TheraHOME',
    newMessage: 'Anda mempunyai mesej baharu',
    sentImage: 'Menghantar gambar',
  },
};

// Legacy clients still send this literal instead of `attachment: true`.
const LEGACY_IMAGE_PREVIEW = 'Đã gửi một ảnh';

function asLang(value: unknown): Lang {
  return value === 'en' || value === 'ms' ? value : 'vi';
}
function marketOf(country: unknown, language: Lang): Market {
  if (country === 'US' || country === 'MALAY' || country === 'VN') return country;
  return language === 'en' ? 'US' : language === 'ms' ? 'MALAY' : 'VN';
}

interface Recipient { id: string; lang: Lang; market: Market }
interface Message { title: string; body: string }

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
    let data: Record<string, unknown> = {};
    // Decided once the recipients' language/market are known.
    let compose: (recipient: Recipient) => Message | null = () => null;

    if (input.mode === 'broadcast') {
      if (!isStaff) return json({ error: 'staff_required' }, 403);
      if (input.all) {
        const { data: profiles, error } = await admin.from('profiles').select('id').is('deleted_at', null);
        if (error) throw error;
        recipientIds = (profiles ?? []).map((profile) => profile.id);
      } else recipientIds = input.userIds ?? [];
      data = input.data ?? {};
      const targets = input.targetMarkets?.length ? input.targetMarkets : null;
      compose = (recipient) => {
        if (targets && !targets.includes(recipient.market)) return null;
        if (recipient.market === 'US' && (input.titleUs || input.bodyUs)) return { title: input.titleUs || input.title, body: input.bodyUs || input.body };
        if (recipient.market === 'MALAY' && (input.titleMalay || input.bodyMalay)) return { title: input.titleMalay || input.title, body: input.bodyMalay || input.body };
        return { title: input.title, body: input.body };
      };
    } else if (input.mode === 'roadmap_ready') {
      if (!isStaff) return json({ error: 'staff_required' }, 403);
      const { data: product, error: productError } = await admin.from('products').select('id, name, name_en, name_ms').eq('id', input.productId).single();
      if (productError) throw productError;
      const { data: owners, error: ownersError } = await admin
        .from('user_programs')
        .select('user_id, profiles!inner(account_type)')
        .eq('product_id', input.productId);
      if (ownersError) throw ownersError;
      recipientIds = (owners ?? [])
        // deno-lint-ignore no-explicit-any
        .filter((row: any) => !['review', 'admin', 'cskh'].includes(row.profiles?.account_type))
        // deno-lint-ignore no-explicit-any
        .map((row: any) => row.user_id as string);
      data = { type: 'roadmap_ready', productId: input.productId };
      const nameFor = (lang: Lang) => (lang === 'en' ? product.name_en : lang === 'ms' ? product.name_ms : null) || product.name;
      compose = (r) => ({
        title: r.lang === 'en' ? `Your ${nameFor('en')} roadmap is ready` : r.lang === 'ms' ? `Pelan ${nameFor('ms')} anda sudah sedia` : `Lộ trình ${nameFor('vi')} đã sẵn sàng`,
        body: r.lang === 'en' ? 'The exercise videos are live. Open the Roadmap tab to start Day 1.' : r.lang === 'ms' ? 'Video senaman telah tersedia. Buka tab Pelan untuk memulakan Hari 1.' : 'Video bài tập đã có. Mở tab Lộ trình để bắt đầu Ngày 1 nhé.',
      });
    } else if (input.mode === 'social') {
      const { data: post, error: postError } = await admin
        .from('community_posts')
        .select('author_id')
        .eq('id', input.postId)
        .eq('hidden', false)
        .single();
      if (postError) throw postError;

      const { data: actor } = await admin.from('profiles').select('full_name').eq('id', user.id).single();
      const actorName = actor?.full_name?.trim() || null;
      const preview = input.preview?.slice(0, 180) || '';
      if (input.event === 'reaction') {
        if (input.targetType === 'comment' && input.commentId) {
          const { data: reaction } = await admin.from('comment_likes').select('comment_id').eq('comment_id', input.commentId).eq('user_id', user.id).maybeSingle();
          if (!reaction) return json({ error: 'reaction_required' }, 403);
          const { data: comment } = await admin.from('post_comments').select('author_id, parent_comment_id').eq('id', input.commentId).single();
          recipientIds = comment?.author_id ? [comment.author_id] : [];
          data = { type: input.event, postId: input.postId, commentId: input.commentId, ...(comment?.parent_comment_id ? { parentCommentId: comment.parent_comment_id } : {}) };
          compose = (r) => ({ title: COPY[r.lang].reactedComment(actorName ?? COPY[r.lang].someone), body: preview || COPY[r.lang].openToSee });
        } else {
          const { data: reaction } = await admin.from('post_likes').select('post_id').eq('post_id', input.postId).eq('user_id', user.id).maybeSingle();
          if (!reaction) return json({ error: 'reaction_required' }, 403);
          recipientIds = post.author_id ? [post.author_id] : [];
          data = { type: input.event, postId: input.postId };
          compose = (r) => ({ title: COPY[r.lang].reactedPost(actorName ?? COPY[r.lang].someone), body: preview || COPY[r.lang].openToSee });
        }
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
        const isReply = input.event === 'reply';
        data = {
          type: input.event,
          postId: input.postId,
          ...(input.commentId ? { commentId: input.commentId } : {}),
          ...(input.parentCommentId ? { parentCommentId: input.parentCommentId } : {}),
        };
        compose = (r) => ({
          title: isReply ? COPY[r.lang].replied(actorName ?? COPY[r.lang].someone) : COPY[r.lang].commented(actorName ?? COPY[r.lang].someone),
          body: preview || COPY[r.lang].openComment,
        });
      }
      recipientIds = recipientIds.filter((recipientId) => recipientId !== user.id);
    } else {
      const { data: thread, error } = await admin.from('chat_threads').select('user_id').eq('id', input.threadId).single();
      if (error) throw error;
      const rawPreview = input.preview?.slice(0, 180) || '';
      const isAttachment = input.attachment === true || rawPreview === LEGACY_IMAGE_PREVIEW;
      data = { type: 'chat', threadId: input.threadId };
      if (input.senderType === 'specialist') {
        if (!isStaff) return json({ error: 'staff_required' }, 403);
        recipientIds = [thread.user_id];
        compose = (r) => ({ title: COPY[r.lang].supportTeam, body: isAttachment ? COPY[r.lang].sentImage : rawPreview || COPY[r.lang].newMessage });
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
        // Staff read Vietnamese.
        compose = () => ({ title: 'Tin nhắn hỗ trợ mới', body: isAttachment ? COPY.vi.sentImage : rawPreview || COPY.vi.newMessage });
      }
    }

    recipientIds = [...new Set(recipientIds)].filter(Boolean);
    if (!recipientIds.length) return json({ sent: 0 });

    const { data: profiles, error: profileError } = await admin.from('profiles').select('id, language, country').in('id', recipientIds);
    if (profileError) throw profileError;
    const recipients = new Map<string, Recipient>();
    for (const p of profiles ?? []) {
      const lang = asLang(p.language);
      recipients.set(p.id, { id: p.id, lang, market: marketOf(p.country, lang) });
    }

    const { data: tokens, error: tokenError } = await admin.from('push_tokens').select('user_id, expo_push_token').in('user_id', recipientIds);
    if (tokenError) throw tokenError;
    const seen = new Set<string>();
    const messages: Array<Record<string, unknown>> = [];
    for (const row of tokens ?? []) {
      if (!row.expo_push_token || seen.has(row.expo_push_token)) continue;
      const recipient = recipients.get(row.user_id) ?? { id: row.user_id, lang: 'vi' as Lang, market: 'VN' as Market };
      const message = compose(recipient);
      if (!message) continue;
      seen.add(row.expo_push_token);
      messages.push({ to: row.expo_push_token, title: message.title, body: message.body, data, sound: 'ting.wav', channelId: 'default-v2', priority: 'high' });
    }
    if (!messages.length) return json({ sent: 0 });

    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const tickets: unknown[] = [];
    for (let index = 0; index < messages.length; index += 100) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
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
