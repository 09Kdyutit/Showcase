#!/usr/bin/env node

// Backward-compatible entry point. The entitlement proof now covers both Portfolio and
// complete Audit leases in the generic local-only integration suite.
await import('./test-ai-feature-usage-leases-live.mjs')
