"use client";

import { useState } from "react";

export default function ShareButton({ plotId, title }: { plotId: string; title: string }) {
  const [status, setStatus] = useState("");
  const share = async () => {
    const url = window.location.origin + "/plot/" + encodeURIComponent(plotId);
    try {
      if (navigator.share) { await navigator.share({ title: title + " — OWN MARS", text: "See my permanent place on Mars.", url }); setStatus("Shared."); }
      else { await navigator.clipboard.writeText(url); setStatus("Link copied."); }
    } catch { setStatus("Sharing was cancelled or unavailable."); }
  };
  return <span className="share-control"><button className="secondary" onClick={() => void share()}>SHARE THIS PLACE</button>{status && <small role="status">{status}</small>}</span>;
}
