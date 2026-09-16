import { registerCustomTheme, resolveTheme } from '@pierre/diffs'

const GLOBAL_THEME_KEY = '__craftShikiThemesRegistered__'

/**
 * Register pacman-dark / pacman-light Shiki themes once per runtime.
 * Prevents duplicate registration warnings during HMR or StrictMode re-mounts.
 */
export function registerCraftShikiThemes() {
  if (typeof globalThis === 'undefined') return
  const globalRef = globalThis as typeof globalThis & { [GLOBAL_THEME_KEY]?: boolean }
  if (globalRef[GLOBAL_THEME_KEY]) return
  globalRef[GLOBAL_THEME_KEY] = true

  registerCustomTheme('pacman-dark', async () => {
    const theme = await resolveTheme('pierre-dark')
    return { ...theme, name: 'pacman-dark', bg: 'transparent', colors: { ...theme.colors, 'editor.background': 'transparent' } }
  })

  registerCustomTheme('pacman-light', async () => {
    const theme = await resolveTheme('pierre-light')
    return { ...theme, name: 'pacman-light', bg: 'transparent', colors: { ...theme.colors, 'editor.background': 'transparent' } }
  })
}
