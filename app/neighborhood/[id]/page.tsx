import { notFound } from "next/navigation";
import { getNeighborhood } from "../../lib/server/store";
import SiteFooter from "../../components/SiteFooter";

export const runtime = "nodejs";

export default async function NeighborhoodPage({ params }: PageProps<"/neighborhood/[id]">) {
  const { id } = await params;
  const neighborhood = getNeighborhood(id);
  if (!neighborhood || neighborhood.status !== "confirmed") notFound();
  const { price } = neighborhood;
  return <main className="policy-page neighborhood-page">
    <nav><a className="brand" href="/"><i/> OWN MARS</a><a className="navcta" href={`/?neighborhood=${encodeURIComponent(neighborhood.id)}#explore`}>JOIN THIS NEIGHBORHOOD</a></nav>
    <article>
      <p className="eyebrow"><span/> CONFIRMED MARS NEIGHBORHOOD</p>
      <h1>{neighborhood.name}</h1>
      <p>FOUNDED BY <b>{neighborhood.founderName}</b> · <b>FOUNDER</b></p>
      <p>A fictional neighborhood on Mars. Digital creative spaces only — no real estate, ownership rights, resale value, or investment claim.</p>
      <h2>{neighborhood.occupancy} / {neighborhood.capacity} confirmed residents</h2>
      <p>{price.soldOut ? "SOLD OUT" : `${price.remaining} available · current new-plot price $${price.price}`}</p>
      {price.plotsUntilNextThreshold !== null && <p>Only {price.plotsUntilNextThreshold} {price.plotsUntilNextThreshold === 1 ? "plot" : "plots"} left before the next price tier.</p>}
      <p>Boundary: {neighborhood.boundary.width} × {neighborhood.boundary.height} virtual pixels · grid {neighborhood.boundary.originX}, {neighborhood.boundary.originY}</p>
      <div className="modal-actions"><a className="primary" href={`/?neighborhood=${encodeURIComponent(neighborhood.id)}#explore`}>EXPLORE AVAILABLE PLOTS</a><a className="secondary" href={`/api/neighborhoods/${encodeURIComponent(neighborhood.id)}`}>VIEW PUBLIC DATA</a></div>
    </article>
    <SiteFooter/>
  </main>;
}
