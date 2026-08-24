# Veterans Justice League website redesign

Production redesign in development for Veterans Justice League. The live `veteransjusticeleague.com` Google Sites deployment is intentionally untouched until final approval and DNS cutover.

## Public site

Static HTML/CSS/JavaScript designed for GitHub Pages. Pages included:

- Home
- About / Mission / Vision
- VJL Housing
- Behind-the-Wall Training
- Outreach
- Gallery
- Events
- Contact
- Team
- Media Review (`/admin/`)

The exact supplied VJL logo is stored at `assets/images/vjl-logo.png` without alteration.

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

`worker/` contains the R2/D1/Worker implementation and schema. It is ready to deploy once Cloudflare account resources can be created. No production DNS changes are required for development.
