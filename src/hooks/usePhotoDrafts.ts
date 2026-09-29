import { createContext, useContext } from 'react'

/**
 * 图片草稿层。
 *
 * 用户在表单里新选的图片此刻还只是内存里的 File，磁盘上并不存在，
 * 但数据里只能存相对路径（如 photos/2024-05-20/1730000000000-1.jpg）。
 * 所以这里按「最终相对路径 → File」记一份草稿，渲染时优先用草稿的
 * 预览地址，路径本身保持不变；第 7 步拿到目录权限后直接把这些 File
 * 写进 photos/ 即可，数据不用改。
 *
 * 草稿仅存在于当前页面会话，刷新后预览失效（图片会显示为未加载占位）。
 */
export interface PhotoDraft {
  file: File
  /** URL.createObjectURL 生成的预览地址 */
  url: string
}

export interface PhotoDraftEntry {
  src: string
  file: File
}

export interface PhotoDraftsValue {
  /** 有草稿就返回草稿的预览地址，否则原样返回 src */
  resolveSrc: (src: string) => string
  /** 取草稿本身；图片已经落盘的话返回 undefined */
  getDraft: (src: string) => PhotoDraft | undefined
  /** 登记草稿；已登记过的 src 会跳过，重复调用是安全的 */
  registerDrafts: (entries: PhotoDraftEntry[]) => void
  /** 丢弃草稿并释放预览地址（图片被移出表单、或已经写进磁盘时调用） */
  dropDrafts: (srcs: string[]) => void
}

export const PhotoDraftsContext = createContext<PhotoDraftsValue | null>(null)

export function usePhotoDrafts(): PhotoDraftsValue {
  const value = useContext(PhotoDraftsContext)
  if (value === null) {
    throw new Error('usePhotoDrafts 必须在 PhotoDraftsProvider 内使用')
  }
  return value
}
