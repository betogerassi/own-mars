# OWN MARS production launch approvals

This is a launch checklist, not an instruction to purchase, enable, or deploy anything. Every item below requires explicit owner approval before it is performed.

## Hosting decision

OWN MARS is a commercial marketplace, even while payments remain in test mode. **Vercel Hobby is not eligible**: Vercel's [Hobby plan documentation](https://vercel.com/docs/plans/hobby) and [Terms](https://vercel.com/legal/terms) restrict Hobby to personal, non-commercial use. Do not deploy OWN MARS there.

The present application uses Node.js Route Handlers, a local SQLite development adapter, local file storage and Node-specific modules. It must therefore move to a server-capable commercial host plus managed services before public launch. A Cloudflare Workers/D1/R2 implementation is a possible future port, but it requires a deliberate runtime rewrite; it is not compatible with the current Node/SQLite process as-is. Cloudflare's [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) currently has a free tier and a paid plan starting at USD $5/month, with usage limits and potential overages. Do not enable it without an owner-approved spending limit.

## Required production services

| Capability | Requirement before launch | Owner decision needed |
| --- | --- | --- |
| Runtime | Commercial, server-capable hosting for Next.js Route Handlers | Provider, region, budget and account owner |
| Database | Managed Postgres with backups and transactional rectangle reservations | Provider, region, retention and budget |
| Artwork | Private object storage with signed upload/download URLs, lifecycle rules and malware/content scanning | Provider, region, retention and moderation workflow |
| Identity | User accounts, email verification, sessions and administrator roles | Provider and privacy review |
| Payments | Stripe **test** account first, verified webhook endpoint and test-only credentials | Account owner and explicit authorization |
| Observability | Error logging, audit retention, alerts and incident contact | Provider and retention |
| Domain | `ownmars.space` DNS pointing at approved host, HTTPS and `www` redirect | GoDaddy/DNS authorization |

## Protected environment variables

The following names are expected; values must exist only in the selected host's protected secret store and never in Git, pull requests, client bundles or screenshots.

```text
NEXT_PUBLIC_SITE_URL=https://ownmars.space
OWN_MARS_PAYMENT_MODE=stripe_test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
OWN_MARS_ADMIN_TOKEN=<temporary sandbox-only token>
```

`OWN_MARS_ADMIN_TOKEN` is only a sandbox bridge. Production must replace it with authenticated, role-based administration and audited sessions. `sk_live_` values are prohibited until a separate owner approval explicitly authorizes live payments.

## Pre-merge and pre-deploy sequence

1. Owner reviews and explicitly approves merge of the stacked PR chain in order.
2. Replace the local SQLite and `data/uploads` adapters with the approved durable services; run a migration rehearsal and rollback test.
3. Configure production identity, storage validation/scanning, rate limits, backups and monitoring.
4. Deploy a private HTTPS preview; configure **Stripe test mode only** and verify signed webhook success, failure, cancellation and duplicate delivery.
5. Run browser QA on desktop and physical mobile devices, including two-finger pinch, upload, checkout, sharing and removal revocation.
6. Obtain legal review for terms, privacy, consumer/refund policy, intellectual-property process, moderation/appeal handling and applicable jurisdictions.
7. Only after a separate explicit approval: deploy publicly. Live Stripe keys and any paid plan require another separate approval.

## Current code state

The repository's sandbox has atomic local reservations, idempotent Stripe-test webhook code, protected temporary artwork delivery, immutable posts, reporting and a token-gated moderation queue. It is intentionally **not** production durable until the services above are approved and integrated.
