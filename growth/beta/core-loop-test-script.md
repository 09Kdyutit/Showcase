# Core Loop Test Script

Use this to verify the full user journey before each new beta wave.  
Run it yourself as a fresh user (incognito, new email).

---

## Prerequisites

- Fresh Supabase project or a test email you can delete after
- A real resume (your own, or a test resume with realistic data)
- Target role chosen: e.g., "Senior Product Designer"

---

## The core loop

```
Waitlist → Invite accepted → Signup → Resume upload → Parse →
Generate portfolio → Edit → ProofScore → Publish → View public page
```

---

## Step-by-step test

### 1. Waitlist signup

- [ ] Go to `/waitlist`
- [ ] Fill in: email, name, target role, experience level, biggest challenge
- [ ] Submit
- [ ] Expected: success state with referral code shown
- [ ] Check Supabase: row inserted in `waitlist_signups` with status `waitlisted`

### 2. Invite flow

- [ ] Copy `invite_token` from Supabase for the test row
- [ ] Navigate to `/signup?token=[INVITE_TOKEN]`
- [ ] Expected: signup form pre-fills or skips waitlist gate
- [ ] Create account with email + password

### 3. Onboarding

- [ ] After signup: lands on onboarding or dashboard
- [ ] No console errors
- [ ] No broken layout

### 4. Resume upload

- [ ] Navigate to resume upload section
- [ ] Upload a PDF or paste text
- [ ] Expected: resume parsed, `resume_parsed` event in `usage_events`
- [ ] Check parsed output: does it extract meaningful experience?

### 5. Portfolio generation

- [ ] Set target role and industry
- [ ] Click generate
- [ ] Expected: loading state appears, no timeout, portfolio renders
- [ ] Check `portfolio_generated` event in `usage_events`
- [ ] Check `portfolios` table: `content` JSON populated

### 6. Portfolio review

- [ ] Read the generated headline — is it ≤14 words?
- [ ] Read proof metrics — are values short (≤8 chars)?
- [ ] Is there a `featuredResult` badge?
- [ ] Are case studies coherent and specific?
- [ ] Is the tone professional and not generic?

### 7. Editing

- [ ] Edit the headline
- [ ] Edit one case study
- [ ] Save
- [ ] Expected: changes persist on page refresh
- [ ] Check `portfolio_edit_saved` event in `usage_events`

### 8. ProofScore

- [ ] Run the ProofScore / audit
- [ ] Expected: score appears, recommendations visible
- [ ] Check `proofscore_completed` event in `usage_events`

### 9. Publish

- [ ] Click publish
- [ ] Expected: portfolio goes live at `/p/[slug]`
- [ ] Check `portfolio_published` event in `usage_events`
- [ ] Check `portfolios.status = 'published'`

### 10. Public page

- [ ] Navigate to `/p/[slug]` in incognito (not logged in)
- [ ] Expected: full portfolio visible, no auth required
- [ ] Gradient text renders correctly (no invisible text)
- [ ] Page loads in < 2 seconds
- [ ] No console errors

---

## Red flags that block a wave

Do NOT send a new wave until all of these pass:

- [ ] Waitlist signup works (no 500 errors)
- [ ] Resume parse completes in < 10 seconds
- [ ] Portfolio generation completes in < 30 seconds
- [ ] Generated output is coherent and specific (not generic placeholders)
- [ ] Publish works and public page renders
- [ ] No critical console errors in any step

---

## Nice-to-have (fix before wave 2)

- [ ] ProofScore gives specific, actionable recommendations
- [ ] Editing interface is intuitive without instructions
- [ ] Mobile portfolio page looks good
- [ ] Social share card for `/p/[slug]` has correct OG image
