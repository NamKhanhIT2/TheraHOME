// Apple sign-in via Supabase Auth's web redirect flow — mirrors
// googleAuth.ts exactly. Requires its own Apple Developer configuration
// (Services ID, Key ID, private key) registered as the Supabase project's
// Apple provider, plus this origin's redirect URI — see CLAUDE.md's Manual
// setup section; not something that can be completed from this repo alone.
import { supabase } from "./supabase";

export async function signInWithApple() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: `${window.location.origin}/verify` },
  });
  if (error) throw error;
}
