import type { TimelineData } from '../types'

export interface PhotoManifestEntry {
  src: string
  /** 用户当初选的那张文件的原名，方便他对照着手动复制 */
  originalName: string
}

/** 降级方案之一：浏览器不支持本地目录时，把数据导成 data.json 让用户自己放 */
export function downloadTimelineData(data: TimelineData): void {
  downloadText('data.json', JSON.stringify(data, null, 2), 'application/json')
}

/** 降级方案之二：告诉用户每张图片该放到项目目录的哪个位置 */
export function downloadPhotoManifest(entries: PhotoManifestEntry[]): void {
  const lines = entries.map((entry) => `${entry.src}\t←\t${entry.originalName}`)
  const text = [
    '把左边的图片放到项目根目录下右边写的位置，放好后刷新页面即可看到。',
    '',
    ...lines,
    '',
  ].join('\n')
  downloadText('photos-manifest.txt', text, 'text/plain')
}

function downloadText(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
