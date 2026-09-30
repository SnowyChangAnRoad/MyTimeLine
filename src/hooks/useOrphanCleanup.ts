import { useCallback, useState } from 'react'
import { listOrphanPhotos, removePhotos } from '../lib/photoFiles'
import type { TimelineEvent } from '../types'
import { readDiskEvents } from './useFileSystem'

export type OrphanCleanState = 'idle' | 'scanning' | 'confirm' | 'cleaning'

export interface UseOrphanCleanupResult {
  state: OrphanCleanState
  /** confirm 态下待删除的张数，其余状态为 null */
  count: number | null
  /** 扫描或删除的结果说明，没有要说的就是 null */
  message: string | null
  /** idle 时点击开始扫描；confirm 时点击执行删除 */
  onPrimaryAction: () => void
  /** confirm 态下取消，回到 idle */
  onCancel: () => void
}

/**
 * 「清空未引用图片」的流程：扫描 → 确认 → 删除。
 *
 * 未连接本地目录时没有可删的东西，App 不会渲染入口，所以这里直接返回。
 */
export function useOrphanCleanup(
  dirHandle: FileSystemDirectoryHandle | null,
  events: TimelineEvent[],
): UseOrphanCleanupResult {
  const [state, setState] = useState<OrphanCleanState>('idle')
  const [orphanSrcs, setOrphanSrcs] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const scan = useCallback(async () => {
    if (dirHandle === null) return
    setState('scanning')
    setMessage(null)

    try {
      // 保护集 = 内存里的数据 + 磁盘上的 data.json。自动保存是异步的，
      // 磁盘上还没被覆盖掉的引用同样算数，两边取并集才不会误删。
      const diskEvents = await readDiskEvents(dirHandle)
      const orphans = await listOrphanPhotos(dirHandle, [...events, ...diskEvents])

      if (orphans.length === 0) {
        setOrphanSrcs([])
        setState('idle')
        setMessage('没有可清理的图片')
        return
      }

      setOrphanSrcs(orphans)
      setState('confirm')
    } catch (error) {
      console.error(error)
      setOrphanSrcs([])
      setState('idle')
      setMessage(`扫描失败：${describeError(error)}`)
    }
  }, [dirHandle, events])

  const remove = useCallback(async () => {
    if (dirHandle === null || orphanSrcs.length === 0) return
    setState('cleaning')

    try {
      const removedCount = await removePhotos(dirHandle, orphanSrcs)
      setOrphanSrcs([])
      setState('idle')
      setMessage(`已删除 ${removedCount} 张未引用的图片`)
    } catch (error) {
      console.error(error)
      setOrphanSrcs([])
      setState('idle')
      setMessage(`删除失败：${describeError(error)}`)
    }
  }, [dirHandle, orphanSrcs])

  const onPrimaryAction = useCallback(() => {
    if (state === 'idle') void scan()
    else if (state === 'confirm') void remove()
  }, [state, scan, remove])

  const onCancel = useCallback(() => {
    setOrphanSrcs([])
    setState('idle')
  }, [])

  return {
    state,
    count: state === 'confirm' ? orphanSrcs.length : null,
    message,
    onPrimaryAction,
    onCancel,
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}