import test from 'node:test';
import assert from 'node:assert/strict';
import { priceOf, pointToLatLon, validPlot } from '../.test-build/demo.js';

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
