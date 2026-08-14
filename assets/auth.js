import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./auth-config.js";

const CONFIGURED =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

const supabase = CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

function getRedirectUrl(path) {
  return new URL(path, window.location.origin + window.location.pathname).href;
}

function setStatus(target, message, tone) {
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone || "neutral";
  target.hidden = !message;
}

function setBusy(form, busy) {
  if (!form) return;
  form.querySelectorAll("button, input").forEach((el) => {
    el.disabled = busy;
  });
}

function getAuthFields(form) {
  const data = new FormData(form);
  return {
    email: String(data.get("email") || "").trim(),
    password: String(data.get("password") || ""),
    // Only the sign-up form carries these; sign-in simply gets empty strings.
    displayName: String(data.get("displayName") || "").trim(),
    confirm: String(data.get("confirm") || "")
  };
}

function validateCredentials(fields) {
  if (!fields.email) return "Enter your email address.";
  if (!fields.password) return "Enter your password.";
  return "";
}

function validateSignup(fields) {
  if (!fields.displayName) return "Enter a display name.";
  const credentialError = validateCredentials(fields);
  if (credentialError) return credentialError;
  if (fields.password !== fields.confirm) return "Passwords do not match.";
  return "";
}

// Accounts created before display names existed have no name stored, so fall back through
// the other metadata keys and finally to the email's local part.
function displayNameOf(user) {
  const meta = user?.user_metadata || {};
  const name = String(meta.display_name || meta.full_name || meta.name || "").trim();
  if (name) return name;
  return String(user?.email || "").split("@")[0] || "Account";
}

// Where to land after signing in. Anything that is not a plain same-directory page is
// discarded: taking the parameter at face value would make this an open redirect.
function getNextUrl() {
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return /^[a-z0-9_-]+\.html(#[\w-]*)?$/i.test(next) ? next : "account.html";
}

function getErrorFromUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("error_description") || query.get("error_description") || "";
}

function authMissingMessage() {
  return "Supabase is not configured yet. Update assets/auth-config.js with your project URL and publishable key.";
}

function authLink(href, text, attrs) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) a.setAttribute(key, value);
  });
  return a;
}

async function signOut() {
  if (supabase) await supabase.auth.signOut();
  window.location.href = "index.html";
}

function closeAccountMenus(except) {
  document.querySelectorAll(".nav-account-toggle[aria-expanded='true']").forEach((toggle) => {
    if (toggle === except) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.nextElementSibling.hidden = true;
  });
}

// Desktop: the account link becomes a name button with an Account / Sign out dropdown.
function buildAccountMenu(name) {
  const wrap = document.createElement("div");
  wrap.className = "nav-account";
  wrap.setAttribute("data-auth-nav", "menu");

  const toggle = document.createElement("button");
  toggle.className = "nav-account-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-haspopup", "true");
  toggle.innerHTML = '<span class="nav-account-name"></span><span class="nav-account-caret"></span>';
  toggle.querySelector(".nav-account-name").textContent = name;

  const menu = document.createElement("div");
  menu.className = "nav-account-menu";
  menu.hidden = true;
  menu.appendChild(authLink("account.html", "Account"));

  const out = document.createElement("button");
  out.type = "button";
  out.textContent = "Sign out";
  out.addEventListener("click", signOut);
  menu.appendChild(out);

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    closeAccountMenus(toggle);
    toggle.setAttribute("aria-expanded", open ? "false" : "true");
    menu.hidden = open;
  });

  wrap.append(toggle, menu);
  return wrap;
}

