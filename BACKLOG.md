# Veterans Justice League Website Publish-Ready Backlog

Last updated: 2026-08-28

Goal: finish verification, load approved client content, complete release-candidate QC and client acceptance, then prepare the production-domain cutover from Google Sites to GitHub Pages.

## Status legend

- [x] Complete / verified
- [~] Implemented but live verification still pending
- [ ] Remaining
- [!] Blocked by client input, external access, or launch approval

---

# Current project status

The replacement site, GitHub Pages deployment, Cloudflare Worker/R2/D1 media backend, dynamic public Gallery, and client-facing media-management interface are built.

The media publishing path has been verified through a real published item:

`Upload → Pending → Approve → Generate derivatives → Publish → Public Gallery`

The published image and its caption were confirmed visible on the public Gallery.

The authentication system has now been upgraded in code from a shared-token workflow to a multi-user system with Administrator and Editor roles. The code is complete, but the new Worker/D1 authentication deployment and live account bootstrap still require verification before that work is closed.

---

# 1. Multi-user authentication and administration

Tracking issue: GitHub issue #1, **Build multi-user admin authentication and user management**.

## Implemented

- [x] Individual username/password accounts
- [x] Administrator and Editor roles
- [x] Dedicated User Administration page
- [x] Create user
- [x] Edit display name and username
- [x] Change role
- [x] Enable/disable user
- [x] Reset password
- [x] Temporary-password / forced-password-change flow
- [x] Delete user with confirmation
- [x] Protect the final active Administrator from disable/delete/demotion
- [x] Salted PBKDF2 password hashing
- [x] Opaque persistent sessions with only token hashes stored in D1
- [x] Session expiration and sign-out
- [x] Session revocation on password reset, account disable, or deletion
- [x] Login throttling / repeated-failure protection
- [x] Record authenticated username for media actions instead of generic `admin`
- [x] One-time first-Administrator bootstrap using the existing server-side `ADMIN_TOKEN`
- [x] Remove raw shared token from normal client login flow

## Still to verify live

- [ ] Redeploy latest Worker authentication code to Cloudflare
- [ ] Apply/update D1 authentication schema if required by deployment
- [ ] Bootstrap the first Administrator account
- [ ] Confirm Administrator login survives normal browser restart for intended session lifetime
- [ ] Create a second Administrator or Editor test account
- [ ] Verify Editor cannot access or invoke user-management functions
- [ ] Verify create/edit/disable/enable/reset/delete operations end-to-end
- [ ] Verify forced password change after an admin reset
- [ ] Verify password reset revokes existing sessions
- [ ] Verify disabled/deleted users lose access immediately
- [ ] Verify final-Administrator safeguards live
- [ ] Verify sign-out and session expiration
- [ ] Close issue #1 after successful live verification

---

# 2. Media workflow verification

## Verified

- [x] Cloudflare Worker/API reachable from temporary GitHub Pages site
- [x] R2 media storage connected
- [x] D1 metadata storage connected
- [x] Cloudflare Images derivative processing connected
- [x] Direct admin upload reaches R2 and review queue
- [x] Pending review state works
- [x] Category/caption editing works
- [x] Approval works
- [x] Publish generates required image derivatives
- [x] Failed derivative generation safely returns item to Approved and keeps it non-public
- [x] Published media appears in public Gallery
- [x] Public caption rendering works
- [x] Rejected item can be restored out of Rejected
- [x] Folder-marker bug identified and code fixed so zero-byte R2 folder markers are not treated as media
- [x] Original image retained in R2
- [x] Published derivatives strip original EXIF metadata
- [x] Thumbnail, normal web, and large/lightbox WebP derivative support implemented

## Remaining workflow tests

- [ ] Redeploy/verify folder-marker cleanup fix and confirm the seven bogus zero-byte rejected records stay gone
- [ ] Test `Unsorted` upload and confirm approval is blocked until category is assigned
- [ ] Test reviewer changing a pre-populated category
- [ ] Test Archive → confirm disappearance from public Gallery → Republish → confirm return
- [ ] Test Rejected → Restore → normal review lifecycle
- [ ] Test bulk select
- [ ] Test bulk category assignment
- [ ] Test bulk gallery assignment
- [ ] Test bulk approve
- [ ] Test bulk publish
- [ ] Test bulk reject
- [ ] Test bulk archive
- [ ] Test malformed/unsupported/oversize image rejection
- [ ] Verify EXIF/photo-date extraction with an image that contains usable date metadata
- [ ] Verify 30-day rejected-item retention behavior
- [ ] Verify guarded permanent deletion after retention period
- [ ] Verify maintenance cleanup does not remove valid retained media

---

# 3. Public Gallery and dynamic media

## Implemented / verified

- [x] Gallery landing page with grouped collections
- [x] Housing, Behind-the-Wall, Outreach, Events, Team, and Partners gallery support
- [x] Worker/D1/R2-backed public media feed
- [x] Published-only public media enforcement
- [x] Captions and alt-text support
- [x] Gallery/lightbox navigation
- [x] Previous/next controls
- [x] Keyboard navigation
- [x] Touch/swipe support
- [x] Adjacent-image preloading
- [x] Public Gallery verified with a real published image and caption
- [x] Archived/rejected/pending items are excluded by the public API design

## Remaining verification

