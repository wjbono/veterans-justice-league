# VJL Cloudflare media backend

This directory contains the deployable Worker source and D1 schema for the Veterans Justice League media workflow and private website administration.

## Expected Cloudflare resources

- R2 bucket: `vjl-media`
- D1 database: `vjl-media`
- Worker: `vjl-media-api`
- Cloudflare Images binding: `IMAGES`
- Worker secret: `ADMIN_TOKEN`

`ADMIN_TOKEN` is no longer a normal client login credential. It is retained server-side as the internal credential used by the authentication wrapper to call the existing media engine, and as the one-time setup key used to create the first Administrator account. After bootstrap, normal users sign in only with their own usernames and passwords.

## Multi-user administration

D1 is authoritative for administrator/editor accounts and sessions.

Roles:

- **Administrator** — full media management, user management, and advanced maintenance.
- **Editor** — upload, review, approve, publish, archive, reject, caption, categorize, and otherwise manage media. Editors cannot manage users or advanced maintenance.

The first Administrator is created once through `/admin/` after deployment. The page detects that no users exist and presents the one-time setup form. The setup form requires the existing `ADMIN_TOKEN`, a display name, username, and password. Once the first account exists, the bootstrap endpoint refuses to create another bootstrap administrator.

Administrators then use `/admin/users.html` to:

- create users
- edit display names and usernames
- assign Administrator or Editor roles
- enable or disable accounts
- reset passwords
- delete accounts
- view account status and last sign-in information

New users and password-reset users receive a temporary password and are forced to change it before any administration endpoint can be used. The final active Administrator cannot be disabled, deleted, or demoted. A signed-in Administrator also cannot disable, delete, or demote their own account through the user-management UI/API.

Security behavior:

- Passwords are salted and hashed with PBKDF2-HMAC-SHA-256 before storage. Plaintext passwords are never stored.
- Each session uses a random opaque token. Only a SHA-256 hash of that token is stored in D1.
- Sessions expire after seven days and can be revoked immediately.
- Password changes/resets revoke existing sessions for that user.
- Disabling or deleting a user revokes that user's sessions.
- Five failed sign-in attempts within the login window temporarily lock that username.
- Media history records the authenticated username for user-driven upload/review/publish actions instead of the old generic `admin` actor.
- Normal client authentication never exposes or stores `ADMIN_TOKEN` in browser storage.

Authentication tables are created lazily by the Worker on first use and are also included in `schema.sql` for clean deployments.

## Upload folders

```text
incoming/
  housing/
  behind-the-wall/
  outreach/
  events/
  team/
  partners/
  unsorted/
```

The Worker scans these prefixes on a schedule and through `POST /api/admin/sync`. Folder placement pre-populates category. `incoming/unsorted/` remains uncategorized and cannot be approved or published until a category is selected. Zero-byte R2 folder-marker objects are ignored and their stale D1 rows are cleaned automatically.

## Ingestion validation

Incoming R2 objects are validated before a new D1 media row enters the review workflow.

Current policy:

- Maximum object size: 20 MB.
- Accepted image content: JPEG, PNG, and WebP.
- The file extension must be `.jpg`, `.jpeg`, `.png`, or `.webp` and must agree with the detected image signature.
- A stored R2 content type, when present, must agree with the detected image type. `application/octet-stream` is tolerated.
- Empty objects and unsupported/mismatched files fail ingestion validation.

A failed object is retained in R2, recorded in D1 as `rejected`, receives the normal 30-day retention date, and stores `validation_code` plus `validation_message` for the reviewer. It is not automatically deleted. A failed object cannot be approved or published unless the source object is replaced with a supported image, synchronized again, and then restored for review.

The validation policy lives in `src/media-policy.js` and is covered by `tests/media-policy.test.mjs`.

## Media lifecycle

The implemented lifecycle is:

`UPLOAD → PENDING → REVIEW → APPROVED → PROCESSING → PUBLISHED → ARCHIVED`

A pending/reviewed item can also move to `REJECTED`.

- New valid R2 objects become `pending` when incoming folders are synchronized.
- Invalid R2 objects are retained but enter `rejected` with the validation reason stored in D1.
- `review` is an explicit reviewer state.
- `approve` requires a category.
- `publish` moves an approved item to `processing`, generates required derivatives, and only then moves it to `published`.
- If derivative processing fails, the item returns to `approved` and remains non-public.
- `archive` removes published media from public API results without deleting the original or derivatives.
- Archived media can be republished while derivatives remain available.
- Rejected media receives a 30-day retention date and is not automatically destroyed.
- State changes and important metadata actions are recorded in `media_history`.

