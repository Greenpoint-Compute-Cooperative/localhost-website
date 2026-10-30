// The hacker application: email, GitHub, X (optional). Shared by the home page (the form sits
// under the first line) and /apply (the standalone page ads and share links point at). Posts JSON
// to GPCC Forms `localhost-hacker`; on success the form becomes the "packet delivered" screen with
// the applicant's own share link. dmarz 2026-10-30: three fields, no questions.
import { FORMS_API, REF } from "./forms.js";
import { SOURCE, convert } from "./track.js";

// GitHub goes in as https://github.com/<user or path>; X as https://x.com/<handle>, left out when empty.
export function githubUrl(v) {
  const s = v.trim().replace(/^@/, "");
  if (/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(s)) return "https://github.com/" + s;
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^?#]+)/i);
  const path = m ? m[1].replace(/\/+$/, "") : "";
  return path ? "https://github.com/" + path : null;
}
export function xUrl(v) {
  const s = v.trim().replace(/^@/, "");
  if (/^[A-Za-z0-9_]{1,15}$/.test(s)) return "https://x.com/" + s;
  const m = s.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})\/?(?:[?#].*)?$/i);
  return m ? "https://x.com/" + m[1] : null;
}
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// After an application: the share step. Each applicant's link carries their own code.
// 265 of X's 280 (a link counts as 23). The blank line is meant.
export const tweetText = (code) => `I applied to hack on open harnesses, open agent memory, and open weights to accelerate the future of Sovereign AI at LOCALHOST, Nov 7 in NYC! Want to hack with me? Register here: https://localhostai.nyc/apply.html?ref=${code}\n\n(yes, that's a referral code. it boosts my chances of getting in)`;

export function doneHTML(code) {
  const share = code ? `<p class="lead">Boost your chance of getting accepted by tweeting out the event.</p>
    <p class="tweet">${esc(tweetText(code))}</p>
    <div class="row2"><a class="b pri" href="https://x.com/intent/post?text=${encodeURIComponent(tweetText(code))}" target="_blank" rel="noopener noreferrer">Post on X ↗</a></div>` : "";
  return `<h2 class="done">Packet delivered to localhost 🗽</h2>
    <p class="lead">We confirm hackers by email through Friday, Nov 6.</p>
    <div class="accel" role="progressbar" aria-label="Future acceleration" aria-valuetext="in progress"><span class="lbl">Future acceleration:</span><div class="bar"><i></i></div><span class="st">in progress</span></div>
    ${share}`;
}

/** Wires a form holding inputs named email, github, x (+ the Turnstile widget). `msg` shows errors. */
export function wireApplyForm(form, msg, { scrollTo } = {}) {
  if (REF) form.insertAdjacentHTML("beforeend", `<input type="hidden" name="ref" value="${REF}">`);
  // Turnstile is rendered explicitly (api.js?render=explicit): the home page builds its form after
  // api.js may already have scanned the page, so implicit rendering could miss it and no token ever
  // arrived. Cloudflare's always-pass test key on localhost (see forms.js).
  const ts = form.querySelector(".cf-turnstile");
  let widget = null;
  const renderTurnstile = () => {
    if (!ts || widget !== null || !window.turnstile) return;
    widget = window.turnstile.render(ts, {
      sitekey: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "1x00000000000000000000AA" : "0x4AAAAAAFLsrU-_juvQUw02",
      action: ts.dataset.action, theme: ts.dataset.theme || "dark", size: ts.dataset.size || "flexible", appearance: ts.dataset.appearance || "always",
    });
  };
  renderTurnstile();
  if (widget === null) { const t = setInterval(() => { renderTurnstile(); if (widget !== null) clearInterval(t); }, 100); setTimeout(() => clearInterval(t), 30000); }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    for (const k of ["email", "github"]) {
      if (!String(body[k] ?? "").trim()) { msg.textContent = k === "email" ? "Email: we need one to confirm you." : "GitHub: a username or a github.com link."; form.elements[k]?.focus(); return; }
    }
    const gh = githubUrl(body.github);
    if (!gh) { msg.textContent = "GitHub: a username or a github.com link."; form.elements.github?.focus(); return; }
    body.github = gh;
    if (!String(body.x ?? "").trim()) delete body.x;
    else {
      const x = xUrl(body.x);
      if (!x) { msg.textContent = "X: a @handle or an x.com link."; form.elements.x?.focus(); return; }
      body.x = x;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    // Turnstile runs invisibly and fills cf-turnstile-response when done. A fast applicant can click
    // before it has: wait for it, and if Cloudflare wants a click (the checkbox appears), say so.
    const token = () => form.querySelector('[name="cf-turnstile-response"]')?.value || "";
    if (!token()) {
      msg.textContent = "checking you're human…";
      for (const t0 = Date.now(); !token() && Date.now() - t0 < 20000; ) await new Promise((r) => setTimeout(r, 250));
      if (!token()) { msg.textContent = "Tick the Cloudflare box below, then Apply again."; btn.disabled = false; return; }
    }
    msg.textContent = "sending…";
    try {
      const res = await fetch(FORMS_API + "/api/f/localhost-hacker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...SOURCE }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.fieldErrors ? Object.values(data.fieldErrors).join(" ") : data.error || "HTTP " + res.status);
      convert("hacker");
      form.classList.add("sent");
      form.innerHTML = doneHTML(/^[a-z2-7]{8}$/.test(data.ref || "") ? data.ref : "");
      (scrollTo || form).scrollIntoView({ block: "start", behavior: "smooth" });
    } catch (err) {
      msg.textContent = /spam check/i.test(err.message) ? "Cloudflare wants a click: tick the box below, then Apply again." : err.message || "Something broke. Try again in a moment.";
      if (!/spam check/i.test(err.message) && widget !== null) window.turnstile?.reset(widget);
      btn.disabled = false;
    }
  });
}
