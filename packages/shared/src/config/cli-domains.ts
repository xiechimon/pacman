export type CliDomainNamespace = 'label' | 'source' | 'skill' | 'automation' | 'permission' | 'theme'

export interface CliDomainPolicy {
  namespace: CliDomainNamespace
  helpCommand: string
  workspacePathScopes: string[]
  readActions: string[]
  quickExamples: string[]
  /** Optional workspace-relative paths guarded for direct Bash operations */
  bashGuardPaths?: string[]
}

const POLICIES: Record<CliDomainNamespace, CliDomainPolicy> = {
  label: {
    namespace: 'label',
    helpCommand: 'pacman label --help',
    workspacePathScopes: ['labels/**'],
    readActions: ['list', 'get', 'auto-rule-list', 'auto-rule-validate'],
    quickExamples: [
      'pacman label list',
      'pacman label create --name "Bug" --color "accent"',
      'pacman label update bug --json \'{"name":"Bug Report"}\'',
    ],
    bashGuardPaths: ['labels/**'],
  },
  source: {
    namespace: 'source',
    helpCommand: 'pacman source --help',
    workspacePathScopes: ['sources/**'],
    readActions: ['list', 'get', 'validate', 'test', 'auth-help'],
    quickExamples: [
      'pacman source list',
      'pacman source get <slug>',
      'pacman source update <slug> --json "{...}"',
      'pacman source validate <slug>',
    ],
  },
  skill: {
    namespace: 'skill',
    helpCommand: 'pacman skill --help',
    workspacePathScopes: ['skills/**'],
    readActions: ['list', 'get', 'validate', 'where'],
    quickExamples: [
      'pacman skill list',
      'pacman skill get <slug>',
      'pacman skill update <slug> --json "{...}"',
      'pacman skill validate <slug>',
    ],
  },
  automation: {
    namespace: 'automation',
    helpCommand: 'pacman automation --help',
    workspacePathScopes: ['automations.json', 'automations-history.jsonl'],
    readActions: ['list', 'get', 'validate', 'history', 'last-executed', 'test', 'lint'],
    quickExamples: [
      'pacman automation list',
      'pacman automation create --event UserPromptSubmit --prompt "Summarize this prompt"',
      'pacman automation update <id> --json "{\"enabled\":false}"',
      'pacman automation history <id> --limit 20',
      'pacman automation validate',
    ],
    bashGuardPaths: ['automations.json', 'automations-history.jsonl'],
  },
  permission: {
    namespace: 'permission',
    helpCommand: 'pacman permission --help',
    workspacePathScopes: ['permissions.json', 'sources/*/permissions.json'],
    readActions: ['list', 'get', 'validate'],
    quickExamples: [
      'pacman permission list',
      'pacman permission get --source linear',
      'pacman permission add-mcp-pattern "list" --comment "All list ops" --source linear',
      'pacman permission validate',
    ],
    bashGuardPaths: ['permissions.json', 'sources/*/permissions.json'],
  },
  theme: {
    namespace: 'theme',
    helpCommand: 'pacman theme --help',
    workspacePathScopes: ['config.json', 'theme.json', 'themes/*.json'],
    readActions: ['get', 'validate', 'list-presets', 'get-preset'],
    quickExamples: [
      'pacman theme get',
      'pacman theme list-presets',
      'pacman theme set-color-theme nord',
      'pacman theme set-workspace-color-theme default',
      'pacman theme set-override --json "{\"accent\":\"#3b82f6\"}"',
    ],
    bashGuardPaths: ['config.json', 'theme.json', 'themes/*.json'],
  },
}

export const CLI_DOMAIN_POLICIES = POLICIES

export interface CliDomainScopeEntry {
  namespace: CliDomainNamespace
  scope: string
}

function dedupeScopes(scopes: string[]): string[] {
  return [...new Set(scopes)]
}

/**
 * Canonical workspace-relative path scopes owned by pacman CLI domains.
 * Use these for file-path ownership checks to avoid drift across call sites.
 */
export const PACMAN_AGENTS_CLI_OWNED_WORKSPACE_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.workspacePathScopes)
)

/**
 * Canonical workspace-relative path scopes guarded for direct Bash operations.
 */
export const PACMAN_AGENTS_CLI_OWNED_BASH_GUARD_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.bashGuardPaths ?? [])
)

/**
 * Namespace-aware workspace scope entries for pacman CLI owned paths.
 */
export const PACMAN_AGENTS_CLI_WORKSPACE_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => policy.workspacePathScopes.map(scope => ({ namespace: policy.namespace, scope })))

/**
 * Namespace-aware Bash guard scope entries.
 */
export const PACMAN_AGENTS_CLI_BASH_GUARD_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => (policy.bashGuardPaths ?? []).map(scope => ({ namespace: policy.namespace, scope })))

export interface BashPatternRule {
  pattern: string
  comment: string
}

/**
 * Derive the canonical Explore-mode read-only pacman bash patterns from
 * CLI domain policies. Keeps permissions regexes aligned with command metadata.
 */
export function getPacmanReadOnlyBashPatterns(): BashPatternRule[] {
  const namespaces = Object.keys(POLICIES) as CliDomainNamespace[]
  const namespaceAlternation = namespaces.join('|')

  const rules: BashPatternRule[] = namespaces.map((namespace) => {
    const policy = POLICIES[namespace]
    const actions = policy.readActions.join('|')
    return {
      pattern: `^pacman\\s+${namespace}\\s+(${actions})\\b`,
      comment: `pacman ${namespace} read-only operations`,
    }
  })

  rules.push(
    { pattern: '^pacman\\s*$', comment: 'pacman bare invocation (prints help)' },
    { pattern: `^pacman\\s+(${namespaceAlternation})\\s*$`, comment: 'pacman entity help' },
    { pattern: `^pacman\\s+(${namespaceAlternation})\\s+--help\\b`, comment: 'pacman entity help flags' },
    { pattern: '^pacman\\s+--(help|version|discover)\\b', comment: 'pacman global flags' },
  )

  return rules
}

export function getCliDomainPolicy(namespace: CliDomainNamespace): CliDomainPolicy {
  return POLICIES[namespace]
}
