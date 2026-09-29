import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createEmptyTimelineData,
  isTimelineData,
  type NewTimelineEvent,
  type TimelineData,
  type TimelineEvent,
  type TimelineEventPatch,
} from '../types'

/**
 * 数据读写接口，有两个实现：
 * - localStorageStore：还没选择数据目录时的临时暂存
 * - createFileSystemStore：读写用户选定的项目根目录下的 data.json
 */
export interface TimelineStore {
  /** 供界面展示的存储来源说明 */
  readonly label: string
  load: () => Promise<TimelineData>
  /**
   * 写入数据。返回值是「实际落盘的数据」：如果写之前发现 data.json 被
   * 页面外改过，会把外部新增的事件合并进去，此时返回值 ≠ 入参。
   */
  save: (data: TimelineData) => Promise<TimelineData>
}

const TEMP_STORAGE_KEY = 'personal-timeline:temp-data'
const DATA_FILE_NAME = 'data.json'

/** 未选择数据目录时的临时暂存，选了目录后以 data.json 为准 */
export const localStorageStore: TimelineStore = {
  label: '浏览器临时暂存',

  async load() {
    const raw = localStorage.getItem(TEMP_STORAGE_KEY)
    if (raw === null) return createEmptyTimelineData()
    return parseTimelineData(raw) ?? createEmptyTimelineData()
  },

  async save(data) {
    localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(data, null, 2))
    return data
  },
}

/** 时间轴统一按日期倒序（新 → 旧）；日期格式为 YYYY-MM-DD，字符串比较即时间先后 */
export function sortEventsByDateDesc(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * 读写用户选定的项目根目录：<root>/data.json 与 <root>/photos/。
 * 项目根目录 = 含 index.html 的目录，图片的相对路径靠 dev server / 静态服务器
 * 从根目录解析，所以选这里图片才能直接显示。
 */
export function createFileSystemStore(root: FileSystemDirectoryHandle): TimelineStore {
  /** 上一次写进磁盘的原文，用来判断这期间有没有被页面外改过 */
  let lastWritten: string | null = null
  /** 写操作串行化：并发写会让先写的内容被后写的盖掉 */
  let queue: Promise<TimelineData> = Promise.resolve(createEmptyTimelineData())

  async function readRaw(): Promise<string | null> {
    try {
      const handle = await root.getFileHandle(DATA_FILE_NAME)
      const file = await handle.getFile()
      return await file.text()
    } catch (error) {
      // 文件不存在是正常情况（首次使用），其它错误照实抛出
      if (error instanceof DOMException && error.name === 'NotFoundError') return null
      throw error
    }
  }

  async function writeOnce(data: TimelineData): Promise<TimelineData> {
    const raw = await readRaw()
    let result = data

    // raw === null：文件还不存在，直接写
    // raw === lastWritten：磁盘就是我们上次写的内容，没人动过
    // 其余情况：页面外改过，把磁盘上独有的事件合并进来，避免覆盖丢失
    if (raw !== null && raw !== lastWritten) {
      const fromDisk = parseTimelineData(raw)
      if (fromDisk !== null) {
        const known = new Set(data.events.map((event) => event.id))
        const incoming = fromDisk.events.filter((event) => !known.has(event.id))
        if (incoming.length > 0) {
          result = { events: sortEventsByDateDesc([...data.events, ...incoming]) }
          console.info(
            `[个人足迹] data.json 在页面外被改动过，已合并 ${incoming.length} 条外部事件`,
          )
        }
      }
    }

    const json = JSON.stringify(result, null, 2)
    const handle = await root.getFileHandle(DATA_FILE_NAME, { create: true })
    const writable = await handle.createWritable()
    await writable.write(json)
    await writable.close()
    lastWritten = json
    return result
  }

  return {
    label: `本地目录「${root.name}」`,

    async load() {
      const raw = await readRaw()

      if (raw === null) {
        // 目录里还没有 data.json：先把浏览器临时暂存里的内容当作初始数据，
        // 免得用户刚录入的东西凭空消失。注意不设 lastWritten，所以此时磁盘
        // 若是空的并不会触发「合并」，下一次真正修改时才落盘。
        const temp = await localStorageStore.load()
        if (temp.events.length > 0) {
          console.info(
            `[个人足迹] 该目录还没有 data.json，先沿用浏览器里的 ${temp.events.length} 条临时数据`,
          )
          return temp
        }
        return createEmptyTimelineData()
      }

      lastWritten = raw
      return parseTimelineData(raw) ?? createEmptyTimelineData()
    },

    save(data) {
      // 前一次无论成功失败都要继续排队，否则一次失败会卡死后续所有写入
      queue = queue.then(
        () => writeOnce(data),
        () => writeOnce(data),
      )
      return queue
    },
  }
}

function parseTimelineData(raw: string): TimelineData | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[个人足迹] 数据不是合法 JSON，已忽略')
    return null
  }
  if (!isTimelineData(parsed)) {
    console.warn('[个人足迹] 数据不符合数据模型，已忽略')
    return null
  }
  return parsed
}

