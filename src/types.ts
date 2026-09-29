/** 一张图片。src 为相对路径，如 photos/2024-05-20/01.jpg */
export interface Photo {
  src: string
  alt?: string
}

/** 一个时间点 */
export interface TimelineEvent {
  id: string
  /** 格式必须为 YYYY-MM-DD，如 2024-05-20 */
  date: string
  description: string
  photos: Photo[]
}

/** data.json 的完整内容 */
export interface TimelineData {
  events: TimelineEvent[]
}

/** 新建时间点时由调用方提供的字段，id 由数据层生成 */
export type NewTimelineEvent = Omit<TimelineEvent, 'id'>

/** 编辑时间点时允许改动的字段，不含 id */
export type TimelineEventPatch = Partial<NewTimelineEvent>

/** 点击图片时，把「所在事件的图片列表 + 第几张」交给上层去打开灯箱 */
export type OpenPhotoHandler = (photos: Photo[], index: number) => void

/** 编辑模式下事件卡片上的操作；只在编辑模式传入，不传就是纯阅读 */
export interface TimelineEditActions {
  onEdit: (event: TimelineEvent) => void
  onDelete: (event: TimelineEvent) => void
}

/** 应用当前的交互模式 */
export type AppMode = 'read' | 'edit'

/** 每次都返回新对象，避免多处共享同一个数组 */
export function createEmptyTimelineData(): TimelineData {
  return { events: [] }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 判断字符串是不是合法的 YYYY-MM-DD */
export function isDateString(value: string): boolean {
  return DATE_PATTERN.test(value)
}

/**
 * 校验从外部读入的数据（data.json / localStorage）是否符合数据模型。
 * 守住这个边界，后面的组件就可以直接信任 data 的结构。
 */
export function isTimelineData(value: unknown): value is TimelineData {
  if (!isRecord(value)) return false
  return Array.isArray(value.events) && value.events.every(isTimelineEvent)
}

function isTimelineEvent(value: unknown): value is TimelineEvent {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    DATE_PATTERN.test(value.date) &&
    typeof value.description === 'string' &&
    Array.isArray(value.photos) &&
    value.photos.every(isPhoto)
  )
}

function isPhoto(value: unknown): value is Photo {
  if (!isRecord(value)) return false
  return (
    typeof value.src === 'string' &&
    (value.alt === undefined || typeof value.alt === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
