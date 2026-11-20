import { handleEdge } from '../../../server/edge.mjs';

Deno.serve((request: Request) => handleEdge(request, {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  APP_ORIGIN: Deno.env.get('APP_ORIGIN'),
  MIDTRANS_SERVER_KEY: Deno.env.get('MIDTRANS_SERVER_KEY'),
  MIDTRANS_CLIENT_KEY: Deno.env.get('MIDTRANS_CLIENT_KEY'),
  MIDTRANS_ENV: Deno.env.get('MIDTRANS_ENV') || 'sandbox',
  CHECKOUT_ENABLED: Deno.env.get('CHECKOUT_ENABLED') || 'false',
}));
