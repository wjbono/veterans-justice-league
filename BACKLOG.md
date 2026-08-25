# Veterans Justice League Website Publish-Ready Backlog

Last updated: 2026-08-24

Goal: bring the replacement Veterans Justice League website to a state where the client can approve launch and the only remaining production action is the final DNS cutover from Google Sites to GitHub Pages, followed by verification.

## Status legend

- [x] Complete
- [ ] Not started / remaining
- [~] In progress / partially implemented
- [!] Blocked or dependent on external setup/approval

## Foundation already completed

- [x] GitHub repository created and connected: `wjbono/veterans-justice-league`
- [x] GitHub Pages deployment workflow created
- [x] Temporary GitHub Pages site deployed
- [x] Existing production Google Sites deployment left untouched
- [x] Core public pages created: Home, About, Housing, Behind-the-Wall Training, Outreach, Gallery, Events, Contact, Team
- [x] Initial responsive styling implemented
- [x] Exact VJL logo stored locally in the repository
- [x] Local placeholder imagery added so preview does not depend on broken external hotlinks
- [x] Initial Cloudflare Worker/D1/R2 backend scaffold added under `worker/`
- [x] Initial media-review/admin shell added under `/admin/`

---

# Phase 1: Finish Public-Site Functionality

## Navigation and page behavior

- [ ] Audit every desktop navigation link
- [ ] Audit every mobile navigation link
- [ ] Verify all buttons and CTAs
- [ ] Verify Donate links
- [ ] Verify Contact/Get Help links
- [ ] Add appropriate empty states where content is not yet available
- [ ] Confirm Team page behavior while bios are unavailable
- [ ] Confirm Events page behavior when no current events are published

## Gallery experience

- [ ] Redesign Gallery as a landing page containing multiple gallery groups
- [ ] Support gallery groupings such as Housing, Behind-the-Wall, Outreach, Events, Team, Partners, and other approved categories
- [ ] Make each gallery open into its own photo collection
- [ ] Implement carousel/lightbox browsing within gallery collections
- [ ] Add previous/next controls
- [ ] Add keyboard navigation
- [ ] Add touch/swipe-friendly behavior for mobile
- [ ] Display captions where available
- [ ] Display accessible alt text
- [ ] Support gallery/event assignment from media metadata rather than hardcoded HTML
- [ ] Keep homepage Recent Moments as a small preview linking into the full gallery experience

## Responsive behavior

- [ ] Full desktop visual pass
- [ ] Full tablet visual pass
- [ ] Full mobile visual pass
- [ ] Check navigation at intermediate viewport widths
- [ ] Check buttons, cards, forms, galleries, carousels, and footer wrapping

---

# Phase 2: Complete the Cloudflare Media and Admin System

Status: [!] Requires manual Cloudflare account setup because the ChatGPT Cloudflare integration is not usable.

## Cloudflare resources

- [ ] Create production R2 bucket for VJL media
- [ ] Create production D1 database
- [ ] Create/deploy Cloudflare Worker/API
- [ ] Bind Worker to R2
- [ ] Bind Worker to D1
- [ ] Configure allowed frontend origins
- [ ] Configure production-safe secrets/environment variables
- [ ] Confirm Worker API is reachable from temporary GitHub Pages URL

## Upload-folder workflow

Implement and verify the locked folder model:

- [ ] `incoming/housing/`
- [ ] `incoming/behind-the-wall/`
- [ ] `incoming/outreach/`
- [ ] `incoming/events/`
- [ ] `incoming/team/`
- [ ] `incoming/partners/`
- [ ] `incoming/unsorted/`
- [ ] Category-specific folders pre-populate category
- [ ] Reviewer can change category
- [ ] Unsorted uploads begin uncategorized
- [ ] Unsorted media cannot be approved until category is assigned

## Media lifecycle

Implement and verify:

- [ ] UPLOAD
- [ ] PENDING
- [ ] REVIEW
- [ ] APPROVED
- [ ] PROCESSING
- [ ] PUBLISHED
- [ ] ARCHIVED
- [ ] REJECTED
- [ ] Rejected media moves to trash/quarantine instead of immediate deletion
- [ ] Retention period supported before permanent deletion
- [ ] Second safeguard/confirmation before permanent deletion
- [ ] Archived media can be restored/republished
- [ ] D1 retains metadata/history

