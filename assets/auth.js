// Shared helpers for the account pages.
//
// These pages are plain static HTML with no build step, matching the rest of the site, so
// supabase-js comes from an ESM CDN and everything else here is a few dozen lines of glue.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL, SUPPORT_EMAIL } from "./config.js";

export { SITE_URL, SUPPORT_EMAIL };

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Writes to the page's one status line. Every page has exactly one, so a second message replaces
// the first rather than stacking up messages the user has to read in order.
export function say(text, kind = "") {
  const node = document.getElementById("message");
  if (!node) return;
  node.textContent = text || "";
  node.className = "message" + (kind ? " " + kind : "");
}

export function busy(on, ...buttons) {
  for (const button of buttons) {
    if (button) button.disabled = on;
  }
}

// Supabase's messages are decent but occasionally speak in API terms. These are the few worth
// rewriting; anything else is passed through, because an accurate unfamiliar message beats a
// friendly wrong one.
export function readable(error) {
  if (!error) return "";

  const message = error.message || String(error);

  if (/invalid login credentials/i.test(message)) {
    return "That email address and password did not match an account.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Confirm your email address first — check your inbox for the link we sent.";
  }
  if (/for security purposes|rate limit|too many/i.test(message)) {
    return "Too many attempts just now. Wait a minute and try again.";
  }
  if (/user already registered/i.test(message)) {
    return "There is already an account with that email address. Sign in instead.";
  }
  if (/password should be/i.test(message)) {
    return "Choose a password of at least six characters.";
  }
  if (/failed to fetch|networkerror/i.test(message)) {
    return "Could not reach the licence server. Check your connection and try again.";
  }

  return message;
}

// Browser sign-in with Google or Microsoft. `azure` is Supabase's name for the Microsoft provider -
// it predates the Entra rename and is still what the API expects.
export async function signInWithProvider(provider, redirectTo) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo || `${SITE_URL}/account.html` },
  });

  if (error) say(readable(error), "error");
}

export async function requireSession() {
  const { data } = await supabase.auth.getSession();

  if (!data?.session) {
    // Send them where they were going after signing in, rather than dumping them on the account
    // page with no idea why.
    const back = encodeURIComponent(location.pathname.replace(/^\//, ""));
    location.replace(`login.html?next=${back}`);
    return null;
  }

  return data.session;
}

// Calls one of the licensing Edge Functions with the signed-in user's token.
//
// Note what is not here: any attempt to read or write the licences table directly. RLS would allow
// the read, but every mutation has to go through these functions - they are where the row lock and
// the device-change rules live.
export async function callFunction(name, session, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { ok: response.ok, status: response.status, payload };
}

// The entitlement is a signed blob the desktop app verifies; the website only needs to read it, and
// only to display it. No signature check here - a browser reading its own account page has nothing
// to gain by lying to itself, and shipping a public key to do it would imply otherwise.
export function readEntitlement(token) {
  try {
    const segment = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const padded = segment + "=".repeat((4 - (segment.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch {
    return null;
  }
}

export function formatDate(iso) {
  const date = new Date(iso);
  if (isNaN(date)) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}
