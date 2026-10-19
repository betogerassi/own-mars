"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Crosshair, ImagePlus, Minus, MoveRight, Plus, RotateCcw, Share2, X } from "lucide-react";
import MarsCanvas, { type MarsControls } from "./components/MarsCanvas";
import { decodeSpot, encodeSpot, priceOf, type Spot, validPlot } from "./lib/demo";

const presets = [[10, 10], [20, 20], [50, 50], [100, 100]];
const fresh = (lat = 0, lon = 0): Spot => ({ id: `demo-${Date.now()}`, lat, lon, width: 10, height: 10, name: "", message: "", url: "", crop: 1, x: 0, y: 0 });

export default function Home() {
  const explorerControls = useRef<MarsControls | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [saved, setSaved] = useState<Spot[]>([]);
  const [modal, setModal] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const shared = decodeSpot(new URLSearchParams(location.hash.slice(1)).get("spot") || "");
    if (shared) { setSpot(shared); setSaved([shared]); }
  }, []);

  const select = (lat: number, lon: number) => setSpot((current) => current ? { ...current, lat, lon } : fresh(lat, lon));
  const edit = (change: Partial<Spot>) => setSpot((current) => current && ({ ...current, ...change }));
  const price = spot ? priceOf(spot) : 0;
  const upload = (file?: File) => {
    if (!file) return;
    if (!/image\/jpeg|image\/png|image\/webp/.test(file.type) || file.size > 2_000_000) return alert("Use JPG, PNG or WebP under 2 MB.");
    const reader = new FileReader();
    reader.onload = () => edit({ image: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const publish = () => {
    if (!spot) return;
    const published = { ...spot, id: `MARS-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
    setSpot(published);
    setSaved((current) => [...current, published]);
    localStorage.setItem("own-mars-demo", JSON.stringify(published));
    history.replaceState(null, "", `#spot=${encodeSpot(published)}`);
    setDone(true);
  };
  const share = () => { if (spot) navigator.clipboard?.writeText(location.href); };
  const openExplorer = () => document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth" });

  return <main>
    <nav><a className="brand" href="#top"><i/> OWN MARS</a><div className="navlinks"><a href="#explore">Explore</a><a href="#how">How it works</a></div><button className="navcta" onClick={openExplorer}>Claim your spot <MoveRight size={15}/></button></nav>
    <section className="hero" id="top"><div className="stars"/><div className="hero-copy"><p className="eyebrow"><span/> THE DIGITAL RED PLANET</p><h1>EARTH IS CROWDED.<br/><em>MARS IS OPEN.</em></h1><p className="lede">Select a location, create a virtual display, and share a complete demo.</p><button className="primary" onClick={openExplorer}>CLAIM YOUR SPOT <MoveRight size={17}/></button><p className="notice">DEMO MODE · NO PAYMENTS · NOT REAL ESTATE</p></div><MarsCanvas className="hero-globe" selected={spot} spots={saved} onSelect={select} interactive={false} focusOnSelection={false}/></section>
    <section className="explore" id="explore"><div className="section-head"><p className="eyebrow"><span/> SELECT YOUR DISPLAY SPACE</p><h2>FIND YOUR <em>PLACE.</em></h2><p>Drag to rotate. Scroll or pinch to zoom. Click the surface to select a geographic location.</p></div><div className="workspace"><div className="mars-stage"><MarsCanvas selected={spot} spots={saved} onSelect={select} controlRef={explorerControls}/><div className="map-ui"><span><Crosshair size={14}/>{spot ? `${spot.lat.toFixed(2)}°, ${spot.lon.toFixed(2)}°` : "CLICK MARS TO SELECT"}</span><span>40,000 × 25,000 VIRTUAL CANVAS</span></div><div className="globe-controls"><button aria-label="Zoom in" onClick={() => explorerControls.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out" onClick={() => explorerControls.current?.zoomOut()}><Minus/></button><button aria-label="Reset globe view" onClick={() => explorerControls.current?.reset()}><RotateCcw/></button></div></div><aside className="claim-panel"><div className="panel-top"><p>YOUR MARS DISPLAY</p><button aria-label="Clear selected location" onClick={() => setSpot(null)}><X size={16}/></button></div>{spot ? <><div className="location"><div className="pin active"><Crosshair size={20}/></div><div><strong>Selected location</strong><small>{spot.lat.toFixed(2)}°, {spot.lon.toFixed(2)}°</small></div></div><label>DISPLAY SIZE</label><div className="sizes">{presets.map(([width, height]) => <button key={width} className={spot.width === width && spot.height === height ? "chosen" : ""} onClick={() => edit({ width, height })}><b>{width} × {height}</b><small>${width * height}</small></button>)}</div><div className="custom"><input aria-label="Plot width" value={spot.width} type="number" min="10" max="100" onChange={(event) => edit({ width: +event.target.value })}/><span>×</span><input aria-label="Plot height" value={spot.height} type="number" min="10" max="100" onChange={(event) => edit({ height: +event.target.value })}/></div><div className="price"><span>{spot.width} × {spot.height} virtual pixels</span><strong>${price.toLocaleString()} <small>USD</small></strong></div><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])}/>{spot.image ? <div className="image-preview" style={{ backgroundImage: `url(${spot.image})`, backgroundSize: `${spot.crop * 100}%` }}/> : <button className="upload" onClick={() => input.current?.click()}><ImagePlus size={20}/>Upload artwork</button>}<label>Crop <input type="range" min=".8" max="2.5" step=".1" value={spot.crop} onChange={(event) => edit({ crop: +event.target.value })}/></label><input className="field" placeholder="Display name" value={spot.name} onChange={(event) => edit({ name: event.target.value })}/><input className="field" placeholder="Message" value={spot.message} onChange={(event) => edit({ message: event.target.value })}/><input className="field" placeholder="https://website.example" value={spot.url} onChange={(event) => edit({ url: event.target.value })}/><button className="claim" disabled={!validPlot(spot.width, spot.height)} onClick={() => setModal(true)}>CONTINUE TO DEMO CHECKOUT <MoveRight size={16}/></button></> : <div className="empty-select">Choose a point on Mars to begin.</div>}</aside></div></section>
    {modal && spot && <div className="modal"><div className="modal-card"><button className="close" aria-label="Close checkout" onClick={() => setModal(false)}><X/></button>{done ? <><h2>Welcome to <em>Mars.</em></h2><p>Your demo plot is published at {spot.lat.toFixed(2)}°, {spot.lon.toFixed(2)}°.</p><button className="primary" onClick={share}><Share2/> COPY SHARE LINK</button></> : <><p className="eyebrow"><span/> DEMO CHECKOUT</p><h2>Ready to make<br/>your <em>mark?</em></h2><p>{spot.width} × {spot.height} pixels · ${price.toLocaleString()} USD. No payment is collected.</p><button className="primary" onClick={publish}>CONFIRM DEMO PUBLISH <Check/></button></>}</div></div>}
  </main>;
}

