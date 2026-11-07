import { createHash, timingSafeEqual } from 'node:crypto';
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function text(value, label, max, required = false) {
  if (typeof value !== 'string' && value !== undefined) throw new ApiError(400, `${label} must be text.`);
  const result = (value || '').trim();
  if (required && !result) throw new ApiError(400, `${label} is required.`);
  if (result.length > max) throw new ApiError(400, `${label} must be ${max} characters or fewer.`);
  return result;
}
export function participantInput(body) {
  return { name: text(body.name, 'Name', 80, true), idea: text(body.idea, 'Idea', 1500, true), skills: text(body.skills, 'Skills', 240) };
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export const publicParticipant = ({ id, name, idea, skills, createdAt }) => ({ id, name, idea, skills, createdAt });
export function validateTeams(teams, participants) {
  if (!Array.isArray(teams) || !teams.length) throw new ApiError(400, 'Provide at least one team.');
  const available = new Set(participants.map(p => p.id));
  const seen = new Set();
  const result = teams.map(team => {
    if (!team || !Array.isArray(team.members) || team.members.length > 5 || team.members.length < (participants.length === 1 ? 1 : 2)) throw new ApiError(400, 'Each team must have 2–5 people (one if only one person joined).');
    const members = team.members.map(id => {
      if (!available.has(id) || seen.has(id)) throw new ApiError(400, 'Team members must be current participant IDs, each used once.');
      seen.add(id); return id;
    });
    return { name: text(team.name, 'Team name', 100, true), summary: text(team.summary, 'Team summary', 800, true), members };
  });
  if (seen.size !== available.size) throw new ApiError(400, 'Every current participant must be assigned exactly once. Refresh the board and try again.');
  return result;
}
