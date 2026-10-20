"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Crosshair, ImagePlus, Minus, MoveRight, Plus, RotateCcw, Share2, X } from "lucide-react";
import MarsCanvas, { type MarsControls } from "./components/MarsCanvas";
import SocialCardActions from "./components/SocialCardActions";
import { type Spot, validPlot } from "./lib/demo";

const presets = [[10, 10], [20, 20], [50, 50], [100, 100]];
const fresh = (lat = 0, lon = 0): Spot => ({ id: `draft-${Date.now()}`, lat, lon, width: 10, height: 10, name: "", message: "", url: "", crop: 1, cropX: 0, cropY: 0, x: 0, y: 0 });
type Quote = { total: number; breakdown: { zone: string; label: string; pixels: number }[] };
type Stage = "checkout" | "publish" | "success" | "found-name" | "found-checkout" | "found-success" | null;

export default function Home() {
  const explorerControls = useRef<MarsControls | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [plots, setPlots] = useState<Spot[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [id, setId] = useState("");
  const [stage, setStage] = useState<Stage>(null);
  const [creator, setCreator] = useState("");
  const [neighborhoodName, setNeighborhoodName] = useState("");
  const [founderName, setFounderName] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/plots").then(async response => {
      if (response.ok) setPlots((await response.json() as { plots: Spot[] }).plots);
    });
    const plotId = new URLSearchParams(location.search).get("plot");
    if (!plotId) return;
    void fetch(`/api/plots/${encodeURIComponent(plotId)}`).then(async response => {
      if (response.ok) setSpot((await response.json() as { plot: Spot }).plot);
    });
  }, []);

  useEffect(() => {
    if (!spot || !validPlot(spot.width, spot.height)) { setQuote(null); return; }
    const controller = new AbortController();
    const query = new URLSearchParams({ lat: String(spot.lat), lon: String(spot.lon), width: String(spot.width), height: String(spot.height) });
    void fetch(`/api/quote?${query}`, { signal: controller.signal }).then(async response => {
      if (response.ok) setQuote(await response.json() as Quote);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [spot?.lat, spot?.lon, spot?.width, spot?.height]);

  // Kept separate from the standard purchase dialog while the founder flow is
  // introduced incrementally. The server remains the authority for reservation
  // and payment confirmation; browser prompts collect only public aliases.
  useEffect(() => {
    if (stage !== "found-name" || !spot) return;
    setStage(null);
    const requestedNeighborhoodName = window.prompt("Name your neighborhood (3–40 characters):", neighborhoodName)?.trim();
    const requestedFounderName = requestedNeighborhoodName ? window.prompt("Your public founder name or alias:", founderName)?.trim() : "";
    if (!requestedNeighborhoodName || !requestedFounderName) return;
    setNeighborhoodName(requestedNeighborhoodName); setFounderName(requestedFounderName);
    void (async () => {
      setBusy(true); setError("");
      try {
        const reserveResponse = await fetch("/api/neighborhoods", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat: spot.lat, lon: spot.lon, neighborhoodName: requestedNeighborhoodName, founderName: requestedFounderName }) });
        const reservation = await reserveResponse.json() as { neighborhood?: { id: string }; founderPlot?: Spot; error?: string };
        if (!reserveResponse.ok || !reservation.neighborhood || !reservation.founderPlot) throw new Error(reservation.error ?? "This neighborhood location is unavailable.");
        setNeighborhoodId(reservation.neighborhood.id); setId(reservation.founderPlot.id);
        if (!window.confirm(`Reserve ${requestedNeighborhoodName} for $100 in sandbox mode? No charge will be made.`)) return;
        const confirmResponse = await fetch(`/api/plots/${encodeURIComponent(reservation.founderPlot.id)}/confirm`, { method: "POST" });
        const confirmation = await confirmResponse.json() as { error?: string };
        if (!confirmResponse.ok) throw new Error(confirmation.error ?? "Sandbox checkout failed.");
        window.location.assign(`/neighborhood/${encodeURIComponent(reservation.neighborhood.id)}`);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not found this neighborhood."); }
      finally { setBusy(false); }
    })();
  }, [stage, spot, neighborhoodName, founderName]);

  const select = (lat: number, lon: number) => { setError(""); setSpot(current => current ? { ...current, id: `draft-${Date.now()}`, lat, lon } : fresh(lat, lon)); };
  const edit = (change: Partial<Spot>) => { setError(""); setSpot(current => current && ({ ...current, ...change })); };
  const openExplorer = () => document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth" });
  const publicUrl = id && typeof window !== "undefined" ? `${window.location.origin}/plot/${id}` : "";

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError("");
    const form = new FormData(); form.append("artwork", file);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const body = await response.json() as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "Upload failed.");
      edit({ image: body.url });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); }
    finally { setBusy(false); }
  };

  const reserve = async () => {
    if (!spot || !quote) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/plots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spot) });
      const body = await response.json() as { reservation?: Spot; error?: string };
      if (!response.ok || !body.reservation) throw new Error(body.error ?? "This plot is unavailable.");
      setId(body.reservation.id); setSpot(body.reservation); setStage("checkout");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "This plot is unavailable."); }
    finally { setBusy(false); }
  };

  const reserveNeighborhood = async () => {
    if (!spot) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/neighborhoods", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat: spot.lat, lon: spot.lon, neighborhoodName, founderName }) });
      const body = await response.json() as { neighborhood?: { id: string }; founderPlot?: Spot; error?: string };
      if (!response.ok || !body.neighborhood || !body.founderPlot) throw new Error(body.error ?? "This neighborhood location is unavailable.");
      setNeighborhoodId(body.neighborhood.id); setId(body.founderPlot.id); setSpot(body.founderPlot); setStage("found-checkout");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "This neighborhood location is unavailable."); }
    finally { setBusy(false); }
  };

  const checkout = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/plots/${encodeURIComponent(id)}/confirm`, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Sandbox checkout failed.");
      setStage("publish");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sandbox checkout failed."); }
    finally { setBusy(false); }
  };

  const confirmFounder = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/plots/${encodeURIComponent(id)}/confirm`, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Sandbox checkout failed.");
      setStage("found-success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sandbox checkout failed."); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!spot) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/plots/${encodeURIComponent(id)}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: spot.name, creatorName: creator, description: spot.message }) });
      const body = await response.json() as { plot?: Spot; error?: string };
      if (!response.ok || !body.plot) throw new Error(body.error ?? "Publication failed.");
      setSpot(body.plot); setPlots(current => [body.plot!, ...current.filter(plot => plot.id !== body.plot!.id)]); setStage("success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Publication failed."); }
    finally { setBusy(false); }
  };

  const share = async () => {
    if (!publicUrl) return;
    if (navigator.share) { await navigator.share({ title: "I'M ON MARS.", url: publicUrl }); return; }
    await navigator.clipboard.writeText(publicUrl);
  };
  const displayPrice = quote?.total ?? 0;

  return <main>
    <nav><a className="brand" href="#top"><i/> OWN MARS</a><div className="navlinks"><a href="#explore">Explore</a><a href="#how">How it works</a></div><button className="navcta" onClick={openExplorer}>Claim your spot <MoveRight size={15}/></button></nav>
    <section className="hero" id="top"><div className="stars"/><div className="hero-copy"><p className="eyebrow"><span/> WHERE IMAGINATION GETS AN ADDRESS</p><h1>EARTH IS CROWDED.<br/><em>MARS IS OPEN.</em></h1><p className="lede">Choose a unique virtual place, publish what you made, and give it a permanent address.</p><button className="primary" onClick={openExplorer}>CLAIM YOUR SPOT <MoveRight size={17}/></button><p className="notice">SANDBOX MODE · NO PAYMENTS · VIRTUAL DIGITAL SPACE</p></div><MarsCanvas className="hero-globe" selected={spot} spots={plots} onSelect={select} interactive={false} focusOnSelection={false}/><p className="hero-credit">Temporary Mars texture: NASA<br/>until licensed OWN MARS artwork is supplied.</p></section>
    <section className="explore" id="explore"><div className="section-head"><p className="eyebrow"><span/> SELECT YOUR DISPLAY SPACE</p><h2>FIND YOUR <em>PLACE.</em></h2><p>Drag to rotate. Scroll or pinch to zoom. Click Mars to select an address; the exact zone price is calculated before reservation.</p></div><div className="workspace"><div className="mars-stage"><MarsCanvas selected={spot} spots={plots} onSelect={select} controlRef={explorerControls}/><div className="map-ui"><span><Crosshair size={14}/>{spot ? `${spot.lat.toFixed(2)}°, ${spot.lon.toFixed(2)}°` : "CLICK MARS TO SELECT"}</span><span>40,000 × 25,000 VIRTUAL CANVAS</span></div><div className="globe-controls"><button aria-label="Zoom in" onClick={() => explorerControls.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out" onClick={() => explorerControls.current?.zoomOut()}><Minus/></button><button aria-label="Reset globe view" onClick={() => explorerControls.current?.reset()}><RotateCcw/></button></div></div><aside className="claim-panel"><div className="panel-top"><p>YOUR MARS POST</p><button aria-label="Clear selected location" onClick={() => setSpot(null)}><X size={16}/></button></div>{spot ? <><div className="location"><div className="pin active"><Crosshair size={20}/></div><div><strong>Selected location</strong><small>{spot.lat.toFixed(2)}°, {spot.lon.toFixed(2)}°</small></div></div><button className="found" disabled={busy} onClick={() => { setError(""); setStage("found-name"); }}>FOUND A NEIGHBORHOOD <b>$100</b></button><p className="found-note">Includes a founder plot and recognition — no commissions or real-estate rights.</p><label>DISPLAY SIZE</label><div className="sizes">{presets.map(([width, height]) => <button key={width} className={spot.width === width && spot.height === height ? "chosen" : ""} onClick={() => edit({ width, height })}><b>{width} × {height}</b><small>{width * height} pixels</small></button>)}</div><div className="custom"><input aria-label="Plot width" value={spot.width} type="number" min="10" max="100" onChange={event => edit({ width: Number(event.target.value) })}/><span>×</span><input aria-label="Plot height" value={spot.height} type="number" min="10" max="100" onChange={event => edit({ height: Number(event.target.value) })}/></div><div className="price"><span>{spot.width} × {spot.height} virtual pixels</span><strong>${displayPrice.toLocaleString()} <small>USD</small></strong></div>{quote && <p className="zone-quote">{quote.breakdown.map(zone => `${zone.label}: ${zone.pixels.toLocaleString()} px`).join(" · ")}</p>}<input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void upload(event.target.files?.[0])}/>{spot.image ? <div className="image-preview" style={{ backgroundImage: `url(${spot.image})`, backgroundSize: `${spot.crop * 100}%`, backgroundPosition: `${50 + (spot.cropX ?? 0) * 25}% ${50 + (spot.cropY ?? 0) * 25}%` }}><button aria-label="Replace artwork" onClick={() => input.current?.click()}><ImagePlus size={15}/></button></div> : <button className="upload" onClick={() => input.current?.click()} disabled={busy}><ImagePlus size={20}/><span>Upload artwork<small> JPG, PNG or WebP · max 2 MB</small></span></button>}<label className="crop-control">Crop <input aria-label="Artwork crop" type="range" min="1" max="2.5" step=".1" value={spot.crop} onChange={event => edit({ crop: Number(event.target.value) })}/></label><label className="crop-control">Position X <input aria-label="Artwork horizontal position" type="range" min="-1" max="1" step=".1" value={spot.cropX ?? 0} onChange={event => edit({ cropX: Number(event.target.value) })}/></label><label className="crop-control">Position Y <input aria-label="Artwork vertical position" type="range" min="-1" max="1" step=".1" value={spot.cropY ?? 0} onChange={event => edit({ cropY: Number(event.target.value) })}/></label><input className="field" placeholder="Post title" value={spot.name} onChange={event => edit({ name: event.target.value })}/><input className="field" placeholder="Optional description" value={spot.message} onChange={event => edit({ message: event.target.value })}/><input className="field" placeholder="Optional https:// link" value={spot.url} onChange={event => edit({ url: event.target.value })}/>{error && <p className="error" role="alert">{error}</p>}<button className="claim" disabled={!validPlot(spot.width, spot.height) || !spot.image || !quote || busy} onClick={() => void reserve()}>CONTINUE TO SANDBOX CHECKOUT <MoveRight size={16}/></button><p className="panel-note">Virtual digital space only. Not physical Mars land.</p></> : <div className="empty-select">Choose a point on Mars to begin.</div>}</aside></div></section>
    <section className="how" id="how"><p className="eyebrow"><span/> ONE PLOT. ONE PERMANENT POST.</p><h2>MAKE IT <em>YOURS.</em></h2><div className="steps"><article><b>01</b><h3>Find an address</h3><p>Explore Mars and choose a unique virtual plot.</p></article><article><b>02</b><h3>Prepare your work</h3><p>Upload your finished image and set its title, crop and optional link.</p></article><article><b>03</b><h3>Share your place</h3><p>Publish once, get a public URL and download your Mars card.</p></article></div></section>
    {stage && spot && <div className="modal" role="dialog" aria-modal="true"><div className="modal-card"><button className="close" aria-label="Close dialog" onClick={() => !busy && setStage(null)}><X/></button>{stage === "checkout" && <><p className="eyebrow"><span/> SANDBOX CHECKOUT</p><h2>Ready to make<br/>your <em>mark?</em></h2><p>{spot.width} × {spot.height} pixels · ${displayPrice.toLocaleString()} USD. This is a simulated order: no payment details or charge are collected.</p><button className="primary" disabled={busy} onClick={() => void checkout()}>CONFIRM SANDBOX ORDER <Check/></button></>}{stage === "publish" && <><p className="eyebrow"><span/> FINAL PUBLICATION</p><h2>Make it <em>permanent.</em></h2><input className="field" placeholder="Public creator name or alias" value={creator} onChange={event => setCreator(event.target.value)}/><p>Your creation will be permanently published on this plot. You will not be able to change it afterward.</p>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy || !creator.trim() || !spot.name.trim()} onClick={() => void publish()}>PUBLISH PERMANENTLY <Check/></button></>}{stage === "success" && spot.image && <><p className="eyebrow"><span/> PUBLICATION CONFIRMED</p><h2>YOU'RE ON <em>MARS.</em></h2><p>Your permanent public address is ready. Download a card made from the exact image you published, then share your place.</p><SocialCardActions image={spot.image} title={spot.name} plotId={spot.id} coordinates={`${spot.lat.toFixed(2)}°, ${spot.lon.toFixed(2)}°`}/><div className="modal-actions"><button className="secondary" onClick={() => void share()}><Share2/> SHARE MY PLACE</button><a className="primary" href={`/plot/${spot.id}`}>VIEW ON MARS</a></div></>}</div></div>}
  </main>;
}