function renderAuthNav(session) {
  const desktop = document.querySelector(".nav-links");
  const mobile = document.getElementById("mobileNav");
  const name = session ? displayNameOf(session.user) : "";

  // Runs again on every auth state change, so reset to the signed-out shape each pass
  // before re-applying: the Account link is markup, everything else is injected.
  [desktop, mobile].filter(Boolean).forEach((nav) => {
    nav.querySelectorAll("[data-auth-nav]").forEach((el) => el.remove());
    const account = nav.querySelector("[data-auth-account]");
    if (!account) return;
    account.hidden = false;
    account.href = session ? "account.html" : "login.html";
  });

  if (!session) return;

  const desktopAccount = desktop?.querySelector("[data-auth-account]");
  if (desktopAccount) {
    desktopAccount.hidden = true;
    desktop.insertBefore(buildAccountMenu(name), desktopAccount);
  }

  // Mobile stays a flat list: the name is a heading above the existing Account row.
  const mobileAccount = mobile?.querySelector("[data-auth-account]");
  if (mobileAccount) {
    const heading = document.createElement("p");
    heading.className = "nav-mobile-user";
    heading.textContent = name;
    heading.setAttribute("data-auth-nav", "user");
    mobile.insertBefore(heading, mobileAccount);

    const out = document.createElement("button");
    out.className = "nav-mobile-signout";
    out.type = "button";
    out.textContent = "Sign out";
    out.setAttribute("data-auth-nav", "signout");
    out.addEventListener("click", signOut);
    mobile.appendChild(out);
  }
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".nav-account")) closeAccountMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAccountMenus();
});

async function refreshAuthNav() {
  if (!supabase) {
    renderAuthNav(null);
    return;
  }

  const { data } = await supabase.auth.getSession();
  renderAuthNav(data.session);
}

function bindPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    const input = button.closest(".password-field")?.querySelector("input");
    if (!input) return;

    button.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.dataset.visible = show ? "true" : "false";
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });
}

function bindLoginPage() {
  const root = document.querySelector("[data-auth-login-page]");
  if (!root) return;

  const status = root.querySelector("[data-auth-status]");
  const urlError = getErrorFromUrl();
  if (urlError) setStatus(status, urlError, "error");

  function setLoginMode(mode) {
    const isSignup = mode === "signup";
    root.querySelector("[data-auth-signin-form]").hidden = isSignup;
    root.querySelector("[data-auth-signup-form]").hidden = !isSignup;
    root.querySelector("[data-auth-copy-signin]").hidden = isSignup;
    root.querySelector("[data-auth-copy-signup]").hidden = !isSignup;
    root.querySelectorAll("[data-auth-show]").forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.authShow === mode));
    });
  }

  root.querySelectorAll("[data-auth-show]").forEach((button) => {
    button.addEventListener("click", () => {
      setStatus(status, "", "neutral");
      setLoginMode(button.dataset.authShow);
    });
  });

  function applyHashMode() {
    if (window.location.hash.replace("#", "") === "signup") {
      setLoginMode("signup");
    }
  }

  // The trial CTA points at login.html#signup, so it also fires while already on this page.
  applyHashMode();
  window.addEventListener("hashchange", () => {
    setStatus(status, "", "neutral");
    applyHashMode();
  });

  if (!supabase) {
    setStatus(status, authMissingMessage(), "error");
    root.querySelectorAll("form button").forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  const signin = root.querySelector("[data-auth-signin-form]");
  signin?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "", "neutral");

    const fields = getAuthFields(signin);
    const validationError = validateCredentials(fields);
    if (validationError) {
      setStatus(status, validationError, "error");
      return;
    }

    setBusy(signin, true);
    const { error } = await supabase.auth.signInWithPassword({
      email: fields.email,
      password: fields.password
    });

    setBusy(signin, false);
    if (error) {
      setStatus(status, error.message, "error");
      return;
    }

    window.location.href = getNextUrl();
  });

  const signup = root.querySelector("[data-auth-signup-form]");
  signup?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "", "neutral");

    const fields = getAuthFields(signup);
    const validationError = validateSignup(fields);
    if (validationError) {
      setStatus(status, validationError, "error");
      return;
    }

    setBusy(signup, true);
    const { error } = await supabase.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        emailRedirectTo: getRedirectUrl("account.html"),
        data: { display_name: fields.displayName }
      }
    });

    setBusy(signup, false);
    if (error) {
      setStatus(status, error.message, "error");
      return;
    }

    setStatus(status, "Check your email to confirm your account, then return to sign in.", "success");
    signup.reset();
  });

  const reset = root.querySelector("[data-auth-reset-form]");
  reset?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "", "neutral");

    const form = new FormData(reset);
    setBusy(reset, true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      String(form.get("email") || "").trim(),
      { redirectTo: getRedirectUrl("reset-password.html") }
    );

    setBusy(reset, false);
    if (error) {
      setStatus(status, error.message, "error");
      return;
    }

    setStatus(status, "Password reset email sent.", "success");
    reset.reset();
  });
}

