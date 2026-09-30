import { useEffect, useRef, useState } from 'react'
import { usePhotoDrafts } from '../hooks/usePhotoDrafts'
import type { Photo } from '../types'

/** 一行固定 5 张；4 个 gap（0.5rem）共 2rem，所以每张宽 (100% - 2rem) / 5 */
const TILE_WIDTH_CLASS = 'w-[calc((100%-2rem)/5)] shrink-0'

interface PhotoGridProps {
  photos: Photo[]
  /** 点击第 index 张图 */
  onOpen: (index: number) => void
}

/** 图片网格：固定一行 5 张，超出横向滚动 */
export function PhotoGrid({ photos, onOpen }: PhotoGridProps) {
  const listRef = useRef<HTMLUListElement>(null)

  // React 的 onWheel 是 passive 监听，拦不了默认行为，只能自己挂原生监听
  useEffect(() => {
    const list = listRef.current
    if (list === null) return

    const handleWheel = (wheelEvent: WheelEvent) => {
      // 按住 Ctrl 是缩放，触控板的横向滚动（deltaY 为 0）交给浏览器默认行为
      if (wheelEvent.ctrlKey || wheelEvent.deltaY === 0) return

      const maxScrollLeft = list.scrollWidth - list.clientWidth
      // 只有横向还能往这个方向滚时才接管，滚到两端就放行，页面照常竖向滚动
      const canScroll =
        wheelEvent.deltaY < 0 ? list.scrollLeft > 0 : list.scrollLeft < maxScrollLeft
      if (!canScroll) return

      wheelEvent.preventDefault()
      list.scrollLeft += wheelEvent.deltaY
    }

    list.addEventListener('wheel', handleWheel, { passive: false })
    return () => list.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <ul
      ref={listRef}
      // overscroll-x-contain：横滑到头不带动页面竖向滚动
      className="flex gap-2 overflow-x-auto overscroll-x-contain"
    >
      {photos.map((photo, index) => (
        <li key={`${index}-${photo.src}`} className={TILE_WIDTH_CLASS}>
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
