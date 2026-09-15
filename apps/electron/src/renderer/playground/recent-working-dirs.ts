export type RecentDirScenario = 'none' | 'few' | 'many'

const RECENT_DIR_SCENARIO_DATA: Record<RecentDirScenario, string[]> = {
  none: [],
  few: [
    '/Users/demo/projects/pacman',
    '/Users/demo/projects/pacman/apps/electron',
    '/Users/demo/projects/pacman/packages/shared',
  ],
  many: [
    '/Users/demo/projects/pacman',
    '/Users/demo/projects/pacman/apps/electron',
    '/Users/demo/projects/pacman/apps/viewer',
    '/Users/demo/projects/pacman/apps/cli',
    '/Users/demo/projects/pacman/packages/shared',
    '/Users/demo/projects/pacman/packages/server-core',
    '/Users/demo/projects/pacman/packages/pi-agent-server',
    '/Users/demo/projects/pacman/packages/ui',
    '/Users/demo/projects/pacman/scripts',
  ],
}

/** Return a copy of the fixture list for the selected scenario. */
export function getRecentDirsForScenario(scenario: RecentDirScenario): string[] {
  return [...RECENT_DIR_SCENARIO_DATA[scenario]]
}
