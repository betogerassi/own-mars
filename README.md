# OWN MARS — Phase 1

Interactive visual prototype for a virtual-display-space marketplace. It is not a land sale, property registry, payment system, or production-ready commerce service.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:7777`. For a production verification build, run `npm run build`; the deployable static site is then written to `out/`.

## GitHub Pages deployment

This project is deliberately a static export and requires no runtime secrets, database, payment provider, or local server. The included GitHub Actions workflow builds and deploys `out/` whenever `main` changes.

- In GitHub: Settings → Pages → Source → GitHub Actions.
- Add `ownmars.space` as the custom domain, then enable **Enforce HTTPS** when GitHub makes it available.
- In GoDaddy, add the GitHub Pages A records for the apex and a `www` CNAME to `<your-github-user-or-org>.github.io`.

The tracked `public/_headers` file remains useful for Cloudflare-compatible static hosts. Do not add `.env` values: there are none for the demo.

## Included

- Responsive English-only landing experience.
- React Three Fiber Mars globe with rotation, drag rotation, scroll/pinch zoom, and surface selection.
- 40,000 × 25,000 virtual inventory-canvas framing, with $1/virtual-pixel calculator and 10×10 minimum.
- Safe client-side prototype image preview for JPG, PNG, and WebP under 8 MB.
- Clearly labelled simulated checkout; no payment, database, image persistence, or real inventory is active.

## Architecture path for Phase 2

Use a Postgres database with a `display_rectangles` table holding `x, y, width, height, status`, not one record per pixel. Add an exclusion constraint / transactional overlap query for reservations and an expiration worker. Keep price calculation, availability, uploads, moderation state, and payment-webhook verification server-side. Stripe test mode is a candidate only after merchant eligibility and legal review.

The current globe is procedural to ensure the prototype works fully offline. Before launch, replace it with an optimized, legally reusable Mars texture and visible source attribution (for example NASA imagery subject to its applicable media-use guidance).

## Cost

Phase 1 requires no paid service. A domain is the only assumed cost. A managed database, object storage, email, monitoring, and payment processing may incur fees at scale; no paid service should be enabled without explicit approval.
