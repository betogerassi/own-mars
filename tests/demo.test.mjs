import test from 'node:test';
import assert from 'node:assert/strict';
import { priceOf, pointToLatLon, validPlot } from '../.test-build/demo.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, priceForRectangle, rectangleFor, rectanglesOverlap, zoneAt } from '../.test-build/marketplace.js';

test('calculates valid plot prices', () => {
  assert.equal(priceOf({ width: 20, height: 20 }), 400);
  assert.equal(priceOf({ width: 9, height: 20 }), 0);
  assert.equal(validPlot(50, 10), true);
});
test('converts sphere point to geographic coordinates', () => {
  const p = pointToLatLon({ x: 1, y: 0, z: 0 });
  assert.equal(Math.round(p.lat), 0);
  assert.equal(Math.round(p.lon), 0);
});
test('addresses exactly one billion cells and produces stable plot rectangles', () => {
  assert.equal(CANVAS_WIDTH * CANVAS_HEIGHT, 1_000_000_000);
  const rectangle = rectangleFor(0, 0, 20, 20);
  assert.deepEqual(rectangle, { x: 19990, y: 12490, width: 20, height: 20 });
  assert.equal(rectanglesOverlap(rectangle, { ...rectangle, x: rectangle.x + 20 }), false);
});
test('assigns landmark pricing and reports exact multi-zone totals', () => {
  assert.equal(zoneAt(18, -135), 'MARS_LANDMARKS');
  const price = priceForRectangle(rectangleFor(18, -135, 10, 10));
  assert.equal(price.total, 2500);
  assert.equal(price.breakdown.MARS_LANDMARKS, 100);
});
