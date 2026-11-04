// Project submissions (GPCC Forms `localhost-project`): the tracks, and how links are cleaned up.
// Used by submit.html (teams) and projects.html (organizers, judges' sheets, the big screen).
// Values must match gpcc-forms src/src/forms/localhost-project.ts.

export const TRACKS = [
  { value: "t01", n: "01", name: "Sovereign Agentic Organization" },
  { value: "t21", n: "2.1", name: "Most production-ready product" },
  { value: "t22", n: "2.2", name: "Own the model" },
  { value: "t23", n: "2.3", name: "Private inference you can check" },
  { value: "t24", n: "2.4", name: "Private cooperation" },
  { value: "none", n: "—", name: "Sponsor bounties only" },
];
export const BOUNTIES = [
  { value: "tinfoil", name: "Tinfoil" },
  { value: "darkbloom", name: "Darkbloom" },
  { value: "superlinked", name: "Superlinked" },
  { value: "cognee", name: "Cognee" },
];

/** "@ada", "ada", "github.com/ada" → "ada"; anything else null. */
export function ghUser(v) {
  let s = String(v).trim().replace(/^@/, "");
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)\/?$/i);
  if (m) s = m[1];
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(s) ? s : null;
}

/** "owner/repo", "github.com/owner/repo(.git)", a tree/blob link → "https://github.com/owner/repo"; else null. */
export function repoUrl(v) {
  const s = String(v).trim();
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:[/?#].*)?$/i) || s.match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}/${m[2]}` : null;
}

/** Any http(s) link; a bare "youtu.be/…" or "loom.com/…" gets https:// in front. */
export function videoUrl(v) {
  let s = String(v).trim();
  if (!/^https?:\/\//i.test(s) && /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.href : null;
  } catch { return null; }
}

/** An embeddable player for YouTube, Loom, Vimeo and Google Drive links; null for anything else. */
export function embedUrl(v) {
  let u;
  try { u = new URL(v); } catch { return null; }
  const h = u.hostname.replace(/^(www|m)\./, "");
  let id;
  if (h === "youtu.be") id = u.pathname.slice(1);
  else if (h === "youtube.com") id = u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/) || [])[1];
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  if (h === "loom.com") { const m = u.pathname.match(/^\/(?:share|embed)\/([0-9a-f]{20,40})/); if (m) return `https://www.loom.com/embed/${m[1]}?autoplay=1&hide_owner=true`; }
  if (h === "vimeo.com") { const m = u.pathname.match(/^\/(\d{5,12})/); if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1`; }
  if (h === "drive.google.com") { const m = u.pathname.match(/^\/file\/d\/([\w-]{10,})/); if (m) return `https://drive.google.com/file/d/${m[1]}/preview`; }
  return null;
}
