# OWN MARS product audit and neighborhood roadmap

## Audit — 19 October 2026

The current stacked PR chain already provides a solid sandbox base: the interactive Mars globe, coordinate picking, 40,000 × 25,000 virtual grid, zone quotes, SQLite-backed atomic reservations, upload validation, simulated checkout, immutable publication, public plot pages, authentic likes, report/moderation flows, social cards and an opt-in Stripe **test** adapter. PRs #2, #4, #6, #10, #11, #12, #14, #16, #18, #20, #22, #24, #26 and #28 are open and unmerged. Each later PR depends on the prior stack; #4 remains a separate earlier texture/demo alternative and must be reviewed rather than blindly merged.

Current limitations are intentional or external: local SQLite and local file storage are not production infrastructure; there is no real buyer identity, hosted object storage, merchant test credentials, live payment, deployment, or production moderation identity. The GitHub Pages workflow is incompatible with the server-side API/SQLite application and must not be treated as a deploy path.

## Practical architecture

The neighborhood domain is a server-owned layer above the existing global grid. A neighborhood records a stable ID, normalized unique display name, founder plot, wrapped rectangular boundary, capacity/configuration, founder status, and timestamps. Its lots are deterministic indexes within that boundary. A separate allocation record links one confirmed purchase to one neighborhood lot. This keeps plot ownership, payment records, and public posts authoritative in the existing purchase layer while supporting future capacity changes per neighborhood.

Price tiers use **confirmed** occupancy only: reserved or failed purchases never alter public occupancy or prices. The founder purchase is $100 and stays `PENDING_PAYMENT`; only a verified checkout turns it into `CONFIRMED`, allocates the founder lot and increments occupancy. Regular lots begin at $50 with transparent configurable tiers. No resale, commission, ownership of others' plots, or investment claim exists in this design.

## Implementation roadmap

1. **Domain rules (this PR):** deterministic boundaries/lots, name normalization, configurable capacity/pricing and founder confirmation semantics, with tests.
2. **Persistence and atomic founder flow:** migrate the sandbox schema, reserve a founder neighborhood without allocating it permanently, and confirm it only through the existing checkout fulfillment path.
3. **Neighborhood APIs and public pages:** availability, occupancy, map/lots, founder profile and invitations.
4. **Explorer UX:** founder flow and nearby-plot selection; preserve the existing plot flow.
5. **Discovery:** explainable all-time/recent rankings based only on stored publications, likes and timestamps.
6. **Production migration:** owner-approved identity, managed database, private object storage, Stripe test credentials/webhook, then separate production approval.

## Decisions deliberately deferred

- A production database, identity provider, object-storage provider and deployment host require owner approval.
- Legal/privacy wording, operator contact and moderation appeals need legal/operator review.
- Stripe test credentials and a public webhook endpoint are required to exercise non-simulated test checkout; live mode remains out of scope.
