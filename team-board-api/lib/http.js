import { ApiError } from './core.js';
export function headers(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}
export const reply = (res, status, data) => { res.statusCode = status; res.end(data === undefined ? undefined : JSON.stringify(data)); };
export const bearer = req => /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1] || '';
export async function body(req, maxBytes = 8192) {
  if (Number(req.headers['content-length'] || 0) > maxBytes) throw new ApiError(413, 'Request is too large.');
  let raw;
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) throw new ApiError(413, 'Request is too large.');
      chunks.push(Buffer.from(chunk));
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw) > maxBytes) throw new ApiError(413, 'Request is too large.');
  let parsed;
  try { parsed = JSON.parse(raw || '{}'); } catch { throw new ApiError(400, 'Send valid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ApiError(400, 'Send a JSON object.');
  return parsed;
}
export function failure(res, error) {
  if (!error.status) console.error('Team board operation failed:', error.name, error.message);
  reply(res, error.status || 503, { error: error.status ? error.message : 'The board is temporarily unavailable. Please try again.' });
}
