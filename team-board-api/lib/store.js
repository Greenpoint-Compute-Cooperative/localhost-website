import { get, put, list, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { ApiError, publicParticipant } from './core.js';
const ROOT = 'team-board-v1/';
const immutableReads = new Map();
let participantListCache;
let participantListExpires = 0;
let listingParticipants;
function invalidateParticipants() { participantListExpires = 0; participantListCache = undefined; }
const participantPath = id => `${ROOT}participants/${id}.json`;
export const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
async function read(pathname) {
  if (immutableReads.has(pathname)) return immutableReads.get(pathname);
  const pending = (async () => {
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result) return null;
    return new Response(result.stream).json();
  })();
  immutableReads.set(pathname, pending);
  if (immutableReads.size > 600) immutableReads.delete(immutableReads.keys().next().value);
  try {
    const value = await pending;
    if (!value) immutableReads.delete(pathname);
    return value;
  } catch (error) { immutableReads.delete(pathname); throw error; }
}
async function paths(prefix) {
  let cursor; const entries = [];
  do {
    const page = await list({ prefix, cursor, limit: 500 });
    entries.push(...page.blobs);
    if (entries.length > 500) throw new ApiError(503, 'The board is full. Please contact the organizers.');
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return entries;
}
async function loadParticipants() {
  const entries = await paths(`${ROOT}participants/`);
  const records = [];
  // Bounded concurrency keeps a busy room from producing a burst of 500 reads.
  for (let i = 0; i < entries.length; i += 20) {
    records.push(...await Promise.all(entries.slice(i, i + 20).map(p => read(p.pathname))));
  }
  return records.filter(Boolean).map(publicParticipant).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function participants({ fresh = false } = {}) {
  if (fresh) return loadParticipants();
  if (participantListCache && Date.now() < participantListExpires) return participantListCache;
  if (!listingParticipants) listingParticipants = loadParticipants().then(value => {
    participantListCache = value;
    participantListExpires = Date.now() + 2500;
    return value;
  }).finally(() => { listingParticipants = undefined; });
  return listingParticipants;
}
export async function participant(id) {
  if (!validId(id)) throw new ApiError(400, 'Invalid participant ID.');
  return read(participantPath(id));
}
export async function addParticipant(record) {
  await put(participantPath(record.id), JSON.stringify(record), { access: 'private', addRandomSuffix: false, contentType: 'application/json' });
  invalidateParticipants();
}
export async function removeParticipant(id) {
  if (!validId(id)) throw new ApiError(400, 'Invalid participant ID.');
  await del(participantPath(id));
  immutableReads.delete(participantPath(id));
  invalidateParticipants();
}
export async function latestGroups(currentParticipants) {
  const entries = await paths(`${ROOT}groups/`);
  const latest = entries.sort((a, b) => b.pathname.localeCompare(a.pathname))[0];
  if (!latest) return null;
  const snapshot = await read(latest.pathname);
  if (!snapshot) return null;
  const ids = currentParticipants.map(p => p.id).sort();
  return { ...snapshot, stale: JSON.stringify(ids) !== JSON.stringify([...snapshot.participantIds].sort()) };
}
export async function saveGroups(teams, currentParticipants) {
  const updatedAt = new Date().toISOString();
  const snapshot = { teams, updatedAt, participantIds: currentParticipants.map(p => p.id) };
  await put(`${ROOT}groups/${updatedAt}-${randomUUID()}.json`, JSON.stringify(snapshot), { access: 'private', addRandomSuffix: false, contentType: 'application/json' });
  return { ...snapshot, stale: false };
}
