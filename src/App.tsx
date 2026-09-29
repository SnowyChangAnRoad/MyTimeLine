import { useCallback, useRef, useState } from 'react'
import { BottomScrubber } from './components/BottomScrubber'
import { DataSourceBar } from './components/DataSourceBar'
import { EditToolbar } from './components/EditToolbar'
import { EventForm } from './components/EventForm'
import { Lightbox } from './components/Lightbox'
import { PhotoDraftsProvider } from './components/PhotoDraftsProvider'
import { ThemeToggle } from './components/ThemeToggle'
import { Timeline } from './components/Timeline'
import { useDirectory } from './hooks/useDirectory'
import { useFileSystem } from './hooks/useFileSystem'
import { usePhotoDrafts } from './hooks/usePhotoDrafts'
import { useTheme } from './hooks/useTheme'
import { useTimelineScroll } from './hooks/useTimelineScroll'
import { downloadPhotoManifest, downloadTimelineData } from './lib/backup'
import { writePhotos, type PendingPhotoWrite } from './lib/photoFiles'
import type {
  AppMode,
  NewTimelineEvent,
  OpenPhotoHandler,
  Photo,
  TimelineEditActions,
  TimelineEvent,
} from './types'

/** 表单的打开状态；eventId 为 null 表示新建 */
interface FormState {
  eventId: string | null
}

/** 草稿层要包在最外层，里面的组件才能拿到还没落盘的图片预览地址 */
function App() {
  return (
    <PhotoDraftsProvider>
      <TimelineApp />
    </PhotoDraftsProvider>
  )
}

