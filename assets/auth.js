import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./auth-config.js";

const DOWNLOAD_URL = "https://github.com/Urjitpatel28/SwMacroFlow.Releases/releases/latest/download/SwMacroFlowSetup.exe";
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
    password: String(data.get("password") || "")
  };
}

function validateCredentials(fields) {
  if (!fields.email) return "Enter your email address.";
  if (!fields.password) return "Enter your password.";
  return "";
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

function insertBeforeDownload(container, element) {
  const download = container.querySelector(`a[href="${DOWNLOAD_URL}"]`);
  container.insertBefore(element, download || null);
}

function renderAuthNav(session) {
  const navs = [
    document.querySelector(".nav-links"),
    document.getElementById("mobileNav")
  ].filter(Boolean);

  navs.forEach((nav) => {
    nav.querySelectorAll("[data-auth-nav]").forEach((el) => el.remove());

    if (session) {
      insertBeforeDownload(nav, authLink("account.html", "Account", { "data-auth-nav": "account" }));
      const signOut = authLink("#", "Sign out", { "data-auth-nav": "signout" });
      signOut.addEventListener("click", async (event) => {
        event.preventDefault();
        if (supabase) await supabase.auth.signOut();
        window.location.href = "index.html";
      });
      insertBeforeDownload(nav, signOut);
    } else {
      insertBeforeDownload(nav, authLink("login.html", "Login", { "data-auth-nav": "login" }));
    }
  });
}

async function refreshAuthNav() {
  if (!supabase) {
    renderAuthNav(null);
    return;
  }

  const { data } = await supabase.auth.getSession();
  renderAuthNav(data.session);
}

async function signInWithProvider(provider) {
  if (!supabase) throw new Error(authMissingMessage());

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getRedirectUrl("account.html")
    }
  });
  if (error) throw error;
}

function bindProviderButtons(status) {
  document.querySelectorAll("[data-auth-provider]").forEach((button) => {
    button.addEventListener("click", async () => {
      setStatus(status, "", "neutral");
      button.disabled = true;
      try {
        await signInWithProvider(button.dataset.authProvider);
      } catch (error) {
        setStatus(status, error.message, "error");
        button.disabled = false;
      }
    });
  });
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
    root.querySelector("[data-auth-switch-signin]").hidden = isSignup;
    root.querySelector("[data-auth-switch-signup]").hidden = !isSignup;
  }

  root.querySelectorAll("[data-auth-show]").forEach((button) => {
    button.addEventListener("click", () => {
      setStatus(status, "", "neutral");
      setLoginMode(button.dataset.authShow);
    });
  });

  if (window.location.hash.replace("#", "") === "signup") {
    setLoginMode("signup");
  }

  if (!supabase) {
    setStatus(status, authMissingMessage(), "error");
    root.querySelectorAll("form button, [data-auth-provider]").forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  bindProviderButtons(status);

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

    window.location.href = "account.html";
  });

  const signup = root.querySelector("[data-auth-signup-form]");
  signup?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "", "neutral");

    const fields = getAuthFields(signup);
    const validationError = validateCredentials(fields);
    if (validationError) {
      setStatus(status, validationError, "error");
      return;
    }

    setBusy(signup, true);
    const { error } = await supabase.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        emailRedirectTo: getRedirectUrl("account.html")
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
  const signedIn = root.querySelector("[data-auth-signed-in]");
  const signedOut = root.querySelector("[data-auth-signed-out]");
  const urlError = getErrorFromUrl();
  if (urlError) setStatus(status, urlError, "error");

  if (!supabase) {
    setStatus(status, authMissingMessage(), "error");
    signedIn.hidden = true;
    signedOut.hidden = false;
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus(status, error.message, "error");
  }

  const session = data?.session;
  signedIn.hidden = !session;
  signedOut.hidden = !!session;
  if (session && email) email.textContent = session.user.email || "Signed in";

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
