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

The Worker scans these prefixes on a schedule and through `POST /api/admin/sync`. Folder placement pre-populates category. `incoming/unsorted/` remains uncategorized and cannot be approved until a category is selected.

## Media lifecycle

`pending → published → archived` with rejected items retained for 30 days before scheduled permanent deletion. The schema also supports the `approved` and `processing` states reserved for the later derivative/image-processing step.

At this stage the Worker serves the original R2 object for published media. Thumbnail/WebP/AVIF generation is intentionally not fabricated here because the image-processing implementation was not yet selected. The schema already includes `thumb_key`, `web_key`, and `large_key` for that next step.

## After Cloudflare resources are created

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Replace the D1 database ID.
3. Apply `schema.sql` to D1.
4. Set `ADMIN_TOKEN` as a Worker secret.
5. Set `ALLOWED_ORIGINS` to the actual temporary GitHub Pages origin and later the production VJL origin.
6. Deploy the Worker.
7. Set `API_BASE` in `assets/js/config.js` to the Worker URL.
