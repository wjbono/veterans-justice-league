# Veterans Justice League Website Launch Runbook

Last updated: 2026-08-25

Purpose: make the final move from the current Google Sites production site to the replacement GitHub Pages site predictable, reversible, and low-risk.

**This document is preparation only. Do not change production DNS until the client explicitly authorizes launch.**

## Production targets

- Production domain: `veteransjusticeleague.com`
- Recommended canonical hostname: `veteransjusticeleague.com`
- `www` hostname: configure to GitHub Pages so GitHub can redirect it to the canonical apex hostname
- GitHub repository: `wjbono/veterans-justice-league`
- Current temporary preview: `https://wjbono.github.io/veterans-justice-league/`
- GitHub Pages DNS target for subdomains: `wjbono.github.io`
- Cloudflare Worker/API: production URL to be recorded here after deployment
- R2 bucket: production name to be recorded here after creation
- D1 database: production name/id to be recorded here after creation

## Launch blockers that must be cleared first

Do not begin production cutover until all of the following are true:

- [ ] Client has approved the release candidate.
- [ ] Authentic approved VJL photography has replaced launch-blocking placeholders.
- [ ] Cloudflare R2, D1, and Worker are deployed and healthy.
- [ ] Public galleries populate from published media.
- [ ] Admin upload/review/publish/archive/reject workflow passes end-to-end testing.
- [ ] Contact/Get Help behavior has been tested.
- [ ] Donation destination has been tested.
- [ ] Desktop and mobile final QC is complete.
- [ ] Final accessibility/performance QC is complete.
- [ ] Current production DNS records have been captured verbatim for rollback.
- [ ] Client has explicitly authorized the production switch.

## Pre-cutover preparation

These steps prepare GitHub without switching visitor traffic.

### 1. Verify domain ownership in GitHub

GitHub recommends verifying a custom domain before assigning it to a Pages site to reduce domain-takeover risk.

- In GitHub account settings, open Pages / Verified domains.
- Add `veteransjusticeleague.com`.
- GitHub will provide a TXT record similar to `_github-pages-challenge-wjbono.veteransjusticeleague.com` with a unique verification value.
- Add exactly the TXT value GitHub provides.
- Wait until GitHub reports the domain as verified.
- Keep the verification TXT record after verification.

Adding this TXT record does not redirect website traffic, but it is still a production-DNS change and should only be done when authorized to modify the zone.

### 2. Capture the existing production DNS state

Before changing any web-routing record, record every existing value for:

- [ ] Apex `A` records
- [ ] Apex `AAAA` records
- [ ] Apex `CNAME`, `ALIAS`, or `ANAME` if present
- [ ] `www` CNAME/A/AAAA records
- [ ] Any Google Sites verification records
- [ ] Any wildcard records
- [ ] CAA records
- [ ] Current TTL values
- [ ] Cloudflare proxy state for each web record

Store the exact pre-launch values in the **Rollback Records** section below immediately before cutover.

Do not remove unrelated mail, SPF, DKIM, DMARC, MX, verification, or other service records.

### 3. Configure the custom domain in GitHub Pages

Before pointing DNS at GitHub:

- Repository → **Settings → Pages**.
- Set custom domain to `veteransjusticeleague.com`.
- Save it.
- This repository deploys with a custom GitHub Actions workflow, so a repository `CNAME` file is not required and GitHub ignores one for this deployment model.

### 4. Check CAA records

If the domain uses CAA records, make sure they allow Let's Encrypt (`letsencrypt.org`) before expecting GitHub Pages HTTPS provisioning to succeed.

### 5. Lower DNS TTL if desired

If the existing provider/records permit it, lower the relevant web-record TTL in advance of the maintenance window. This is optional but can make rollback and cutover convergence faster.

Do not remove the current production route just to lower TTL.

## Planned DNS cutover

GitHub's current documented apex IPv4 addresses are:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

GitHub's current documented apex IPv6 addresses are:

| Type | Name | Value |
| --- | --- | --- |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

For `www`:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | `wjbono.github.io` |

At launch time, re-check GitHub's official documentation before applying these values. Do not treat a copied runbook as permanently authoritative for provider IP addresses.

### Cloudflare proxy state during cutover

For the initial GitHub Pages domain verification and certificate-provisioning stage, use **DNS Only** for the GitHub web-routing records. This keeps GitHub's DNS/HTTPS validation path as direct and diagnosable as possible.

After GitHub Pages is serving the production domain correctly over HTTPS, Cloudflare proxying can be evaluated separately. Do not make proxying part of the same change required to establish the initial GitHub Pages route.

## Cutover procedure

Execute only after explicit client launch approval.

1. Confirm the latest `main` deployment is successful and its live Pages smoke test passed.
2. Confirm the Worker/API, D1, R2, galleries, admin workflow, Donate, and Contact/Get Help are healthy.
3. Record the current production DNS values in **Rollback Records** below.
4. Confirm GitHub Pages has `veteransjusticeleague.com` configured as its custom domain.
5. Replace only the existing website-routing apex records with the current GitHub Pages apex records.
6. Point `www` to `wjbono.github.io` with a CNAME.
7. Leave unrelated DNS records untouched.
8. Keep the GitHub domain-verification TXT record.
9. Initially keep GitHub web-routing records DNS Only if Cloudflare is authoritative DNS.
10. Verify DNS resolution from more than one resolver/network when practical.
11. Wait for GitHub's custom-domain check and TLS certificate provisioning.
12. Enable **Enforce HTTPS** in GitHub Pages after the certificate is available.
13. Run the post-cutover checks below.

