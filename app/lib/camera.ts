export const MARS_MIN_DISTANCE = 1.85;
export const MARS_MAX_DISTANCE = 6;

/** Clamp every zoom interaction to the same bounds used by OrbitControls. */
export function nextMarsCameraDistance(currentDistance: number, factor: number) {
  if (!Number.isFinite(currentDistance) || currentDistance <= 0 || !Number.isFinite(factor) || factor <= 0) {
    throw new Error("Camera distance and zoom factor must be positive finite numbers.");
  }
  return Math.min(MARS_MAX_DISTANCE, Math.max(MARS_MIN_DISTANCE, currentDistance * factor));
}
