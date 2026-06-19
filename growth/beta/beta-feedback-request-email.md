# Feedback Request Email

Send to users who have published a portfolio (status: `published`).  
Triggered by `portfolio_published` event — check `usage_events` or `portfolios.status = 'published'`.

---

**Subject:** Quick question about your Showcase portfolio — [NAME]

---

Hi [NAME],

You published your Showcase portfolio — that's the thing I'm most excited to see happen.

Would you mind taking 5 minutes to tell me what it was actually like?

**[Leave feedback →](https://app.showcase.so/beta/feedback?token=[INVITE_TOKEN])**

I'm specifically trying to understand:
- Where did you get stuck or confused?
- Did your portfolio end up telling your story the way you needed it to?
- What's still missing?

This directly shapes what we build next. I read every response.

—Vinay  
Founder, Showcase

---

## If they published but haven't done the portfolio justice

If their published portfolio looks sparse or low quality (you can check `/p/[slug]`), add this line before the CTA:

> "Also — if you want to improve it before sharing, I'm happy to jump on a quick call and walk through it with you. Just reply to this email."

---

## After sending

- Note `feedback_request_sent: true` in tracker
- If they submit feedback, their `feedback_submitted` usage_event fires automatically. No DB status change needed — `status` stays `feedback_requested`.
- If no feedback after 5 days, send beta-call-invite.md as a softer follow-up
