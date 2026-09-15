# Research notes

Snapshot date: 2026-09-14 (America/Los_Angeles)

## Product thesis

A broad intelligence leaderboard is useful for discovery but insufficient for routing real work. The product wedge is a task-shaped purchasing decision: “What is the least expensive model that clears my quality bar for this workload, at an acceptable latency?”

The recommendation loop is:

1. Describe or select a representative workload.
2. Measure candidates on identical examples and deterministic graders.
3. Eliminate models below the required quality floor.
4. Rank the survivors by the user’s first constraint: cost, quality, or speed.
5. Return a primary route, a fallback, and the evidence age and confidence.

## Findings that shaped V1

- Artificial Analysis separates quality, price, and end-to-end performance, and defines cost per task from the tokens actually consumed. ModelGauge adopts that task-cost framing while using a much smaller, user-legible suite for V1. Source: https://artificialanalysis.ai/methodology
- OpenRouter’s catalog API exposes current model properties and token pricing. Its routing controls can prefer price, throughput, or latency and its performance signals use rolling provider observations. Source: https://openrouter.ai/docs/api/api-reference/models/get-models and https://openrouter.ai/docs/guides/routing/provider-selection
- Reasoning tokens count as output tokens and can materially change both task cost and whether an answer fits within an output limit. The benchmark therefore records finish reason and reasoning-token use, and sets the same minimal reasoning effort across candidates. Source: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
- MCP tools are model-controlled, schema-described operations. V1 exposes recommendation, comparison, and evidence tools over local stdio. Source: https://modelcontextprotocol.io/specification/2025-06-18/server/tools

## V1 caveats

- Three tasks and one measured pass per task are directional evidence, not a general leaderboard.
- Wall-clock timing includes gateway and provider behavior for that request; it is not a stable service-level guarantee.
- The benchmark routes to the lowest-price eligible provider. A different privacy or data-retention policy can change provider availability, price, and speed.
- Prices and models move quickly. The checked-in snapshot is reproducible; a production service should refresh the catalog and re-run user-specific evals on a schedule.

## Experiment result

The initial calibration pass used default model reasoning and showed that several candidates could consume the whole output allowance before returning usable content. The final pass applied OpenRouter's normalized `minimal` reasoning effort and recorded reasoning tokens, completion status, provider, quality, wall-clock time, and returned usage cost.

Across both passes, OpenRouter reported **$0.139573** in total usage cost—well below the $5 ceiling. In the final pass, GPT-5.6 Luna was the least expensive model to score 100/100 on all three task profiles. Qwen 3.8 Flash was cheaper and scored 100 on extraction and triage, but consumed the full 1,800-token coding allowance as reasoning and returned no gradeable answer. Gemini 3.8 Flash scored 96 overall and had the lowest measured median wall-clock time.
