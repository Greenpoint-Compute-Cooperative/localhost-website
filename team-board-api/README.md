# LOCALHOST team board API

Vercel Node functions backed by private Vercel Blob. Public view/add; deletion requires the token returned on creation, or organizer key. All responses disable caching and allow CORS `*`. No cookies or participant accounts.

Environment: `BLOB_READ_WRITE_TOKEN`, `TEAM_ADMIN_KEY`, `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default `gpt-4.1-mini`). Keep server-side.

- `GET /api/teams` → `{participants:[{id,name,idea,skills,createdAt}],groups:null|{teams,updatedAt,participantIds,stale}}`.
- `POST /api/teams` JSON `{name,idea,skills?}` → 201 `{participant,editToken}`. Save token locally to remove own entry. Name and idea mandatory, limits 80/1500/240 characters.
- `DELETE /api/teams?id=UUID` with `Authorization: Bearer EDIT_TOKEN` or organizer key → `{deleted:id}`.
- `POST /api/teams/group` organizer Bearer key, body `{}` → draft `{teams:[{name,summary,members:[IDs]}],participantIds,generatedAt}`. Does not publish.
- Same endpoint/key, body `{teams:[...]}` → publish `{groups}`. Validates every current participant exactly once, 2–5 per team (singleton only with one total participant). Rejects stale drafts missing new people.

8 KiB submission request limit; organizer grouping accepts up to 128 KiB. Participant listing has a 2.5-second per-instance cache; immutable record reads are cached per-instance, with fresh listing for group generation and publishing. Immutable unique per-person records prevent concurrent submissions overwriting others. Group snapshots append-only, latest wins, stale flag when participant IDs change. Up to 500 records per prefix, paginated and read with bounded parallelism. Public projection never includes edit token hashes. `npm test` validates input, grouping invariants, secret projection/auth boundaries, and malformed requests. Exercise concurrent adds and actual Blob integration on deployment as well.

SDK reference: https://vercel.com/docs/vercel-blob/using-blob-sdk
