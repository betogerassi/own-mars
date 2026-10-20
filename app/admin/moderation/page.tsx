"use client";

import { useState } from "react";

type Report = { id: string; plotId: string; plotTitle: string; plotState: string; reason: string; details: string; createdAt: string };
type Action = { id: string; plotId: string; action: string; reason: string; administrator: string; createdAt: string };

export default function ModerationConsole() {
  const [token, setToken] = useState("");
  const [administrator, setAdministrator] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("Enter the server-configured sandbox admin token to load the queue.");
  const headers = () => ({ authorization: `Bearer ${token}`, "content-type": "application/json" });
  const load = async () => {
    const response = await fetch("/api/admin/reports", { headers: headers() });
    const body = await response.json() as { reports?: Report[]; actions?: Action[]; error?: string };
    if (!response.ok) return setMessage(body.error ?? "Could not load moderation data.");
    setReports(body.reports ?? []); setActions(body.actions ?? []); setMessage("Queue loaded. Token is kept only in this page's memory.");
  };
  const moderate = async (plotId: string, action: "HIDDEN_BY_MODERATION" | "REMOVED_BY_MODERATION") => {
    if (!reason.trim() || !administrator.trim()) return setMessage("Administrator name and reason are required.");
    const response = await fetch(`/api/admin/plots/${encodeURIComponent(plotId)}/moderate`, { method: "POST", headers: headers(), body: JSON.stringify({ action, reason, administrator }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Could not moderate this plot.");
    setReason(""); setMessage("Action recorded. Refreshing queue."); void load();
  };
  return <main className="admin-page"><nav><a className="brand" href="/"><i/> OWN MARS</a></nav><article><p className="eyebrow"><span/> SANDBOX ADMINISTRATION</p><h1>MODERATION <em>QUEUE.</em></h1><p>This console is protected by a server-side token. It is not a replacement for production role-based authentication.</p><div className="admin-auth"><input type="password" autoComplete="off" placeholder="Sandbox admin token" value={token} onChange={event => setToken(event.target.value)} /><input placeholder="Administrator name" value={administrator} onChange={event => setAdministrator(event.target.value)} /><button className="primary" onClick={() => void load()}>LOAD QUEUE</button></div><p role="status">{message}</p><label className="admin-reason">Moderation reason<textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /></label><section className="admin-list"><h2>Open reports</h2>{reports.length === 0 ? <p>No open reports loaded.</p> : reports.map(report => <article key={report.id}><p className="notice">{report.createdAt} · {report.plotState}</p><h3>{report.plotTitle || report.plotId}</h3><p><b>{report.reason}</b>{report.details ? ` — ${report.details}` : ""}</p><div><button className="secondary" onClick={() => void moderate(report.plotId, "HIDDEN_BY_MODERATION")}>HIDE</button><button className="secondary" onClick={() => void moderate(report.plotId, "REMOVED_BY_MODERATION")}>REMOVE</button></div></article>)}</section><section className="admin-list"><h2>Recent actions</h2>{actions.length === 0 ? <p>No actions loaded.</p> : actions.map(action => <article key={action.id}><p className="notice">{action.createdAt}</p><p><b>{action.action}</b> · {action.plotId} · {action.administrator}</p><p>{action.reason}</p></article>)}</section></article></main>;
}