## Media review/admin interface

Each image should support:

- [ ] Thumbnail preview
- [ ] Larger preview
- [ ] Filename
- [ ] Upload date
- [ ] EXIF/photo date when available
- [ ] Category dropdown
- [ ] Caption
- [ ] Alt text
- [ ] Optional event/gallery assignment
- [ ] Featured-image toggle
- [ ] Approve action
- [ ] Reject action
- [ ] Archive action where appropriate

Bulk actions:

- [ ] Bulk select
- [ ] Bulk category assignment
- [ ] Bulk gallery assignment
- [ ] Bulk approve
- [ ] Bulk reject
- [ ] Bulk archive where appropriate

## Image processing

On approval/publishing:

- [ ] Validate file type/content
- [ ] Correct orientation
- [ ] Strip unnecessary/private EXIF metadata
- [ ] Preserve useful metadata in D1
- [ ] Generate thumbnail derivative
- [ ] Generate normal web-size derivative
- [ ] Generate larger/lightbox derivative
- [ ] Generate WebP and/or AVIF where appropriate
- [ ] Retain original in R2
- [ ] Store object keys and derivative keys in D1

---

# Phase 3: Connect the Public Site to Real Media

- [ ] Replace static gallery placeholders with Worker/D1/R2 media feed
- [ ] Homepage Recent Moments pulls approved/published featured/recent images dynamically
- [ ] Gallery landing page pulls gallery definitions dynamically
- [ ] Individual gallery collections pull published media dynamically
- [ ] Only `PUBLISHED` media is publicly displayed
- [ ] Archived/rejected/pending media never appears publicly
- [ ] Verify category filters
- [ ] Verify gallery/event filters
- [ ] Verify featured-image behavior
- [ ] Verify public URLs and caching
- [ ] Verify graceful API-unavailable state

---

# Phase 4: Load and Organize Real Client Content

- [ ] Import approved VJL photo library
- [ ] Categorize photos
- [ ] Assign photos to galleries/events
- [ ] Add captions where appropriate
- [ ] Add meaningful alt text
- [ ] Select featured/recent images
- [ ] Replace remaining placeholder imagery
- [ ] Confirm all public copy remains grounded in approved/current VJL information
- [ ] Obtain and add client-approved Team bios if desired for launch
- [ ] Obtain and add any client-approved event updates if desired for launch
- [ ] Confirm no invented claims, statistics, programs, people, partnerships, contact information, or addresses are present

---

# Phase 5: Production Polish and Quality Control

## Accessibility

- [ ] Heading hierarchy audit
- [ ] Keyboard-only navigation audit
- [ ] Focus-state audit
- [ ] Color-contrast audit
- [ ] Alt-text audit
- [ ] Carousel accessibility audit
- [ ] Form accessibility audit
- [ ] Skip-link verification

## SEO and sharing

- [ ] Unique page titles
- [ ] Meta descriptions
- [ ] Canonical URL strategy for production domain
- [ ] Open Graph metadata
- [ ] Social share image
- [ ] Favicon/site icons
- [ ] `sitemap.xml`
- [ ] `robots.txt`
- [ ] Structured data where appropriate

## Performance

- [ ] Optimize image dimensions and compression
- [ ] Verify lazy loading
- [ ] Verify modern image formats
- [ ] Minimize render-blocking resources where practical
- [ ] Verify caching strategy
- [ ] Check page weight on mobile
- [ ] Run Lighthouse-style performance/accessibility review

## Functional QC

- [ ] Test all internal links
- [ ] Test all external links
- [ ] Test Donate flow
- [ ] Test Contact form
- [ ] Test Get Help flow
- [ ] Test galleries/carousels
- [ ] Test admin workflow end-to-end
- [ ] Test upload → review → publish → archive → republish
- [ ] Test rejection/quarantine flow
- [ ] Test malformed/unsupported image upload handling
- [ ] Test 404 page
- [ ] Check browser console for errors
- [ ] Check Chrome
- [ ] Check Edge
- [ ] Check Safari where available
- [ ] Check mobile browser behavior

