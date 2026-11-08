# opencode-anon-turn

OpenCode plugin: send a prompt now, keep only the answer. The question is dropped from context after the turn.

## What it does

- Your instruction runs as a normal turn — tools, edits, commands all work.
- The answer lands in the conversation like any other reply.
- On the next prompt, **your text becomes `(omitted)`**.
- Also scrubs the turn's reasoning blocks and tool call inputs/outputs (URLs, file paths, pasted data).
- Transcript still shows what you typed. Model context does not.

## Install

```bash
# Global (all projects)
opencode plugin add https://github.com/hussainbiedouh/opencode-anon-turn

# Or local: drop this repo in ~/.config/opencode/plugins/anon-turn
# then add "./plugins/anon-turn" to plugins in opencode.jsonc
```

Restart OpenCode after install.

## Usage

### GUI / TUI (slash command)

```
/anon continue
/anon fix the failing test, keep the assertion
/anon <paste 500-line log> find the bug
```

### TUI / headless (prefix)

```bash
//continue
>>fix the test
;;<paste log>
```

Prefixes: `//`, `>>`, `;;`. Change with `ANON_TURN_PREFIX` env var.

## How it works

| Hook | What it does |
|------|--------------|
| `session.hook("prompt")` | Strips prefix, tags message `anonTurn: true` |
| `session.hook("context")` | Before each model call: replaces tagged user text with `(omitted)`, drops reasoning, scrubs tool-call inputs and tool-result outputs |
| `session.hook("compaction")` | Same scrub for summaries |
| `ctx.command.transform` | Registers `/anon` command |

The tag is stored in the message metadata, so scrubbing applies retroactively to existing sessions.

## Example

```
You:     /anon codeword is mango
Model:   Got it — mango noted.
You:     what is the codeword?
Model:   (omitted)  ← no idea, the question is gone
```

## Comparison with `/btw`

OpenCode's `/btw` asks a side question using session context and shows the answer in a dialog — nothing is added to the conversation and it cannot run tools or make changes. `/anon` is the opposite: it runs as a real turn (tools, edits, everything), keeps the answer in chat, then scrubs the question and its tool evidence from future context.

| | `/btw` | `/anon` |
|---|---|---|
| Runs tools | ❌ | ✅ |
| Answer kept in chat | ❌ (dialog only) | ✅ |
| Question kept | ❌ | ❌ (scrubbed next turn) |
| Tool evidence kept | N/A | ❌ (scrubbed) |

## License

MIT