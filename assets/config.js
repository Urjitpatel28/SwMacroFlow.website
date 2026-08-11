// Supabase project the account pages talk to. Filled in when the project exists - see
// backend/README.md.
//
// The anon key belongs in a public file. It is an identifier carrying the `anon` role, not a
// credential: row-level security lets a signed-in user read their own licence row and nothing else,
// no policy anywhere grants a write, and every mutation happens inside a SECURITY DEFINER function
// that only the service-role key can call. That key, and the Google and Microsoft client secrets,
// never leave Supabase.

export const SUPABASE_URL = "https://egqgwkrxinmlfmcuadlp.supabase.co";

// Supabase's newer publishable key format, replacing the legacy JWT-shaped anon key. Same role, and
// the same reasoning above about why it belongs in a file served to every visitor.
export const SUPABASE_ANON_KEY = "sb_publishable_leOadXmb5UMAcW9tw1g-qQ_S1jUr1P9";

export const SITE_URL = "https://swmacroflow.in";
export const SUPPORT_EMAIL = "support@swmacroflow.in";
