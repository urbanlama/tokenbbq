import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

// Bypass the LiteLLM fetch — pin findModelPricing/calculateCost behavior
// against a synthetic price map so the C11 fallback (cache cost → 0
// when no explicit cache rate, NOT → input rate) is locked in.
mock.method(globalThis, 'fetch', async () =>
  new Response(
    JSON.stringify({
      'with-cache-pricing': {
        input_cost_per_token: 1e-6,
        output_cost_per_token: 4e-6,
        cache_creation_input_token_cost: 1.25e-6,
        cache_read_input_token_cost: 0.1e-6,
      },
      'without-cache-pricing': {
        input_cost_per_token: 1e-6,
        output_cost_per_token: 4e-6,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ),
);

const { calculateCost } = await import('./pricing.js');

const counts = (over: Partial<Record<string, number>> = {}) => ({
  input: 1000,
  output: 500,
  cacheCreation: 200,
  cacheRead: 800,
  reasoning: 0,
  ...over,
});

describe('calculateCost — cache pricing fallback (C11)', () => {
  test('uses explicit cache rates when LiteLLM provides them', async () => {
    const cost = await calculateCost('with-cache-pricing', counts());
    // 1000*1e-6 + 500*4e-6 + 200*1.25e-6 + 800*0.1e-6
    //   = 1e-3 + 2e-3 + 0.25e-3 + 0.08e-3 = 0.00333
    assert.equal(cost.toFixed(6), '0.003330');
  });

  test('falls back to 0 (NOT input rate) when no cache pricing is published', async () => {
    const cost = await calculateCost('without-cache-pricing', counts());
    // Cache portions must contribute 0. Pre-fix: 200*1e-6 + 800*1e-6 = 1e-3
    // would have been added — a 30%+ overcharge on this synthetic case.
    // Post-fix: 1000*1e-6 + 500*4e-6 = 0.003 only.
    assert.equal(cost.toFixed(6), '0.003000');
  });

  test('returns 0 for unknown models', async () => {
    const cost = await calculateCost('does-not-exist', counts());
    assert.equal(cost, 0);
  });
});
