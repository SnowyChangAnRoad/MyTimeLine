import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { TimelineEvent } from '../types'

/** 每个事件卡片上的锚点属性，见 EventCard */
const EVENT_DATE_ATTRIBUTE = 'data-event-date'

/** '2024-05-20' → '2024-05' */
export function monthKeyOf(date: string): string {
  return date.slice(0, 7)
}

export interface UseTimelineScrollResult {
  /** 视口顶部当前所在月份，如 '2024-05'；没有事件时为 null */
  activeMonthKey: string | null
  /** 跳到某个月份的第一条事件（events 已倒序，所以就是该月最新那条） */
  jumpToMonth: (monthKey: string, behavior?: ScrollBehavior) => void
  /** 把外部滚动量（如 Scrubber 上的滚轮）转成主内容的滚动 */
  scrollByDelta: (deltaY: number) => void
}

/**
 * 把「滚动容器的视口位置」翻译成「当前是几月」，并提供按月份跳转。
 * 高亮不靠 IntersectionObserver，而是滚动时直接量卡片位置：几十个节点，
 * 逻辑一眼能看懂，也不用维护可见集合。
 */
export function useTimelineScroll<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  events: TimelineEvent[],
): UseTimelineScrollResult {
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return

    let frame = 0

    const measure = () => {
      frame = 0
      const containerTop = container.getBoundingClientRect().top

      // 卡片是从新到旧排列的：从上往下找第一个「底边还没越过视口顶部」的卡片，
      // 它就是当前视口顶部那一条；若全都越过了（滚到底部留白），就取最后一条。
      let current: string | null = null
      for (const card of container.querySelectorAll<HTMLElement>(`[${EVENT_DATE_ATTRIBUTE}]`)) {
        const date = card.dataset.eventDate
        if (date === undefined) continue
        current = monthKeyOf(date)
        if (card.getBoundingClientRect().bottom > containerTop) break
      }

      setActiveMonthKey(current)
    }

    // 滚动回调每帧最多量一次，避免连续滚动时反复触发同步布局
    const onScroll = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(measure)
    }

    measure()
    container.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      container.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [containerRef, events])

  const jumpToEvent = useCallback(
    (date: string, behavior: ScrollBehavior) => {
      const container = containerRef.current
      if (container === null) return

      const card = container.querySelector<HTMLElement>(`[${EVENT_DATE_ATTRIBUTE}="${date}"]`)
      if (card === null) return

      // 用 rect 差值算，避免 offsetTop 依赖 offsetParent 带来的偏差
      const offset = card.getBoundingClientRect().top - container.getBoundingClientRect().top
      container.scrollTo({ top: container.scrollTop + offset, behavior })
    },
    [containerRef],
  )

  const jumpToMonth = useCallback(
    (monthKey: string, behavior: ScrollBehavior = 'smooth') => {
      const target = events.find((event) => monthKeyOf(event.date) === monthKey)
      if (target === undefined) return
      jumpToEvent(target.date, behavior)
    },
    [events, jumpToEvent],
  )

  const scrollByDelta = useCallback(
    (deltaY: number) => {
      containerRef.current?.scrollBy({ top: deltaY, behavior: 'auto' })
    },
    [containerRef],
  )

  return { activeMonthKey, jumpToMonth, scrollByDelta }
}
