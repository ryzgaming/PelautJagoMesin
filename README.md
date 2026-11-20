# Pelaut Jago Mesin — Cloudflare storefront

Prepared from Sites version 7, commit 6eede2205ca2b38d50295ebc84ef4294cb77261e.

## Cloudflare Pages setup

- Repository: ryzgaming/PelautJagoMesin
- Production branch: cloudflare-store
- Project name: pelautjagomesin (subject to availability)
- Framework preset: None
- Root directory: leave blank (repository root)
- Build command: npm run build
- Build output directory: dist
- Environment variables: none required for this static frontend

The backend already runs at Supabase Edge Function commerce. Do not upload service-role or payment keys into frontend files.

## Before opening customer accounts/payments

After Pages deploys, verify the actual production URL and add only that exact origin to the commerce Edge CORS allowlist, preserving the existing ChatGPT Site origin. Until then, the new hostname cannot call the account API. Preview deployment origins are not enabled automatically.

Update Supabase Auth redirect settings for the confirmed URL; complete SMTP/email confirmation testing. Checkout remains closed until Midtrans configuration and payment tests are complete.

Only Shinko GJ Simulator is public. MAN, Tanabe, and Alfa Laval HTML files under dist are catalog pages, not premium simulators. Premium source files are not included in this branch and are served from private Supabase Storage only after authorization.

The old main branch and its public history are unchanged. They still contain old downloadable model files; this release does not make those historical copies private.

## Validation

npm run build checks frontend syntax and premium source exclusion.
npm test runs API, origin, and database authorization tests after installing locked development dependencies.
