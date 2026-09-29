import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  PhotoDraftsContext,
  type PhotoDraft,
  type PhotoDraftEntry,
  type PhotoDraftsValue,
} from '../hooks/usePhotoDrafts'

export function PhotoDraftsProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, PhotoDraft>>(() => new Map())
  // 与 drafts 同步的影子副本：registerDrafts 要先看「这个 src 登记过没有」再算出新表，
  // 不能读 state（拿到的是旧值）。两个函数是唯一的写入方，因此始终一致。
  const draftsRef = useRef(drafts)

  const registerDrafts = useCallback((entries: PhotoDraftEntry[]) => {
    const pending = entries.filter((entry) => !draftsRef.current.has(entry.src))
    if (pending.length === 0) return

    const next = new Map(draftsRef.current)
    for (const { src, file } of pending) {
      next.set(src, { file, url: URL.createObjectURL(file) })
    }
    draftsRef.current = next
    setDrafts(next)
  }, [])

  const dropDrafts = useCallback((srcs: string[]) => {
    const next = new Map(draftsRef.current)
    let removed = false
    for (const src of srcs) {
      const draft = next.get(src)
      if (draft === undefined) continue
      URL.revokeObjectURL(draft.url)
      next.delete(src)
      removed = true
    }
    if (!removed) return
    draftsRef.current = next
    setDrafts(next)
  }, [])

  const value = useMemo<PhotoDraftsValue>(
    () => ({
      resolveSrc: (src) => drafts.get(src)?.url ?? src,
      getDraft: (src) => drafts.get(src),
      registerDrafts,
      dropDrafts,
    }),
    [drafts, registerDrafts, dropDrafts],
  )

  return <PhotoDraftsContext.Provider value={value}>{children}</PhotoDraftsContext.Provider>
}
