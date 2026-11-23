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

The commerce Edge CORS allowlist includes https://pelautjagomesin.pages.dev and the existing ChatGPT Site origin. Preview deployment origins are not enabled automatically. Authentication and entitlement checks still apply to both storefronts.

Update Supabase Auth redirect settings for the confirmed URL; complete SMTP/email confirmation testing. Checkout remains closed until Midtrans configuration and payment tests are complete.

Store Sandbox credentials only in Supabase Edge Function Secrets: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, and `MIDTRANS_SIGNATURE_KEY` (the Midtrans Signature Secret Key). Since October 2026, the notification signature key is separate from newly generated Server Keys. Webhook signatures use the Signature Secret Key; requests to Midtrans use the Server Key. A valid signature is followed by a server-to-server status check before access is granted. Missing credentials keep checkout unavailable. Leave `CHECKOUT_ENABLED=false` until setup and sandbox validation are complete, and `MIDTRANS_ENV=sandbox` throughout testing.

Configure the Midtrans Sandbox payment notification URL as `https://vkljhkzbuomcwqnsiope.supabase.co/functions/v1/commerce/webhook`. No real-money test is required. Do not change catalog prices to create a test transaction; use an explicitly isolated sandbox test flow.

Only Shinko GJ Simulator is public. MAN, Tanabe, and Alfa Laval HTML files under dist are catalog pages, not premium simulators. Premium source files are not included in this branch and are served from private Supabase Storage only after authorization.

The old main branch and its public history are unchanged. They still contain old downloadable model files; this release does not make those historical copies private.

## Alur workflow

The storefront links to Alur at `/alur/`. From the repository root, run `npm ci` and `npm run build` to generate the editor and form alongside the existing storefront in `dist`. Cloudflare Pages bundles `functions/alur/api` for Alur login, cloud workflows and execution history. For a local Pages preview, run `npx wrangler pages dev dist` after building. Alur uses the same Supabase account credentials as the storefront with its own scoped session cookies.

## Validation

npm run build checks frontend syntax and premium source exclusion, then builds Alur.
npm test runs API, origin, and database authorization tests after installing locked development dependencies.
