# VJL Cloudflare media backend

This directory contains the deployable Worker source and D1 schema for the locked VJL media workflow.

## Expected Cloudflare resources

- R2 bucket: `vjl-media`
- D1 database: `vjl-media`
- Worker: `vjl-media-api`
- Cloudflare Images binding: `IMAGES`
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

## Ingestion validation

Incoming R2 objects are validated before a new D1 media row enters the review workflow.

Current policy:

- Maximum object size: 20 MB, matching the Cloudflare Images binding input limit used by the publishing pipeline.
- Accepted image content: JPEG, PNG, and WebP.
- The file extension must be `.jpg`, `.jpeg`, `.png`, or `.webp` and must agree with the detected image signature.
- A stored R2 content type, when present, must agree with the detected image type. `application/octet-stream` is tolerated because some upload tools use it generically.
- Empty objects and unsupported/mismatched files fail ingestion validation.

A failed object is retained in R2, recorded in D1 as `rejected`, receives the normal 30-day retention date, and stores `validation_code` plus `validation_message` for the reviewer. It is not automatically deleted. The admin interface surfaces the validation reason. A failed object cannot be approved or published unless the source object is replaced with a supported image, synchronized again, and then restored for review.

The validation policy lives in `src/media-policy.js` and is covered by `tests/media-policy.test.mjs`.

## Media lifecycle

The implemented lifecycle is:

`UPLOAD → PENDING → REVIEW → APPROVED → PROCESSING → PUBLISHED → ARCHIVED`

A pending/reviewed item can also move to `REJECTED`.

- New valid R2 objects become `pending` when the incoming folders are synchronized.
- Invalid R2 objects are retained but enter `rejected` with the validation reason stored in D1.
- `review` is an explicit reviewer state.
- `approve` moves an item to `approved` and requires a category.
- `publish` is allowed only from `approved`. It moves the item to `processing`, generates the required derivatives, and only then moves the item to `published`.
- If derivative processing fails, the item returns to `approved` and remains non-public.
- `archive` is allowed only for published media and removes it from public API results without deleting the original or derivatives.
- Archived media can be republished because its derivatives remain in R2.
- Rejected media receives a 30-day retention date.
- Rejected media is **not automatically deleted** after 30 days. Permanent deletion requires an authenticated explicit request with a second confirmation safeguard after the retention period expires.
- State changes and important metadata actions are recorded in `media_history`.

## Image processing and derivatives

Publishing uses the Cloudflare Images binding to process the retained R2 original once and writes optimized WebP derivatives back to R2.

Current derivative policy in `src/derivative-policy.js`:

| Variant | Maximum width | WebP quality | R2 key |
| --- | ---: | ---: | --- |
| Thumbnail | 480 px | 78 | `published/<media-id>/thumb.webp` |
| Normal web | 1280 px | 82 | `published/<media-id>/web.webp` |
| Large/lightbox | 1920 px | 85 | `published/<media-id>/large.webp` |

Processing uses `fit: scale-down`, so small images are not enlarged. Cloudflare's image transform handles source orientation, and the transform is configured with `metadata: none`; the WebP derivatives therefore do not carry the original EXIF metadata. The original R2 object is retained unchanged for archival/reprocessing purposes and is not the normal public delivery target.

D1 stores `thumb_key`, `web_key`, and `large_key` after all required derivatives are created successfully. Partial derivatives are removed if processing fails.

Derivative naming/URL behavior is covered by `tests/derivative-policy.test.mjs`.

## Public API

- `GET /api/media?status=published`
- `GET /api/media?status=published&category=housing`
- `GET /api/media?status=published&gallery=housing`
- `GET /api/galleries`
- `GET /media/:id?size=thumb`
- `GET /media/:id?size=web`
- `GET /media/:id?size=large`

Public API media objects include `thumb_url`, `public_url`/`web_url`, and `large_url`. Gallery covers use the thumbnail variant, normal page content uses the web variant, and the Gallery lightbox prefers the large variant.

Only `published` media is available through public endpoints. `size=original` is reserved for authenticated admin requests.

Published derivatives are served with long-lived immutable cache headers because derivative object keys are replaced only by a deliberate reprocessing/publishing action. Admin/non-public media is served with `private, no-store`.

## Admin API

Requires `Authorization: Bearer <ADMIN_TOKEN>`.

- `POST /api/admin/sync` — scan and validate incoming R2 prefixes into D1
- `GET /api/admin/media?status=pending` — list media for review
- `GET /api/admin/media?status=rejected` — review rejected/invalid media and validation reasons
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

The homepage Recent Moments block also consumes `GET /api/media?status=published&limit=4` after `API_BASE` is configured. Until then, the local placeholder preview remains in place.

## Tests

From the `worker/` directory:

```text
npm test
```

The repository's GitHub Pages workflow also runs Worker syntax checks and both policy test suites before publishing the static site. These tests validate pure policy and integration assumptions that do not require a live Cloudflare account; end-to-end R2/D1/Images behavior still must be verified after deployment.

## After Cloudflare resources are created

1. Confirm Cloudflare Images transformations are enabled for the account and that the Images binding is available. Re-check current Cloudflare pricing/account requirements at setup time.
2. Copy `wrangler.toml.example` to `wrangler.toml`.
3. Replace the D1 database ID.
4. Apply `schema.sql` to D1.
5. Confirm the `IMAGES` binding, `MEDIA` R2 binding, and `DB` D1 binding are configured.
6. Set `ADMIN_TOKEN` as a Worker secret.
7. Set `ALLOWED_ORIGINS` to the temporary GitHub Pages origin and, later, the production VJL origin.
8. Deploy the Worker.
9. Open `/admin/`, enter the admin token, run **Seed gallery groups**, then **Sync incoming folders**.
10. Confirm valid test media lands in `pending` and an intentionally unsupported test object lands in `rejected` with a validation reason.
11. Review and approve a valid test image, publish it, and confirm all three WebP derivatives are written to R2 and their keys are recorded in D1.
12. Confirm `/media/:id?size=thumb`, `web`, and `large` deliver the expected derivative and that the original is not exposed publicly.
13. Set `API_BASE` in `assets/js/config.js` to the Worker URL.
14. Verify the homepage Recent Moments feed, full Gallery page, and admin review workflow against the live Worker/R2/D1/Images backend.

## Important deployment note

The Cloudflare ChatGPT integration is not available for this project, so resource creation and deployment must be performed manually in Cloudflare. The repository is structured so those manual steps are configuration/deployment work rather than additional application design work.
