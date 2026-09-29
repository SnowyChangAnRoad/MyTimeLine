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

function parsePhotoSrc(src: string): { date: string; fileName: string } | null {
  const parts = src.split('/')
  const [prefix, date, fileName] = parts
  if (prefix !== PHOTOS_DIR_NAME || date === undefined || date === '' || !fileName) {
    return null
  }
  return { date, fileName }
}
