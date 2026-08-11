// Makes the nav reflect whether anyone is signed in.
//
// Pages render the signed-out state in their HTML and this upgrades it. The other way round -
// render nothing, then fill it in once Supabase answers - means the nav visibly pops in on every
// page load, including for the majority who are signed out and would never see it change.
//
// Elements opt in with data-account="signed-in" or "signed-out"; anything without the attribute is
// left alone. That keeps the markup honest about which links are conditional, rather than hiding
// the rule in a list of element ids here.

import { supabase } from "./auth.js";

function apply(signedIn) {
  for (const node of document.querySelectorAll("[data-account]")) {
    const wantsSignedIn = node.dataset.account === "signed-in";
    node.hidden = wantsSignedIn !== signedIn;
  }
}

async function refresh() {
  try {
    const { data } = await supabase.auth.getSession();
    apply(Boolean(data?.session));
  } catch {
    // A licence server that cannot be reached is not a reason to break the marketing page. The
    // signed-out nav is already on screen and is the safe thing to leave showing.
  }
}

await refresh();

// Covers signing out in another tab, and the moment a session is established by a redirect landing
// on this page.
supabase.auth.onAuthStateChange(() => refresh());
