// Show why the last sign-in failed, and whether a password has been set up yet
const MESSAGES = {
  wrong: "That password is not right. Try again.",
  wait: "Too many wrong passwords. Wait 15 minutes, then try again.",
  nopassword: 'No password has been set yet. On the server run: cd /srv/bsrea/monitoring && npm run set-password',
};
try {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
} catch { /* private window */ }
const show = (text) => {
  const el = document.getElementById("error");
  el.textContent = text;
  el.hidden = false;
};
const error = new URLSearchParams(location.search).get("error");
if (MESSAGES[error]) show(MESSAGES[error]);
fetch("/api/login-status").then((r) => r.json()).then((s) => { if (!s.passwordSet) show(MESSAGES.nopassword); }).catch(() => {});
