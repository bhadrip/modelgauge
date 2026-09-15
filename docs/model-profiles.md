# Model profile evidence policy

The ModelGauge model library is designed as a research index, not a scraped marketing directory. Every model record follows the same hierarchy:

1. First-party model documentation, technical reports, and the model maker's official Hugging Face organization.
2. OpenRouter's catalog for normalized routing IDs, current routed prices, modalities, and supported API parameters.
3. ModelGauge's own workload measurements, which are always labeled separately from vendor-reported benchmarks.

Unknown values stay unknown. Parameter count, active parameters, layers, knowledge cutoff, and training details are never estimated from rumors or third-party summaries.

## Current source map

| Model | Primary sources | Architecture status | Weights |
| --- | --- | --- | --- |
| Qwen 3.8 Flash | Qwen Cloud guide; Qwen Hugging Face model card | Detailed disclosure | Open weights, Qwen Community License 1.0 |
| DeepSeek V4.1 Flash | DeepSeek release; DeepSeek Hugging Face model card | Detailed disclosure | Open weights, MIT |
| GPT-5.6 Luna | OpenAI API model documentation | Not publicly disclosed | Proprietary API |
| Gemini 3.8 Flash | Gemini API documentation; Google DeepMind model card | Lineage disclosed, parameter-level design undisclosed | Proprietary API |
| Claude Sonnet 5 | Claude Platform model documentation | Not publicly disclosed | Proprietary API |
| GPT-6 Astra | OpenAI API model documentation | Not publicly disclosed | Proprietary API |

All six records also include the corresponding OpenRouter model page and a per-source verification date. The checked-in snapshot was verified on 2026-09-15.

## Evaluation labels

- **ModelGauge measurement:** a run we paid for and recorded. The profile shows quality, wall-clock latency, actual reported cost, selected provider, reasoning-token count, and finish reason.
- **Vendor-reported:** a score published by the model maker. It is not blended into the ModelGauge quality score.
- **Not imported:** vendor documentation may link to a system card or announcement without a compact benchmark table. The profile leaves that section empty instead of manufacturing comparability.

## Refresh protocol

A catalog refresh should update price and capability fields from OpenRouter, revisit every first-party URL, advance the checked date only for sources actually reviewed, and run the catalog tests. Changes in model aliasing, promotional pricing, retirement status, license, or weight availability should be called out in the model's caveats.
