import { useEffect, useState } from 'react'
import { usePhotoDrafts } from '../hooks/usePhotoDrafts'
import type { Photo } from '../types'

interface LightboxProps {
  photos: Photo[]
  /** 当前第几张，由上层持有（单一真相源），灯箱只负责算出下一张 */
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

const ARROW_CLASS =
  'absolute top-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-2xl leading-none text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'

export function Lightbox({ photos, index, onIndexChange, onClose }: LightboxProps) {
  const photo: Photo | undefined = photos[index]
  const hasMultiple = photos.length > 1

  // 键盘：Esc 关闭、左右箭头切换。用 window 级监听，不依赖焦点落在哪里
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (photos.length < 2) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault() // 否则可能连带滚动背后主内容
        onIndexChange((index - 1 + photos.length) % photos.length)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onIndexChange((index + 1) % photos.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, photos.length, onIndexChange, onClose])

  if (photo === undefined) return null

  const go = (step: number) => {
    onIndexChange((index + step + photos.length) % photos.length)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`图片 ${index + 1} / ${photos.length}`}
      // 只有点在背景本身（而不是图片或按钮）时才关闭
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 p-8"
    >
      {/* key 跟随 src 变化，切换图片时失败状态会跟着重置 */}
      <LightboxImage key={photo.src} photo={photo} />

      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label="上一张"
            onClick={() => go(-1)}
            className={`${ARROW_CLASS} left-4`}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={() => go(1)}
            className={`${ARROW_CLASS} right-4`}
          >
            ›
          </button>
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs text-neutral-400">
            {index + 1} / {photos.length}
          </p>
        </>
      )}
    </div>
  )
}

function LightboxImage({ photo }: { photo: Photo }) {
  const { resolveSrc } = usePhotoDrafts()
  const [isFailed, setIsFailed] = useState(false)

  if (isFailed) {
    return (
      <div className="flex flex-col items-center gap-2 rounded border border-dashed border-neutral-700 px-8 py-12 text-center">
        <span className="text-sm text-neutral-400">图片未加载</span>
        <span className="font-mono text-xs break-all text-neutral-500">{photo.src}</span>
      </div>
    )
  }

  return (
    <img
      src={resolveSrc(photo.src)}
      alt={photo.alt ?? ''}
      onError={() => setIsFailed(true)}
      className="max-h-full max-w-full object-contain"
    />
  )
}
