"use client";

import { useState } from "react";

const reasons = ["Copyright or trademark", "Sexual or exploitative content", "Hate, harassment, or threat", "Illegal content", "Other policy concern"];

export default function ReportButton({ plotId }: { plotId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async () => {
    setSending(true); setMessage("");
    try {
      const response = await fetch(`/api/plots/${encodeURIComponent(plotId)}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason, details }) });
      const result = await response.json() as { error?: string; report?: { submitted?: boolean } };
      if (response.status === 409 || result.report?.submitted === false) setMessage("You have already reported this post.");
      else if (!response.ok) setMessage(result.error ?? "Could not submit the report.");
      else { setMessage("Report received. Thank you."); setDetails(""); }
    } catch { setMessage("Could not submit the report."); }
    finally { setSending(false); }
  };
  return <section className="report-box"><button className="text-button" onClick={() => setOpen(value => !value)}>{open ? "CLOSE REPORT" : "REPORT THIS POST"}</button>{open && <div className="report-form"><label>Reason<select value={reason} onChange={event => setReason(event.target.value)}>{reasons.map(item => <option key={item}>{item}</option>)}</select></label><label>Optional details<textarea value={details} maxLength={1000} onChange={event => setDetails(event.target.value)} /></label><button className="secondary" disabled={sending} onClick={() => void submit()}>{sending ? "SENDING…" : "SUBMIT REPORT"}</button>{message && <p role="status">{message}</p>}</div>}</section>;
}
