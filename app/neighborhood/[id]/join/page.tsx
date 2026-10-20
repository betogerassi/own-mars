"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";

type Neighborhood = { id: string; name: string; price: { price: number | null; soldOut: boolean }; };

export default function JoinNeighborhoodPage() {
  const { id } = useParams<{ id: string }>();
  const [neighborhood, setNeighborhood] = useState<Neighborhood | null>(null);
  const [lots, setLots] = useState<number[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [reservationId, setReservationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void fetch(`/api/neighborhoods/${encodeURIComponent(id)}`).then(async response => { if (!response.ok) throw new Error(); const body = await response.json() as { neighborhood: Neighborhood; availableLotIndexes: number[] }; setNeighborhood(body.neighborhood); setLots(body.availableLotIndexes); }).catch(() => setError("This neighborhood is not available.")); }, [id]);
  const reserve = async () => { if (chosen === null) return; setBusy(true); setError(""); try { const response = await fetch(`/api/neighborhoods/${encodeURIComponent(id)}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lotIndex: chosen }) }); const body = await response.json() as { reservation?: { id: string }; error?: string }; if (!response.ok || !body.reservation) throw new Error(body.error ?? "Lot unavailable."); setReservationId(body.reservation.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Lot unavailable."); } finally { setBusy(false); } };
  const confirm = async () => { setBusy(true); setError(""); try { const response = await fetch(`/api/plots/${encodeURIComponent(reservationId)}/confirm`, { method: "POST" }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Sandbox checkout failed."); window.location.assign(`/neighborhood/${encodeURIComponent(id)}`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Sandbox checkout failed."); } finally { setBusy(false); } };
  return <main className="policy-page"><article><p className="eyebrow"><span/> JOIN THIS NEIGHBORHOOD</p><h1>{neighborhood?.name ?? "MARS NEIGHBORHOOD"}</h1>{reservationId ? <><p>Lot {chosen} is reserved. This is a simulated checkout; no payment details or charge are involved.</p><button className="primary" disabled={busy} onClick={() => void confirm()}>CONFIRM SANDBOX ORDER <Check/></button></> : <><p>Choose an actually available nearby lot. ${neighborhood?.price.price ?? 0} is the current server-calculated price for a new plot.</p><div className="sizes">{lots.map(index => <button key={index} className={chosen === index ? "chosen" : ""} onClick={() => setChosen(index)}><b>{index}</b><small>LOT</small></button>)}</div>{!lots.length && neighborhood && <p>There are no available nearby lots right now.</p>}<button className="primary" disabled={chosen === null || busy} onClick={() => void reserve()}>RESERVE SELECTED LOT</button></>}{error && <p className="error" role="alert">{error}</p>}</article></main>;
}
