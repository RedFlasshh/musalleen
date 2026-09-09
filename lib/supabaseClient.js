import { createClient } from "@supabase/supabase-js";

// PKCE forced explicitly — required for the native-Capacitor OAuth redirect
// exchange (see app/page.js's appUrlOpen listener) to work at all.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { flowType: "pkce" } }
);