- [ ] Verify category filters live with multiple real images
- [ ] Verify gallery/event filters live with multiple real images
- [ ] Verify Featured ordering with multiple published images
- [ ] Verify dynamic gallery covers with real content
- [ ] Verify homepage Recent Moments against several published images
- [ ] Verify public image caching from production/custom-domain origin after cutover

---

# 4. Load and organize approved client content

Authentic client media is still needed for the final visual/content population. Starter-package mockup photography must not be represented as real VJL photography.

- [!] Obtain/import approved VJL photo library
- [ ] Categorize approved photos
- [ ] Assign photos to galleries/events where appropriate
- [ ] Add captions where appropriate
- [ ] Add meaningful accessibility alt text
- [ ] Select Featured / Recent Moments images
- [!] Replace remaining placeholder imagery with approved VJL media
- [ ] Obtain and add client-approved Team bios if desired for launch
- [ ] Obtain and add current client-approved event information if desired for launch
- [x] Public copy currently used on the redesign is grounded in verified/current VJL information rather than invented claims
- [x] Existing VJL logo remains the exact locked brand asset

---

# 5. Final website QC and polish

## Browser / responsive

- [ ] Final desktop visual pass
- [ ] Final tablet visual pass
- [ ] Final mobile visual pass
- [ ] Check intermediate viewport widths
- [ ] Chrome functional pass
- [ ] Edge functional pass
- [ ] Safari functional pass where available
- [ ] Mobile-browser functional pass
- [ ] Check browser console for errors

## Accessibility

- [ ] Final page-by-page heading hierarchy audit
- [ ] Keyboard-only navigation test
- [ ] Focus-state test
- [ ] Full color-contrast review
- [ ] Final alt-text audit after real client images are loaded
- [ ] Live carousel/lightbox accessibility test
- [ ] Live admin modal/forms accessibility test
- [ ] Live skip-link test

Already implemented: reduced-motion support, forced-colors support, accessible external-link handling, mobile-menu ARIA association, modal keyboard controls, and focus management.

## Functional

- [ ] Test all external links in browser
- [ ] Test Stripe Donate destination live
- [ ] Test Contact form submission live
- [ ] Test Get Help flow end-to-end
- [ ] Final Gallery/lightbox interaction test with real media
- [ ] Final admin/media workflow test with multi-user authentication

## Performance / SEO / cleanup

- [ ] Optimize final client-media dimensions/compression as needed after the real library is loaded
- [ ] Run Lighthouse-style performance/accessibility review against release candidate
- [ ] Verify final production caching strategy
- [ ] Verify final mobile page weight with real media
- [ ] Create dedicated 1200×630 social-sharing image if desired for launch
- [ ] Remove remaining debug/test content
- [ ] Remove remaining placeholder/development labels once real content is loaded
- [ ] Final README/deployment/runbook consistency pass

Already complete: page titles/descriptions, canonical strategy, Open Graph metadata, sitemap, robots rules, Organization structured data, favicon/logo handling, internal-link validation, deployment smoke tests, JavaScript syntax validation, static performance budgets, custom 404, lazy loading, async decoding, and published-artifact cleanup.

---

# 6. Client acceptance

- [x] Temporary GitHub Pages preview exists
- [ ] Client approves desktop layout
- [ ] Client approves mobile layout
- [ ] Client approves wording/content
- [ ] Client approves real photos and galleries
- [ ] Client approves donation flow
- [ ] Client approves contact/help flow
- [ ] Client approves Media Manager and user-administration workflow
- [ ] Resolve client-requested changes
- [ ] Freeze client-approved release candidate
- [ ] After freeze, limit work to approved changes and bug fixes

---

# 7. Launch preparation

Do not replace the existing Google Sites production site until explicit launch approval.

## Production configuration

- [ ] Configure `veteransjusticeleague.com` as the GitHub Pages custom domain when authorized
- [ ] Confirm final Worker production origin / allowed-origin configuration
- [ ] Confirm final R2/D1/Images bindings
- [ ] Confirm multi-user admin authentication/security on production origin
- [ ] Confirm no secrets are exposed in frontend source
- [ ] Verify HTTPS behavior on the final domain
- [ ] Verify apex/`www` redirect behavior as intended

## DNS cutover / rollback

- [ ] Record current Google Sites DNS records before changing anything
- [ ] Document exact replacement GitHub Pages DNS records
- [ ] Prepare rollback records/instructions
- [ ] Document expected DNS/HTTPS propagation behavior
- [ ] Obtain explicit client authorization for cutover
- [ ] Switch DNS from Google Sites to GitHub Pages
- [ ] Verify production site, SSL, Gallery, admin login, uploads, publishing, Donate, and Contact after cutover
- [ ] Keep rollback information until production is stable

---

# Definition of publish-ready

The replacement site is ready for production cutover when:

1. Multi-user authentication is live and verified.
2. Media upload/review/approve/publish/archive/reject workflows pass end-to-end testing.
3. Approved VJL media/content is loaded and placeholders are removed or explicitly approved.
4. Desktop/mobile/accessibility/performance/functional QC passes.
5. The client approves the release candidate.
6. Production domain, Worker, DNS, HTTPS, and rollback preparation are complete.
7. The only remaining action is explicit authorization followed by DNS cutover and final production verification.
