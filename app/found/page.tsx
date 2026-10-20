"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, MoveRight } from "lucide-react";

type FounderReservation = { neighborhood?: { id: string }; founderPlot?: { id: string }; error?: string };

function FoundNeighborhoodForm() {
  const query = useSearchParams();
  const lat = Number(query.get("lat"));
  const lon = Number(query.get("lon"));
  const [neighborhoodName, setNeighborhoodName] = useState("");
  const [founderName, setFounderName] = useState("");
  const [reservation, setReservation] = useState<FounderReservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reserve = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/neighborhoods", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat, lon, neighborhoodName, founderName }) });
      const body = await response.json() as FounderReservation;
      if (!response.ok || !body.neighborhood || !body.founderPlot) throw new Error(body.error ?? "This location is unavailable.");
      setReservation(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "This location is unavailable."); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!reservation?.founderPlot?.id || !reservation.neighborhood?.id) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/plots/${encodeURIComponent(reservation.founderPlot.id)}/confirm`, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Sandbox checkout failed.");
      window.location.assign(`/neighborhood/${encodeURIComponent(reservation.neighborhood.id)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sandbox checkout failed."); }
    finally { setBusy(false); }
  };

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return <main className="policy-page"><article><h1>Choose a Mars location first.</h1><a className="primary" href="/#explore">EXPLORE MARS</a></article></main>;
  return <main className="policy-page founder-page"><nav><a className="brand" href="/"><i/> OWN MARS</a><a className="navcta" href="/#explore"><ArrowLeft size={15}/> BACK TO MARS</a></nav><article><p className="eyebrow"><span/> FOUND YOUR OWN NEIGHBORHOOD · $100</p><h1>{reservation ? "MAKE IT OFFICIAL." : "START THE STORY."}</h1>{reservation ? <><p>You are reserving <b>{neighborhoodName}</b> at {lat.toFixed(2)}°, {lon.toFixed(2)}°. This simulated order creates no charge and confirms the founder badge only after confirmation.</p>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy} onClick={() => void confirm()}>CONFIRM SANDBOX FOUNDER ORDER <Check/></button></> : <form onSubmit={reserve}><p>Claim one founder plot, name the neighborhood, and invite future neighbors. This is fictional digital space only: no ownership of land, commissions, or investment rights.</p><label>NEIGHBORHOOD NAME<input className="field" required minLength={3} maxLength={40} value={neighborhoodName} onChange={event => setNeighborhoodName(event.target.value)} placeholder="Olympus Heights"/></label><label>PUBLIC FOUNDER NAME<input className="field" required maxLength={80} value={founderName} onChange={event => setFounderName(event.target.value)} placeholder="Your alias"/></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>RESERVE FOUNDER PLOT <MoveRight/></button></form>}</article></main>;
}

export default function FoundNeighborhoodPage() {
  return <Suspense fallback={<main className="policy-page"><article><p className="eyebrow"><span/> OWN MARS</p><h1>PREPARING YOUR NEIGHBORHOOD.</h1></article></main>}><FoundNeighborhoodForm/></Suspense>;
}
