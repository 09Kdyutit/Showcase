# Steel-Mode Proof Pack — 2026-06-26

Reproducible evidence for the Steel-Mode security review. Every claim in
`security/STEEL_MODE_REPORT.md` traces to a log in `logs/` or a script in
`scripts/security/` and `scripts/`.

## How to reproduce
```bash
cd /Users/kumardyutit/Showcase/casefile
# 1. Build + start a production server
NODE_ENV=production npm run build
NODE_ENV=production npm run start &   # serves http://localhost:3000

# 2. DB/logic suites (no server needed)
npm run test:secrets        # gitleaks
npm run test:rls            # 13/13

# 3. Live HTTP suites (server must be up)
EXPECT_PROD=1 npm run test:headers   # 13/13, prod CSP no unsafe-eval
npm run test:csrf                    # 6/6
npm run test:abuse                   # 3/3 (10 concurrent -> 5 pass)
npm run test:stripe                  # 6/6
npm run test:authorization           # 15/15
npm run test:uploads                 # 8/8
npm run test:prompt-injection        # 15/15
npm run test:deletion                # 13/13
npm run test:interview-rls           # 24/24
npm run test:interview-authorization # 16/16
npm run test:interview-deletion      # 10/10
npm run test:kill-switches           # 4/4
node scripts/security/raw-http-attacks.mjs   # 10/10

# 4. Production-bundle secret scan
grep -rE 'sk_(live|test)_|service_role|eyJhbGciOiJ|AIza|whsec_' .next/static public
#   -> no matches = PASS
```

## Contents
- `attack-matrix.json` — machine-readable per-attack results
- `environment-matrix.md` — exact environment each test ran in
- `evidence-index.md` — log file ↔ claim mapping
- `logs/` — raw captured output of every run
