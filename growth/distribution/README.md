# Distribution operator system

This folder turns the 30-day organic plan into a reviewable queue without auto-posting,
fabricated proof, or unsolicited bulk outreach.

## Social queue

1. Edit `content-queue.json`: replace evidence placeholders, attach permission evidence for
   any user story, and set `status`, `approvedBy`, and `approvedAt` only after review.
2. Validate with `npm run growth:social:validate`.
3. Export the approved X queue with:

   `npm run growth:social:export -- --channel=x --output=/tmp/showcase-x.csv`

4. In Buffer, download the X channel's fresh template once to confirm its columns, import
   the generated UTF-8 CSV, inspect the preview, and choose **Save as Drafts** first.

`npm run growth:social:ideas` is a dry run. Add `-- --push` only after setting
`BUFFER_API_KEY` and `BUFFER_ORGANIZATION_ID`; this creates Buffer Ideas, never posts.

The active launch account is X `@Showcase_app1`. The queue contains 20 X-only drafts at four
posts per week for five weeks. There is no LinkedIn account/page; `approvedChannels` makes
the export and Buffer-Idea helpers fail if a non-X row is introduced.

## Why approval remains human

Build-in-public metrics must come from the weekly scorecard, user examples require written
permission, and community rules change. Automation removes copying and formatting; it does
not outsource truth, consent, or judgment.

## Community work

Reddit is intentionally excluded from the publishing queue. Contribute complete, link-free
resume audits by hand, disclose the founder relationship if asked, and re-check each
community's current rules before participating. Never automate comments or DMs.

## Partner waves

`partner-pipeline.json` contains 20 organizations verified against official pages on
2026-07-09. Generate a five-organization review packet with:

`npm run growth:partners -- --wave=1 --output=/tmp/showcase-partner-wave-1.md`

The script never sends. Re-open each official route before submitting, personalize the
note, and prepare all five drafts for founder review. Submit nothing until the founder
explicitly approves the full first wave. After approval, contact each organization once and
record the outcome. Do not request member lists or share participant-level audit data with
a partner.
