# Ideation record

This folder is the record of how we chose the project. The prompt files are kept exactly as they were sent to the models.

**Our brief.**
- Find a project for the Center for Geospatial Analytics track that is genuinely unique, has a real-world use, and scales.
- Reduce two specific failure modes of AI ideation: single-model bias (one model's favorite ideas winning by default) and hallucinated datasets.

**Our method.** We adapted the LLM Council skill (`.claude/skills/llm-council/`) into a cross-model version (`.claude/skills/cross-model-council/`), run with Claude and GPT (via Hermes):
1. Each model writes an idea pool independently, after first listing the predictable ideas for the track so they can be excluded.
2. Every dataset an idea depends on is checked against a live endpoint and tagged VERIFIED or UNVERIFIED.
3. All ideas are rewritten into one template, stripped of their source, and shuffled (`council/build_pool.py`).
4. Five advisor lenses judge the pool, split across both model families. Anonymized peer review follows, then a chairman verdict (`council/verdict.md`).

**Who wrote what.** The prompts in `prompts/` and `council/` were written by Claude from the brief and method above. The model outputs are saved unedited next to them.

**Outcome.** The three finalists are in `PROPOSALS.md`. We chose Culvert Combinations, which became Pinchpoint.
