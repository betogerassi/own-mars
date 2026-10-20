import { CANVAS_HEIGHT, CANVAS_WIDTH, type PlotRectangle } from "./marketplace";

export type NeighborhoodPriceTier = { startsAtPercent: number; price: number };
export type NeighborhoodConfiguration = {
  capacity: number;
  lotWidth: number;
  lotHeight: number;
  columns: number;
  founderPrice: number;
  priceTiers: readonly NeighborhoodPriceTier[];
};

export const defaultNeighborhoodConfiguration: NeighborhoodConfiguration = {
  capacity: 100,
  lotWidth: 10,
  lotHeight: 10,
  columns: 10,
  founderPrice: 100,
  priceTiers: [
    { startsAtPercent: 0, price: 50 },
    { startsAtPercent: 20, price: 65 },
    { startsAtPercent: 40, price: 85 },
    { startsAtPercent: 60, price: 110 },
    { startsAtPercent: 80, price: 150 },
  ],
};

export type NeighborhoodBoundary = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
};

export type NeighborhoodPrice = {
  price: number | null;
  soldOut: boolean;
  confirmedOccupancy: number;
  capacity: number;
  remaining: number;
  nextThreshold: number | null;
  plotsUntilNextThreshold: number | null;
};

/** Founder status is intentionally assigned only after authoritative payment fulfillment. */
export type FounderStatus = "PENDING_PAYMENT" | "CONFIRMED";

function validateConfiguration(configuration: NeighborhoodConfiguration) {
  if (!Number.isInteger(configuration.capacity) || configuration.capacity < 2 ||
    !Number.isInteger(configuration.lotWidth) || configuration.lotWidth < 10 ||
    !Number.isInteger(configuration.lotHeight) || configuration.lotHeight < 10 ||
    !Number.isInteger(configuration.columns) || configuration.columns < 1 || configuration.columns > configuration.capacity ||
    !Number.isInteger(configuration.founderPrice) || configuration.founderPrice < 0) throw new Error("Invalid neighborhood configuration.");
  const tiers = [...configuration.priceTiers];
  if (!tiers.length || tiers[0].startsAtPercent !== 0 || tiers.some((tier, index) =>
    !Number.isInteger(tier.startsAtPercent) || tier.startsAtPercent < 0 || tier.startsAtPercent >= 100 ||
    !Number.isInteger(tier.price) || tier.price < 0 || (index > 0 && tier.startsAtPercent <= tiers[index - 1].startsAtPercent))) {
    throw new Error("Neighborhood price tiers must start at 0 and increase deterministically.");
  }
}

/** A deterministic boundary centered on the founder's 10×10 virtual lot. */
export function boundaryForFounder(founder: PlotRectangle, configuration = defaultNeighborhoodConfiguration): NeighborhoodBoundary {
  validateConfiguration(configuration);
  const rows = Math.ceil(configuration.capacity / configuration.columns);
  const width = configuration.columns * configuration.lotWidth;
  const height = rows * configuration.lotHeight;
  if (width > CANVAS_WIDTH || height > CANVAS_HEIGHT) throw new Error("Neighborhood configuration exceeds the Mars grid.");
  return {
    originX: ((founder.x - Math.floor(width / 2) + CANVAS_WIDTH) % CANVAS_WIDTH + CANVAS_WIDTH) % CANVAS_WIDTH,
    originY: Math.max(0, Math.min(CANVAS_HEIGHT - height, founder.y - Math.floor(height / 2))),
    width, height, columns: configuration.columns, rows,
  };
}

/** Returns one stable, zero-based lot location; the final row can contain inactive cells. */
export function lotForIndex(boundary: NeighborhoodBoundary, index: number, configuration = defaultNeighborhoodConfiguration): PlotRectangle {
  validateConfiguration(configuration);
  if (!Number.isInteger(index) || index < 0 || index >= configuration.capacity) throw new Error("Invalid neighborhood lot index.");
  const row = Math.floor(index / boundary.columns);
  const column = index % boundary.columns;
  return {
    x: (boundary.originX + column * configuration.lotWidth) % CANVAS_WIDTH,
    y: boundary.originY + row * configuration.lotHeight,
    width: configuration.lotWidth,
    height: configuration.lotHeight,
  };
}

/** Uses confirmed (never reserved) occupancy, so scarcity claims remain factual. */
export function priceForNeighborhoodOccupancy(confirmedOccupancy: number, configuration = defaultNeighborhoodConfiguration): NeighborhoodPrice {
  validateConfiguration(configuration);
  if (!Number.isInteger(confirmedOccupancy) || confirmedOccupancy < 0 || confirmedOccupancy > configuration.capacity) throw new Error("Invalid confirmed occupancy.");
  const remaining = configuration.capacity - confirmedOccupancy;
  if (!remaining) return { price: null, soldOut: true, confirmedOccupancy, capacity: configuration.capacity, remaining, nextThreshold: null, plotsUntilNextThreshold: null };
  const percent = (confirmedOccupancy / configuration.capacity) * 100;
  const activeTier = [...configuration.priceTiers].reverse().find(tier => percent >= tier.startsAtPercent)!;
  const nextTier = configuration.priceTiers.find(tier => tier.startsAtPercent > percent);
  const nextThreshold = nextTier ? Math.ceil((nextTier.startsAtPercent / 100) * configuration.capacity) : null;
  return {
    price: activeTier.price,
    soldOut: false,
    confirmedOccupancy,
    capacity: configuration.capacity,
    remaining,
    nextThreshold,
    plotsUntilNextThreshold: nextThreshold === null ? null : nextThreshold - confirmedOccupancy,
  };
}

export function normalizeNeighborhoodName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9 '’&-]{1,38}[A-Za-z0-9]$/.test(name)) throw new Error("Neighborhood names must be 3–40 letters, numbers, spaces, apostrophes, ampersands, or hyphens.");
  return { displayName: name, key: name.toLocaleLowerCase("en-US") };
}

export function founderStatusAfterPayment(paymentConfirmed: boolean): FounderStatus {
  return paymentConfirmed ? "CONFIRMED" : "PENDING_PAYMENT";
}
