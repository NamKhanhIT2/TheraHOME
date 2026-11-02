import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Market = 'VN' | 'US' | 'MALAY';
type Language = 'vi' | 'en' | 'ms';

interface OrderInput {
  storeItemId?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  quantity?: number;
  note?: string;
}

interface CatalogItem {
  id: string;
  name: string;
  price_text: string;
  discount_percent: number;
  market: Market;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function amountFrom(priceText: string): number | null {
  const digits = priceText.replace(/\D/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatPrice(amount: number, market: Market): string {
  if (market === 'VN') return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
  if (market === 'MALAY') return `RM ${amount.toLocaleString('ms-MY', { maximumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function orderMessage({
  language,
  reference,
  item,
  originalPrice,
  discountedPrice,
  discountPercent,
  quantity,
  total,
  customerName,
  phone,
  address,
  note,
}: {
  language: Language;
  reference: string;
  item: CatalogItem;
  originalPrice: string;
  discountedPrice: string;
  discountPercent: number;
  quantity: number;
  total: string;
  customerName: string;
  phone: string;
  address: string;
  note: string | null;
}) {
  const copy = language === 'en'
    ? {
        title: 'IN-APP ORDER', product: 'Product', price: 'List price', discount: 'Member price',
        quantity: 'Quantity', total: 'Total', customer: 'Customer', phone: 'Phone', address: 'Delivery address', note: 'Note',
      }
    : language === 'ms'
      ? {
          title: 'PESANAN DALAM APLIKASI', product: 'Produk', price: 'Harga asal', discount: 'Harga ahli',
          quantity: 'Kuantiti', total: 'Jumlah', customer: 'Pelanggan', phone: 'Telefon', address: 'Alamat penghantaran', note: 'Nota',
        }
      : {
          title: 'ĐƠN HÀNG TRONG ỨNG DỤNG', product: 'Sản phẩm', price: 'Giá gốc', discount: 'Giá thành viên',
          quantity: 'Số lượng', total: 'Tổng cộng', customer: 'Khách hàng', phone: 'Điện thoại', address: 'Địa chỉ giao hàng', note: 'Ghi chú',
        };

  return [
    `🛒 ${copy.title} · #${reference}`,
    `${copy.product}: ${item.name}`,
    `${copy.price}: ${originalPrice}`,
    `${copy.discount} (-${discountPercent}%): ${discountedPrice}`,
    `${copy.quantity}: ${quantity}`,
    `${copy.total}: ${total}`,
    '',
    `${copy.customer}: ${customerName}`,
    `${copy.phone}: ${phone}`,
    `${copy.address}: ${address}`,
    ...(note ? [`${copy.note}: ${note}`] : []),
  ].join('\n');
}

/** What the buyer sees in their own notification inbox. The order details
 * themselves are already in the support thread this points at, so this is a
 * receipt and a way back in, not a second copy of the order. */
function orderReceipt(language: Language, reference: string, productName: string, total: string) {
  if (language === 'en') {
    return {
      title: `Order received · #${reference}`,
      body: `${productName} — ${total}. TheraHOME Support will call to confirm.`,
    };
  }
  if (language === 'ms') {
    return {
      title: `Pesanan diterima · #${reference}`,
      body: `${productName} — ${total}. Sokongan TheraHOME akan menelefon untuk mengesahkan.`,
    };
  }
  return {
    title: `Đã nhận đơn hàng · #${reference}`,
    body: `${productName} — ${total}. CSKH TheraHOME sẽ gọi xác nhận với bạn.`,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = request.headers.get('Authorization') ?? '';
    const token = authorization.replace(/^Bearer\s+/i, '');
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, serviceKey);
    const { data: { user }, error: userError } = await caller.auth.getUser(token);
    if (userError || !user) return json({ error: 'unauthorized' }, 401);

    const input = await request.json() as OrderInput;
    const customerName = input.customerName?.trim() ?? '';
    const phone = input.phone?.trim() ?? '';
    const phoneDigits = phone.replace(/\D/g, '');
    const address = input.address?.trim() ?? '';
    const note = input.note?.trim() || null;
    const quantity = Number.isInteger(input.quantity) ? Number(input.quantity) : 0;

    if (!input.storeItemId) return json({ error: 'store_item_required' }, 400);
    if (customerName.length < 2 || customerName.length > 100) return json({ error: 'invalid_customer_name' }, 400);
    if (phoneDigits.length < 7 || phoneDigits.length > 15) return json({ error: 'invalid_phone' }, 400);
    if (address.length < 8 || address.length > 500) return json({ error: 'invalid_address' }, 400);
    if (quantity < 1 || quantity > 10) return json({ error: 'invalid_quantity' }, 400);
    if ((note?.length ?? 0) > 500) return json({ error: 'note_too_long' }, 400);

    const { data, error } = await admin
      .from('store_items')
      .select('id, name, price_text, discount_percent, market')
      .eq('id', input.storeItemId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: 'store_item_not_found' }, 404);
    const item = data as CatalogItem;

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('country, language')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.country && profile.country !== item.market) {
      return json({ error: 'store_item_not_available_in_market' }, 400);
    }

