# What a Memory Preview Cannot Tell You: Ambiguity in AI Memory Permissions

**Start with [the single-column review PDF](paper/manuscript.pdf).** It has four pages of body text and one page of references. The full analysis is local and repeatable. [Changes and evidence for all ten requests](CHANGELOG.md) · [Claim ledger](CLAIMS.md) · [Author decisions](OPEN_QUESTIONS.md).

For a quick walkthrough, run `node ui/server.mjs 4199` in this directory and open http://127.0.0.1:4199/. The adaptive diagnostic lets you answer hypothetical requests and see the surviving rule count. The memory editor shows an allowed and a blocked recommendation. A separate expanded-rule panel lets you test a seven-day expiry and a delegated handoff. The demonstration uses fictional local state and no paid API requests. Quit with Ctrl+C.

Use [the reproduction guide](analysis/README.md) for the complete scripts, fixed seeds, cached model outputs and PDF build instructions. To review the dataset without predictions, use [the label worksheet](analysis/results/label-review.csv). To inspect the original full-size evidence, open [allowed](paper/figures/allow.png) and [blocked](paper/figures/block.png). The supplementary [two-pattern matrix](paper/figures/two-patterns.pdf) replaces the old twelve-row graphic. This edition is a single-column review draft. No changes were deployed or submitted to PCS.
