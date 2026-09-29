/**
 * 把用户选过的数据目录记下来，刷新后还能接着用。
 *
 * FileSystemDirectoryHandle 只有「结构化克隆」能保存，JSON 序列化不了，
 * 所以只能放 IndexedDB。这里所有失败都只降级成「不记忆」，不打断主流程。
 */
const DB_NAME = 'personal-timeline'
const DB_VERSION = 1
const STORE_NAME = 'directory-handles'
const HANDLE_KEY = 'data-directory'

export interface StoredDirectory {
  handle: FileSystemDirectoryHandle
  /** 目录名冗余存一份：还没授权时也要能显示「上次用的是『个人足迹』」 */
  name: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('打不开 IndexedDB'))
  })
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'))
    })
  } finally {
    db.close()
  }
}

export async function saveDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const stored: StoredDirectory = { handle, name: handle.name }
    await runRequest('readwrite', (store) => store.put(stored, HANDLE_KEY))
  } catch (error) {
    console.warn('[个人足迹] 记不住这个数据目录，刷新后需要重新选择', error)
  }
}

export async function loadDirectory(): Promise<StoredDirectory | null> {
  try {
    const stored = await runRequest<StoredDirectory | undefined>('readonly', (store) =>
      store.get(HANDLE_KEY),
    )
    return stored ?? null
  } catch (error) {
    console.warn('[个人足迹] 读不到上次的数据目录记录，按未选择处理', error)
    return null
  }
}

export async function clearDirectory(): Promise<void> {
  try {
    await runRequest('readwrite', (store) => store.delete(HANDLE_KEY))
  } catch (error) {
    console.warn('[个人足迹] 清除数据目录记录失败', error)
  }
}
