import { describe, it, expect } from 'vitest';
import { estimateCost, registerModelPricing, MODEL_PRICING } from '../model-pricing.js';

describe('estimateCost', () => {
  it('computes opus-4-7 cost', () => {
    const cost = estimateCost({
      model: 'claude-opus-4-7',
      tokens_in: 1_000_000,
      tokens_out: 500_000,
    });
    // 1M * $15 + 0.5M * $75 = $15 + $37.5 = $52.5
    expect(cost).toBeCloseTo(52.5, 5);
  });

  it('handles cache_read discount', () => {
    const cost = estimateCost({
      model: 'claude-sonnet-4-6',
      tokens_in: 1_000_000,
      tokens_out: 100_000,
      tokens_cache_read: 2_000_000,
    });
    // 1M * $3 + 0.1M * $15 + 2M * $0.3 = 3 + 1.5 + 0.6 = $5.1
    expect(cost).toBeCloseTo(5.1, 5);
  });

  it('returns 0 for unknown models', () => {
    expect(estimateCost({ model: 'unknown-model', tokens_in: 1000, tokens_out: 1000 })).toBe(0);
  });

  it('registerModelPricing overrides table', () => {
    registerModelPricing('custom-model', { input: 10, output: 20 });
    expect(MODEL_PRICING['custom-model']).toEqual({ input: 10, output: 20 });
    const cost = estimateCost({ model: 'custom-model', tokens_in: 1_000_000, tokens_out: 1_000_000 });
    expect(cost).toBeCloseTo(30, 5);
  });
});
