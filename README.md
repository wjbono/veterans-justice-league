# Veterans Justice League website redesign

Production redesign in development for Veterans Justice League. The live `veteransjusticeleague.com` Google Sites deployment is intentionally untouched until final approval and DNS cutover.

## Public site

Static HTML/CSS/JavaScript designed for GitHub Pages. Pages included:

- Home
- About / Mission / Vision
- Programs
- VJL Housing
- Behind-the-Wall Training
- Outreach
- Gallery
- Events
- Contact
- Team
- Media Review (`/admin/`)

The exact supplied VJL logo is preserved as verified base64 build chunks under `.build-assets/`. The GitHub Pages workflow reconstructs `assets/images/vjl-logo.png` before deployment and verifies both its 32,857-byte size and SHA-256 checksum before the site can publish. `.build-assets/` is removed from the deployed artifact.

The Pages build also generates canonical URLs, Open Graph/Twitter metadata, favicon references, homepage Organization structured data, noindex directives for `/admin/` and `404.html`, and the shared QC stylesheet link directly into the deployed HTML. A static-site validator must pass before Pages deployment proceeds.

## Content provenance

Public-facing copy was based on information currently published at:

- https://www.veteransjusticeleague.com/
- https://www.veteransjusticeleague.com/about
- https://www.veteransjusticeleague.com/housing
- https://www.veteransjusticeleague.com/btw-training
- https://www.veteransjusticeleague.com/outreach
- https://www.veteransjusticeleague.com/events
- https://www.veteransjusticeleague.com/contact
- https://www.veteransjusticeleague.com/about/team

Donation continues to use the Stripe donation link currently published by VJL. Contact continues to embed the Google Form currently published by VJL.

## Cloudflare backend

`worker/` contains the R2/D1/Worker implementation and schema. It is ready for account-side deployment/configuration once the required Cloudflare resources are created. The intended production media path is GitHub Pages → Worker/API → D1 metadata + R2 media. No production DNS changes are required during development.

## Launch tracking

`BACKLOG.md` is the authoritative publish-readiness checklist. Production DNS remains unchanged until explicit client authorization.
