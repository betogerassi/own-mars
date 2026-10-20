import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { CANVAS_HEIGHT, CANVAS_WIDTH, priceForRectangle, rectangleFor, rectanglesOverlap, safeWebsite, sanitizeText, type PlotRectangle, type PurchaseDraft } from "../marketplace";
import { boundaryForFounder, defaultNeighborhoodConfiguration, lotForIndex, normalizeNeighborhoodName, priceForNeighborhoodOccupancy, type NeighborhoodBoundary } from "../neighborhoods";

// Tests and disposable local previews can isolate state without touching the default sandbox data.
const dataDirectory = process.env.OWN_MARS_DATA_DIRECTORY ? resolve(process.env.OWN_MARS_DATA_DIRECTORY) : join(process.cwd(), "data");
let openedDatabase: DatabaseSync | undefined;

function db() {
  if (openedDatabase) return openedDatabase;
  mkdirSync(dataDirectory, { recursive: true });
  const opened = new DatabaseSync(join(dataDirectory, "own-mars.sqlite"));
  opened.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  initialise(opened);
  openedDatabase = opened;
  return opened;
}

// Keeps call sites concise while delaying I/O until an API handler actually runs.
const database = new Proxy({} as DatabaseSync, {
  get(_target, property) {
    const value = Reflect.get(db(), property);
    return typeof value === "function" ? value.bind(db()) : value;
  },
});

