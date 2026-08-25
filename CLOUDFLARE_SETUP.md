# Veterans Justice League Cloudflare Setup

This is the remaining account-side setup needed to connect the VJL media system to the temporary GitHub Pages site. It does **not** change production DNS.

## What this creates

- R2 bucket: `vjl-media`
- D1 database: `vjl-media`
- Worker: `vjl-media-api`
- Images binding: `IMAGES`
- Worker secret: `ADMIN_TOKEN`

The Worker configuration already defines the required R2, D1, Images, allowed-origin, and scheduled-sync bindings in `worker/wrangler.toml.example`.

## 1. Authenticate Wrangler

From a local clone of the repository:

```bash
cd worker
npx wrangler login
```

Wrangler will open the Cloudflare authorization flow.

## 2. Create the R2 bucket

```bash
npx wrangler r2 bucket create vjl-media
```

Optional verification:

```bash
npx wrangler r2 bucket list
```

## 3. Create the D1 database

```bash
npx wrangler d1 create vjl-media
```

Wrangler returns the database UUID. Copy `wrangler.toml.example` to `wrangler.toml`, then replace `REPLACE_WITH_D1_DATABASE_ID` with that UUID.

```bash
cp wrangler.toml.example wrangler.toml
```

`worker/wrangler.toml` is intentionally git-ignored because it is local deployment configuration.

## 4. Apply the D1 schema

From the `worker` directory:

```bash
npx wrangler d1 execute vjl-media --remote --file=./schema.sql
```

This creates the media, galleries, and media-history tables used by the Worker.

## 5. Deploy the Worker

```bash
npx wrangler deploy
```

Wrangler will report the deployed `*.workers.dev` URL. Save that URL; it becomes the site's `API_BASE`.

The `[images]` binding in `wrangler.toml` exposes Cloudflare Images to the Worker as `env.IMAGES`; no separate image bucket is required for that binding. Originals remain private in R2 and generated derivatives are written back to R2.

## 6. Set the admin secret

Generate a long random token using a password manager or secure random generator, then run:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Paste the token when prompted and save the same token securely for the VJL administrator. Do not commit it to GitHub or place it in frontend JavaScript.

## 7. Confirm the Worker is reachable

Replace `<WORKER_URL>` with the URL returned by Wrangler:

```bash
curl -i <WORKER_URL>/api/galleries
```

A successful connection should return JSON. Before gallery definitions are seeded, an empty gallery result is acceptable.

The temporary frontend origin is already configured as:

```text
https://wjbono.github.io
```

Do not add or change the production VJL origin until production launch preparation.

## 8. Connect the temporary site

Update `assets/js/config.js` so `API_BASE` equals the Worker URL, then deploy the GitHub Pages site.

After that, open:

```text
https://wjbono.github.io/veterans-justice-league/admin/
```

Enter the `ADMIN_TOKEN`, then:

1. Click **Seed gallery groups**.
2. Click **Sync incoming folders**.
3. Confirm the six default gallery groups exist.

## 9. End-to-end test media

Upload test images to R2 under the locked prefixes:

```text
incoming/housing/
incoming/behind-the-wall/
incoming/outreach/
incoming/events/
incoming/team/
incoming/partners/
incoming/unsorted/
```

Use at least:

- one valid JPEG with EXIF `DateTimeOriginal` if available;
- one valid PNG or WebP;
- one file in `incoming/unsorted/`;
- one intentionally unsupported or mismatched file to verify rejection behavior.

Then verify:

1. Valid images sync to `pending`.
2. Category folders pre-populate the category.
3. `unsorted` begins with no category and cannot be approved until categorized.
4. Invalid media enters `rejected` with a validation reason.
5. Review → Approve → Publish creates thumbnail/web/lightbox WebP derivatives.
6. Public Gallery uses the generated thumbnail and larger image URLs.
7. Homepage Recent Moments begins using published media.
8. Archive removes media from public results without deleting the original.
9. Republish restores archived media when derivatives exist.
10. Rejected media remains retained and cannot be permanently deleted before the retention date.

## 10. Do not do yet

Until explicit launch authorization:

- Do not change `veteransjusticeleague.com` DNS.
- Do not replace the current Google Sites deployment.
- Do not configure the GitHub Pages production custom domain.
- Do not change the Worker allowlist solely to the production hostname.

Those steps remain part of the final launch runbook after the temporary site, media workflow, and client review are complete.
