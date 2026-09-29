const BUTTON_CLASS =
  'rounded border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'

interface DataSourceBarProps {
  storeLabel: string
  /** 是否已经连上本地目录 */
  isConnected: boolean
  /** 浏览器是否支持 File System Access API */
  isSupported: boolean
  /** 上次用过、但这次刷新后还没授权的目录名；null 表示没有 */
  pendingDirectoryName: string | null
  errorMessage: string | null
  onPickDirectory: () => void
  onRestoreDirectory: () => void
  onExportData: () => void
  onExportManifest: () => void
}

/** 页头上的数据源说明：现在这份数据存在哪里，以及怎么切到本地目录 */
export function DataSourceBar({
  storeLabel,
  isConnected,
  isSupported,
  pendingDirectoryName,
  errorMessage,
  onPickDirectory,
  onRestoreDirectory,
  onExportData,
  onExportManifest,
}: DataSourceBarProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
      <span className="text-neutral-400">数据源</span>
      <span className={isConnected ? 'text-neutral-600 dark:text-neutral-300' : 'text-amber-600 dark:text-amber-400'}>
        {storeLabel}
      </span>

      {isSupported ? (
        <button type="button" className={BUTTON_CLASS} onClick={onPickDirectory}>
          {isConnected ? '更换数据目录' : '选择数据目录'}
        </button>
      ) : (
        <>
          <span className="text-neutral-400">当前浏览器不支持直接读写本地目录，可以：</span>
          <button type="button" className={BUTTON_CLASS} onClick={onExportData}>
            导出 data.json
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={onExportManifest}>
            导出图片清单
          </button>
        </>
      )}

      {pendingDirectoryName !== null && (
        <>
          <button type="button" className={BUTTON_CLASS} onClick={onRestoreDirectory}>
            恢复访问「{pendingDirectoryName}」
          </button>
          <span className="text-neutral-400">上次用的目录，需点一下重新授权</span>
        </>
      )}

      {!isConnected && pendingDirectoryName === null && (
        <span className="text-neutral-400">数据只存在浏览器里，图片刷新后会丢失</span>
      )}

      {errorMessage !== null && <span className="text-red-600 dark:text-red-400">{errorMessage}</span>}
    </div>
  )
}