async function bindAccountPage() {
  const root = document.querySelector("[data-auth-account-page]");
  if (!root) return;

  const status = root.querySelector("[data-auth-status]");
  const email = root.querySelector("[data-auth-email]");
  const name = root.querySelector("[data-auth-name]");
  const signedIn = root.querySelector("[data-auth-signed-in]");
  const urlError = getErrorFromUrl();
  if (urlError) setStatus(status, urlError, "error");

  if (!supabase) {
    setStatus(status, authMissingMessage(), "error");
    signedIn.hidden = true;
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus(status, error.message, "error");
  }

  const session = data?.session;
  if (!session) {
    // replace(), not assign(): going Back from the login page should not bounce here again.
    window.location.replace("login.html?next=account.html");
    return;
  }

  signedIn.hidden = false;
  if (email) email.textContent = session.user.email || "Signed in";
  if (name) name.textContent = displayNameOf(session.user);

  const profile = root.querySelector("[data-auth-profile-form]");
  const profileInput = profile?.querySelector("[name='displayName']");
  if (profileInput) profileInput.value = displayNameOf(session.user);

  profile?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "", "neutral");

    const nextName = String(new FormData(profile).get("displayName") || "").trim();
    if (!nextName) {
      setStatus(status, "Enter a display name.", "error");
      return;
    }

    setBusy(profile, true);
    const { data: updated, error: updateError } = await supabase.auth.updateUser({
      data: { display_name: nextName }
    });

    setBusy(profile, false);
    if (updateError) {
      setStatus(status, updateError.message, "error");
      return;
    }

    setStatus(status, "Display name updated.", "success");
    if (name) name.textContent = displayNameOf(updated.user);
    // Refresh the nav tab so the new name shows without a reload.
    renderAuthNav({ user: updated.user });
  });

  root.querySelector("[data-auth-signout]")?.addEventListener("click", async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setStatus(status, signOutError.message, "error");
      return;
    }
    window.location.href = "index.html";
  });
}

async function bindResetPage() {
  const root = document.querySelector("[data-auth-reset-page]");
  if (!root) return;

  const status = root.querySelector("[data-auth-status]");
  const requestPanel = root.querySelector("[data-auth-reset-request]");
  const updatePanel = root.querySelector("[data-auth-reset-update]");
  const urlError = getErrorFromUrl();
  if (urlError) setStatus(status, urlError, "error");

  if (!supabase) {
    setStatus(status, authMissingMessage(), "error");
    root.querySelectorAll("form button, form input").forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  function showUpdatePassword(show) {
    requestPanel.hidden = show;
    updatePanel.hidden = !show;
  }

  const { data } = await supabase.auth.getSession();
  showUpdatePassword(!!data.session);

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" || session) {
      showUpdatePassword(true);
    }
  });

  const request = root.querySelector("[data-auth-reset-form]");
  request?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "", "neutral");

    const form = new FormData(request);
    setBusy(request, true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      String(form.get("email") || "").trim(),
      { redirectTo: getRedirectUrl("reset-password.html") }
    );

    setBusy(request, false);
    if (error) {
      setStatus(status, error.message, "error");
      return;
    }

    setStatus(status, "Password reset email sent.", "success");
    request.reset();
  });

  const update = root.querySelector("[data-auth-update-password-form]");
  update?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "", "neutral");

    const form = new FormData(update);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (password !== confirm) {
      setStatus(status, "Passwords do not match.", "error");
      return;
    }

    setBusy(update, true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(update, false);
    if (error) {
      setStatus(status, error.message, "error");
      return;
    }

    setStatus(status, "Password updated. Redirecting to your account...", "success");
    setTimeout(() => {
      window.location.href = "account.html";
    }, 900);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindPasswordToggles();
  await refreshAuthNav();
  bindLoginPage();
  await bindAccountPage();
  await bindResetPage();

  if (supabase) {
    supabase.auth.onAuthStateChange((_event, session) => {
      renderAuthNav(session);
    });
  }
});