## Image processing and derivatives

Publishing uses the Cloudflare Images binding to process the retained R2 original and writes optimized WebP derivatives back to R2.

| Variant | Maximum width | WebP quality | R2 key |
| --- | ---: | ---: | --- |
| Thumbnail | 480 px | 78 | `published/<media-id>/thumb.webp` |
| Normal web | 1280 px | 82 | `published/<media-id>/web.webp` |
| Large/lightbox | 1920 px | 85 | `published/<media-id>/large.webp` |

Processing uses `fit: scale-down`, so small images are not enlarged. Image transforms remove metadata from derivatives. The original R2 object is retained unchanged for archival/reprocessing purposes and is not the normal public delivery target.

D1 stores `thumb_key`, `web_key`, and `large_key` after all required derivatives are created successfully. Partial derivatives are removed if processing fails.

## Public API

- `GET /api/media?status=published`
- `GET /api/media?status=published&category=housing`
- `GET /api/media?status=published&gallery=housing`
- `GET /api/galleries`
- `GET /media/:id?size=thumb`
- `GET /media/:id?size=web`
- `GET /media/:id?size=large`

Only `published` media is available publicly. `size=original` is reserved for authenticated administration.

## Authentication API

Public/setup routes:

- `GET /api/auth/status` — reports whether first-account bootstrap is required.
- `POST /api/auth/bootstrap` — one-time first-Administrator creation; requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `POST /api/auth/login` — username/password sign-in.
- `GET /api/auth/session` — validate the current bearer session.
- `POST /api/auth/logout` — revoke the current session.
- `POST /api/auth/change-password` — change the signed-in user's password and issue a replacement session.

Normal authentication responses issue an opaque bearer session token. Browser storage contains only that session token, never a password or `ADMIN_TOKEN`.

## Authenticated media API

The browser sends the user's opaque session token. The wrapper authenticates and authorizes the user, then forwards allowed media requests to the existing media engine using the server-side `ADMIN_TOKEN`.

- `POST /api/admin/upload`
- `GET /api/admin/media?status=pending`
- `GET /api/admin/media?status=rejected`
- `PATCH /api/admin/media/:id`
- `PATCH /api/admin/media/bulk`
- `GET /api/admin/galleries`

Administrators additionally have:

- `POST /api/admin/sync`
- `POST /api/admin/galleries/seed`
- `POST /api/admin/cleanup-orphans`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`

Supported user-management PATCH actions are `update`, `enable`, `disable`, and `reset_password`.

## Gallery metadata

D1 includes a `galleries` table. Default gallery groups are VJL Housing, Behind-the-Wall Training, Outreach, Events, Team, and Partners.

The public Gallery page consumes `/api/galleries`. The homepage Recent Moments block consumes `GET /api/media?status=published&limit=4`.

## Tests and deployment validation

From the `worker/` directory:

```text
npm test
```

The GitHub Pages workflow also syntax-checks all public/admin JavaScript and Worker JavaScript, runs the media policy tests, validates the static site, assembles the publishable artifact, and smoke-tests the deployed admin assets.

End-to-end authentication, D1, R2, and Images behavior still requires the deployed Worker because GitHub Pages does not execute Worker code.

## Deploy/update procedure

1. Confirm the `IMAGES`, `MEDIA`, and `DB` bindings are configured.
2. Keep `ADMIN_TOKEN` configured as a strong Worker secret. Do not share it with normal users.
3. Ensure `ALLOWED_ORIGINS` contains the GitHub Pages origin during development and the production VJL origin after cutover.
4. Deploy the latest Worker code.
5. Open `/admin/`.
6. On the first deployment with no `admin_users` rows, use the one-time setup screen to create the first Administrator. Enter the existing `ADMIN_TOKEN` only into the setup-key field.
7. Sign out and sign back in with that individual account to verify normal login.
8. Open `/admin/users.html` and create at least one test Editor account with a temporary password.
9. Verify the Editor is forced to change that password, can manage media, and cannot open user administration or advanced maintenance.
10. Verify an Administrator can edit/disable/enable/reset/delete a second account and cannot disable/delete/demote the final active Administrator.
11. Re-test upload → review → approve → publish → archive → republish and confirm the authenticated username appears in media audit fields.

Existing media, galleries, and media history are not replaced by this authentication upgrade.

## Important deployment note

GitHub Pages deploys the static administration interface automatically. The Cloudflare Worker must still be redeployed separately after Worker source changes. Production DNS should not be changed during this development/testing process.
