import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { CANVAS_HEIGHT, CANVAS_WIDTH, priceForRectangle, rectangleFor, safeWebsite, sanitizeText, type PurchaseDraft } from "../marketplace";

const dataDirectory = join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(join(dataDirectory, "own-mars.sqlite"));

database.exec(`
  CREATE TABLE IF NOT EXISTS plots (
    id TEXT PRIMARY KEY,
    x INTEGER NOT NULL, y INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
    lat REAL NOT NULL, lon REAL NOT NULL,
    name TEXT NOT NULL, message TEXT NOT NULL, website TEXT NOT NULL, image TEXT,
    price_usd INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('reserved', 'paid')),
    reservation_expires_at TEXT,
    created_at TEXT NOT NULL, paid_at TEXT
  );
  CREATE INDEX IF NOT EXISTS plots_rectangle ON plots(status, x, y, width, height);
`);
try { database.exec("ALTER TABLE plots ADD COLUMN price_usd INTEGER NOT NULL DEFAULT 0"); } catch { /* existing database already migrated */ }

export type StoredPlot = PurchaseDraft & {
  id: string;
  status: "reserved" | "paid";
  reservationExpiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  price: number;
};

export class PlotUnavailableError extends Error {}
export class ReservationExpiredError extends Error {}

function rowToPlot(row: Record<string, unknown>): StoredPlot {
  return {
    id: String(row.id), x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height),
    lat: Number(row.lat), lon: Number(row.lon), name: String(row.name), message: String(row.message),
    url: String(row.website), image: row.image ? String(row.image) : undefined,
    status: row.status as StoredPlot["status"], reservationExpiresAt: row.reservation_expires_at ? String(row.reservation_expires_at) : null,
    createdAt: String(row.created_at), paidAt: row.paid_at ? String(row.paid_at) : null,
    price: Number(row.price_usd),
  };
}

function normalizeDraft(input: Record<string, unknown>): PurchaseDraft {
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  const width = Number(input.width);
  const height = Number(input.height);
  const rectangle = rectangleFor(lat, lon, width, height);
  const image = sanitizeText(input.image, 512);
  if (image && !image.startsWith("/uploads/")) throw new Error("Artwork must be a validated local upload.");
  return { ...rectangle, lat, lon, name: sanitizeText(input.name, 80), message: sanitizeText(input.message, 280), url: safeWebsite(input.url), image: image || undefined };
}

export function reservePlot(input: Record<string, unknown>, now = new Date()) {
  const draft = normalizeDraft(input);
  const createdAt = now.toISOString();
  const reservationExpiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  const id = `rsv_${randomUUID()}`;
  const price = priceForRectangle(draft).total;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM plots WHERE status = 'reserved' AND reservation_expires_at <= ?").run(createdAt);
    const conflict = database.prepare(`SELECT id FROM plots WHERE status IN ('reserved', 'paid')
      AND NOT (x + width <= ? OR x >= ? OR y + height <= ? OR y >= ?) LIMIT 1`).get(draft.x, draft.x + draft.width, draft.y, draft.y + draft.height);
    if (conflict) throw new PlotUnavailableError("That plot is no longer available.");
    database.prepare(`INSERT INTO plots (id,x,y,width,height,lat,lon,name,message,website,image,price_usd,status,reservation_expires_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, draft.x, draft.y, draft.width, draft.height, draft.lat, draft.lon, draft.name, draft.message, draft.url, draft.image ?? null, price, "reserved", reservationExpiresAt, createdAt);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getPlot(id)!;
}

export function confirmSandboxCheckout(id: string, now = new Date()) {
  const timestamp = now.toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT * FROM plots WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row || row.status !== "reserved" || String(row.reservation_expires_at) <= timestamp) throw new ReservationExpiredError("Your reservation has expired. Please select the plot again.");
    database.prepare("UPDATE plots SET status = 'paid', paid_at = ?, reservation_expires_at = NULL WHERE id = ?").run(timestamp, id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getPlot(id)!;
}

export function getPlot(id: string) {
  const row = database.prepare("SELECT * FROM plots WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToPlot(row) : null;
}

export function publishedPlots() {
  return (database.prepare("SELECT * FROM plots WHERE status = 'paid' ORDER BY paid_at DESC").all() as Record<string, unknown>[]).map(rowToPlot);
}

export const marketplaceLimits = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
