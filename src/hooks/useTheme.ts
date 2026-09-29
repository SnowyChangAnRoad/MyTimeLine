import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
/** 实际生效的主题：偏好为 system 时由系统偏好决定 */
export type ResolvedTheme = 'light' | 'dark'

/** 改这个键要同步改 index.html 里的防闪烁脚本 */
const STORAGE_KEY = 'personal-timeline:theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredPreference(): ThemePreference {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

export interface UseThemeResult {
  preference: ThemePreference
  theme: ResolvedTheme
  /** 三态循环：跟随系统 → 浅色 → 深色 → 跟随系统 */
  cycleTheme: () => void
}

export function useTheme(): UseThemeResult {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light',
  )

  // 偏好是「跟随系统」时，系统主题改了要跟着变
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const theme: ResolvedTheme = preference === 'system' ? systemTheme : preference

  // 挂到 <html> 上，dark: 变体（见 styles/index.css 的 @custom-variant）认这个类
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const cycleTheme = useCallback(() => {
    // 先在事件处理器里算好并落盘，不要在 setState 的更新函数里做副作用
    // （StrictMode 会双调用更新函数，写两次 localStorage）
    const next: ThemePreference =
      preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system'

    // 手动选过才记住；回到「跟随系统」就把记录删掉
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)

    setPreference(next)
  }, [preference])

  return { preference, theme, cycleTheme }
}