function initialise(database: DatabaseSync) {
database.exec(`
  CREATE TABLE IF NOT EXISTS plots (
    id TEXT PRIMARY KEY,
    x INTEGER NOT NULL, y INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
    lat REAL NOT NULL, lon REAL NOT NULL,
    name TEXT NOT NULL, message TEXT NOT NULL, website TEXT NOT NULL, image TEXT,
    crop REAL NOT NULL DEFAULT 1, crop_x REAL NOT NULL DEFAULT 0, crop_y REAL NOT NULL DEFAULT 0,
    price_usd INTEGER NOT NULL DEFAULT 0,
    publication_state TEXT NOT NULL DEFAULT 'DRAFT',
    title TEXT NOT NULL DEFAULT '', creator_name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('reserved', 'paid')),
    reservation_expires_at TEXT,
    stripe_checkout_session_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    owner_token TEXT,
    created_at TEXT NOT NULL, paid_at TEXT
  );
  CREATE INDEX IF NOT EXISTS plots_rectangle ON plots(status, x, y, width, height);
  CREATE TABLE IF NOT EXISTS plot_likes (
    plot_id TEXT NOT NULL REFERENCES plots(id),
    visitor_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(plot_id, visitor_id)
  );
  CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY, plot_id TEXT NOT NULL REFERENCES plots(id), reason TEXT NOT NULL,
    details TEXT NOT NULL, reporter_id TEXT, status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS moderation_actions (
    id TEXT PRIMARY KEY, plot_id TEXT NOT NULL REFERENCES plots(id), action TEXT NOT NULL,
    reason TEXT NOT NULL, administrator TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS neighborhoods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, founder_name TEXT NOT NULL DEFAULT '',
    origin_x INTEGER NOT NULL, origin_y INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
    columns_count INTEGER NOT NULL, rows_count INTEGER NOT NULL, capacity INTEGER NOT NULL,
    lot_width INTEGER NOT NULL, lot_height INTEGER NOT NULL, founder_price_usd INTEGER NOT NULL,
    founder_plot_id TEXT NOT NULL UNIQUE REFERENCES plots(id),
    status TEXT NOT NULL CHECK(status IN ('reserved', 'confirmed')),
    founder_status TEXT NOT NULL CHECK(founder_status IN ('PENDING_PAYMENT', 'CONFIRMED')),
    reservation_expires_at TEXT, created_at TEXT NOT NULL, confirmed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS neighborhood_lots (
    neighborhood_id TEXT NOT NULL REFERENCES neighborhoods(id),
    lot_index INTEGER NOT NULL, plot_id TEXT NOT NULL UNIQUE REFERENCES plots(id),
    status TEXT NOT NULL CHECK(status IN ('confirmed')),
    created_at TEXT NOT NULL,
    PRIMARY KEY(neighborhood_id, lot_index)
  );
  CREATE TABLE IF NOT EXISTS neighborhood_lot_reservations (
    neighborhood_id TEXT NOT NULL REFERENCES neighborhoods(id),
    lot_index INTEGER NOT NULL, plot_id TEXT NOT NULL UNIQUE REFERENCES plots(id),
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(neighborhood_id, lot_index)
  );
`);
try { database.exec("ALTER TABLE plots ADD COLUMN price_usd INTEGER NOT NULL DEFAULT 0"); } catch { /* existing database already migrated */ }
for (const migration of [
  "ALTER TABLE plots ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'DRAFT'",
  "ALTER TABLE plots ADD COLUMN title TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE plots ADD COLUMN creator_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE plots ADD COLUMN description TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE plots ADD COLUMN published_at TEXT",
  "ALTER TABLE plots ADD COLUMN stripe_checkout_session_id TEXT",
  "ALTER TABLE plots ADD COLUMN stripe_payment_intent_id TEXT",
  "ALTER TABLE plots ADD COLUMN owner_token TEXT",
  "ALTER TABLE plots ADD COLUMN crop REAL NOT NULL DEFAULT 1",
  "ALTER TABLE plots ADD COLUMN crop_x REAL NOT NULL DEFAULT 0",
  "ALTER TABLE plots ADD COLUMN crop_y REAL NOT NULL DEFAULT 0",
  "ALTER TABLE content_reports ADD COLUMN reporter_id TEXT",
  "ALTER TABLE neighborhoods ADD COLUMN founder_name TEXT NOT NULL DEFAULT ''",
]) { try { database.exec(migration); } catch { /* existing database already migrated */ } }
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS plots_stripe_checkout_session_id ON plots(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL");
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS reports_per_visitor ON content_reports(plot_id, reporter_id) WHERE reporter_id IS NOT NULL");
}

export type StoredPlot = PurchaseDraft & {
  id: string;
  status: "reserved" | "paid";
  reservationExpiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  price: number;
  publicationState: "DRAFT" | "PUBLISHED" | "HIDDEN_BY_MODERATION" | "REMOVED_BY_MODERATION";
  likes: number;
  title: string;
  creatorName: string;
  description: string;
};

export class PlotUnavailableError extends Error {}
export class ReservationExpiredError extends Error {}
export class PlotOwnershipError extends Error {}
export class NeighborhoodUnavailableError extends Error {}

function rowToPlot(row: Record<string, unknown>): StoredPlot {
  return {
    id: String(row.id), x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height),
    lat: Number(row.lat), lon: Number(row.lon), name: String(row.name), message: String(row.message),
    url: String(row.website), image: row.image ? String(row.image) : undefined,
    crop: Number(row.crop ?? 1), cropX: Number(row.crop_x ?? 0), cropY: Number(row.crop_y ?? 0),
    status: row.status as StoredPlot["status"], reservationExpiresAt: row.reservation_expires_at ? String(row.reservation_expires_at) : null,
    createdAt: String(row.created_at), paidAt: row.paid_at ? String(row.paid_at) : null,
    price: Number(row.price_usd),
    publicationState: String(row.publication_state) as StoredPlot["publicationState"],
    likes: Number(row.likes ?? 0),
    title: String(row.title ?? ""), creatorName: String(row.creator_name ?? ""), description: String(row.description ?? ""),
  };
}

function normalizeDraft(input: Record<string, unknown>): PurchaseDraft {
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  const width = Number(input.width);
  const height = Number(input.height);
  const rectangle = rectangleFor(lat, lon, width, height);
  const image = sanitizeText(input.image, 512);
  if (image && !/^\/api\/artwork\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(image)) throw new Error("Artwork must be a validated OWN MARS upload.");
  const crop = Math.min(2.5, Math.max(1, Number(input.crop) || 1));
  const cropX = Math.min(1, Math.max(-1, Number(input.cropX) || 0));
  const cropY = Math.min(1, Math.max(-1, Number(input.cropY) || 0));
  return { ...rectangle, lat, lon, name: sanitizeText(input.name, 80), message: sanitizeText(input.message, 280), url: safeWebsite(input.url), image: image || undefined, crop, cropX, cropY };
}

