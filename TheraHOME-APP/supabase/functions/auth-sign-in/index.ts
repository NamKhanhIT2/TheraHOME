// `npm:` is resolved by Supabase Edge Runtime's package cache. The JSR
// registry may reject anonymous manifest fetches during CLI bundling.
import { createClient } from 'npm:@supabase/supabase-js@2';

// The sign-in form accepts "email or username", but Supabase Auth only ever
// authenticates by email. Resolving that here rather than in the app is a
// deliberate privacy choice: an RPC that answered "which email belongs to
// this username?" would let anyone walk the user list and harvest addresses.
// Nothing in the response distinguishes an unknown name from a wrong
// password, so this endpoint cannot be used to discover who has an account
// either — both come back as `invalid_credentials`.
//
// The password itself is verified by Supabase Auth, which owns the hashing
// and its own rate limits. This function never stores or logs it.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let identifier = '';
  let password = '';
  try {
    const body = await req.json();
    identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!identifier || !password) return json({ error: 'bad_request' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  let email = identifier;

  if (!identifier.includes('@')) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await admin
      .from('profiles')
      .select('email')
      .ilike('username', identifier)
      .maybeSingle();
    if (error) {
      console.error('auth-sign-in: username lookup failed', error.message);
      return json({ error: 'server_error' }, 500);
    }
    // Deliberately the same answer as a wrong password.
    if (!data?.email) return json({ error: 'invalid_credentials' }, 401);
    email = data.email;
  }

  // A plain anon client, so Supabase Auth applies exactly the same checks and
  // rate limits it would if the app had called signInWithPassword itself.
  const auth = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // `email_not_confirmed` is worth telling the user apart: they have the
    // right password and just need to finish the code we already emailed
    // them, and the app routes them straight to the OTP screen.
    const code = error?.code === 'email_not_confirmed' ? 'email_not_confirmed' : 'invalid_credentials';
    return json({ error: code, email: code === 'email_not_confirmed' ? email : undefined }, 401);
  }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
