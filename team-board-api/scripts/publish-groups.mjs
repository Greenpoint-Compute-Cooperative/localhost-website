// Run locally with the private Blob token obtained through authenticated Vercel CLI.
// This script makes no LLM calls and exposes no HTTP endpoint.
import { readFile } from 'node:fs/promises';
import { participants, saveGroups } from '../lib/store.js';
import { validateTeams } from '../lib/core.js';

const [file, action] = process.argv.slice(2);
if (!file || (action && action !== '--publish')) {
  console.error('Usage: node --env-file=/private/production.env scripts/publish-groups.mjs draft.json [--publish]');
  process.exit(1);
}
const draft = JSON.parse(await readFile(file, 'utf8'));
const current = await participants({ fresh: true });
const teams = validateTeams(draft.teams, current);
console.log(`Validated ${teams.length} teams for ${current.length} current participants.`);
if (action === '--publish') {
  const saved = await saveGroups(teams, current);
  console.log(`Published ${saved.updatedAt}`);
} else {
  console.log('Dry run only. Add --publish to make these groups public.');
}
