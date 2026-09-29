import { useEffect, useState } from 'react'
import type { OpenPhotoHandler, TimelineEditActions, TimelineEvent } from '../types'
import { PhotoGrid } from './PhotoGrid'

const CARD_ACTION_CLASS =
  'text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'

interface EventCardProps {
  event: TimelineEvent
  onOpenPhoto: OpenPhotoHandler
  /** 只在编辑模式传入；不传就是纯阅读，卡片上没有按钮 */
  editActions?: TimelineEditActions
}

export function EventCard({ event, onOpenPhoto, editActions }: EventCardProps) {
  return (
    <article
      // 底部 Scrubber 靠这个属性反推「视口顶部当前是几月」，见 useTimelineScroll
      data-event-date={event.date}
      className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between gap-3">
        <time dateTime={event.date} className="font-mono text-xs tracking-wide text-neutral-500">
          {event.date}
        </time>

        {editActions !== undefined && (
          <span className="flex items-center gap-3">
            <button
              type="button"
              className={CARD_ACTION_CLASS}
              onClick={() => editActions.onEdit(event)}
            >
              编辑
            </button>
            <DeleteEventButton onConfirm={() => editActions.onDelete(event)} />
          </span>
        )}
      </div>

      {event.description !== '' && (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{event.description}</p>
      )}

      {event.photos.length > 0 && (
        <div className="mt-3">
          <PhotoGrid
            photos={event.photos}
            onOpen={(index) => onOpenPhoto(event.photos, index)}
          />
        </div>
      )}
    </article>
  )
}

/** 删除按钮：点一下变成「确认删除？」，再点才真删；停手 3 秒自动复原 */
function DeleteEventButton({ onConfirm }: { onConfirm: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    if (!isConfirming) return
    const timer = setTimeout(() => setIsConfirming(false), 3000)
    return () => clearTimeout(timer)
  }, [isConfirming])

  return (
    <button
      type="button"
      onClick={() => {
        if (isConfirming) {
          onConfirm()
          return
        }
        setIsConfirming(true)
      }}
      className={
        isConfirming
          ? 'text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
          : CARD_ACTION_CLASS
      }
    >
      {isConfirming ? '确认删除？' : '删除'}
    </button>
  )
}
