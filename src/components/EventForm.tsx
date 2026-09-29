import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { usePhotoDrafts, type PhotoDraftEntry } from '../hooks/usePhotoDrafts'
import { isDateString } from '../types'
import type { NewTimelineEvent, OpenPhotoHandler, TimelineEvent } from '../types'

dayjs.locale('zh-cn')

const FIELD_CLASS =
  'rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-500'

const BUTTON_CLASS =
  'rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'

const PRIMARY_BUTTON_CLASS =
  'rounded bg-neutral-900 px-4 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:disabled:hover:bg-neutral-100'

/** 表单内部的图片：比 Photo 多一个「本次新选的文件」 */
interface FormPhoto {
  src: string
  alt?: string
  /** 磁盘上还不存在的图片才有，靠草稿层给预览 */
  file?: File
}

interface EventFormProps {
  /** undefined / null 表示新建 */
  event: TimelineEvent | null
  /** 灯箱打开时忽略 Esc，免得一次按键把灯箱和表单一起关掉 */
  isPhotoViewerOpen: boolean
  /** 是否已经连上本地目录；没连上时新选的图片落不了盘 */
  hasDataDirectory: boolean
  /** 抛错表示保存失败，表单会留在原地显示错误，让用户重试 */
  onSubmit: (input: NewTimelineEvent) => Promise<void>
  onClose: () => void
  onOpenPhoto: OpenPhotoHandler
}

