import { notFound } from "next/navigation";
import SocialCardActions from "../../../components/SocialCardActions";
import { getPlot } from "../../../lib/server/store";

export const dynamic = "force-dynamic";

export default async function PlotCards({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plot = getPlot(id);
  if (!plot || plot.publicationState !== "PUBLISHED" || !plot.image) notFound();
  return <main className="public-plot"><nav><a className="brand" href={"/plot/" + plot.id}><i/> OWN MARS</a></nav><article><p className="eyebrow"><span/> SHARE YOUR PLACE</p><h1>I'M ON <em>MARS.</em></h1><p>Your cards use the exact image permanently published on plot {plot.id}.</p><SocialCardActions image={plot.image} title={plot.title} plotId={plot.id} coordinates={plot.lat.toFixed(2) + "°, " + plot.lon.toFixed(2) + "°"}/></article></main>;
}