function TimelineApp() {
  const { store, dirHandle, isSupported, pickDirectory, pendingDirectory, restoreDirectory } =
    useDirectory()
  const { data, isReady, storeLabel, addEvent, updateEvent, removeEvent } = useFileSystem(store)
  const { getDraft, dropDrafts } = usePhotoDrafts()
  const { preference: themePreference, cycleTheme } = useTheme()

  const [mode, setMode] = useState<AppMode>('read')
  const [formState, setFormState] = useState<FormState | null>(null)
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null)
  const [directoryError, setDirectoryError] = useState<string | null>(null)

  const handleOpenPhoto: OpenPhotoHandler = useCallback(
    (photos, index) => setLightbox({ photos, index }),
    [],
  )
  const closeLightbox = useCallback(() => setLightbox(null), [])

  // 主区自己滚动（不是 window 滚动），底部 Scrubber 才能作为普通底栏而不是 fixed
  const mainRef = useRef<HTMLDivElement>(null)
  const { activeMonthKey, jumpToMonth, scrollByDelta } = useTimelineScroll(mainRef, data.events)

  // 正在编辑的事件从 data 里现取，避免表单拿着过期副本
  const editingEvent =
    formState?.eventId == null
      ? null
      : (data.events.find((event) => event.id === formState.eventId) ?? null)

  const openCreateForm = () => {
    setMode('edit')
    setFormState({ eventId: null })
  }
  const openEditForm = useCallback((event: TimelineEvent) => {
    setFormState({ eventId: event.id })
  }, [])
  const handleDeleteEvent = useCallback(
    (event: TimelineEvent) => removeEvent(event.id),
    [removeEvent],
  )
  const closeForm = useCallback(() => setFormState(null), [])

  const editActions: TimelineEditActions | undefined =
    mode === 'edit' ? { onEdit: openEditForm, onDelete: handleDeleteEvent } : undefined

  const handleSubmitEvent = async (input: NewTimelineEvent) => {
    // 只把「还没写进磁盘」的图片挑出来落盘；已经在磁盘上的图片没有草稿
    const pending: PendingPhotoWrite[] = []
    for (const photo of input.photos) {
      const draft = getDraft(photo.src)
      if (draft !== undefined) pending.push({ src: photo.src, file: draft.file })
    }

    if (pending.length > 0 && dirHandle !== null) {
      // 写盘失败会抛出去，由表单显示错误并留在原地等重试
      await writePhotos(dirHandle, pending)
      // 写完就不再需要草稿预览了，释放掉，让页面直接读磁盘上的真实文件
      dropDrafts(pending.map((item) => item.src))
    }

    if (editingEvent === null) addEvent(input)
    else updateEvent(editingEvent.id, input)
    setFormState(null)
  }

  const handleModeChange = (nextMode: AppMode) => {
    setMode(nextMode)
    if (nextMode === 'read') setFormState(null)
  }

  const handlePickDirectory = async () => {
    setDirectoryError(null)
    try {
      await pickDirectory()
    } catch (error) {
      console.error(error)
      setDirectoryError(`选择目录失败：${describeError(error)}`)
    }
  }

  // 刷新后接回上次的数据目录；必须在点击事件里直接调用，否则浏览器不给授权
  const handleRestoreDirectory = async () => {
    setDirectoryError(null)
    try {
      await restoreDirectory()
    } catch (error) {
      console.error(error)
      setDirectoryError(describeError(error))
    }
  }

  // 降级方案：不支持本地目录时，导出数据和图片清单，由用户手动放入项目目录
  const handleExportData = () => {
    downloadTimelineData(data)
  }

  const handleExportManifest = () => {
    const pending: { src: string; originalName: string }[] = []
    for (const event of data.events) {
      for (const photo of event.photos) {
        const draft = getDraft(photo.src)
        if (draft !== undefined) pending.push({ src: photo.src, originalName: draft.file.name })
      }
    }

    if (pending.length === 0) {
      setDirectoryError('当前没有等待放置的图片（新选的图片已经写入磁盘，或页面刷新后草稿丢失）')
      return
    }
    setDirectoryError(null)
    downloadPhotoManifest(pending)
  }

  // 编辑中的事件被删掉时（eventId 找不到）就不再渲染表单
  const isFormOpen = formState !== null && (formState.eventId === null || editingEvent !== null)

  return (
    <div className="flex h-screen flex-col text-neutral-800 dark:text-neutral-200">
      <header className="shrink-0 px-6 pt-10 pb-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-sm tracking-[0.2em] text-neutral-400">个人足迹</h1>
            <div className="flex items-center gap-2">
              <ThemeToggle preference={themePreference} onCycle={cycleTheme} />
              <EditToolbar mode={mode} onModeChange={handleModeChange} onAddEvent={openCreateForm} />
            </div>
          </div>

          <DataSourceBar
            storeLabel={storeLabel}
            isConnected={dirHandle !== null}
            isSupported={isSupported}
            pendingDirectoryName={pendingDirectory?.name ?? null}
            errorMessage={directoryError}
            onPickDirectory={() => void handlePickDirectory()}
            onRestoreDirectory={() => void handleRestoreDirectory()}
            onExportData={handleExportData}
            onExportManifest={handleExportManifest}
          />
        </div>
      </header>

      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 pb-16">
          {isReady ? (
            <Timeline
              events={data.events}
              onOpenPhoto={handleOpenPhoto}
              onSelectDirectory={() => void handlePickDirectory()}
              onCreateEvent={openCreateForm}
              editActions={editActions}
            />
          ) : (
            <p className="text-sm text-neutral-400">读取中…</p>
          )}
        </div>
      </main>

      {data.events.length > 0 && (
        <BottomScrubber
          events={data.events}
          activeMonthKey={activeMonthKey}
          onJumpToMonth={jumpToMonth}
          onScrollBy={scrollByDelta}
        />
      )}

      {isFormOpen && (
        <EventForm
          key={editingEvent?.id ?? 'new'}
          event={editingEvent}
          isPhotoViewerOpen={lightbox !== null}
          hasDataDirectory={dirHandle !== null}
          onSubmit={handleSubmitEvent}
          onClose={closeForm}
          onOpenPhoto={handleOpenPhoto}
        />
      )}

      {lightbox !== null && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox({ photos: lightbox.photos, index })}
          onClose={closeLightbox}
        />
      )}
    </div>
  )
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export default App
