import { useState } from 'react'
import type { OpenPhotoHandler, TimelineEditActions, TimelineEvent } from '../types'
import { EventCard } from './EventCard'

/** 左侧 1.5rem 是竖线槽，竖线由 Timeline 画在槽的正中 */
const ROW_GRID = 'grid grid-cols-[1.5rem_1fr] gap-x-4'

interface YearGroupProps {
  year: string
  events: TimelineEvent[]
  onOpenPhoto: OpenPhotoHandler
  editActions?: TimelineEditActions
}

export function YearGroup({ year, events, onOpenPhoto, editActions }: YearGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <section>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
        className={`${ROW_GRID} w-full items-center text-left`}
      >
        <span className="flex justify-center">
          <span className="size-3 rounded-full border-2 border-neutral-400 bg-white dark:border-neutral-500 dark:bg-neutral-950" />
        </span>
        <span className="flex items-baseline gap-2">
          <h2 className="text-lg font-medium tracking-wide">{year}</h2>
          <span className="text-xs text-neutral-400">{events.length} 条</span>
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={`size-3 self-center text-neutral-400 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          >
            <path
              d="M4 2.5 7.5 6 4 9.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div className={`${ROW_GRID} mt-4`}>
          <span />
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onOpenPhoto={onOpenPhoto}
                editActions={editActions}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
