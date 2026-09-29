import type { ThemePreference } from '../hooks/useTheme'

const BUTTON_CLASS =
  'rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'

const LABELS: Record<ThemePreference, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

const NEXT_LABELS: Record<ThemePreference, string> = {
  system: '浅色',
  light: '深色',
  dark: '跟随系统',
}

interface ThemeToggleProps {
  preference: ThemePreference
  onCycle: () => void
}

/** 右上角的主题开关：点一下在 跟随系统 → 浅色 → 深色 之间循环 */
export function ThemeToggle({ preference, onCycle }: ThemeToggleProps) {
  const hint = `主题：${LABELS[preference]}，点击切换为${NEXT_LABELS[preference]}`

  return (
    <button type="button" className={BUTTON_CLASS} onClick={onCycle} title={hint} aria-label={hint}>
      {LABELS[preference]}
    </button>
  )
}
