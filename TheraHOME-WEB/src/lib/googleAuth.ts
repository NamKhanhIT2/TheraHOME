// Google sign-in via Supabase Auth's web redirect flow. Simpler than the
// mobile app's expo-web-browser session dance — the browser client's
// default `detectSessionInUrl` handles the PKCE code exchange automatically
// once Google redirects back to `redirectTo`, so no server callback route
// is needed. Requires its own Google Cloud OAuth client redirect URI
// registration — see CLAUDE.md's Manual setup section.
import { supabase } from "./supabase";

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/verify`,
      // prompt=select_account so the chooser always appears — see the same
      // note in AuthPanel.tsx. It matters more here: this is the staff door,
      // and a specialist on a shared machine must be able to pick.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  // On success the browser navigates away to Google immediately — nothing
  // more happens on this page.
}
