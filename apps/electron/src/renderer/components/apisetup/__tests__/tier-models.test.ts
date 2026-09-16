import { describe, expect, it } from 'bun:test'
import { pickTierDefaults, resolveTierModels } from '../tier-models'

/**
 * Synthetic GitHub Copilot model list, cost-sorted expensive-first.
 *
 * Mirrors what the user sees in the catalog: ~10 enabled models per
 * Copilot OAuth flow. `mai-code-1.1-flash` is the model the user reports
 * as being silently picked as `default_` even though their tier rejects it.
 */
const COPILOT_CATALOG = [
  { id: 'claude-opus-4-6',         name: 'Claude Opus 4.6',         costInput: 15, costOutput: 75, contextWindow: 200_000, reasoning: true  },
  { id: 'gpt-5.6',                 name: 'GPT-5.6',                 costInput:  5, costOutput: 25, contextWindow: 200_000, reasoning: true  },
  { id: 'claude-sonnet-4-6',       name: 'Claude Sonnet 4.6',       costInput:  3, costOutput: 15, contextWindow: 200_000, reasoning: true  },
  { id: 'gpt-5.4',                 name: 'GPT-5.4',                 costInput:  3, costOutput: 12, contextWindow: 200_000, reasoning: true  },
  { id: 'mai-code-1.1-flash',      name: 'mai-code 1.1 (flash)',    costInput:  1, costOutput:  4, contextWindow: 128_000, reasoning: false },
  { id: 'gpt-5.4-mini',            name: 'GPT-5.4 mini',            costInput:  0.5, costOutput: 2, contextWindow: 128_000, reasoning: false },
  { id: 'claude-haiku-4-5',        name: 'Claude Haiku 4.5',        costInput:  0.4, costOutput: 2, contextWindow: 128_000, reasoning: false },
  { id: 'gpt-5.2-mini',            name: 'GPT-5.2 mini',            costInput:  0.3, costOutput: 1.5, contextWindow: 128_000, reasoning: false },
  { id: 'gemini-2.5-flash',        name: 'Gemini 2.5 Flash',        costInput:  0.2, costOutput: 1, contextWindow: 128_000, reasoning: false },
  { id: 'mai-code-mini',           name: 'mai-code mini',           costInput:  0.1, costOutput: 0.5, contextWindow: 64_000,  reasoning: false },
]

/** Models known to be accepted by the lowest common Copilot subscription tier. */
const STABLE_DEFAULTS = ['gpt-5.4-mini', 'claude-haiku-4-5']

describe('pickTierDefaults — Copilot catalog', () => {
  it('returns the cheap end as `cheap` tier', () => {
    const defaults = pickTierDefaults(COPILOT_CATALOG)
    expect(defaults.cheap).toBe('mai-code-mini')
  })

  it('returns the expensive head as `best` tier', () => {
    const defaults = pickTierDefaults(COPILOT_CATALOG)
    expect(defaults.best).toBe('claude-opus-4-6')
  })

  // RED: the user reports `default_` lands on `mai-code-1.1-flash`, which
  // their tier rejects. The current cost-based picker (~40% from top)
  // happens to land there for this 10-row catalog. After the fix this
  // assertion flips to point at one of the stable models.
  it('does NOT pick a tier-rejected model as `default_` when stable defaults are available', () => {
    const defaults = pickTierDefaults(COPILOT_CATALOG, STABLE_DEFAULTS)
    expect(STABLE_DEFAULTS).toContain(defaults.default_)
  })
})

describe('resolveTierModels — saved selection survives when stable', () => {
  it('keeps a user-saved tier when the model is still in the catalog', () => {
    const resolved = resolveTierModels(COPILOT_CATALOG, ['gpt-5.4-mini', 'gpt-5.4-mini', 'gpt-5.4-mini'])
    expect(resolved.best).toBe('gpt-5.4-mini')
    expect(resolved.default_).toBe('gpt-5.4-mini')
    expect(resolved.cheap).toBe('gpt-5.4-mini')
  })
})
