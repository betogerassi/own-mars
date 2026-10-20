import Link from "next/link";
import SiteFooter from "../components/SiteFooter";
import { publicDiscovery, type StoredPlot } from "../lib/server/store";

export const runtime = "nodejs";

function PropertyList({ plots }: { plots: StoredPlot[] }) {
  return <div className="steps">{plots.map((plot, index) => <article key={plot.id}><b>{String(index + 1).padStart(2, "0")}</b><h3>{plot.title}</h3><p>by {plot.creatorName} · {plot.likes} {plot.likes === 1 ? "like" : "likes"}</p><Link href={`/plot/${plot.id}`}>VIEW PROPERTY →</Link></article>)}</div>;
}

export default function DiscoverPage() {
  const discovery = publicDiscovery();
  const hasActivity = discovery.mostLiked.length || discovery.trendingNow.length || discovery.newest.length || discovery.hottestNeighborhoods.length;
  return <main className="policy-page discover-page">
    <nav><a className="brand" href="/"><i/> OWN MARS</a><a className="navcta" href="/#explore">CLAIM YOUR SPOT</a></nav>
    <article>
      <p className="eyebrow"><span/> THE FIRST PLANET BUILT BY THE INTERNET</p>
      <h1>DISCOVER<br/><em>MARS.</em></h1>
      <p>Real public activity, ranked from actual likes and publication dates. No invented popularity.</p>
      {!hasActivity && <section><h2>Mars is waiting for its first story.</h2><p>Found a neighborhood or publish a property to appear here through real activity.</p><a className="primary" href="/#explore">EXPLORE MARS</a></section>}
      {discovery.trendingNow.length > 0 && <section><p className="eyebrow"><span/> LIKES IN THE LAST 7 DAYS</p><h2>TRENDING NOW</h2><PropertyList plots={discovery.trendingNow}/></section>}
      {discovery.mostLiked.length > 0 && <section><p className="eyebrow"><span/> ALL-TIME AUTHENTIC LIKES</p><h2>MOST LIKED ON MARS</h2><PropertyList plots={discovery.mostLiked}/></section>}
      {discovery.newest.length > 0 && <section><p className="eyebrow"><span/> PERMANENTLY PUBLISHED</p><h2>NEWEST CREATIONS</h2><PropertyList plots={discovery.newest}/></section>}
      {discovery.hottestNeighborhoods.length > 0 && <section><p className="eyebrow"><span/> RECENT AUTHENTIC ACTIVITY</p><h2>HOTTEST NEIGHBORHOODS</h2><div className="steps">{discovery.hottestNeighborhoods.map((neighborhood, index) => <article key={neighborhood.id}><b>{String(index + 1).padStart(2, "0")}</b><h3>{neighborhood.name}</h3><p>Founded by {neighborhood.founderName} · {neighborhood.confirmedResidents} residents · {neighborhood.recentLikes} recent likes</p><Link href={`/neighborhood/${neighborhood.id}`}>VISIT NEIGHBORHOOD →</Link></article>)}</div></section>}
      <small>{discovery.rules.trendingOrder}</small>
    </article>
    <SiteFooter/>
  </main>;
}
