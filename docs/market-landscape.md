# Market landscape

Research date: 2026-09-14 (America/Los_Angeles)

## Executive take

Model selection is already an active market. The broad idea—compare quality, cost, and latency, then route to an appropriate model—is validated but not novel on its own. The market clusters into four layers:

1. **Independent indexes and recommenders** help humans compare the market.
2. **Intelligent routers** choose a model per request or agent step.
3. **Gateways** unify providers and add routing, reliability, budgets, and observability.
4. **Evaluation platforms** measure application quality on a customer’s datasets but usually stop short of producing a portable route policy.

The strongest opening for ModelGauge is an **eval-to-route-policy compiler for agents**: bring representative examples, run a transparent and budget-capped bake-off, then emit an inspectable task policy through MCP. It should complement an existing gateway instead of becoming another one.

## Closest products

| Product | Category | What exists today | Direct overlap | Opening for ModelGauge |
|---|---|---|---|---|
| [Artificial Analysis / Optima](https://artificialanalysis.ai/) | Index + recommender | Independent model/provider intelligence, cost-per-task, speed, a model recommender, and custom benchmarks. | The closest match to the “Artificial Analysis for my data” concept. | Agent-native MCP output, local/private sample handling, versioned route policies, and repository-native evidence. |
| [Not Diamond](https://docs.notdiamond.ai/docs/what-is-model-routing) | Intelligent router | Pretrained chat and code routing plus custom routers trained from prompts, candidate outputs, and evaluation scores. Cost, quality, and latency trade-off modes. | Very direct; its coding router is designed for long-running coding agents. | Transparent deterministic task packs, no hosted router dependency, procurement/audit UX, and explicit fallback evidence. |
| [OpenRouter Auto](https://openrouter.ai/docs/guides/routing/routers/auto-router) | Managed model router | Selects a model by task/complexity, with allowed-model filters and cost tiers; currently powered by Not Diamond. | Immediate one-line routing for OpenRouter customers. | Customer-specific holdouts instead of aggregate market behavior; explainable policies that can choose any downstream gateway. |
| [Ramp Router](https://router.com/) | Production router + gateway | One endpoint, model selection by quality/cost/availability, live latency/failure response, and a coding benchmark based on internal work. | Strong production-grade cost routing and agent benchmark story. | Lightweight open-source decision layer for smaller teams; user-owned benchmark artifacts and MCP-native integration. |
| [Microsoft Foundry Model Router](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/model-router) | Cloud model router | Azure-native routing modes, policy controls, and a workload-specific evaluation toolkit across quality, cost, and latency. | Enterprise version of measure–route–reevaluate. | Cloud-neutral, usable before an enterprise platform decision, and easier to embed in local agent tooling. |
| [Martian](https://withmartian.github.io/martian-sdk-python/api/routers_client.html) | Trainable router | Trains a router across candidate models using representative requests and a quality judge. | Similar custom-workload routing loop. | Human-readable scorecards, deterministic graders, spend guardrails, and portable MCP policy output. |
| [Portkey](https://portkey.ai/docs/product/observability/cost-management) / [LiteLLM](https://docs.litellm.ai/) | AI gateways | Provider abstraction, cost tracking, budgets, load balancing, fallbacks, and routing infrastructure. | They own the execution and observability plane ModelGauge would feed. | Be the evidence and policy layer above gateways instead of competing on proxy infrastructure. |
| [Braintrust](https://www.braintrust.dev/docs/evaluate) / [LangSmith](https://docs.langchain.com/langsmith/evaluation-concepts) | Evaluation platforms | Datasets, deterministic and LLM-based scorers, side-by-side experiments, production traces, and regression monitoring. | They already make model bake-offs possible. | Turn experiment results into a small, installable model policy; optimize for agent delegation rather than general application observability. |

## Positioning recommendation

Avoid positioning ModelGauge as “another model leaderboard” or “the smartest universal router.” Both are occupied and expensive to defend.

Position it as:

> **The transparent model buyer for AI agents.** Give it ten examples of a job. It returns the cheapest model that clears your bar, a fallback, the evidence, and an MCP policy your agent can use.

Core promises:

- **Your work, not a generic leaderboard.** Recommendations are tied to user-supplied examples and acceptance criteria.
- **Evidence travels with the route.** Every decision includes sample size, run date, cost, latency, grader, and failure mode.
- **No new inference gateway required.** The MCP tool recommends; the customer keeps OpenRouter, LiteLLM, Portkey, direct provider APIs, or another execution plane.
- **Spend is bounded before the bake-off begins.** The test plan estimates worst-case cost and stops before the authorized budget.
- **Policies are versioned artifacts.** A route decision can be reviewed in Git, pinned, rolled back, and refreshed when models or prices move.

## Product wedge and roadmap

### V1 — proof of decision

- Curated task profiles with deterministic graders
- Current catalog pricing
- Cost/quality/latency recommendation surface
- Local MCP recommendation server
- Primary model, fallback, evidence age, and caveat

### V2 — bring your ten examples

- CSV/JSON upload with local PII scan and redaction preview
- Suggested task type and grader, always user-reviewable
- Holdout split and repeated trials with confidence intervals
- Budget preflight before any model calls
- Exported `route-policy.json`, MCP configuration, and benchmark report

### V3 — continuous procurement

- Scheduled catalog refresh and challenger runs
- Drift alerts when the incumbent is no longer on the workload’s Pareto frontier
- Gateway adapters for OpenRouter, LiteLLM, Portkey, and direct APIs
- Production feedback sampled back into the offline test set

## Risks

- **Incumbents can add this UI.** The moat has to come from portable task packs, trustworthy private-data handling, and an agent distribution surface—not the ranking formula.
- **Tiny evals create false confidence.** Recommendations need visible sample sizes, variance, failure cases, and a minimum evidence standard.
- **Routing overhead can erase savings.** Prefer static task policies for known subagent roles; reserve per-request classification for ambiguous work.
- **Token price is not task cost.** Reasoning length, retries, cache behavior, and provider failures must be measured from actual completions.
- **Policy and privacy constraints change the candidate pool.** Region, retention, provider allowlists, tool support, and context needs should be hard filters before price optimization.
