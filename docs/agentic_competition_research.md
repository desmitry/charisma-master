# Agentic Competition Research

## Goal

This extension adds a competition-research pipeline to the ML worker. After the user uploads a speech video or text, the worker now tries to determine the pitched product, gather external sources about the market, review the most relevant ones, and synthesize a short competition summary that is included in the final speech report and passed into criteria evaluation as an auxiliary tool.

## Architecture

The implementation lives in `services/ml_worker/app/logic/competition_research.py`.

Stages:

1. `identify_product`
   - Uses the existing `LLMClient` to extract `product_name`, `product_description`, and a search query from the transcript and slide text.
   - If the product cannot be identified confidently, the pipeline stops and returns an empty string.

2. `search_sources`
   - Uses DuckDuckGo search.
   - Primary path: LangChain community wrapper.
   - Fallback path: direct `duckduckgo-search`.
   - Results are normalized and deduplicated.

3. `analyze_sources`
   - Fetches the top sources with `requests`.
   - Extracts readable text from HTML pages.
   - Runs concurrent source-review tasks that decide whether each source describes a relevant competitor.

4. `synthesize_report`
   - Combines the reviewed competitor findings into a concise final summary.
   - Returns `""` when evidence is too weak or inconsistent.

## LangGraph and Fallback Behavior

The orchestration is modeled as a LangGraph state machine when LangGraph is installed. The graph uses conditional routing between stages and terminates early when there is not enough evidence.

Tests and local imports should still work without downloading new packages, so the module lazy-imports LangGraph and search integrations. If LangGraph is unavailable or the graph execution fails, the same stages run sequentially with identical stop conditions.

## Integration Points

- `packages/charisma_schemas/.../SpeechReport` now includes `competition_analysis`.
- `services/ml_worker/app/logic/tasks.py` runs competition research after transcript/presentation parsing and before the main LLM speech report.
- `LLMClient.analyze_speech(...)` and `LLMClient.analyze_with_evalution_criteria(...)` receive the synthesized competition block as additional context.
- The speech-analysis prompt is responsible for filling `speech_report.competition_analysis` only when the provided research is strong enough. The worker also preserves the synthesized summary as a fallback when the field comes back empty.

## Prompts

New prompts:

- `competition_product.txt`
- `competition_source.txt`
- `competition_summary.txt`

Updated prompts:

- `speech_analysis.txt`
- `criteria_evaluation.txt`

These prompts enforce JSON-only outputs and explicitly require empty strings when competition data is insufficient.

## Failure Model

Competition research must not break the core analysis pipeline.

- Product not identified: return `""`
- Search unavailable: return `""`
- Source fetch failures: skip failed sources
- No relevant reviewed sources: return `""`
- Graph/runtime failure: log warning and fall back or continue without competition data

This keeps the existing speech-analysis flow operational even when external research is weak or unavailable.
