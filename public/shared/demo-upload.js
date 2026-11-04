// Demo file upload for /submit: R2 multipart through GPCC Forms (src/lib/demos.ts). The file goes up
// in the server's fixed parts (8 MiB), three at a time, each retried with backoff; finished parts are
// remembered in this browser, so a dropped connection or a reload resumes where it stopped when the
// same file is picked again. One room on one wifi at 5:00 PM is the case this is for.
import { FORMS_API } from "./forms.js";

const SLUG = "localhost-project";
const PARALLEL = 3;
const TRIES = 7;
const EXT = /\.(mp4|mov|webm|m4v)$/i;
export const MAX_MB = 500;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (path, body) => {
  const r = await fetch(`${FORMS_API}/api/f/${SLUG}/demo/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) { const e = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return j;
};

/** null if fine, else what's wrong with the picked file. */
export function checkFile(file) {
  if (!EXT.test(file.name)) return "Pick an .mp4, .mov or .webm file.";
  if (file.size > MAX_MB * 1024 * 1024) return `That file is ${Math.round(file.size / 1048576)} MB; the cap is ${MAX_MB} MB. Export at 1080p, or paste a link.`;
  if (!file.size) return "That file is empty.";
  return null;
}

/**
 * Uploads `file` for the entry with edit key `edit`. onProgress(fraction, text). Resolves {key, size};
 * rejects with a message when it gives up (the caller offers "Retry", which resumes).
 */
export async function uploadDemo(edit, file, onProgress = () => {}) {
  const fp = `${file.name}|${file.size}|${file.lastModified}`;
  const sk = `localhost-demo-up:${edit}`;
  let st = store.get(sk);
  if (!st || st.fp !== fp) {
    onProgress(0, "starting…");
    const ext = file.name.match(EXT)[1].toLowerCase();
    const s = await post("start", { edit, size: file.size, ext });
    st = { fp, key: s.key, uploadId: s.uploadId, partSize: s.partSize, parts: {} };
    store.set(sk, st);
  }
  const total = Math.ceil(file.size / st.partSize);
  const todo = [];
  for (let n = 1; n <= total; n++) if (!st.parts[n]) todo.push(n);
  let sent = Object.keys(st.parts).length * st.partSize;
  const t0 = Date.now(), sent0 = sent;
  const report = () => {
    const done = Math.min(sent, file.size);
    const rate = (done - sent0) / Math.max(1, (Date.now() - t0) / 1000);
    const eta = rate > 0 ? Math.round((file.size - done) / rate) : 0;
    onProgress(done / file.size, `${Math.round(done / 1048576)} / ${Math.round(file.size / 1048576)} MB${eta > 3 ? ` · ~${eta > 90 ? Math.round(eta / 60) + " min" : eta + " s"} left` : ""}`);
  };
  report();

  let expired = false;
  async function sendPart(n) {
    const blob = file.slice((n - 1) * st.partSize, Math.min(n * st.partSize, file.size));
    for (let i = 0; i < TRIES; i++) {
      try {
        const r = await fetch(`${FORMS_API}/api/f/${SLUG}/demo/part?key=${encodeURIComponent(st.key)}&uploadId=${encodeURIComponent(st.uploadId)}&n=${n}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Edit-Key": edit }, body: blob });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.etag) { st.parts[n] = j.etag; store.set(sk, st); sent += blob.size; report(); return; }
        if (r.status === 409) { expired = true; throw new Error(j.error || "expired"); }
        if (r.status === 403 || r.status === 404 || r.status === 413) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { fatal: true });
      } catch (e) { if (e.fatal || expired) throw e; }
      onProgress(Math.min(sent, file.size) / file.size, `wifi hiccup, retrying part ${n}…`);
      await sleep(Math.min(30000, 1000 * 2 ** i));
    }
    throw new Error("The connection keeps dropping.");
  }
  try {
    const queue = [...todo];
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => { while (queue.length) await sendPart(queue.shift()); }));
  } catch (e) {
    if (expired) store.del(sk); // the next try starts a fresh upload
    throw e;
  }
  onProgress(1, "finishing…");
  const parts = Object.entries(st.parts).map(([n, etag]) => ({ partNumber: +n, etag }));
  try {
    const done = await post("complete", { edit, key: st.key, uploadId: st.uploadId, parts });
    store.del(sk);
    return done;
  } catch (e) {
    if (e.status === 409) store.del(sk);
    throw e;
  }
}