export function reservePlot(input: Record<string, unknown>, now = new Date()) {
  const draft = normalizeDraft(input);
  const createdAt = now.toISOString();
  const reservationExpiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  const id = `rsv_${randomUUID()}`;
  const ownerToken = randomUUID();
  const price = priceForRectangle(draft).total;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM plots WHERE status = 'reserved' AND reservation_expires_at <= ?").run(createdAt);
    // This remains inside BEGIN IMMEDIATE. SQL's ordinary rectangle predicate cannot
    // see a shape crossing column 0, so compare the small active inventory in JS.
    const conflict = (database.prepare("SELECT id, x, y, width, height FROM plots WHERE status IN ('reserved', 'paid')").all() as Array<Record<string, unknown>>)
      .find((plot) => rectanglesOverlap(draft, {
        x: Number(plot.x), y: Number(plot.y), width: Number(plot.width), height: Number(plot.height),
      }));
    if (conflict) throw new PlotUnavailableError("That plot is no longer available.");
    database.prepare(`INSERT INTO plots (id,x,y,width,height,lat,lon,name,message,website,image,crop,crop_x,crop_y,price_usd,status,reservation_expires_at,owner_token,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, draft.x, draft.y, draft.width, draft.height, draft.lat, draft.lon, draft.name, draft.message, draft.url, draft.image ?? null, draft.crop, draft.cropX, draft.cropY, price, "reserved", reservationExpiresAt, ownerToken, createdAt);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { plot: getPlot(id)!, ownerToken };
}

export type StoredNeighborhood = {
  id: string;
  name: string;
  founderName: string;
  founderPlotId: string;
  status: "reserved" | "confirmed";
  founderStatus: "PENDING_PAYMENT" | "CONFIRMED";
  reservationExpiresAt: string | null;
  confirmedAt: string | null;
  boundary: NeighborhoodBoundary;
  capacity: number;
  occupancy: number;
  price: ReturnType<typeof priceForNeighborhoodOccupancy>;
};

function rowToNeighborhood(row: Record<string, unknown>): StoredNeighborhood {
  const boundary = { originX: Number(row.origin_x), originY: Number(row.origin_y), width: Number(row.width), height: Number(row.height), columns: Number(row.columns_count), rows: Number(row.rows_count) };
  const capacity = Number(row.capacity);
  const occupancy = Number(row.occupancy ?? 0);
  return {
    id: String(row.id), name: String(row.name), founderName: String(row.founder_name ?? ""), founderPlotId: String(row.founder_plot_id),
    status: String(row.status) as StoredNeighborhood["status"], founderStatus: String(row.founder_status) as StoredNeighborhood["founderStatus"],
    reservationExpiresAt: row.reservation_expires_at ? String(row.reservation_expires_at) : null,
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
    boundary, capacity, occupancy,
    price: priceForNeighborhoodOccupancy(occupancy, { ...defaultNeighborhoodConfiguration, capacity, columns: boundary.columns, lotWidth: Number(row.lot_width), lotHeight: Number(row.lot_height), founderPrice: Number(row.founder_price_usd) }),
  };
}

function removeExpiredNeighborhoodReservations(timestamp: string) {
  const expired = database.prepare("SELECT id, founder_plot_id FROM neighborhoods WHERE status = 'reserved' AND reservation_expires_at <= ?").all(timestamp) as Array<Record<string, unknown>>;
  for (const neighborhood of expired) {
    database.prepare("DELETE FROM neighborhood_lots WHERE neighborhood_id = ?").run(String(neighborhood.id));
    database.prepare("DELETE FROM neighborhoods WHERE id = ?").run(String(neighborhood.id));
    database.prepare("DELETE FROM plots WHERE id = ? AND status = 'reserved'").run(String(neighborhood.founder_plot_id));
  }
}

function removeExpiredLotReservations(timestamp: string) {
  const expired = database.prepare("SELECT neighborhood_id, lot_index, plot_id FROM neighborhood_lot_reservations WHERE expires_at <= ?").all(timestamp) as Array<Record<string, unknown>>;
  for (const reservation of expired) {
    database.prepare("DELETE FROM neighborhood_lot_reservations WHERE neighborhood_id = ? AND lot_index = ?").run(String(reservation.neighborhood_id), Number(reservation.lot_index));
    database.prepare("DELETE FROM plots WHERE id = ? AND status = 'reserved'").run(String(reservation.plot_id));
  }
}

/** Reserves a unique neighborhood/name/founder plot, but grants no founder privilege until checkout confirms. */
export function reserveNeighborhoodFounder(input: Record<string, unknown>, now = new Date()) {
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  const { displayName, key } = normalizeNeighborhoodName(input.neighborhoodName);
  const founderName = sanitizeText(input.founderName, 80);
  if (!founderName) throw new Error("A public founder name is required.");
  const founder = rectangleFor(lat, lon, defaultNeighborhoodConfiguration.lotWidth, defaultNeighborhoodConfiguration.lotHeight);
  const boundary = boundaryForFounder(founder);
  const id = `nh_${randomUUID()}`;
  const plotId = `rsv_${randomUUID()}`;
  const ownerToken = randomUUID();
  const createdAt = now.toISOString();
  const reservationExpiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM plots WHERE status = 'reserved' AND reservation_expires_at <= ?").run(createdAt);
    removeExpiredNeighborhoodReservations(createdAt);
    const plotConflict = (database.prepare("SELECT x, y, width, height FROM plots WHERE status IN ('reserved', 'paid')").all() as Array<Record<string, unknown>>)
      .some((plot) => rectanglesOverlap(founder, { x: Number(plot.x), y: Number(plot.y), width: Number(plot.width), height: Number(plot.height) }));
    if (plotConflict) throw new NeighborhoodUnavailableError("The founder plot is no longer available.");
    const neighborhoodConflict = (database.prepare("SELECT origin_x, origin_y, width, height FROM neighborhoods WHERE status IN ('reserved', 'confirmed')").all() as Array<Record<string, unknown>>)
      .some((neighborhood) => rectanglesOverlap({ x: boundary.originX, y: boundary.originY, width: boundary.width, height: boundary.height }, { x: Number(neighborhood.origin_x), y: Number(neighborhood.origin_y), width: Number(neighborhood.width), height: Number(neighborhood.height) }));
    if (neighborhoodConflict) throw new NeighborhoodUnavailableError("A neighborhood already exists at this location.");
    database.prepare(`INSERT INTO plots (id,x,y,width,height,lat,lon,name,message,website,image,crop,crop_x,crop_y,price_usd,status,reservation_expires_at,owner_token,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(plotId, founder.x, founder.y, founder.width, founder.height, lat, lon, "Founder plot", "", "", null, 1, 0, 0, defaultNeighborhoodConfiguration.founderPrice, "reserved", reservationExpiresAt, ownerToken, createdAt);
    database.prepare(`INSERT INTO neighborhoods (id,name,name_key,founder_name,origin_x,origin_y,width,height,columns_count,rows_count,capacity,lot_width,lot_height,founder_price_usd,founder_plot_id,status,founder_status,reservation_expires_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, displayName, key, founderName, boundary.originX, boundary.originY, boundary.width, boundary.height, boundary.columns, boundary.rows, defaultNeighborhoodConfiguration.capacity, defaultNeighborhoodConfiguration.lotWidth, defaultNeighborhoodConfiguration.lotHeight, defaultNeighborhoodConfiguration.founderPrice, plotId, "reserved", "PENDING_PAYMENT", reservationExpiresAt, createdAt);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) throw new NeighborhoodUnavailableError("That neighborhood name is already reserved."); throw error; }
  return { neighborhood: getNeighborhood(id)!, founderPlot: getPlot(plotId)!, ownerToken };
}

function confirmFounderNeighborhoodForPlot(plotId: string, timestamp: string) {
  const neighborhood = database.prepare("SELECT id, status, reservation_expires_at FROM neighborhoods WHERE founder_plot_id = ?").get(plotId) as Record<string, unknown> | undefined;
  if (!neighborhood) return;
  if (neighborhood.status !== "reserved" || String(neighborhood.reservation_expires_at) <= timestamp) throw new ReservationExpiredError("The neighborhood reservation expired before payment completed.");
  const neighborhoodId = String(neighborhood.id);
  database.prepare("UPDATE neighborhoods SET status = 'confirmed', founder_status = 'CONFIRMED', reservation_expires_at = NULL, confirmed_at = ? WHERE id = ?").run(timestamp, neighborhoodId);
  database.prepare("INSERT INTO neighborhood_lots (neighborhood_id, lot_index, plot_id, status, created_at) VALUES (?, 0, ?, 'confirmed', ?)").run(neighborhoodId, plotId, timestamp);
}

/** A nearby resident joins only after the underlying checkout reaches paid status. */
function confirmNeighborhoodLotForPlot(plotId: string, timestamp: string) {
  const reservation = database.prepare("SELECT neighborhood_id, lot_index, expires_at FROM neighborhood_lot_reservations WHERE plot_id = ?").get(plotId) as Record<string, unknown> | undefined;
  if (!reservation) return;
  if (String(reservation.expires_at) <= timestamp) throw new ReservationExpiredError("The neighborhood lot reservation expired before payment completed.");
  const neighborhoodId = String(reservation.neighborhood_id);
  const lotIndex = Number(reservation.lot_index);
  database.prepare("DELETE FROM neighborhood_lot_reservations WHERE plot_id = ?").run(plotId);
  database.prepare("INSERT INTO neighborhood_lots (neighborhood_id, lot_index, plot_id, status, created_at) VALUES (?, ?, ?, 'confirmed', ?)").run(neighborhoodId, lotIndex, plotId, timestamp);
}

export function reserveNeighborhoodLot(neighborhoodId: string, lotIndex: number, now = new Date()) {
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  const plotId = `rsv_${randomUUID()}`;
  const ownerToken = randomUUID();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM plots WHERE status = 'reserved' AND reservation_expires_at <= ?").run(createdAt);
    removeExpiredNeighborhoodReservations(createdAt);
    removeExpiredLotReservations(createdAt);
    const row = database.prepare(`SELECT neighborhoods.*, (SELECT COUNT(*) FROM neighborhood_lots WHERE neighborhood_id = neighborhoods.id AND status = 'confirmed') AS occupancy
      FROM neighborhoods WHERE id = ? AND status = 'confirmed'`).get(neighborhoodId) as Record<string, unknown> | undefined;
    if (!row) throw new NeighborhoodUnavailableError("Confirmed neighborhood not found.");
    const neighborhood = rowToNeighborhood(row);
    if (!Number.isInteger(lotIndex) || lotIndex < 1 || lotIndex >= neighborhood.capacity || neighborhood.price.soldOut) throw new NeighborhoodUnavailableError("That neighborhood lot is unavailable.");
    const rectangle = lotForIndex(neighborhood.boundary, lotIndex, { ...defaultNeighborhoodConfiguration, capacity: neighborhood.capacity, columns: neighborhood.boundary.columns });
    const taken = database.prepare("SELECT 1 FROM neighborhood_lots WHERE neighborhood_id = ? AND lot_index = ? UNION ALL SELECT 1 FROM neighborhood_lot_reservations WHERE neighborhood_id = ? AND lot_index = ? LIMIT 1").get(neighborhoodId, lotIndex, neighborhoodId, lotIndex);
    if (taken) throw new NeighborhoodUnavailableError("That neighborhood lot is no longer available.");
    const plotConflict = (database.prepare("SELECT x, y, width, height FROM plots WHERE status IN ('reserved', 'paid')").all() as Array<Record<string, unknown>>)
      .some((plot) => rectanglesOverlap(rectangle, { x: Number(plot.x), y: Number(plot.y), width: Number(plot.width), height: Number(plot.height) }));
    if (plotConflict) throw new NeighborhoodUnavailableError("That neighborhood lot overlaps an existing Mars plot.");
    const lat = 90 - ((rectangle.y + rectangle.height / 2) / CANVAS_HEIGHT) * 180;
    const lon = ((rectangle.x + rectangle.width / 2) / CANVAS_WIDTH) * 360 - 180;
    database.prepare(`INSERT INTO plots (id,x,y,width,height,lat,lon,name,message,website,image,crop,crop_x,crop_y,price_usd,status,reservation_expires_at,owner_token,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(plotId, rectangle.x, rectangle.y, rectangle.width, rectangle.height, lat, lon, "Neighborhood plot", "", "", null, 1, 0, 0, neighborhood.price.price!, "reserved", expiresAt, ownerToken, createdAt);
    database.prepare("INSERT INTO neighborhood_lot_reservations (neighborhood_id, lot_index, plot_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(neighborhoodId, lotIndex, plotId, expiresAt, createdAt);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return { neighborhood: getNeighborhood(neighborhoodId)!, plot: getPlot(plotId)!, ownerToken };
}

export function getNeighborhood(id: string) {
  const row = database.prepare(`SELECT neighborhoods.*, (SELECT COUNT(*) FROM neighborhood_lots WHERE neighborhood_id = neighborhoods.id AND status = 'confirmed') AS occupancy
    FROM neighborhoods WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? rowToNeighborhood(row) : null;
}

/** Public discovery only exposes confirmed neighborhoods and real confirmed occupancy. */
export function confirmedNeighborhoods() {
  return (database.prepare(`SELECT neighborhoods.*, (SELECT COUNT(*) FROM neighborhood_lots WHERE neighborhood_id = neighborhoods.id AND status = 'confirmed') AS occupancy
    FROM neighborhoods WHERE status = 'confirmed' ORDER BY confirmed_at DESC`).all() as Record<string, unknown>[]).map(rowToNeighborhood);
}

export type PublicDiscovery = {
  mostLiked: StoredPlot[];
  trendingNow: StoredPlot[];
  newest: StoredPlot[];
  hottestNeighborhoods: Array<{ id: string; name: string; founderName: string; confirmedResidents: number; recentLikes: number }>;
  rules: { trendingWindowDays: number; trendingOrder: string; hottestNeighborhoodOrder: string };
};

/** Every ranking is derived from stored, public activity; no synthetic engagement is added. */
export function publicDiscovery(now = new Date()): PublicDiscovery {
  const recentSince = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const plotRows = (order: string) => (database.prepare(`SELECT plots.*, (SELECT COUNT(*) FROM plot_likes WHERE plot_id = plots.id) AS likes
    FROM plots WHERE status = 'paid' AND publication_state = 'PUBLISHED' ${order} LIMIT 24`).all() as Record<string, unknown>[]).map(rowToPlot);
  const mostLiked = plotRows("ORDER BY likes DESC, published_at ASC");
  const newest = plotRows("ORDER BY published_at DESC");
  const trendingNow = (database.prepare(`SELECT plots.*, (SELECT COUNT(*) FROM plot_likes WHERE plot_id = plots.id) AS likes,
    (SELECT COUNT(*) FROM plot_likes WHERE plot_id = plots.id AND created_at >= ?) AS recent_likes
    FROM plots WHERE status = 'paid' AND publication_state = 'PUBLISHED'
    ORDER BY recent_likes DESC, likes DESC, published_at DESC LIMIT 24`).all(recentSince) as Record<string, unknown>[])
    .filter(row => Number(row.recent_likes) > 0).map(rowToPlot);
  const hottestNeighborhoods = (database.prepare(`SELECT neighborhoods.id, neighborhoods.name, neighborhoods.founder_name,
    (SELECT COUNT(*) FROM neighborhood_lots WHERE neighborhood_id = neighborhoods.id AND status = 'confirmed') AS confirmed_residents,
    (SELECT COUNT(*) FROM plot_likes likes JOIN neighborhood_lots lots ON lots.plot_id = likes.plot_id
      JOIN plots ON plots.id = lots.plot_id WHERE lots.neighborhood_id = neighborhoods.id
      AND plots.status = 'paid' AND plots.publication_state = 'PUBLISHED' AND likes.created_at >= ?) AS recent_likes
    FROM neighborhoods WHERE status = 'confirmed' ORDER BY recent_likes DESC, confirmed_residents DESC, confirmed_at DESC LIMIT 24`).all(recentSince) as Record<string, unknown>[])
    .filter(row => Number(row.recent_likes) > 0).map(row => ({ id: String(row.id), name: String(row.name), founderName: String(row.founder_name), confirmedResidents: Number(row.confirmed_residents), recentLikes: Number(row.recent_likes) }));
  return { mostLiked, trendingNow, newest, hottestNeighborhoods, rules: { trendingWindowDays: 7, trendingOrder: "Likes in the last 7 days, then all-time likes, then publication date.", hottestNeighborhoodOrder: "Likes in the last 7 days across confirmed published resident plots, then confirmed residents." } };
}

export function requirePlotOwner(id: string, suppliedToken: string | undefined) {
  const row = database.prepare("SELECT owner_token FROM plots WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  const token = row?.owner_token;
  if (typeof token !== "string" || !suppliedToken) throw new PlotOwnershipError("This browser does not own the active plot reservation.");
  const expected = Buffer.from(token);
  const supplied = Buffer.from(suppliedToken);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new PlotOwnershipError("This browser does not own the active plot reservation.");
}

export function confirmSandboxCheckout(id: string, now = new Date()) {
  const timestamp = now.toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT * FROM plots WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row || row.status !== "reserved" || String(row.reservation_expires_at) <= timestamp) throw new ReservationExpiredError("Your reservation has expired. Please select the plot again.");
    database.prepare("UPDATE plots SET status = 'paid', paid_at = ?, reservation_expires_at = NULL WHERE id = ?").run(timestamp, id);
    confirmFounderNeighborhoodForPlot(id, timestamp);
    confirmNeighborhoodLotForPlot(id, timestamp);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getPlot(id)!;
}

/** Associates one Stripe test Checkout Session with a still-active reservation. */
export function recordStripeCheckoutSession(id: string, sessionId: string, now = new Date()) {
  const timestamp = now.toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT status, reservation_expires_at, stripe_checkout_session_id FROM plots WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row || row.status !== "reserved" || String(row.reservation_expires_at) <= timestamp) throw new ReservationExpiredError("Your reservation has expired. Please select the plot again.");
    if (row.stripe_checkout_session_id && row.stripe_checkout_session_id !== sessionId) throw new Error("A checkout session already exists for this plot.");
    database.prepare("UPDATE plots SET stripe_checkout_session_id = ? WHERE id = ?").run(sessionId, id);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return getPlot(id)!;
}

/** Webhook fulfillment is safe to repeat for the same verified Checkout Session. */
export function fulfillStripeCheckout(id: string, sessionId: string, paymentIntentId: string | null, now = new Date()) {
  const timestamp = now.toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT status, reservation_expires_at, stripe_checkout_session_id FROM plots WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row || row.stripe_checkout_session_id !== sessionId) throw new Error("Checkout session does not match this plot.");
    if (row.status === "paid") { database.exec("COMMIT"); return getPlot(id)!; }
    if (row.status !== "reserved" || String(row.reservation_expires_at) <= timestamp) throw new ReservationExpiredError("The reservation expired before payment completed.");
    database.prepare("UPDATE plots SET status = 'paid', paid_at = ?, reservation_expires_at = NULL, stripe_payment_intent_id = ? WHERE id = ?").run(timestamp, paymentIntentId, id);
    confirmFounderNeighborhoodForPlot(id, timestamp);
    confirmNeighborhoodLotForPlot(id, timestamp);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return getPlot(id)!;
}

export function getPlot(id: string) {
  const row = database.prepare("SELECT plots.*, (SELECT COUNT(*) FROM plot_likes WHERE plot_id = plots.id) AS likes FROM plots WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToPlot(row) : null;
}

/** Public artwork is available only while its plot remains published. */
export function isPublicArtworkPath(imagePath: string) {
  const row = database.prepare("SELECT 1 FROM plots WHERE image = ? AND status = 'paid' AND publication_state = 'PUBLISHED' LIMIT 1").get(imagePath);
  return Boolean(row);
}

export function publishedPlots() {
  return (database.prepare("SELECT plots.*, (SELECT COUNT(*) FROM plot_likes WHERE plot_id = plots.id) AS likes FROM plots WHERE status = 'paid' AND publication_state = 'PUBLISHED' ORDER BY paid_at DESC").all() as Record<string, unknown>[]).map(rowToPlot);
}

/** A paid plot can transition from DRAFT to PUBLISHED exactly once. */
export function publishPlot(id: string, input: Record<string, unknown>, now = new Date()) {
  const title = sanitizeText(input.title, 100);
  const creator = sanitizeText(input.creatorName, 80);
  const description = sanitizeText(input.description, 800);
  if (!title || !creator) throw new Error("A title and public creator name are required.");
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT status, publication_state, image FROM plots WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row || row.status !== "paid") throw new Error("Paid plot not found.");
    if (row.publication_state !== "DRAFT") throw new Error("This plot already has its permanent publication.");
    if (!row.image) throw new Error("Upload artwork before publishing.");
    database.prepare("UPDATE plots SET publication_state = 'PUBLISHED', title = ?, creator_name = ?, description = ?, published_at = ? WHERE id = ?").run(title, creator, description, now.toISOString(), id);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return getPlot(id)!;
}

export function likePublishedPlot(id: string, visitorId: string, now = new Date()) {
  const plot = getPlot(id);
  if (!plot || plot.publicationState !== "PUBLISHED") throw new Error("Published plot not found.");
  const result = database.prepare("INSERT OR IGNORE INTO plot_likes (plot_id, visitor_id, created_at) VALUES (?, ?, ?)").run(id, visitorId, now.toISOString());
  return { likes: getPlot(id)!.likes, added: result.changes === 1 };
}

export function reportPlot(id: string, input: Record<string, unknown>, reporterId: string, now: Date = new Date()) {
  const plot = getPlot(id);
  if (!plot || plot.publicationState !== "PUBLISHED") throw new Error("Published plot not found.");
  const reason = sanitizeText(input.reason, 80);
  if (!reason) throw new Error("A report reason is required.");
  const report = { id: "rpt_" + randomUUID(), reason, details: sanitizeText(input.details, 1000) };
  try {
    database.prepare("INSERT INTO content_reports (id, plot_id, reason, details, reporter_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(report.id, id, report.reason, report.details, reporterId, now.toISOString());
    return { ...report, submitted: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) return { ...report, submitted: false };
    throw error;
  }
}

export function moderatePlot(id: string, action: "HIDDEN_BY_MODERATION" | "REMOVED_BY_MODERATION", reason: string, administrator: string, now = new Date()) {
  const plot = getPlot(id);
  if (!plot || plot.publicationState !== "PUBLISHED") throw new Error("Published plot not found.");
  const cleanReason = sanitizeText(reason, 500);
  if (!cleanReason) throw new Error("A moderation reason is required.");
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE plots SET publication_state = ? WHERE id = ?").run(action, id);
    database.prepare("UPDATE content_reports SET status = 'RESOLVED' WHERE plot_id = ? AND status = 'OPEN'").run(id);
    database.prepare("INSERT INTO moderation_actions (id, plot_id, action, reason, administrator, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("mod_" + randomUUID(), id, action, cleanReason, administrator, now.toISOString());
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return getPlot(id)!;
}

export type ModerationReport = { id: string; plotId: string; plotTitle: string; plotState: StoredPlot["publicationState"]; reason: string; details: string; createdAt: string };
export type ModerationAction = { id: string; plotId: string; action: string; reason: string; administrator: string; createdAt: string };

export function openModerationReports(): ModerationReport[] {
  return (database.prepare(`SELECT reports.id, reports.plot_id, plots.title, plots.publication_state, reports.reason, reports.details, reports.created_at
    FROM content_reports reports JOIN plots ON plots.id = reports.plot_id WHERE reports.status = 'OPEN' ORDER BY reports.created_at ASC`).all() as Record<string, unknown>[]).map(row => ({
    id: String(row.id), plotId: String(row.plot_id), plotTitle: String(row.title), plotState: String(row.publication_state) as ModerationReport["plotState"], reason: String(row.reason), details: String(row.details), createdAt: String(row.created_at),
  }));
}

export function moderationHistory(limit = 30): ModerationAction[] {
  return (database.prepare("SELECT id, plot_id, action, reason, administrator, created_at FROM moderation_actions ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]).map(row => ({
    id: String(row.id), plotId: String(row.plot_id), action: String(row.action), reason: String(row.reason), administrator: String(row.administrator), createdAt: String(row.created_at),
  }));
}

export const marketplaceLimits = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
