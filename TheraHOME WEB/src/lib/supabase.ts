import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Same Supabase project as TheraHOME APP (nyjvtvmllwbyfokldgtj) — see
// CLAUDE.md. Browser client only for now; add a server client (@supabase/ssr)
// once route handlers/middleware need session-aware server-side access.
export const supabase = createClient(supabaseUrl, supabaseKey);
