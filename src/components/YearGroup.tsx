import type { OpenPhotoHandler, TimelineEditActions, TimelineEvent } from '../types'
import { EventCard } from './EventCard'

/** 左侧 1.5rem 是竖线槽，竖线由 Timeline 画在槽的正中 */
const ROW_GRID = 'grid grid-cols-[1.5rem_1fr] gap-x-4'

/** 一年里的记录达到这个数量才按月再分组，否则月份标题比记录还多，反而更乱 */
const MONTH_FOLD_THRESHOLD = 10

interface YearGroupProps {
  year: string
  events: TimelineEvent[]
  /** 被折叠的 key 集合（年份如 2024，月份如 2024-03）；不在集合里就是展开 */
  collapsedKeys: Set<string>
  onToggleCollapsed: (key: string) => void
  onOpenPhoto: OpenPhotoHandler
  editActions?: TimelineEditActions
}

export function YearGroup({
  year,
  events,
  collapsedKeys,
  onToggleCollapsed,
  onOpenPhoto,
  editActions,
}: YearGroupProps) {
  const isExpanded = !collapsedKeys.has(year)
  const monthGroups = events.length >= MONTH_FOLD_THRESHOLD ? groupByMonth(events) : null

  return (
    <section>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => onToggleCollapsed(year)}
        className={`${ROW_GRID} w-full items-center text-left`}
      >
        <span className="flex justify-center">
          <span className="size-3 rounded-full border-2 border-neutral-400 bg-white dark:border-neutral-500 dark:bg-neutral-950" />
        </span>
        <span className="flex items-baseline gap-2">
          <h2 className="text-lg font-medium tracking-wide">{year}</h2>
          <span className="text-xs text-neutral-400">{events.length} 条</span>
          <CollapseArrow isExpanded={isExpanded} />
        </span>
      </button>

      {isExpanded &&
        (monthGroups === null ? (
          <EventList events={events} onOpenPhoto={onOpenPhoto} editActions={editActions} />
        ) : (
          <div className="mt-4 space-y-6">
            {monthGroups.map((group) => {
              const monthKey = `${year}-${group.month}`
              return (
                <MonthGroup
                  key={monthKey}
                  month={group.month}
                  events={group.events}
                  isExpanded={!collapsedKeys.has(monthKey)}
                  onToggle={() => onToggleCollapsed(monthKey)}
                  onOpenPhoto={onOpenPhoto}
                  editActions={editActions}
                />
              )
            })}
          </div>
        ))}
    </section>
  )
}

interface MonthGroupProps {
  /** '03' */
  month: string
  events: TimelineEvent[]
  isExpanded: boolean
  onToggle: () => void
  onOpenPhoto: OpenPhotoHandler
  editActions?: TimelineEditActions
}

/** 年份内部的月份子分组：视觉上比年份低一级，折叠状态与年份互不影响 */
function MonthGroup({
  month,
  events,
  isExpanded,
  onToggle,
  onOpenPhoto,
  editActions,
}: MonthGroupProps) {
  return (
    <section>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className={`${ROW_GRID} w-full items-center text-left`}
      >
        <span className="flex justify-center">
          <span className="size-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </span>
        <span className="flex items-baseline gap-2">
          <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            {Number(month)}月 · {events.length} 条
          </h3>
          <CollapseArrow isExpanded={isExpanded} />
        </span>
      </button>

      {isExpanded && <EventList events={events} onOpenPhoto={onOpenPhoto} editActions={editActions} />}
    </section>
  )
}

interface EventListProps {
  events: TimelineEvent[]
  onOpenPhoto: OpenPhotoHandler
  editActions?: TimelineEditActions
}

/** 卡片区：左侧空出竖线槽，卡片按日期倒序排列 */
function EventList({ events, onOpenPhoto, editActions }: EventListProps) {
  return (
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
  )
}

function CollapseArrow({ isExpanded }: { isExpanded: boolean }) {
  return (
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
  )
}

interface EventMonthGroup {
  month: string
  events: TimelineEvent[]
}

/** 传入的 events 已按日期倒序，所以同一个月的事件必然相邻 */
function groupByMonth(events: TimelineEvent[]): EventMonthGroup[] {
  const groups: EventMonthGroup[] = []

  for (const event of events) {
    const month = event.date.slice(5, 7)
    const current = groups[groups.length - 1]
    if (current !== undefined && current.month === month) {
      current.events.push(event)
    } else {
      groups.push({ month, events: [event] })
    }
  }

  return groups
}