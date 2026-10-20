import "server-only";
import Stripe from "stripe";

export const STRIPE_TEST_MODE = "stripe_test";

export function stripeTestClient() {
  if (process.env.OWN_MARS_PAYMENT_MODE !== STRIPE_TEST_MODE) return null;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_test_")) throw new Error("Stripe test mode requires an sk_test_ secret key.");
  return new Stripe(key);
}

export function stripeWebhookSecret() {
  if (process.env.OWN_MARS_PAYMENT_MODE !== STRIPE_TEST_MODE) return null;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith("whsec_")) throw new Error("Stripe test mode requires a whsec_ webhook secret.");
  return secret;
}

export function publicOrigin() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_SITE_URL is required for Stripe Checkout return URLs.");
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Stripe Checkout needs an HTTPS public origin outside localhost.");
  return url.origin;
}
