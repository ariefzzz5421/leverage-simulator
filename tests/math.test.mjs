import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../lib/math.mjs';

test('long liquidation accounts for maintenance and fees', () => {
  const v = simulate({ entry: 90000, margin: 100, leverage: 10, side: 'long', exit: 99000 });
  assert.ok(v);
  assert.equal(v.notional, 1000);
  assert.equal(v.quantity, 1 / 90);
  assert.ok(v.liquidation < 90000 && v.liquidation > 81000);
  assert.ok(Math.abs(v.netPnl - 98.95) < 0.00001);
});
test('short liquidation is above entry and adverse exit caps loss', () => {
  const v = simulate({ entry: 90000, margin: 100, leverage: 10, side: 'short', exit: 110000 });
  assert.ok(v);
  assert.ok(v.liquidation > 90000);
  assert.equal(v.reachedLiquidation, true);
  assert.equal(v.netPnl, -100);
});
test('cross collateral shifts liquidation and loss budget', () => {
  const isolated = simulate({ entry: 90000, margin: 100, leverage: 10, side: 'long', exit: 85000 });
  const cross = simulate({ entry: 90000, margin: 100, leverage: 10, side: 'long', exit: 85000, mode: 'cross', extraCollateral: 100 });
  assert.ok(isolated && cross && isolated.liquidation && cross.liquidation);
  assert.ok(cross.liquidation < isolated.liquidation);
  assert.equal(cross.collateral, 200);
});
test('invalid entry cannot produce a liquidation price', () => {
  assert.equal(simulate({ entry: 0, margin: 100, leverage: 10, side: 'long', exit: 90000 }), null);
});
