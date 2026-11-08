import type { Plugin as PluginType } from "@opencode-ai/plugin"

/**
 * Anon turn: send a prompt now, keep only the answer later.
 *
 * A message starting with the prefix is delivered to the model as normal, but
 * on every later model request its user text is replaced with a stub. The
 * assistant answer stays untouched, so the conversation keeps its outcome but
 * not the instruction that started it.
 *
 * Prefixes default to ";;" and "//", and can be replaced with ANON_TURN_PREFIX.
 */

const PREFIXES = process.env.ANON_TURN_PREFIX ? [process.env.ANON_TURN_PREFIX] : ["//", ">>", ";;" ]
const TAG = "anonTurn"
const STUB = "(omitted)"

type Part = { type: string; text?: string; input?: unknown; result?: unknown; [key: string]: unknown }

type Msg = {
  id: string
  role: string
  content: Part[]
  metadata?: Record<string, unknown>
}

/** Replace every string leaf, keep object shape so the provider still accepts it. */
function scrub(value: unknown): unknown {
  if (typeof value === "string") return STUB
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrub(v)]))
  }
  return value
}

function scrubTurn(messages: Msg[], from: number) {
  for (let i = from; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === "user") break
    m.content = (m.content ?? [])
      .filter((p) => p.type !== "reasoning")
      .map((p) => {
        if (p.type === "tool-call") return { ...p, input: scrub(p.input) }
        if (p.type === "tool-result") return { ...p, result: scrub(p.result) }
        return p
      })
  }
}

function stripTagged(messages: Msg[]) {
  let lastUser = -1
  messages.forEach((m, i) => {
    if (m.role === "user") lastUser = i
  })
  messages.forEach((m, i) => {
    if (m.role !== "user") return
    if (m.metadata?.[TAG] !== true) return
    if (i === lastUser) return
    m.content = [{ type: "text", text: STUB }]
    scrubTurn(messages, i + 1)
  })
}

interface PluginDef {
  id: string
  setup: (ctx: any) => Promise<void> | void
}

const plugin: PluginDef = {
  id: "anon-turn",
  async setup(ctx: any) {
    await ctx.session.hook("prompt", (event: any) => {
      const text = String(event.prompt.text ?? "").trim().replace(/^"([\s\S]*)"$/, "$1")
      const prefix = PREFIXES.find((p) => text.startsWith(p))
      if (!prefix) return
      const body = text.slice(prefix.length).trimStart()
      if (!body) return
      event.prompt.text = body
      event.metadata = { ...event.metadata, [TAG]: true }
    })

    const hook = (event: { messages?: Msg[] }) => {
      if (!Array.isArray(event?.messages)) return
      stripTagged(event.messages)
    }

    await ctx.session.hook("context", hook)
    await ctx.session.hook("compaction", hook)

    await ctx.command.transform((editor: any) => {
      editor.add({
        name: "anon",
        description: "Ask without keeping the question: the answer stays in the conversation, your text is dropped after this turn.",
        execute: async ({ sessionID, prompt, delivery }: any) => {
          const text = String(prompt.text ?? "").trim()
          if (!text) return
          const mark = PREFIXES[0]
          const body = PREFIXES.some((p) => text.startsWith(p)) ? text : mark + text
          await ctx.session.prompt({ ...prompt, sessionID, text: body, delivery })
        },
      })
    })
  },
}

export default plugin
