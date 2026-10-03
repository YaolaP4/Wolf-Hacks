---
name: cross-model-council
description: "Variant of llm-council that runs advisors and reviewers on two different model families (Claude sub-agents + GPT via the local Hermes CLI) with source-blinded inputs. Use for project decisions in this repo where self-preference bias or a shared blind spot would be costly: 'cross-council this', 'council with hermes'."
---

# Cross-model council

Same five lenses, peer review, and chairman as `.claude/skills/llm-council/SKILL.md`. It changes three things, each aimed at a specific bias.

1. **Self-preference bias.** LLM judges tend to rate text from their own model family higher. So when candidate ideas come from more than one model, strip the source labels and shuffle the IDs before any advisor sees them. Keep the ID-to-source map in `ideation/council/source_map.json` and reveal it only after the verdict.
2. **Shared blind spots.** Five lenses on one model still share that model's priors. So split the advisors across families:
   - Claude sub-agents: First Principles, Expansionist, Executor
   - GPT via Hermes: Contrarian, Outsider
   - Peer reviewers use the same split. Two reviewers are GPT. Reviewer letters are randomized.
3. **Hallucinated feasibility.** Every dataset an idea depends on is tagged VERIFIED (download confirmed by search or fetch) or UNVERIFIED. Advisors are told to treat UNVERIFIED data as missing. The chairman must flag any recommendation that rests on UNVERIFIED data.

## Running a GPT advisor

```bash
hermes -z "$(cat ideation/council/prompt_<lens>.md)" --reasoning high > ideation/council/out_<lens>.md
```

Hermes uses the provider set in `%LOCALAPPDATA%\hermes\config.yaml` (openai-codex). Run Hermes calls in the background, in parallel with the Claude sub-agents.

## Chairman
The chairman is a fresh Claude sub-agent. It does not see the source map. It gets the de-anonymized advisor lenses (the lens names only, not which model ran each) plus all reviews, and it uses the llm-council verdict structure.

## Output
Write everything to `ideation/council/`: the framed question, the 5 advisor outputs, the 5 reviews, the verdict, and the source map. Nothing gets deleted. The transcript is the audit trail.
