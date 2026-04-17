/**
 * Per-1M-token pricing for common LLM models.
 *
 * Keep this table up to date — stale pricing produces bad cost estimates.
 * Prices are in USD per 1,000,000 tokens.
 *
 * Used by `estimateCost()` and consumed by the Claude Code Stop hook.
 */

export interface ModelPricing {
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude 4.x
  'claude-opus-4-7': { input: 15.0, output: 75.0, cache_read: 1.5 },
  'claude-opus-4-6': { input: 15.0, output: 75.0, cache_read: 1.5 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cache_read: 0.3 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0, cache_read: 0.3 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0, cache_read: 0.08 },

  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0, cache_read: 1.25 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cache_read: 0.075 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'o1-preview': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },

  // Google Gemini
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};

export interface CostEstimateInput {
  model: string;
  tokens_in: number;
  tokens_out: number;
  tokens_cache_read?: number;
  tokens_cache_write?: number;
}

/**
 * Compute a USD cost estimate for a model call.
 * Returns 0 if the model is not in the pricing table — prefer emitting 0
 * over a wildly wrong estimate.
 */
export function estimateCost(input: CostEstimateInput): number {
  const pricing = MODEL_PRICING[input.model] ?? MODEL_PRICING[input.model.toLowerCase()];
  if (!pricing) return 0;

  const cost =
    input.tokens_in * pricing.input +
    input.tokens_out * pricing.output +
    (input.tokens_cache_read ?? 0) * (pricing.cache_read ?? 0) +
    (input.tokens_cache_write ?? 0) * (pricing.cache_write ?? pricing.input);

  return cost / 1_000_000;
}

/**
 * Register or override pricing for a model — useful for fine-tuned variants
 * or self-hosted models where you know the unit cost.
 */
export function registerModelPricing(model: string, pricing: ModelPricing): void {
  MODEL_PRICING[model] = pricing;
}
