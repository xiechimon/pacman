import {
  isLocalConnection,
  type LlmConnection,
} from '@config/llm-connections'

/**
 * Format token count for display (e.g., 1500 -> "1.5k", 200000 -> "200k").
 * Shared by the desktop model dropdown and the compact (drawer) model picker.
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}k`
  }
  return tokens.toString()
}

/**
 * Strip the "pi/" prefix from model IDs/display names so the user sees a
 * provider-agnostic label in the picker (e.g., "pi/claude-opus" → "claude-opus").
 */
export function stripPiPrefixForDisplay(value: string): string {
  return value.startsWith('pi/') ? value.slice(3) : value
}

export type ConnectionGroup = [groupName: string, connections: LlmConnection[]]

/**
 * Stable group identifiers returned by `groupConnectionsByProvider`.
 * Callers localize these via `t()` at render time (see CLAUDE.md i18n rules).
 * The internal keys are intentionally English/brand-stable; the displayed
 * labels are resolved against `t('onboarding.apiSetup.pacmanBackend')` etc.
 */
export type ConnectionGroupId = 'anthropic' | 'local' | 'pacman_backend'

/**
 * Resolve the user-facing label for a connection group id.
 * Anthropic and "Local" are kept as English literals (brand per CLAUDE.md i18n
 * rule); the Pacman group is translated so the brand name doesn't drift if
 * locales rename it.
 */
export function connectionGroupLabel(
  id: ConnectionGroupId,
  t: (key: string) => string,
): string {
  switch (id) {
    case 'anthropic':
      return 'Anthropic'
    case 'local':
      return 'Local'
    case 'pacman_backend':
      return t('onboarding.apiSetup.pacmanBackend')
  }
}

/**
 * Group connections by provider type for hierarchical picker rendering.
 * Each provider section can contain multiple connections (API Key, OAuth, …).
 * Order is significant for UI: anthropic, local, pacman_backend.
 * Empty groups are dropped. The first tuple element is a stable group id;
 * callers translate it via `t()` for display.
 */
export function groupConnectionsByProvider<T extends LlmConnection>(
  connections: readonly T[],
): Array<[ConnectionGroupId, T[]]> {
  const groups: Record<ConnectionGroupId, T[]> = {
    'anthropic': [],
    'local': [],
    'pacman_backend': [],
  }
  for (const conn of connections) {
    const provider = conn.providerType || 'anthropic'
    if (provider === 'anthropic') {
      groups['anthropic'].push(conn)
    } else if (provider === 'pi_compat' && isLocalConnection(conn)) {
      groups['local'].push(conn)
    } else if (provider === 'pi' || provider === 'pi_compat') {
      groups['pacman_backend'].push(conn)
    }
  }
  return (Object.entries(groups) as Array<[ConnectionGroupId, T[]]>).filter(
    ([, conns]) => conns.length > 0,
  )
}