## Production cleanup

- [ ] Remove development-only wording
- [ ] Remove debug/test content
- [ ] Remove temporary placeholder labels once real images are loaded
- [ ] Remove unused assets/scripts/styles
- [ ] Confirm README/deployment documentation matches final architecture

---

# Phase 6: Client Acceptance

- [ ] Provide temporary GitHub Pages URL for final client review
- [ ] Client approves desktop layout
- [ ] Client approves mobile layout
- [ ] Client approves wording/content
- [ ] Client approves real photos and galleries
- [ ] Client approves donation flow
- [ ] Client approves contact/help flow
- [ ] Client approves admin/media workflow
- [ ] Resolve client-requested changes
- [ ] Freeze client-approved release candidate
- [ ] Limit post-freeze work to approved changes and bug fixes

---

# Phase 7: Launch Preparation

## Domain and GitHub Pages

- [ ] Configure `veteransjusticeleague.com` as GitHub Pages custom domain when client authorizes launch preparation
- [ ] Confirm GitHub Pages production-domain requirements
- [ ] Verify HTTPS configuration readiness

## Cloudflare production configuration

- [ ] Set production frontend origin/allowlist
- [ ] Confirm Worker production URL
- [ ] Confirm R2 public-media delivery strategy
- [ ] Confirm production D1 database/bindings
- [ ] Confirm authentication/security for admin endpoints
- [ ] Confirm no secrets are exposed in frontend source

## DNS cutover plan

- [ ] Record current Google Sites DNS records before changes
- [ ] Document exact replacement DNS records
- [ ] Prepare rollback records/instructions
- [ ] Identify expected DNS/HTTPS propagation behavior
- [ ] Confirm no DNS change is made before explicit client authorization

## Redirects and compatibility

- [ ] Inventory existing public Google Sites URLs
- [ ] Determine which legacy paths need redirects
- [ ] Implement/test redirect strategy where possible
- [ ] Check inbound links/bookmarks that should continue working

## Final pre-launch test

- [ ] Production release candidate passes complete QC
- [ ] GitHub Pages deployment succeeds
- [ ] Worker/API healthy
- [ ] D1 healthy
- [ ] R2 healthy
- [ ] Public galleries populate correctly
- [ ] Admin workflow works from production-configured frontend
- [ ] Donation works
- [ ] Contact/Get Help works
- [ ] Client gives explicit launch approval

---

# Launch Day

These items are intentionally NOT performed until the client explicitly authorizes the production switch.

- [ ] Apply DNS changes from Google Sites to GitHub Pages
- [ ] Wait for/verify DNS resolution
- [ ] Verify production homepage
- [ ] Verify HTTPS/certificate
- [ ] Verify all primary pages
- [ ] Verify Worker/API from production origin
- [ ] Verify gallery/media delivery
- [ ] Verify admin access/workflow
- [ ] Verify Donate
- [ ] Verify Contact/Get Help
- [ ] Check mobile production site
- [ ] Check console/network errors
- [ ] Monitor initial launch behavior

## Rollback trigger

If a launch-blocking issue appears during cutover:

- [ ] Restore recorded pre-launch DNS values
- [ ] Confirm Google Sites becomes reachable again
- [ ] Resolve issue on temporary GitHub Pages deployment
- [ ] Repeat launch verification before another cutover

---

# Publish-Ready Definition of Done

The site is considered **publish-ready** when:

1. Public pages and gallery/carousel functionality are complete.
2. The real R2/D1/Worker media system is deployed and connected.
3. Admin upload/review/publish/archive/reject workflows work end-to-end.
4. Approved client media and content are loaded.
5. Desktop/mobile/accessibility/performance/functional QC passes.
6. Client has approved the release candidate.
7. Production domain, Worker, DNS, HTTPS, redirect, and rollback plans are prepared.
8. The only remaining launch action is explicit client authorization followed by DNS cutover and verification.