export function EventForm({
  event,
  isPhotoViewerOpen,
  hasDataDirectory,
  onSubmit,
  onClose,
  onOpenPhoto,
}: EventFormProps) {
  // 打开表单那一刻的快照，只用来判断「有没有改过」
  const [initial] = useState(() => ({
    date: event?.date ?? dayjs().format('YYYY-MM-DD'),
    description: event?.description ?? '',
    photos: (event?.photos ?? []) as FormPhoto[],
  }))

  const [date, setDate] = useState(initial.date)
  const [description, setDescription] = useState(initial.description)
  const [photos, setPhotos] = useState<FormPhoto[]>(initial.photos)
  const [isDiscardPending, setIsDiscardPending] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  /** 本次新选、还没写进磁盘的图片张数 */
  const pendingCount = photos.filter((photo) => photo.file !== undefined).length

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const { registerDrafts, dropDrafts } = usePhotoDrafts()

  const isDirty =
    date !== initial.date ||
    description !== initial.description ||
    !samePhotos(photos, initial.photos)

  const requestClose = useCallback(() => {
    // 有未保存的修改就先提示一次，再点/再按才真的关掉
    if (isDirty && !isDiscardPending) {
      setIsDiscardPending(true)
      return
    }
    onClose()
  }, [isDirty, isDiscardPending, onClose])

  useEffect(() => {
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape' || isPhotoViewerOpen) return
      keyEvent.preventDefault()
      requestClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPhotoViewerOpen, requestClose])

  const handlePickFiles = (pickEvent: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(pickEvent.target.files ?? [])
    // 清空 value，这样连着选同一个文件也能再触发 change
    pickEvent.target.value = ''
    if (files.length === 0) return

    // 同一批用同一个时间戳，靠序号区分，避免同一毫秒内重名
    const stamp = Date.now()
    const added: PhotoDraftEntry[] = files.map((file, index) => ({
      src: buildPhotoSrc(date, file.name, `${stamp}-${index + 1}`),
      file,
    }))

    // 先登记草稿再更新列表，保证这一帧就能拿到预览地址
    registerDrafts(added)
    setPhotos((prev) => [...prev, ...added])
  }

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate)
    if (!isDateString(nextDate)) return

    // 新选的图片还没落盘，改日期时把目录一起改掉，文件名（时间戳）保持不变
    const renamed: PhotoDraftEntry[] = []
    const nextPhotos = photos.map((photo) => {
      if (photo.file === undefined) return photo
      const src = movePhotoToDate(photo.src, nextDate)
      renamed.push({ src, file: photo.file })
      return { ...photo, src }
    })

    registerDrafts(renamed)
    setPhotos(nextPhotos)
  }

  const handleRemovePhoto = (index: number) => {
    const removed = photos[index]
    if (removed === undefined) return
    dropDrafts([removed.src])
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const resetDrag = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  const handleDrop = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      setPhotos((prev) => moveItem(prev, dragIndex, index))
    }
    resetDrag()
  }

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    if (!isDateString(date) || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      // file 只是表单内部用的，不进数据模型
      await onSubmit({
        date,
        description,
        photos: photos.map(({ src, alt }) => ({ src, alt })),
      })
    } catch (error) {
      // 保存失败（多半是图片写盘失败）时留在表单里：内容和图片草稿都还在，可以直接重试
      setSubmitError(error instanceof Error ? error.message : '保存失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-title"
      // 只有点在遮罩本身（而不是弹窗卡片）时才关闭
      onClick={(clickEvent) => {
        if (clickEvent.target === clickEvent.currentTarget) requestClose()
      }}
      className="fixed inset-0 z-40 overflow-y-auto bg-neutral-950/60 p-4 sm:p-8"
    >
      <div className="mx-auto w-full max-w-2xl rounded-md border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 id="event-form-title" className="text-xs tracking-[0.2em] text-neutral-400">
          {event === null ? '添加时间点' : '编辑时间点'}
        </h2>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="event-date" className="block text-xs text-neutral-500">
              日期
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <input
                id="event-date"
                type="date"
                required
                value={date}
                onChange={(changeEvent) => handleDateChange(changeEvent.target.value)}
                className={`${FIELD_CLASS} w-auto`}
              />
              <span className="text-xs text-neutral-400">
                {dayjs(date).isValid() ? dayjs(date).format('YYYY年M月D日 dddd') : '请选择日期'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="event-description" className="block text-xs text-neutral-500">
              说明
            </label>
            <textarea
              id="event-description"
              rows={5}
              autoFocus
              placeholder="这一天发生了什么…"
              value={description}
              onChange={(changeEvent) => setDescription(changeEvent.target.value)}
              className={`${FIELD_CLASS} mt-1.5 w-full resize-y leading-relaxed`}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-neutral-500">图片</span>
              <span className="text-xs text-neutral-400">{photos.length} 张</span>
            </div>

            {photos.length > 0 && (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((photo, index) => (
                  <FormPhotoItem
                    key={photo.src}
                    photo={photo}
                    index={index}
                    isDragging={dragIndex === index}
                    isDropTarget={overIndex === index && dragIndex !== index}
                    onDragStart={setDragIndex}
                    onDragEnter={(targetIndex) => {
                      if (dragIndex !== null && targetIndex !== dragIndex) setOverIndex(targetIndex)
                    }}
                    onDrop={handleDrop}
                    onDragEnd={resetDrag}
                    onRemove={() => handleRemovePhoto(index)}
                    onOpen={() => onOpenPhoto(photos, index)}
                  />
                ))}
              </ul>
            )}

            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
              选择图片（可多选）
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePickFiles}
              />
            </label>

            <p className="mt-2 text-xs text-neutral-400">
              拖动缩略图可调整顺序。
              {hasDataDirectory
                ? '保存时会写入 photos/日期/ 目录。'
                : '先在页头选择数据目录，图片才会写入 photos/日期/ 目录。'}
            </p>

            {pendingCount > 0 && !hasDataDirectory && (
              <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                这 {pendingCount} 张新选的图片只存在当前页面，刷新就会丢失。建议先在页头「选择数据目录」再保存。
              </p>
            )}
          </div>

          {submitError !== null && (
            <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {submitError}
            </p>
          )}

          {isDiscardPending && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <span>有未保存的修改，关闭后会丢失。</span>
              <span className="flex gap-3">
                <button
                  type="button"
                  className="underline"
                  onClick={() => setIsDiscardPending(false)}
                >
                  继续编辑
                </button>
                <button type="button" className="underline" onClick={onClose}>
                  放弃修改
                </button>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <span className="text-xs text-neutral-400">
              {event === null ? '保存后按日期插入时间轴' : '保存后立即更新这一条'}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className={BUTTON_CLASS}
                disabled={isSubmitting}
                onClick={requestClose}
              >
                取消
              </button>
              <button
                type="submit"
                className={PRIMARY_BUTTON_CLASS}
                disabled={!isDateString(date) || isSubmitting}
              >
                {isSubmitting ? '保存中…' : '保存'}
              </button>
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

interface FormPhotoItemProps {
  photo: FormPhoto
  index: number
  isDragging: boolean
  isDropTarget: boolean
  onDragStart: (index: number) => void
  onDragEnter: (index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
  onRemove: () => void
  onOpen: () => void
}

function FormPhotoItem({
  photo,
  index,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  onRemove,
  onOpen,
}: FormPhotoItemProps) {
  const { resolveSrc } = usePhotoDrafts()
  const [isFailed, setIsFailed] = useState(false)

  return (
    <li
      draggable
      onDragStart={(dragEvent) => {
        // Firefox 要求必须设置数据才会开始拖拽
        dragEvent.dataTransfer.effectAllowed = 'move'
        dragEvent.dataTransfer.setData('text/plain', String(index))
        onDragStart(index)
      }}
      onDragEnter={() => onDragEnter(index)}
      // 不阻止默认行为就不会触发 drop
      onDragOver={(dragEvent) => dragEvent.preventDefault()}
      onDrop={(dragEvent) => {
        dragEvent.preventDefault()
        onDrop(index)
      }}
      onDragEnd={onDragEnd}
      className={`group relative ${isDragging ? 'opacity-40' : ''} ${
        isDropTarget ? 'ring-2 ring-neutral-500' : ''
      }`}
    >
      {isFailed ? (
        <div className="flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded border border-dashed border-neutral-300 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-950">
          <span className="text-[10px] text-neutral-400">图片未加载</span>
        </div>
      ) : (
        <img
          src={resolveSrc(photo.src)}
          alt=""
          // 否则拖的会是图片本身，拿不到列表顺序
          draggable={false}
          onError={() => setIsFailed(true)}
          onClick={onOpen}
          className="aspect-square w-full cursor-zoom-in rounded object-cover"
        />
      )}

      <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-neutral-950/60 px-1.5 font-mono text-[10px] text-white">
        {index + 1}
      </span>

      <button
        type="button"
        aria-label={`移除第 ${index + 1} 张图片`}
        onClick={onRemove}
        className="absolute top-1 right-1 rounded bg-neutral-950/70 px-1.5 text-xs leading-5 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        ✕
      </button>
    </li>
  )
}

/** photos/YYYY-MM-DD/时间戳-序号.扩展名 */
function buildPhotoSrc(date: string, fileName: string, stamp: string): string {
  const dot = fileName.lastIndexOf('.')
  const extension = dot === -1 ? '' : fileName.slice(dot).toLowerCase()
  return `photos/${date}/${stamp}${extension}`
}

/** 把 photos/旧日期/文件名 换到新日期目录下，文件名不变 */
function movePhotoToDate(src: string, date: string): string {
  return `photos/${date}/${src.slice(src.lastIndexOf('/') + 1)}`
}

function samePhotos(a: FormPhoto[], b: FormPhoto[]): boolean {
  if (a.length !== b.length) return false
  return a.every((photo, index) => photo.src === b[index]?.src && photo.alt === b[index]?.alt)
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
