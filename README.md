# ModelGauge

ModelGauge answers a practical question: **what is the least expensive model that can reliably do this particular job?**

V1 is a working decision console plus a local MCP server. It combines current OpenRouter pricing with a small, reproducible benchmark across invoice extraction, support triage, and a bounded coding task. The output is a primary model, fallback, estimated run cost, measured wall-clock latency, and an explicit evidence caveat.

The included 2026-09-14 run found GPT-5.6 Luna was the lowest-priced model to score 100/100 across all three tasks. Qwen 3.8 Flash was cheaper for extraction and triage but produced no gradeable coding answer inside the fixed output budget. Gemini 3.8 Flash was the fastest measured model and scored 96/100 overall. Total experiment spend, including one calibration pass, was **$0.139573**.

## What is included

- Interactive comparison site in `dist/`
- Six-model OpenRouter experiment with deterministic graders
- Shared recommendation engine in `lib/engine.mjs`
- Dependency-free MCP stdio server with three tools
- Tests for routing logic and the MCP contract
- Research and product reasoning in `docs/research.md`
- Current competitor map and positioning in `docs/market-landscape.md`

## Run it

Node 20+ is required for the tests and MCP server.

```bash
npm test
npm run mcp
```

For the site:

```bash
npm run dev
```

Then open `http://localhost:4173`.

## Connect the MCP server

Codex configuration:

```toml
[mcp_servers.modelgauge]
command = "node"
args = ["/absolute/path/to/modelgauge/mcp/server.mjs"]
```

Available tools:

- `recommend_model` — cheapest measured model above a quality floor, or quality/speed-first routing
- `compare_models` — task-shaped cost, quality, and latency table
- `list_benchmarks` — the evidence and its limitations

## Re-run the experiment

Put an OpenRouter key at `~/.openrouter.key`, then run:

```bash
npm run benchmark
```

The script reads the live catalog, routes every request price-first, records OpenRouter’s returned usage cost, and stops before its `$4.50` per-run guard. It prints JSON to stdout and never prints the key. A rerun is a new spend event; the guard does not track costs from earlier invocations.

## Why this shape

[Artificial Analysis](https://artificialanalysis.ai/methodology) demonstrates why quality, performance, and price need to be seen together. [OpenRouter](https://openrouter.ai/docs/guides/routing/provider-selection) already provides multi-provider routing and live price/performance controls. ModelGauge’s wedge is the layer between them: workload-specific evidence and a simple “cheapest model that clears the bar” decision that an agent can call through [MCP](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).

## Market position

This is a validated but competitive category. Artificial Analysis Optima offers custom benchmarks and recommendations; Not Diamond and OpenRouter Auto route prompts; Ramp Router and Microsoft Foundry target production traffic; Braintrust and LangSmith provide deep evaluation workflows. ModelGauge should not become another inference gateway. Its sharper wedge is a transparent, local **eval-to-route-policy compiler**: use a customer’s examples, expose every cost and failure, and produce a versioned MCP policy that works with the gateway they already have. See the [market landscape](docs/market-landscape.md).

## Current limitations

This is intentionally a V1. The checked-in benchmark is one pass on three small tasks, so it should guide a shortlist—not approve a production migration on its own. A next version should accept a customer dataset, generate holdout cases, add repeated runs and confidence intervals, and continuously refresh price and provider telemetry.
