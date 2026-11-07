# LOCALHOST team board API

Vercel Node functions backed by private Vercel Blob. Public view/add; deletion requires the private receipt token returned on creation. CORS allows `*`; no participant login or cookies.

Only server environment: `BLOB_READ_WRITE_TOKEN`. There is no organizer key, public administration endpoint, or LLM credential/call in this application.

- `GET /api/teams` → `{participants:[{id,name,idea,skills,createdAt}],groups:null|{teams,updatedAt,participantIds,stale}}`.
- `POST /api/teams` JSON `{name,idea,skills?}` → 201 `{participant,editToken}`. Save token locally to remove own entry. Name and idea mandatory; limits80/1500/240 characters.
- `DELETE /api/teams?id=UUID` with `Authorization: Bearer EDIT_TOKEN` → `{deleted:id}`.
- `/api/teams/group` is removed and must return404. Old organizer links have no authority.

## Grouping through chat

Brenner asks his chat agent to read the public board and reason about teams in the chat model. No site-hosted LLM call is involved. Once groups are ready, the agent writes JSON `{teams:[{name,summary,members:[IDs]}]}` outside the shared checkout. Use authenticated Vercel CLI to obtain this project's private Blob environment, then run locally from `team-board-api/`:

```
vercel env pull /private/production.env --environment production --yes --scope tychohq
node --env-file=/private/production.env scripts/publish-groups.mjs /private/draft.json
node --env-file=/private/production.env scripts/publish-groups.mjs /private/draft.json --publish
```

First command for the script is a dry run. Publication validates every current participant exactly once,2–5 per team (singleton only with one total participant); it rejects missing, duplicate or unknown people. This writes directly to private Blob using credentials held only by the authenticated agent, with no public write endpoint for groups. Published results are visible at `/teams?view=groups`.

Deploy backend manually with `vercel deploy --prod --yes --scope tychohq --cwd team-board-api` from the repository root. Frontend deployment remains Cloudflare from main. Remove historical Vercel deployments containing retired administration functions when revoking that functionality.

8KiB submission limit. Participant listing has a2.5second per-instance cache; immutable record reads are cached, fresh listing before group publication. Unique per-person records prevent concurrent overwrite. Group snapshots append-only, latest wins, stale flag when IDs change. Public responses omit edit-token hashes. `npm test` checks validation, group invariants, private field projection, and request boundaries.
