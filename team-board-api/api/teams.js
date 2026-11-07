import { randomBytes, randomUUID } from 'node:crypto';
import { ApiError, participantInput, publicParticipant, sameSecret, tokenHash } from '../lib/core.js';
import { headers, reply, body, bearer, isAdmin, failure } from '../lib/http.js';
import * as store from '../lib/store.js';
export default async function handler(req, res) {
  headers(res);
  if (req.method === 'OPTIONS') return reply(res, 204);
  try {
    if (req.method === 'GET') {
      const participants = await store.participants();
      return reply(res, 200, { participants, groups: await store.latestGroups(participants) });
    }
    if (req.method === 'POST') {
      const input = participantInput(await body(req));
      const editToken = randomBytes(32).toString('base64url');
      const record = { ...input, id: randomUUID(), createdAt: new Date().toISOString(), editTokenHash: tokenHash(editToken) };
      await store.addParticipant(record);
      return reply(res, 201, { participant: publicParticipant(record), editToken });
    }
    if (req.method === 'DELETE') {
      const id = new URL(req.url, 'https://board.invalid').searchParams.get('id');
      const record = await store.participant(id);
      if (!record) throw new ApiError(404, 'Entry not found.');
      if (!isAdmin(req) && !sameSecret(tokenHash(bearer(req)), record.editTokenHash)) throw new ApiError(401, 'Your entry token or organizer key is required.');
      await store.removeParticipant(id);
      return reply(res, 200, { deleted: id });
    }
    throw new ApiError(405, 'Method not allowed.');
  } catch (error) { failure(res, error); }
}
