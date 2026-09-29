import { useCallback, useEffect, useMemo, useState } from 'react'
import { clearDirectory, loadDirectory, saveDirectory } from '../lib/directoryStore'
import { createFileSystemStore, localStorageStore, type TimelineStore } from './useFileSystem'

export interface PendingDirectory {
  handle: FileSystemDirectoryHandle
  name: string
}

export interface UseDirectoryResult {
  /** 当前使用的数据源：没选目录就是 localStorage 临时暂存 */
  store: TimelineStore
  /** 已选中的数据目录；还没选就是 null */
  dirHandle: FileSystemDirectoryHandle | null
  /** 浏览器是否支持 File System Access API（Chrome / Edge 支持） */
  isSupported: boolean
  pickDirectory: () => Promise<void>
  /** 上次用过、但这次刷新后还没拿到授权的目录；null 表示没有 */
  pendingDirectory: PendingDirectory | null
  /** 点一下接回上次的目录，必须在用户手势里调用 */
  restoreDirectory: () => Promise<void>
}

export function useDirectory(): UseDirectoryResult {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [pendingDirectory, setPendingDirectory] = useState<PendingDirectory | null>(null)

  // 纯前端应用，不做 SSR 判断
  const isSupported = window.showDirectoryPicker !== undefined

  // 刷新后接回上次的目录：有权限就直接用，用户无感；要重新授权就留个按钮
  // 等用户点一下（浏览器只认用户手势）；记录彻底失效就清掉，回到未连接。
  useEffect(() => {
    if (!isSupported) return

    let cancelled = false

    void loadDirectory().then(async (stored) => {
      if (cancelled || stored === null) return

      const { handle } = stored
      if (handle.queryPermission === undefined || handle.requestPermission === undefined) return

      let permission: PermissionState | null = null
      try {
        permission = await handle.queryPermission({ mode: 'readwrite' })
      } catch (error) {
        // 目录被删掉或改名之后句柄会失效
        console.warn('[个人足迹] 上次用的数据目录已经不可用了', error)
      }
      if (cancelled) return

      if (permission === 'granted') setDirHandle(handle)
      else if (permission === 'prompt') setPendingDirectory({ handle, name: stored.name })
      else await clearDirectory() // denied 或句柄失效：记录留着也没用
    })

    return () => {
      cancelled = true
    }
  }, [isSupported])

  const pickDirectory = useCallback(async () => {
    const picker = window.showDirectoryPicker
    if (picker === undefined) return

    let handle: FileSystemDirectoryHandle
    try {
      handle = await picker({
        // 让浏览器记住上次选的位置
        id: 'personal-timeline',
        mode: 'readwrite',
      })
    } catch (error) {
      // 用户在对话框里点了取消，不是错误
      if (error instanceof DOMException && error.name === 'AbortError') return
      throw error
    }

    setDirHandle(handle)
    setPendingDirectory(null)
    // 记住这个目录，下次刷新就不用再选
    void saveDirectory(handle)
  }, [])

  const restoreDirectory = useCallback(async () => {
    if (pendingDirectory === null) return

    const { handle, name } = pendingDirectory
    if (handle.requestPermission === undefined) return

    // 这一步之前不能有别的 await，否则会丢掉用户手势，浏览器不弹授权
    const permission = await handle.requestPermission({ mode: 'readwrite' })

    if (permission !== 'granted') {
      await clearDirectory()
      setPendingDirectory(null)
      throw new Error(`没有拿到「${name}」的访问权限，请重新选择数据目录`)
    }

    setDirHandle(handle)
    setPendingDirectory(null)
  }, [pendingDirectory])

  const store = useMemo<TimelineStore>(
    () => (dirHandle === null ? localStorageStore : createFileSystemStore(dirHandle)),
    [dirHandle],
  )

  return {
    store,
    dirHandle,
    isSupported,
    pickDirectory,
    pendingDirectory,
    restoreDirectory,
  }
}
