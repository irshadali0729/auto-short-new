import type { Groq } from "groq-sdk";
import { withRetry } from "@/app/utils/retry";

// Shared Groq JSON-completion helper: tries each model in order and returns
// the first non-empty response. Used by generate-seo and translate-transcript.

// Only these chat models are enabled for this Groq key (checked via
// GET /openai/v1/models) — "groq/compound-mini" and "llama-3.3-70b-versatile"
// return model_not_found, so they can't act as fallbacks.
export const GROQ_JSON_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
];

export function getGroqErrorStatus(err: unknown): number | undefined {
  const asRecord = err as { status?: number; response?: { status?: number } } | null;
  return asRecord?.status ?? asRecord?.response?.status;
}

// Reasoning models spend hidden tokens that count against max_tokens — with
// the default effort a small budget ran out before any JSON was written
// ("max completion tokens reached"). gpt-oss takes low/medium/high; qwen3
// only takes none/default.
export function reasoningParams(model: string, effort: "low" | "medium") {
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: effort };
  if (model.startsWith("qwen/")) return { reasoning_effort: effort === "low" ? ("none" as const) : ("default" as const) };
  return {};
}

export async function groqJsonCompletion(
  groq: Groq,
  prompt: string,
  options: {
    maxTokens: number;
    temperature?: number;
    reasoningEffort?: "low" | "medium";
    models?: string[];
  },
): Promise<string> {
  const errors: string[] = [];

  for (const model of options.models ?? GROQ_JSON_MODELS) {
    try {
      const completion = await withRetry(
        () =>
          groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model,
            response_format: { type: "json_object" },
            temperature: options.temperature ?? 0.4,
            max_tokens: options.maxTokens,
            ...reasoningParams(model, options.reasoningEffort ?? "low"),
          }),
        { retries: 2, baseDelayMs: 1000, shouldRetry: (err) => getGroqErrorStatus(err) === 429 },
      );
      const content = completion.choices[0]?.message?.content;
      if (content) return content;
      errors.push(`${model}: empty response`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${message}`);
      console.warn(`Model ${model} failed, trying next candidate:`, message);
    }
  }

  // Report every model's failure, not just the last (often a less useful 404).
  throw new Error(`All Groq models failed. ${errors.join(" | ")}`);
}
