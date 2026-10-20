import { getPlot, recordStripeCheckoutSession } from "../../../../lib/server/store";
import { publicOrigin, stripeTestClient } from "../../../../lib/server/stripe";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/plots/[id]/checkout">) {
  try {
    const { id } = await context.params;
    const plot = getPlot(id);
    if (!plot || plot.status !== "reserved") throw new Error("Active plot reservation not found.");
    const stripe = stripeTestClient();
    if (!stripe) return Response.json({ error: "Stripe test checkout is not enabled." }, { status: 503 });
    const origin = publicOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price_data: { currency: "usd", product_data: { name: `OWN MARS virtual plot ${plot.id}` }, unit_amount: plot.price * 100 }, quantity: 1 }],
      metadata: { own_mars_plot_id: plot.id },
      success_url: `${origin}/?plot=${encodeURIComponent(plot.id)}&checkout=success#explore`,
      cancel_url: `${origin}/?plot=${encodeURIComponent(plot.id)}&checkout=cancelled#explore`,
    });
    recordStripeCheckoutSession(plot.id, session.id);
    return Response.json({ checkoutUrl: session.url, mode: "stripe_test" }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create Stripe Checkout." }, { status: 400 });
  }
}