GitHub notes that DNS changes may take up to 24 hours to propagate and HTTPS availability after a custom-domain change can take time. A slow resolver is not by itself a rollback trigger if authoritative/new-path checks are healthy.

## Post-cutover verification

### DNS / TLS

- [ ] `veteransjusticeleague.com` resolves to the intended GitHub Pages route.
- [ ] `www.veteransjusticeleague.com` resolves correctly.
- [ ] Apex loads the replacement site.
- [ ] `www` redirects to the canonical apex hostname.
- [ ] HTTPS certificate is valid for the production hostname.
- [ ] HTTP redirects to HTTPS after enforcement is enabled.
- [ ] No mixed-content warnings appear.

### Public website

- [ ] Home
- [ ] About
- [ ] Programs
- [ ] Housing
- [ ] Behind-the-Wall Training
- [ ] Outreach
- [ ] Gallery landing page
- [ ] Gallery carousel/lightbox
- [ ] Events
- [ ] Contact
- [ ] Team
- [ ] Custom 404
- [ ] Mobile navigation
- [ ] Desktop navigation
- [ ] All primary CTAs

### Integrations

- [ ] Worker/API responds from the production frontend origin.
- [ ] Public gallery data loads from D1/R2.
- [ ] Only published media is public.
- [ ] Admin authentication works.
- [ ] Upload → review → approve → publish works.
- [ ] Archive/restore and reject flows work.
- [ ] Donate opens the expected Stripe destination.
- [ ] Contact/Get Help form loads and submits successfully.

### Final technical checks

- [ ] Browser console has no launch-blocking errors.
- [ ] Network panel has no unexpected 4xx/5xx responses.
- [ ] Canonical tags use `https://www.veteransjusticeleague.com` or `https://veteransjusticeleague.com` consistently with the selected canonical hostname. **Current build is configured for the apex domain `https://www.veteransjusticeleague.com`? Review before launch and correct if necessary.**
- [ ] Open Graph/Twitter URLs and image resolve over HTTPS.
- [ ] `robots.txt` is reachable.
- [ ] `sitemap.xml` is reachable.
- [ ] `/admin/` remains `noindex,nofollow,noarchive`.

## Important canonical-hostname check

The current site build uses `https://www.veteransjusticeleague.com` only where explicitly configured in code? Before the release candidate is frozen, inspect `PROD_BASE` in `.github/scripts/prepare_site.py` and choose one canonical hostname deliberately:

- Preferred plan: `https://www.veteransjusticeleague.com` **or** `https://veteransjusticeleague.com`
- GitHub can redirect between apex and `www` when both DNS configurations are correct.
- The canonical URL, structured-data URL, sitemap, and Worker allowed-origin list must all agree with the chosen hostname.

Do not leave this as an accidental default.

## Rollback triggers

Rollback should be considered when there is a launch-blocking condition such as:

- Production domain consistently fails to reach GitHub Pages after records are confirmed correct.
- GitHub cannot provision a certificate because of a configuration issue that cannot be corrected promptly.
- Public site has a critical navigation/content failure.
- Worker/API failure breaks required launch functionality.
- Galleries expose non-published media.
- Contact/Get Help is unusable and is considered launch-critical.
- A security or privacy issue is discovered.

Transient DNS propagation differences alone are not necessarily a rollback trigger.

## Rollback procedure

1. Restore the exact pre-launch website-routing DNS records from **Rollback Records** below.
2. Restore their prior Cloudflare proxy states.
3. Do not remove unrelated DNS records.
4. Confirm the former Google Sites production site is reachable again.
5. Keep the GitHub Pages preview available for remediation.
6. Record the failure cause and correction.
7. Re-run the full release-candidate verification before attempting another cutover.

## Rollback Records

Fill this in immediately before launch. Do not rely on memory or screenshots alone.

| Host | Type | Pre-launch value | TTL | Proxy state | Notes |
| --- | --- | --- | --- | --- | --- |
| `@` |  |  |  |  |  |
| `@` |  |  |  |  |  |
| `www` |  |  |  |  |  |
|  |  |  |  |  |  |

## Launch record

- Client approval received: `____________________`
- Approved by: `____________________`
- Cutover started: `____________________`
- GitHub custom-domain check passed: `____________________`
- HTTPS active: `____________________`
- Post-launch QC completed: `____________________`
- Rollback required: `Yes / No`
- Notes: `____________________________________________________________`

## Official references checked 2026-08-25

- GitHub Docs: Managing a custom domain for your GitHub Pages site
- GitHub Docs: About custom domains and GitHub Pages
- GitHub Docs: Verifying your custom domain for GitHub Pages
- GitHub Docs: Securing your GitHub Pages site with HTTPS
- GitHub Docs: Troubleshooting custom domains and GitHub Pages
- Cloudflare Docs: DNS proxy status

Re-check GitHub's DNS values and certificate guidance immediately before the production cutover.