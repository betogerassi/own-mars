import { confirmSandboxCheckout, ReservationExpiredError } from "../../../../lib/server/store";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/plots/[id]/confirm">) {
  try {
    const { id } = await context.params;
    const plot = confirmSandboxCheckout(id);
    return Response.json({ plot, mode: "sandbox", charged: false });
  } catch (error) {
    const status = error instanceof ReservationExpiredError ? 409 : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Could not confirm sandbox checkout." }, { status });
  }
}
