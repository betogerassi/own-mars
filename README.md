# OWN MARS — sandbox marketplace

OWN MARS is a virtual-display-space marketplace. It is not physical Mars land, a property registry, or a live commerce service.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:7777`. Verify a production build with `npm run build`.

## Current sandbox capabilities

- Responsive Mars explorer with rotation, scroll/pinch zoom, reset controls, geographic selection and a 40,000 × 25,000 virtual canvas.
- Zone-aware server quote: General Mars ($1), Prime ($3), Iconic ($10), and Landmark ($25) per virtual pixel.
- A local SQLite sandbox adapter providing transactional reservations, overlap prevention, sandbox checkout, immutable publication, public plot pages, likes, reports and audited moderation states.
- Server-validated JPG, PNG and WebP uploads up to 2 MB in local development, image crop/position preview, and browser-generated Story and Feed sharing cards.
- No payment method, charge, production credential, paid service or live payment provider is active.

## Texture

The globe uses a temporary local NASA texture. It is not claimed as original OWN MARS artwork. See [public/ATTRIBUTION.md](public/ATTRIBUTION.md). Before launch, replace it with an original or separately licensed 8192 × 4096 2:1 texture, optimized as WebP. Do not upscale the temporary texture and present it as production quality.

## Production requirements — not yet implemented

The SQLite database and local `public/uploads` storage are intentionally unsuitable for a public deployment. Before launch, approve and configure:

1. A server-capable host, managed Postgres database and private object storage.
2. Authenticated user accounts, secure signed uploads, malware/content moderation, rate limits, backups and monitoring.
3. Durable rectangle reservation/fulfillment, deployed worker for expiry, and administrator console.
4. A verified payment provider in sandbox/test mode first; live credentials and payments require explicit owner approval.

Keep every secret in the host's protected environment-variable store. Never commit credentials. No deployment, merge, paid service activation or live payments occur from this repository without owner approval.
