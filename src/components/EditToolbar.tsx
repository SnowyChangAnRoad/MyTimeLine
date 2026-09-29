import type { AppMode } from '../types'

const BUTTON_CLASS =
  'rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'

interface EditToolbarProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  onAddEvent: () => void
}

/** 右上角的模式切换；编辑模式下多出「添加时间点」和「完成」 */
export function EditToolbar({ mode, onModeChange, onAddEvent }: EditToolbarProps) {
  if (mode === 'read') {
    return (
      <button type="button" className={BUTTON_CLASS} onClick={() => onModeChange('edit')}>
        编辑模式
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        编辑模式
      </span>
      <button type="button" className={BUTTON_CLASS} onClick={onAddEvent}>
        添加时间点
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={() => onModeChange('read')}>
        完成
      </button>
    </div>
  )
}
