import type { TokenCounts } from './types.js';

const LITELLM_URL =
	'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

type ModelPricing = {
	input_cost_per_token?: number;
	output_cost_per_token?: number;
	cache_creation_input_token_cost?: number;
	cache_read_input_token_cost?: number;
};

const FALLBACK_PRICES: Record<string, ModelPricing> = {
	'claude-sonnet-4-20250514': {
		input_cost_per_token: 3e-6,
		output_cost_per_token: 15e-6,
		cache_read_input_token_cost: 0.3e-6,
		cache_creation_input_token_cost: 3.75e-6,
	},
	'claude-opus-4-20250514': {
		input_cost_per_token: 15e-6,
		output_cost_per_token: 75e-6,
		cache_read_input_token_cost: 1.5e-6,
		cache_creation_input_token_cost: 18.75e-6,
	},
	'gpt-5': {
		input_cost_per_token: 2e-6,
		output_cost_per_token: 8e-6,
		cache_read_input_token_cost: 0.5e-6,
	},
};

let pricingCache: Record<string, ModelPricing> | null = null;

async function fetchPricing(): Promise<Record<string, ModelPricing>> {
	if (pricingCache) return pricingCache;

	try {
		const res = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		pricingCache = (await res.json()) as Record<string, ModelPricing>;
		return pricingCache;
	} catch {
		pricingCache = FALLBACK_PRICES;
		return pricingCache;
	}
}

function findModelPricing(
	prices: Record<string, ModelPricing>,
	modelName: string,
): ModelPricing | null {
	if (prices[modelName]) return prices[modelName];

	const prefixes = ['anthropic/', 'openai/', 'openrouter/openai/', 'gemini/', ''];
	for (const prefix of prefixes) {
		const key = prefix + modelName;
		if (prices[key]) return prices[key];
	}

	const cleaned = modelName.replace(/^\[pi\]\s*/, '');
	if (cleaned !== modelName) return findModelPricing(prices, cleaned);

	const baseMatch = modelName.replace(/-\d{8}$/, '');
	if (baseMatch !== modelName) return findModelPricing(prices, baseMatch);

	// No fuzzy substring match. The previous loop would return the first
	// `key.includes(modelName)` hit, which is order-dependent on the JSON
	// keys LiteLLM ships — `gpt-4` could match `gpt-4o` or `gpt-4-turbo`
	// depending on iteration order, silently mispricing every event for
	// that model. If we don't have an exact or prefix match, return null
	// and let `enrichCosts` keep `costUSD: 0` rather than make up a price.
	return null;
}

export async function calculateCost(model: string, tokens: TokenCounts): Promise<number> {
	const prices = await fetchPricing();
	const pricing = findModelPricing(prices, model);
	if (!pricing) return 0;

	const inputCost = tokens.input * (pricing.input_cost_per_token ?? 0);
	const outputCost = tokens.output * (pricing.output_cost_per_token ?? 0);
	// Cache pricing is provider-specific (Anthropic charges 1.25× input for
	// writes / 0.1× for reads; OpenAI ~0.5× for reads). When LiteLLM doesn't
	// publish explicit cache rates for a model, fall back to 0 — falling back
	// to the input rate would inflate cache-read cost up to 10× (Anthropic)
	// and silently misprice every Claude Code session.
	const cacheCreateCost =
		tokens.cacheCreation * (pricing.cache_creation_input_token_cost ?? 0);
	const cacheReadCost =
		tokens.cacheRead * (pricing.cache_read_input_token_cost ?? 0);

	return inputCost + outputCost + cacheCreateCost + cacheReadCost;
}

export async function enrichCosts(
	events: Array<{ model: string; tokens: TokenCounts; costUSD: number }>,
): Promise<void> {
	await fetchPricing();
	for (const event of events) {
		if (event.costUSD > 0) continue;
		event.costUSD = await calculateCost(event.model, event.tokens);
	}
}
