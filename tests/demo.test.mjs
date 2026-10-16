import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSpot, encodeSpot, priceOf, pointToLatLon, validPlot } from '../.test-build/demo.js';

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
test('keeps uploaded artwork out of share links', () => {
  const encoded = encodeSpot({ id: 'demo', lat: 1, lon: 2, width: 20, height: 20, name: 'Test', message: '', url: '', crop: 1, x: 0, y: 0, image: 'data:image/png;base64,large-private-upload' });
  assert.equal(encoded.includes('large-private-upload'), false);
  assert.equal(decodeSpot(encoded)?.image, undefined);
});
