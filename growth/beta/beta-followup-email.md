# Beta Follow-Up Email (Day 3)

Send to anyone who received an invite but hasn't signed up after 72 hours.  
Check `waitlist_signups.status = 'invited'` and no matching `auth.users` record yet.

---

**Subject:** Still here if you want in — Showcase beta

---

Hi [NAME],

Just a quick note — your Showcase beta invite is still active.

If you've been busy or forgot, no pressure. The link below still works:

**[Get started →]([BETA_ACCESS_LINK])**

If you're not interested right now, just let me know and I won't follow up again. No hard feelings.

—Vinay

---

## When to send

- Day 3 after invite email (72 hours)
- Send between Tuesday–Thursday, 9–11am in their likely timezone
- Don't send if they've clicked the link (check via email open tracking or Supabase signup date)

## After sending

- Log in tracker: `followup_sent: true`
- If no response after 4 more days → send `beta-no-response-followup.md` (final ping)
- If still nothing → mark status `bounced`, stop outreach
