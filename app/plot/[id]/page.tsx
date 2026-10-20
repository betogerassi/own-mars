import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LikeButton from "./LikeButton";
import ReportButton from "./ReportButton";
import { getPlot } from "../../lib/server/store";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const plot = getPlot(id);
  if (!plot || plot.publicationState !== "PUBLISHED") return { title: "Plot not found — OWN MARS" };
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ownmars.space";
  const image = plot.image ? new URL(plot.image, siteUrl).toString() : undefined;
  return { title: `${plot.title} — OWN MARS`, description: plot.description || `A permanent creation at ${plot.lat.toFixed(2)}°, ${plot.lon.toFixed(2)}° on Mars.`, openGraph: { url: `/plot/${plot.id}`, images: image ? [image] : [] } };
}

export default async function PublicPlotPage({ params }: Props) {
  const { id } = await params;
  const plot = getPlot(id);
  if (!plot || plot.publicationState !== "PUBLISHED") notFound();
  return <main className="public-plot"><nav><a className="brand" href="/"><i/> OWN MARS</a></nav><article><p className="eyebrow"><span/> PERMANENT MARS POST</p>{plot.image && <img src={plot.image} alt={plot.title} />}<p className="notice">PLOT {plot.id}</p><h1>{plot.title}</h1><p>By {plot.creatorName ?? plot.name}</p>{plot.description && <p>{plot.description}</p>}<p>{plot.lat.toFixed(2)}°, {plot.lon.toFixed(2)}° · ${plot.price} USD virtual space</p><LikeButton plotId={plot.id} initialLikes={plot.likes}/><a className="primary" href={`/?plot=${encodeURIComponent(plot.id)}#explore`}>VIEW ON MARS</a><a className="secondary" href={`/plot/${encodeURIComponent(plot.id)}/cards`}>DOWNLOAD SHARE CARDS</a><a className="secondary" href="/#explore">CLAIM YOUR OWN SPACE</a>{plot.url && <a className="secondary" href={plot.url} rel="noreferrer">VISIT CREATOR LINK</a>}<ReportButton plotId={plot.id}/></article></main>;
}
