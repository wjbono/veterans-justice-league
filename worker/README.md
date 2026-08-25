# VJL Cloudflare media backend

This directory contains the deployable Worker source and D1 schema for the locked VJL media workflow.

## Expected Cloudflare resources

- R2 bucket: `vjl-media`
- D1 database: `vjl-media`
- Worker: `vjl-media-api`
- Worker secret: `ADMIN_TOKEN`

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

The Worker scans these prefixes on a schedule and through `POST /api/admin/sync`. Folder placement pre-populates category. `incoming/unsorted/` remains uncategorized and cannot be approved or published until a category is selected.

## Media lifecycle

The implemented lifecycle is:

`UPLOAD → PENDING → REVIEW → APPROVED → PROCESSING → PUBLISHED → ARCHIVED`

A reviewed item can also move to `REJECTED`.

- New R2 objects become `pending` when the incoming folders are synchronized.
- `review` is an explicit reviewer state.
- `approve` moves an item to `approved` and requires a category.
- `publish` passes through `processing` and then `published`.
- `archive` removes media from public display without deleting the original.
- Archived media can be republished.
- Rejected media receives a 30-day retention date.
- Rejected media is **not automatically deleted** after 30 days. Permanent deletion requires an authenticated explicit request with a second confirmation safeguard after the retention period expires.
- State changes and important metadata actions are recorded in `media_history`.

At this stage the Worker serves the original R2 object as the delivery fallback for published media. True thumbnail, web-size, lightbox-size, WebP, and AVIF derivative generation remains a separate implementation step. The schema already contains `thumb_key`, `web_key`, and `large_key` for those derivatives.

## Public API

- `GET /api/media?status=published`
- `GET /api/media?status=published&category=housing`
- `GET /api/media?status=published&gallery=housing`
- `GET /api/galleries`
- `GET /media/:id`

Only `published` media is available through the public endpoints.

## Admin API

Requires `Authorization: Bearer <ADMIN_TOKEN>`.

- `POST /api/admin/sync` — scan incoming R2 prefixes into D1
- `GET /api/admin/media?status=pending` — list media for review
- `PATCH /api/admin/media/:id` — save metadata or perform lifecycle actions
- `PATCH /api/admin/media/bulk` — bulk save/category/gallery/approve/publish/reject/archive actions
- `POST /api/admin/galleries/seed` — seed the default gallery groups
- `GET /api/admin/galleries` — list gallery definitions

Supported single-item actions include `review`, `approve`, `publish`, `reject`, `archive`, `restore`, and guarded `permanent-delete`.

Permanent deletion is intentionally excluded from bulk actions.

## Gallery metadata

D1 includes a `galleries` table. The default gallery groups are:

- VJL Housing
- Behind-the-Wall Training
- Outreach
- Events
- Team
- Partners

The public Gallery page can consume `/api/galleries` once the Worker is connected. Until then, it uses the matching local placeholder collections in `assets/js/config.js`.

## After Cloudflare resources are created

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Replace the D1 database ID.
3. Apply `schema.sql` to D1.
4. Set `ADMIN_TOKEN` as a Worker secret.
5. Set `ALLOWED_ORIGINS` to the temporary GitHub Pages origin and, later, the production VJL origin.
6. Deploy the Worker.
7. Open `/admin/`, enter the admin token, run **Seed gallery groups**, then **Sync incoming folders**.
8. Set `API_BASE` in `assets/js/config.js` to the Worker URL.
9. Verify the public Gallery page and admin review workflow against the live Worker/R2/D1 backend.

## Important deployment note

The Cloudflare ChatGPT integration is not available for this project, so resource creation and deployment must be performed manually in Cloudflare. The repository is structured so that those manual steps are configuration/deployment work rather than additional application design work.
