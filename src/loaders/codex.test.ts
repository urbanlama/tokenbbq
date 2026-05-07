import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsage, subtractUsage, type RawUsage } from './codex.js';

describe('normalizeUsage', () => {
  test('reads OpenAI field names and fills total when missing', () => {
    const u = normalizeUsage({
      input_tokens: 100,
      cached_input_tokens: 30,
      output_tokens: 50,
      reasoning_output_tokens: 10,
    });
    assert.deepEqual(u, {
      input: 100, cached: 30, output: 50, reasoning: 10,
      // total absent → fallback to input + output, NOT including cached/reasoning
      total: 150,
    });
  });

  test('honors total_tokens when provided', () => {
    const u = normalizeUsage({
      input_tokens: 100, output_tokens: 50, total_tokens: 175,
    });
    assert.equal(u?.total, 175);
  });

  test('falls back to cache_read_input_tokens for cached', () => {
    const u = normalizeUsage({
      input_tokens: 100,
      cache_read_input_tokens: 40,
      output_tokens: 50,
    });
    assert.equal(u?.cached, 40);
  });

  test('returns null for non-objects', () => {
    assert.equal(normalizeUsage(null), null);
    assert.equal(normalizeUsage(undefined), null);
    assert.equal(normalizeUsage(42), null);
    assert.equal(normalizeUsage('x'), null);
  });
});

describe('subtractUsage — cumulative-total math', () => {
  const usage = (over: Partial<RawUsage> = {}): RawUsage => ({
    input: 0, cached: 0, output: 0, reasoning: 0, total: 0, ...over,
  });

  test('returns the current usage as-is when prev is null (first turn)', () => {
    const cur = usage({ input: 100, output: 50, total: 150 });
    assert.deepEqual(subtractUsage(cur, null), cur);
  });

  test('subtracts each field independently across turns', () => {
    const turn1 = usage({ input: 100, cached: 20, output: 50, reasoning: 5, total: 175 });
    const turn2Cumulative = usage({ input: 250, cached: 80, output: 120, reasoning: 15, total: 465 });
    const fresh = subtractUsage(turn2Cumulative, turn1);
    assert.deepEqual(fresh, {
      input: 150, cached: 60, output: 70, reasoning: 10, total: 290,
    });
  });

  test('clamps negative deltas to 0 (rare schema-glitch guard)', () => {
    // If a session log emits an out-of-order or downward-counting entry,
    // never subtract into negative — Math.max(.., 0) keeps the event sane
    // but signals nothing was added on this turn.
    const prev = usage({ input: 100, output: 50, total: 150 });
    const cur = usage({ input: 90, output: 50, total: 140 });
    const fresh = subtractUsage(cur, prev);
    assert.deepEqual(fresh, {
      input: 0, cached: 0, output: 0, reasoning: 0, total: 0,
    });
  });

  test('three-turn cumulative chain produces per-turn deltas', () => {
    // Codex emits cumulative totals, the loader reduces them via successive
    // subtractUsage calls. Each call must yield only the new tokens since
    // the previous call.
    const t1 = usage({ input: 100, output: 50, total: 150 });
    const t2 = usage({ input: 220, output: 130, total: 350 });
    const t3 = usage({ input: 320, output: 200, total: 520 });

    const f1 = subtractUsage(t1, null);
    const f2 = subtractUsage(t2, t1);
    const f3 = subtractUsage(t3, t2);

    assert.equal(f1.input + f2.input + f3.input, t3.input);
    assert.equal(f1.output + f2.output + f3.output, t3.output);
    assert.equal(f1.total + f2.total + f3.total, t3.total);
    assert.deepEqual(f2, { input: 120, cached: 0, output: 80, reasoning: 0, total: 200 });
  });
});
