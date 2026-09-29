/**
 * File System Access API：showDirectoryPicker 和权限查询还没进 TypeScript 的 lib.dom，
 * 这里只补这几个口子。FileSystemDirectoryHandle / createWritable 等类型库里已有。
 */
interface Window {
  showDirectoryPicker?: (options?: {
    /** 让浏览器记住上次的位置 */
    id?: string
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}

interface FileSystemHandle {
  /**
   * 查当前权限，不弹窗。浏览器已实现但 lib.dom 未收录，用之前先判空。
   */
  queryPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  /**
   * 请求权限，会弹窗，必须在用户手势里同步调用，否则浏览器不理会。
   */
  requestPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
}
