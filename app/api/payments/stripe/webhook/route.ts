import Stripe from "stripe";
import { fulfillStripeCheckout } from "../../../../lib/server/store";
import { stripeTestClient, stripeWebhookSecret } from "../../../../lib/server/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const stripe = stripeTestClient();
    const secret = stripeWebhookSecret();
    if (!stripe || !secret) return Response.json({ error: "Stripe test webhooks are not enabled." }, { status: 503 });
    const signature = request.headers.get("stripe-signature");
    if (!signature) return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
    const event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const plotId = session.metadata?.own_mars_plot_id;
      if (!plotId || session.payment_status !== "paid") return Response.json({ received: true });
      fulfillStripeCheckout(plotId, session.id, typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null);
    }
    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid Stripe webhook." }, { status: 400 });
  }
}
