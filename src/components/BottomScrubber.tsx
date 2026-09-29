import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { TimelineEvent } from '../types'

const TICK_ATTRIBUTE = 'data-month-key'

interface MonthMarker {
  /** '2024-05' */
  key: string
  year: string
  /** '05' */
  month: string
  /** 该月是这一年的第一个刻度，用来在刻度上方标出年份 */
  isYearStart: boolean
}

/** 只取「有数据的月份」，等距排列，并翻转为 旧 → 新（左端最旧、右端最新） */
function buildMonthMarkers(events: TimelineEvent[]): MonthMarker[] {
  const seen = new Set<string>()
  const keys: string[] = []

  for (const event of events) {
    const key = event.date.slice(0, 7)
    if (seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  keys.reverse()

  return keys.map((key, index) => {
    const year = key.slice(0, 4)
    return {
      key,
      year,
      month: key.slice(5, 7),
      isYearStart: index === 0 || keys[index - 1].slice(0, 4) !== year,
    }
  })
}

/** 找出横坐标落在哪个刻度上；落在最右侧之外就返回最后一个刻度 */
function tickKeyAtX(strip: HTMLElement, clientX: number): string | null {
  let last: string | null = null

  for (const tick of strip.querySelectorAll<HTMLElement>(`[${TICK_ATTRIBUTE}]`)) {
    const key = tick.dataset.monthKey
    if (key === undefined) continue
    last = key
    if (tick.getBoundingClientRect().right > clientX) return key
  }

  return last
}

interface BottomScrubberProps {
  events: TimelineEvent[]
  activeMonthKey: string | null
  onJumpToMonth: (monthKey: string, behavior?: ScrollBehavior) => void
  /** 在刻度条上滚轮时，把位移交给主内容滚动（方向与主内容一致：向下滚 = 看更旧的） */
  onScrollBy: (deltaY: number) => void
}

export function BottomScrubber({
  events,
  activeMonthKey,
  onJumpToMonth,
  onScrollBy,
}: BottomScrubberProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const markers = buildMonthMarkers(events)

  // 让高亮刻度停在条的正中间，刻度多到溢出时也能看到当前位置
  useEffect(() => {
    const strip = stripRef.current
    if (strip === null || activeMonthKey === null) return

    const tick = strip.querySelector<HTMLElement>(`[${TICK_ATTRIBUTE}="${activeMonthKey}"]`)
    if (tick === null) return

    const stripRect = strip.getBoundingClientRect()
    const tickRect = tick.getBoundingClientRect()
    strip.scrollTo({
      left: strip.scrollLeft + (tickRect.left - stripRect.left) + tickRect.width / 2 - strip.clientWidth / 2,
      behavior: 'smooth',
    })
  }, [activeMonthKey])

  const jumpToPointer = (strip: HTMLElement, clientX: number) => {
    const key = tickKeyAtX(strip, clientX)
    if (key !== null) onJumpToMonth(key, 'auto')
  }

  // 按下即跳；按住拖动时靠 pointer capture 持续收到 move，实现边拖边跳
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    jumpToPointer(event.currentTarget, event.clientX)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    jumpToPointer(event.currentTarget, event.clientX)
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    onScrollBy(event.deltaY)
  }

  return (
    <div className="shrink-0 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* overflow-hidden 是刻意的：条本身不参与用户滚动，位置完全由高亮刻度驱动 */}
      <div
        ref={stripRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onWheel={handleWheel}
        className="flex cursor-ew-resize touch-none overflow-hidden px-6 select-none"
      >
        {markers.map((marker) => {
          const isActive = marker.key === activeMonthKey
          return (
            <div
              key={marker.key}
              data-month-key={marker.key}
              className="flex min-w-14 flex-1 flex-col items-center pb-3"
            >
              <span className="flex h-4 items-center text-[10px] leading-none text-neutral-400">
                {marker.isYearStart ? marker.year : ''}
              </span>
              <span
                className={
                  isActive
                    ? 'text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100'
                    : 'text-xs leading-none text-neutral-400'
                }
              >
                {marker.month}
              </span>
              <span
                className={`mt-1.5 h-0.5 w-4 rounded-full ${
                  isActive ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-transparent'
                }`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
