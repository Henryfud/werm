# WERM, notes for Claude Code

WERM stands for Wiring-Encoded Recurrent Modulator. A 302 neuron network on the real *C. elegans* wiring diagram, a long scroll site, and a steering layer for local language models.

Read `HANDOFF.md` first. It has the audit you must do before building anything, the roadmap, and the rules.

## Commands

```bash
npm test                  # 9 pass, 1 todo (head touch reflex is a known weak result)
npm run build:site        # rebuilds site/index.html and site/artifact.html
node src/cli.mjs sim --stim touch-tail --seconds 3
node src/cli.mjs chat --model llama3.2     # needs Ollama
bash scripts/fetch_genome.sh               # needs internet, about 100 MB
```

## Rules

- No em dashes and no double hyphens in prose. Plain, human sounding sentences.
- No coin, token or financial feature. None was ever planned.
- Never invent a number, a sequence, an edge or a citation. Every figure traces to `docs/research/`.
- Citations marked "recall" in `docs/research/07-reading-list.md` must be verified before they appear in public copy.
- Do not push or create a repository without the user saying yes.
- Ask the user decisions as short multiple choice questions with a recommended first option.
- Keep the honest limits in the README and the notes. State them once, plainly.
- Do not copy Sorocarp (sorolabs.si). It was an example of the kind of project, not a template.
- `site/index.html` and `site/artifact.html` are generated. Edit `site/template.html` and rebuild.
- The source of truth for the model is `src/network.mjs`. The site inlines it at build time.
