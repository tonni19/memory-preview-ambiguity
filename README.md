# What a Memory Preview Cannot Tell You: Ambiguity in AI Memory Permissions

Code, fixtures, results and the survey for the ACM IUI 2027 poster paper by Sadia Noman Tonni (United International University) and Nafis Fuad Shahid (Islamic University of Technology).

An assistant that remembers needs a rule for when it may reuse a memory, and an editor can confirm a rule by previewing one use it allows and one it blocks. This project enumerates every rule compatible with such a preview, measures what stays ambiguous, and tests which follow-up requests resolve it. A small pilot survey checks whether people can predict what the rule they saved will do.

The paper is [`research/paper/manuscript.pdf`](research/paper/manuscript.pdf).

## Contents

| Path | What it holds |
|---|---|
| `research/src/` | The permission gate, the fictional scenarios and the diagnostic |
| `research/analysis/` | Numbered scripts, their inputs, and every result file the paper reports (`results/`) |
| `research/paper/` | LaTeX source, figures and the built PDF |
| `research/CLAIMS.md` | Each claim in the paper next to the script and result file behind it |
| `research/ui/` | The prototype: memory editor and diagnostic |
| `survey/` | The pilot survey program (local, offline, no AI model) |
| `configuration/participant-information.example.txt` | The information shown to survey participants, with contact details removed |

## Reproduce the numbers

Requires Node.js 22 or later and Python 3 with Pillow, reportlab and pypdf. From `research/`:

```
node analysis/01-pairs.mjs
node analysis/02-reference.mjs
node analysis/03-space.mjs
node analysis/08-metrics.mjs
node analysis/09-identify.mjs
node analysis/10-previews.mjs
node analysis/robustness.mjs
python analysis/07-figures.py
python analysis/validate.py
```

The task-matching and model scripts (`04`, `05`, `06`) replay archived responses and need no API key; see `research/analysis/README.md`. Build the paper from `research/paper/` with `pdflatex`, `bibtex` and two more `pdflatex` runs.

## Run the prototype and the survey

```
node research/ui/server.mjs 4199      # diagnostic at http://127.0.0.1:4199/, editor at /workshop
node launch.mjs interface             # survey in practice mode
```

`launch.mjs survey` collects real responses and requires `configuration/participant-information.txt` (copy and complete the example file).

## Data

All scenarios are fictional. Survey responses are not published, because they include participants' written answers; `research/analysis/results/survey-pilot.json` holds the aggregate counts reported in the paper, produced by `analysis/11-survey-pilot.py`. No identifying information was collected.

## License

MIT, see [`LICENSE`](LICENSE). `research/paper/acmart.cls` and `ACM-Reference-Format.bst` are ACM's template files and keep their own licence.

## AI use

Generative AI tools (OpenAI Codex and Anthropic Claude) were used to write the code, author the fictional fixtures and provisional labels, run the archived model calls, and draft and edit the paper. The authors reviewed the work and are responsible for it.
