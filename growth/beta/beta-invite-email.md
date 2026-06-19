# Beta Invite Emails

Three versions. One per segment. Always personalize [NAME], [TARGET_ROLE], [BIGGEST_CHALLENGE_HOOK].  
Link format: `https://app.showcase.so/signup?token=[INVITE_TOKEN]`

The invite token auto-fills their account, skips the waitlist, and tracks activation to their waitlist record.

---

## Version A — Student / New Grad

**Subject:** Your Showcase beta invite, [NAME]

---

Hi [NAME],

You joined the Showcase waitlist a few days ago — and I've been reading through every response personally.

Yours stood out. You mentioned [BIGGEST_CHALLENGE_HOOK — e.g., "not knowing how to show your projects without a strong work history"]. That's exactly the problem Showcase is built to solve.

Showcase takes your resume and turns it into a portfolio that shows the impact of your work — not just your job titles. No design skills needed. Takes about 15 minutes from paste to published.

I'd love for you to be one of our first 20 beta users and tell me what works and what doesn't.

**[Accept your invite →]([BETA_ACCESS_LINK])**

This link is personal to you and expires in 7 days.

What to expect:
- You paste or upload your resume
- Showcase generates your portfolio using AI
- You edit, refine, and publish it
- You fill out a short feedback form (takes 5 min)

There's no cost to participate. If you're on the free plan and hit a limit, email me directly and I'll sort it out.

—Vinay  
Founder, Showcase

P.S. If the timing's off or this isn't for you, no worries at all — just let me know and I'll stop the clock.

---

## Version B — Designer / Developer

**Subject:** Showcase beta — [NAME], your invite

---

Hi [NAME],

You're on the Showcase waitlist. I'm reaching out personally because your background caught my attention.

Most designers and developers I talk to have done great work — but their portfolio either doesn't exist, or it undersells them badly. You mentioned [BIGGEST_CHALLENGE_HOOK]. That's what we're targeting.

Showcase generates a portfolio that leads with outcomes and proof — not just project names and screenshots. It's built for people who've shipped real work and need a way to show what it actually did.

You're invited to be one of our first 20 beta users.

**[Get early access →]([BETA_ACCESS_LINK])**

Takes 15 minutes end-to-end. If you hit anything confusing, I want to hear about it — that's the whole point of beta.

—Vinay  
Founder, Showcase

---

## Version C — Career Switcher

**Subject:** Your Showcase invite — [NAME]

---

Hi [NAME],

You signed up for the Showcase waitlist, and I wanted to reach out directly.

Career switching is hard. Not because you don't have the skills — but because your story is scattered across a resume that wasn't built to tell it.

You mentioned [BIGGEST_CHALLENGE_HOOK]. I hear this constantly. Showcase is specifically designed to help people with non-linear careers turn their real experience into a portfolio that makes sense to the people hiring for the roles they want.

I'd like you to be in our first beta cohort. You'd be one of 20 people helping us figure out what works before we open to everyone.

**[Claim your invite →]([BETA_ACCESS_LINK])**

No credit card. No design skills. Just your resume and 15 minutes.

Honest question after you try it: did your portfolio end up telling the story you needed it to tell? That's the one thing I'm trying to nail.

—Vinay  
Founder, Showcase

---

## Personalization guidelines

- Always use their first name
- Reference something specific from their form if possible (`biggest_challenge`, `target_role`)
- If `biggest_challenge` is blank, use their `target_role` or `user_type` to infer their situation
- Keep it under 250 words
- One clear CTA link — don't add multiple links
- Sign personally as Vinay, not "the Showcase team"

## Technical notes

- `[BETA_ACCESS_LINK]` = `https://app.showcase.so/signup?token=[INVITE_TOKEN]`
- Replace `[INVITE_TOKEN]` with the `invite_token` from their `waitlist_signups` row
- After sending, update their `status` to `invited` in Supabase
