# Reproduce the poster diagnostic

Run from the project root. Use Node 22+ (tested on Node 24), Python 3 with Pillow and reportlab, and an ACM-compatible LaTeX installation. For browser captures install Playwright and its Chromium browser, or point PLAYWRIGHT_MODULE at an installed Playwright package and CHROME_BIN at Chrome. For PDF audit install pypdf and Poppler. The original gate and fictional scenario tables are vendored in src. The packaged author workshop runs only on loopback, stores temporary synthetic sessions in memory and requires no API credentials.

```
node ui/server.mjs 4199
```

Open http://127.0.0.1:4199/ for the adaptive diagnostic; open /workshop for the desk editor. In the diagnostic, choose an event, answer allow/block, note the remaining candidates and undo the last answer. In the desk editor select direct fields, permit factual recall and same-task recommendation, preview, save and try the same and a different task. Ctrl+C stops the local process. Open /extended to test expiry, scoped preferences, handoff to another person and follow-up against the executable extension. This separate panel does not alter saved workshop rules.

```
node analysis/01-pairs.mjs
node analysis/02-reference.mjs
node analysis/03-space.mjs
node analysis/04-match.mjs
node analysis/05-leakage.mjs
node analysis/06-trials.mjs
python analysis/07-figures.py
node analysis/08-metrics.mjs
node analysis/09-identify.mjs
node analysis/10-previews.mjs
node analysis/robustness.mjs
node analysis/table-macros.mjs
python analysis/export.py
node analysis/verify-ui.mjs
```

The matcher and marker scripts replay the included cached responses before consulting the network. No key or payment is needed for replay. Cache digests identify the precise request. A fresh run is stochastic and costs money; use a separate working copy and a fresh explicit budget. Do not share a live run directory between simultaneous paid workers. The original run set a combined reservation cap of US$0.10. paid-ledger.json records reservations and billed costs. No credentials are included.

Build from paper/ with `latexmk -pdf manuscript.tex` or `tectonic manuscript.tex`. Review count is verified on the delivered PDF. The supplementary two-patterns.pdf encodes recall (0/1), recommendation scope (N/T/P) and preference (0/1); Y compatible, N excluded, -- inadmissible. Side-by-side Figure 1 is composed exclusively of complete saved browser views. Individually open allow.png and block.png for detail. Outcome counts are produced by the scripts above. Author-written prose quotes their tabulated results. Figures can differ slightly across font and browser versions.

**Design choices.** One-off and explicit results condition on the authored target, not the average over possible intended rules. Random is the exact expectation over 120 pairs without replacement. Adaptive allows any semantic request from the same 16 cells; tie order follows enumeration. Disagreement samples two distinct surviving rules uniformly and one of those cells uniformly; no traffic distribution was observed. Coherent baselines and expanded spaces have separate denominators. Word-for-word equality on full requests is a deliberately strict lexical baseline; it is distinct from the editor's equality on confirmed identifiers. Embeddings are 256-dimensional openai/text-embedding-3-small. Threshold is fitted only on six development families using F1 and the highest threshold at a tie. The judge saw shuffled anonymous text pairs without labels (seed 31415); the software oracle seed is 20261108. Marker checks use literal case-insensitive substring detection; all model outputs are fictional and auditable.

Primary reference URLs and IDs are recorded in 10-references.json and paper/references.bib. The three disputed arXiv IDs were checked at arxiv.org/abs/<ID>. The ACM DOI records were confirmed with Crossref; CIMemories was checked via ICLR proceedings. No absence-of-prior-art claim is made.

After building the paper, run `python analysis/validate.py` from the project root to check page count, figure descriptions, citations and numerical inputs.

## Synthetic coding check

Run `python analysis/compare-synthetic.py` to compare the archived decisions and rationales against the provisional labels. The coding input contained only shuffled pair texts, item IDs and empty answer fields. Codex had earlier conversation context about the aggregate study design and results. This was one AI coding pass with access to that context, not an independent human review. Same means the same concrete task, beneficiary and occasion. Different means a changed task, beneficiary or occasion. Unsure was available for unresolved cases. The scoring script verifies all 48 row identities and writes the item-level CSV. It replays the comparison, not fresh model generations. No API call is needed.
