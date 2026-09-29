import { useState } from 'react'
import { usePhotoDrafts } from '../hooks/usePhotoDrafts'
import type { Photo } from '../types'

interface PhotoGridProps {
  photos: Photo[]
  /** 点击第 index 张图 */
  onOpen: (index: number) => void
}

/** 图片网格：窄屏 2 列，宽屏 3 列 */
export function PhotoGrid({ photos, onOpen }: PhotoGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((photo, index) => (
        <li key={`${index}-${photo.src}`}>
          <PhotoTile photo={photo} onOpen={() => onOpen(index)} />
        </li>
      ))}
    </ul>
  )
}

interface PhotoTileProps {
  photo: Photo
  onOpen: () => void
}

/**
 * 单张图片。加载失败时换成等尺寸占位块：图片文件被移动、改名或路径写错时
 * 网格不会塌掉，也能一眼看出是哪张图出了问题。占位块不可点，因为没东西可看。
 */
function PhotoTile({ photo, onOpen }: PhotoTileProps) {
  const { resolveSrc } = usePhotoDrafts()
  const [isFailed, setIsFailed] = useState(false)

  if (isFailed) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded border border-dashed border-neutral-300 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-900">
        <span className="text-[10px] text-neutral-400">图片未加载</span>
        <span className="line-clamp-2 text-center text-[10px] break-all text-neutral-400">
          {photo.src}
        </span>
      </div>
    )
  }

  return (
    <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in p-0">
      <img
        src={resolveSrc(photo.src)}
        alt={photo.alt ?? ''}
        loading="lazy"
        decoding="async"
        onError={() => setIsFailed(true)}
        className="aspect-square w-full rounded object-cover"
      />
    </button>
  )
}
