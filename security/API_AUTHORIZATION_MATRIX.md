# API Authorization Matrix

Every route under `src/app/api/` reviewed by reading the actual source (not inferred). "Ownership check" means an explicit `.eq('user_id', user.id)` (or equivalent) applied server-side to every record lookup/mutation, independent of RLS — RLS is real but this app never relies on it alone.

| Route | Method | Auth required | Ownership check | Pro gate | Zod validation | Rate limit | External provider | Sensitive data | Verified |
|---|---|---|---|---|---|---|---|---|---|
| `/api/applications` | GET/POST/PATCH | ✅ | ✅ (`user_id` on all 3) | — | ✅ | — | — | application notes | code review + `test:authorization` |
| `/api/ats/check` | POST | ✅ | ✅ (tailored_asset update scoped) | soft (rate limit differs) | ✅ | ✅ | OpenAI | resume text | code review |
| `/api/beta/feedback` | POST | none (pre-account, intentional) | N/A (no user concept) | — | ✅ | none (low-value target) | — | feedback text | code review |
| `/api/jobs/[id]/tailor` | POST | ✅ | ✅ (`saved_job_id` ownership checked) | ✅ hard | ✅ | ✅ | OpenAI | resume + job content | code review + `test:authorization` |
| `/api/jobs/import` | POST | ✅ | N/A (creates own record) | soft | ✅ | ✅ | OpenAI (parse only, never fetches URL) | job description text | code review |
| `/api/jobs/match` | POST | ✅ | N/A (`job_listings_cache` is shared public data) | soft (AI explanation only) | ✅ | ✅ | OpenAI | resume content | code review |
| `/api/jobs/recommendations` | POST | ✅ | N/A (reads own profile only) | ✅ hard | ✅ | — | OpenAI, job provider | resume content | code review (prior session) |
| `/api/jobs/save` | GET/POST/PATCH/DELETE | ✅ | ✅ (`user_id` on all 4) | soft (free-tier cap) | ✅ | — | — | saved job notes | code review + `test:authorization` |
| `/api/jobs/search` | GET | ✅ | N/A (public job search) | — | ✅ | — | job provider | — | code review |
| `/api/ai/analyze-resume` | POST | ✅ | ✅ (`resumeId` update scoped) | soft | ✅ | ✅ | OpenAI | resume text | code review |
| `/api/ai/audit-portfolio` | POST | ✅ | ✅ (`portfolioId`/`resumeId` scoped) | soft (preview limits) | ✅ | ✅ | OpenAI | resume + portfolio content | code review |
| `/api/ai/generate-portfolio` | POST | ✅ | ✅ (`portfolioId` scoped) | ✅ hard | ✅ | ✅ | OpenAI | resume content | code review |
| `/api/ai/improve-resume` | POST | ✅ | N/A (no record reference) | soft | ✅ | ✅ | OpenAI | bullet text | code review |
| `/api/ai/role-match` | POST | ✅ | N/A (no record reference) | soft | ✅ | ✅ | OpenAI | resume content | code review |
| `/api/portfolio/publish` | POST | ✅ | ✅ (`portfolioId` scoped) | ✅ hard | ✅ | — | — | publish status | code review + `test:authorization` |
| `/api/portfolio/save` | POST | ✅ | ✅ (`portfolioId` scoped) | — | ✅ | — | — | portfolio content | code review + `test:authorization` |
| `/api/resume/export` | POST | ✅ | ✅ (`tailored_asset_id`/`resume_id` scoped) | — | manual | — | — | full resume content | code review + `test:authorization` |
| `/api/resume/extract-text` | POST | ✅ | N/A (no persistence in this route) | — | manual | — | — | file content | code review (prior session) — magic-byte + size/MIME hardened |
| `/api/stripe/create-checkout-session` | POST | ✅ | N/A (derives customer from own session) | — | — | — | Stripe | — | code review + live test (prior session) |
| `/api/stripe/create-portal-session` | POST | ✅ | ✅ (`stripe_customer_id` derived from own `user_id`, never client input) | — | — | — | Stripe | — | code review + `test:authorization` |
| `/api/stripe/webhook` | POST | signature (not session) | N/A (server-to-server) | — | — | — | Stripe | subscription data | code review + live test (prior session) |
| `/api/waitlist/join` | POST | none (intentional, pre-account) | N/A | — | ✅ | ✅ (IP, in-memory) | — | email, profile fields | code review (prior session) |

## Result

**Zero missing ownership checks found.** Every route that accepts a record ID (resume, portfolio, audit, saved job, application, tailored asset) scopes the database query to the authenticated user's own `user_id`, server-side, independent of RLS. The 3 intentionally-unauthenticated routes (`waitlist/join`, `beta/feedback`, `stripe/webhook`) have no user-owned-record concept and are correctly designed that way.

This table is a static claim based on source review. `scripts/test-api-authorization.mjs` proves it adversarially with two real users — see `npm run test:authorization` for current pass/fail status.
