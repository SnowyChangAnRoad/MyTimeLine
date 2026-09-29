import type { OpenPhotoHandler, TimelineEditActions, TimelineEvent } from '../types'
import { YearGroup } from './YearGroup'

const BUTTON_CLASS =
  'rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'

interface TimelineProps {
  events: TimelineEvent[]
  onOpenPhoto: OpenPhotoHandler
  onSelectDirectory?: () => void
  onCreateEvent?: () => void
  /** 只在编辑模式传入，透传到事件卡片 */
  editActions?: TimelineEditActions
}

interface EventYearGroup {
  year: string
  events: TimelineEvent[]
}

/** 传入的 events 已按日期倒序（见 useFileSystem），所以同一年的事件必然相邻 */
function groupByYear(events: TimelineEvent[]): EventYearGroup[] {
  const groups: EventYearGroup[] = []

  for (const event of events) {
    const year = event.date.slice(0, 4)
    const current = groups[groups.length - 1]
    if (current !== undefined && current.year === year) {
      current.events.push(event)
    } else {
      groups.push({ year, events: [event] })
    }
  }

  return groups
}

export function Timeline({
  events,
  onOpenPhoto,
  onSelectDirectory,
  onCreateEvent,
  editActions,
}: TimelineProps) {
  if (events.length === 0) {
    return <EmptyTimeline onSelectDirectory={onSelectDirectory} onCreateEvent={onCreateEvent} />
  }

  return (
    <div className="relative">
      {/* 竖线画在左侧 1.5rem 槽的正中，与 YearGroup 里的年份圆点对齐 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 flex w-6 justify-center"
      >
        <div className="w-px bg-neutral-200 dark:bg-neutral-800" />
      </div>

      <div className="space-y-10">
        {groupByYear(events).map((group) => (
          <YearGroup
            key={group.year}
            year={group.year}
            events={group.events}
            onOpenPhoto={onOpenPhoto}
            editActions={editActions}
          />
        ))}
      </div>
    </div>
  )
}

interface EmptyTimelineProps {
  onSelectDirectory?: () => void
  onCreateEvent?: () => void
}

function EmptyTimeline({ onSelectDirectory, onCreateEvent }: EmptyTimelineProps) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-neutral-300 px-6 py-20 text-center dark:border-neutral-700">
      <p className="text-sm text-neutral-500">这里还没有足迹</p>
      <p className="mt-2 max-w-sm text-sm text-neutral-400">
        选择一个数据目录读取 data.json，或者直接添加第一条记录。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={() => onSelectDirectory?.()}
        >
          选择数据目录
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={() => onCreateEvent?.()}>
          添加第一条足迹
        </button>
      </div>
    </div>
  )
}