export interface UseFileSystemResult {
  data: TimelineData
  /** 当前 store 是否已读取完成；未完成前不要写回，避免用空数据覆盖已有内容 */
  isReady: boolean
  storeLabel: string
  addEvent: (input: NewTimelineEvent) => TimelineEvent
  updateEvent: (id: string, patch: TimelineEventPatch) => void
  removeEvent: (id: string) => void
}

export function useFileSystem(store: TimelineStore = localStorageStore): UseFileSystemResult {
  const [data, setData] = useState<TimelineData>(createEmptyTimelineData)
  /**
   * 已加载完成的 store。换成别的 store（比如刚选完数据目录）时会自动变回
   * 「未就绪」，否则新目录读完之前，旧数据会被当成新目录的内容写进去。
   */
  const [readyStore, setReadyStore] = useState<TimelineStore | null>(null)
  /** 上一次落盘的数据；用来跳过「刚读完就回写」的那一次 */
  const lastSavedRef = useRef<TimelineData | null>(null)

  const isReady = readyStore === store

  useEffect(() => {
    let cancelled = false
    lastSavedRef.current = null

    void store.load().then((loaded) => {
      if (cancelled) return
      setData({ events: sortEventsByDateDesc(loaded.events) })
      setReadyStore(store)
    })

    return () => {
      cancelled = true
    }
  }, [store])

  // 每次修改后自动写回（PRD：自动保存）
  useEffect(() => {
    if (!isReady) return

    // 刚读完不写回：此刻 data 就是刚从磁盘读出来的内容，写回去没有意义；
    // 更要紧的是「读取失败 → 空数据」时写回会把磁盘上的文件覆盖掉
    if (lastSavedRef.current === null) {
      lastSavedRef.current = data
      return
    }
    if (lastSavedRef.current === data) return

    let cancelled = false
    void store.save(data).then((saved) => {
      if (cancelled) return
      lastSavedRef.current = saved
      // 发生过合并：把外部多出来的事件同步回内存，否则下次保存又会被盖掉
      if (saved !== data) setData(saved)
    })

    return () => {
      cancelled = true
    }
  }, [data, isReady, store])

  const addEvent = useCallback((input: NewTimelineEvent): TimelineEvent => {
    const event: TimelineEvent = { ...input, id: crypto.randomUUID() }
    setData((prev) => ({ events: sortEventsByDateDesc([...prev.events, event]) }))
    return event
  }, [])

  const updateEvent = useCallback((id: string, patch: TimelineEventPatch) => {
    setData((prev) => ({
      events: sortEventsByDateDesc(
        prev.events.map((event) => (event.id === id ? { ...event, ...patch } : event)),
      ),
    }))
  }, [])

  const removeEvent = useCallback((id: string) => {
    setData((prev) => ({
      events: prev.events.filter((event) => event.id !== id),
    }))
  }, [])

  return {
    data,
    isReady,
    storeLabel: store.label,
    addEvent,
    updateEvent,
    removeEvent,
  }
}
