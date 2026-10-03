# Wolf-Hacks

WolfHacks 2026 (NC State), Center for Geospatial Analytics track.

> Use geospatial data to understand a pressing societal or environmental issue, and develop a software solution that helps determine where to take action.

## Status
Ideation. Three proposals are in `ideation/PROPOSALS.md`. The project gets built once one is chosen.

## How the ideas were chosen (`ideation/`)
1. **Two independent pools.** Claude (`claude_divergent.md`) and GPT via Hermes (`hermes_divergent_raw.md`) each wrote ideas without seeing the other's. Each pool first listed the predictable ideas for this track and excluded them.
2. **Hallucination guard.** Every dataset an idea depends on was checked against a live endpoint or download page on 3 Oct 2026 and tagged VERIFIED or UNVERIFIED.
3. **Cross-model council** (`.claude/skills/cross-model-council/`). This adapts [llm-council](https://github.com/aiwithremy/claude-skills-llm-council). The 16 ideas were rewritten into one template, stripped of their source, and shuffled (`council/build_pool.py`, seed 20261003), so no judge could favor its own model's ideas. Five advisor lenses split across Claude and GPT, then anonymized peer review, then a chairman verdict. The full transcript is in `ideation/council/`.

## Key dates
- Sun 11:00 AM: DevPost submission due
- Sun 12:30 PM: judging
