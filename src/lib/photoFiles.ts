import { isDateString, type TimelineEvent } from '../types'

export interface PendingPhotoWrite {
  /** 相对路径，形如 photos/2024-05-20/1730000000000-1.jpg */
  src: string
  file: File
}

const PHOTOS_DIR_NAME = 'photos'

/**
 * 把还没落盘的图片写进 <root>/photos/YYYY-MM-DD/ 下。
 *
 * 目录和文件名都从 src 里解析，保证 data.json 里记的相对路径和磁盘上的
 * 实际位置严格一致（第 6 步生成 src 时就已经把「目标位置」写好了）。
 */
export async function writePhotos(
  root: FileSystemDirectoryHandle,
  entries: PendingPhotoWrite[],
): Promise<void> {
  if (entries.length === 0) return

  const photosDir = await root.getDirectoryHandle(PHOTOS_DIR_NAME, { create: true })

  for (const { src, file } of entries) {
    const target = parsePhotoSrc(src)
    if (target === null) {
      console.warn(`[个人足迹] 图片路径不符合 photos/日期/文件名 的约定，跳过写入：${src}`)
      continue
    }

    const dateDir = await photosDir.getDirectoryHandle(target.date, { create: true })
    const fileHandle = await dateDir.getFileHandle(target.fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(file)
    await writable.close()
  }
}

/**
 * 找出 photos/ 下没有被引用、可以清掉的图片，返回它们的 src。
 *
 * 传进来的 events 应当把「所有可能的真相源」都算上（内存里的数据 + 磁盘上的
 * data.json）：自动保存是异步的，磁盘上残留的引用也算数，免得误删。
 */
export async function listOrphanPhotos(
  root: FileSystemDirectoryHandle,
  events: TimelineEvent[],
): Promise<string[]> {
  const photosDir = await getPhotosDir(root)
  if (photosDir === null) return []

  const referenced = new Set<string>()
  for (const event of events) {
    for (const photo of event.photos) referenced.add(photo.src)
  }

  const orphans: string[] = []
  for await (const [dateName, dateHandle] of photosDir.entries()) {
    if (dateHandle.kind !== 'directory') continue
    if (!isDateString(dateName)) {
      console.warn(`[个人足迹] photos/ 下的「${dateName}」不是 YYYY-MM-DD 目录，已跳过`)
      continue
    }

    for await (const [fileName, fileHandle] of dateHandle.entries()) {
      if (fileHandle.kind !== 'file') continue
      const src = `${PHOTOS_DIR_NAME}/${dateName}/${fileName}`
      if (parsePhotoSrc(src) === null) {
        console.warn(`[个人足迹] 无法还原成图片路径，已跳过：${src}`)
        continue
      }
      if (!referenced.has(src)) orphans.push(src)
    }
  }

  return orphans
}

/**
 * 删除给定 src 对应的磁盘文件，返回成功删掉的张数。
 * 单张失败（比如文件已被手动删除）不会中断整体，最后顺手清掉空的日期目录。
 */
export async function removePhotos(
  root: FileSystemDirectoryHandle,
  srcs: string[],
): Promise<number> {
  if (srcs.length === 0) return 0

  const photosDir = await getPhotosDir(root)
  if (photosDir === null) return 0

  // 按日期归并，同一个日期目录只取一次句柄
  const fileNamesByDate = new Map<string, string[]>()
  for (const src of srcs) {
    const target = parsePhotoSrc(src)
    if (target === null) continue
    const names = fileNamesByDate.get(target.date)
    if (names === undefined) fileNamesByDate.set(target.date, [target.fileName])
    else names.push(target.fileName)
  }

  let removedCount = 0
  for (const [date, fileNames] of fileNamesByDate) {
    let dateDir: FileSystemDirectoryHandle
    try {
      dateDir = await photosDir.getDirectoryHandle(date)
    } catch (error) {
      console.warn(`[个人足迹] 找不到日期目录 photos/${date}/，跳过`, error)
      continue
    }

    for (const fileName of fileNames) {
      try {
        await dateDir.removeEntry(fileName)
        removedCount += 1
      } catch (error) {
        console.warn(`[个人足迹] 删除失败：photos/${date}/${fileName}`, error)
      }
    }

    // 删空后把日期目录一并收拾掉；目录里还有图片时 removeEntry 会抛错，保留即可
    try {
      await photosDir.removeEntry(date)
    } catch (error) {
      console.debug(`[个人足迹] photos/${date}/ 还有其它图片，保留目录`, error)
    }
  }

  return removedCount
}

/** 取 photos/ 目录；还没有这个目录时返回 null（没有图片，也就没有孤儿） */
async function getPhotosDir(
  root: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await root.getDirectoryHandle(PHOTOS_DIR_NAME)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null
    throw error
  }
}

function parsePhotoSrc(src: string): { date: string; fileName: string } | null {
  const parts = src.split('/')
  const [prefix, date, fileName] = parts
  if (prefix !== PHOTOS_DIR_NAME || date === undefined || date === '' || !fileName) {
    return null
  }
  return { date, fileName }
}