    const original = amountFrom(item.price_text);
    if (!original) return json({ error: 'invalid_catalog_price' }, 500);
    const discountPercent = Math.min(100, Math.max(0, Number(item.discount_percent) || 0));
    const discounted = Math.round(original * (1 - discountPercent / 100) * 100) / 100;
    const totalAmount = discounted * quantity;
    const originalPrice = formatPrice(original, item.market);
    const discountedPrice = formatPrice(discounted, item.market);
    const total = formatPrice(totalAmount, item.market);

    const { data: existingThread, error: threadError } = await admin
      .from('chat_threads')
      .select('id')
      .eq('user_id', user.id)
      .eq('kind', 'human')
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (threadError) throw threadError;

    let threadId = existingThread?.id as string | undefined;
    if (!threadId) {
      const { data: created, error: createError } = await admin
        .from('chat_threads')
        .insert({ user_id: user.id, kind: 'human' })
        .select('id')
        .single();
      if (createError) throw createError;
      threadId = created.id;
    }

    const reference = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const language: Language = profile?.language === 'en' || profile?.language === 'ms' ? profile.language : 'vi';

    // The order itself, as a row. Everything after this — the chat message,
    // the alerts, the push — is how people FIND OUT about an order; this is
    // what the order IS, and it is the only write below allowed to fail the
    // request. Until 2026-11-01 it did not exist: an order lived solely as a
    // paragraph of text inside a support thread, so nothing could list,
    // search, count or close one.
    const { data: orderRow, error: orderError } = await admin
      .from('app_orders')
      .insert({
        reference,
        user_id: user.id,
        store_item_id: item.id,
        product_name: item.name,
        market: item.market,
        quantity,
        list_price: original,
        unit_price: discounted,
        discount_percent: discountPercent,
        total_amount: totalAmount,
        customer_name: customerName,
        phone,
        phone_digits: phoneDigits,
        address,
        note,
        thread_id: threadId,
      })
      .select('id')
      .single();
    if (orderError) throw orderError;
    const body = orderMessage({
      language,
      reference,
      item,
      originalPrice,
      discountedPrice,
      discountPercent,
      quantity,
      total,
      customerName,
      phone,
      address,
      note,
    });
    const { data: message, error: messageError } = await admin
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender_type: 'user',
        sender_id: user.id,
        body,
      })
      .select('id, created_at')
      .single();
    if (messageError) throw messageError;

    // Backlink to the message, best effort: the order row is complete and
    // workable without it, so a failure here must not undo a placed order.
    const { error: linkError } = await admin
      .from('app_orders')
      .update({ message_id: message.id })
      .eq('id', orderRow.id);
    if (linkError) {
      console.error('place-app-order: order backlink failed:', linkError.message);
    }

    // Everything below is about making sure an order is NOT missed. None of
    // it may fail the order itself: at this point the order exists, it is in
    // the customer's support thread, and CSKH can find it there even if
    // every alert below goes wrong.

    // The chat-message trigger has already raised a staff alert for this
    // thread, but it titles every one of them "<name> nhắn tin" — an order
    // then looks exactly like someone asking a question. Retitle that row
    // rather than raising a second one, so the specialist's reply still
    // closes it and the console badge still counts one thing.
    const alertTitle = `Đơn hàng mới · ${item.name}`;
    const alertSummary = `#${reference} · ${quantity} × ${discountedPrice} = ${total} · ${customerName} · ${phone}`;

    try {
      const { data: retitled, error: alertError } = await admin
        .from('staff_alerts')
        .update({ title: alertTitle, body: alertSummary })
        .eq('kind', 'chat')
        .eq('dedupe_key', threadId)
        .is('handled_at', null)
        .select('id');
      if (alertError) throw alertError;
      if (!retitled?.length) {
        await admin.rpc('raise_staff_alert', {
          p_kind: 'chat',
          p_dedupe_key: threadId,
          p_customer: user.id,
          p_title: alertTitle,
          p_body: alertSummary,
          p_thread: threadId,
        });
      }
    } catch (alertError) {
      console.error('place-app-order: staff alert failed:', alertError instanceof Error ? alertError.message : alertError);
    }

    // Staff have a second inbox: `notify_chat_message_inbox` puts every
    // incoming message into `notifications` as "Tin nhắn hỗ trợ mới". The
    // test order on 2026-11-01 showed an order sitting under that generic
    // title in the staff app while the push and the console both said
    // "Đơn hàng mới". Same row, same fix as the alert above: retitle what
    // the trigger wrote rather than add a second notification. Scoped by
    // the message's own timestamp — the trigger runs inside this insert's
    // transaction, so its rows carry it — or it would also rewrite older
    // unread messages from the same thread.
    try {
      const { error: staffInboxError } = await admin
        .from('notifications')
        .update({ title: alertTitle, body: alertSummary })
        .eq('related_chat_thread_id', threadId)
        .neq('user_id', user.id)
        .gte('created_at', message.created_at);
      if (staffInboxError) throw staffInboxError;
    } catch (staffInboxError) {
      console.error('place-app-order: staff inbox failed:', staffInboxError instanceof Error ? staffInboxError.message : staffInboxError);
    }

    // The buyer's own receipt. Nothing inserts into `notifications` on its
    // own for the person who placed the order, so one used to leave no
    // trace anywhere the customer could see (owner, 2026-11-01).
    try {
      const receipt = orderReceipt(language, reference, item.name, total);
      const { error: notificationError } = await admin.from('notifications').insert({
        user_id: user.id,
        type: 'chat',
        title: receipt.title,
        body: receipt.body,
        related_chat_thread_id: threadId,
        destination: 'chat',
        actor_is_official: true,
      });
      if (notificationError) throw notificationError;
    } catch (notificationError) {
      console.error('place-app-order: receipt failed:', notificationError instanceof Error ? notificationError.message : notificationError);
    }

    // The staff push used to be fired by the app AFTER this function
    // returned, so an order placed on a phone that was then backgrounded,
    // killed or taken out of signal reached nobody. It belongs on this side
    // of the wire. `staffNotified` in the reply is how the app knows not to
    // send its own: an app talking to an older copy of this function sees no
    // such field, falls back to pushing itself, and neither version of the
    // pair can leave an order silent or push it twice.
    let staffNotified = false;
    try {
      const pushResponse = await fetch(`${url}/functions/v1/dispatch-push`, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'chat',
          threadId,
          senderType: 'user',
          alert: 'order',
          preview: `🛒 ${item.name} · ${total}`,
        }),
      });
      if (!pushResponse.ok) throw new Error(`dispatch-push ${pushResponse.status}`);
      staffNotified = true;
    } catch (pushError) {
      console.error('place-app-order: staff push failed:', pushError instanceof Error ? pushError.message : pushError);
    }

    return json({
      ok: true,
      staffNotified,
      reference,
      threadId,
      messageId: message.id,
      productName: item.name,
      originalPrice,
      discountedPrice,
      total,
      discountPercent,
    });
  } catch (error) {
    console.error('place-app-order failed:', error instanceof Error ? error.message : error);
    return json({ error: 'order_failed' }, 500);
  }
});
