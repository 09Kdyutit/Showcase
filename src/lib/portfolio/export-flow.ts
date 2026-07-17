export type ExportRequestResult<T> =
  | { kind: 'download'; payload: T }
  | { kind: 'pro-required' }
  | { kind: 'error'; message?: string }

interface ExportFlowDependencies<T> {
  lock: { current: boolean }
  isGenerating: boolean
  isPublishing: boolean
  setBusy: (busy: boolean) => void
  clearPendingSave: () => void
  flushEditorSave: () => Promise<boolean>
  requestExport: () => Promise<ExportRequestResult<T>>
  openPaywall: () => void
  markNotPro: () => void
  download: (payload: T) => Promise<void> | void
  reportError: (message: string) => void
}

export const EXPORT_SAVE_ERROR = 'Save your latest changes before exporting.'
export const EXPORT_GENERATING_ERROR = 'Wait for portfolio generation to finish before exporting.'
export const EXPORT_GENERIC_ERROR = 'Export failed'

export async function runPortfolioExport<T>({
  lock,
  isGenerating,
  isPublishing,
  setBusy,
  clearPendingSave,
  flushEditorSave,
  requestExport,
  openPaywall,
  markNotPro,
  download,
  reportError,
}: ExportFlowDependencies<T>): Promise<void> {
  if (lock.current || isPublishing) return
  if (isGenerating) {
    reportError(EXPORT_GENERATING_ERROR)
    return
  }

  // Set the ref before the first await so rapid repeat clicks cannot start a second flow.
  lock.current = true
  setBusy(true)
  try {
    clearPendingSave()
    if (!await flushEditorSave()) {
      reportError(EXPORT_SAVE_ERROR)
      return
    }

    // Client subscription state can be stale after an upgrade in another tab. Always
    // ask the ownership- and entitlement-enforcing export route before deciding whether
    // to download or show the Free upgrade choice.
    const result = await requestExport()
    if (result.kind === 'pro-required') {
      // The server remains authoritative. An edit can land while its response is in
      // flight, so flush once more before opening a dialog that can navigate away.
      clearPendingSave()
      if (!await flushEditorSave()) {
        reportError(EXPORT_SAVE_ERROR)
        return
      }
      markNotPro()
      openPaywall()
      return
    }
    if (result.kind === 'error') {
      reportError(result.message ?? EXPORT_GENERIC_ERROR)
      return
    }

    await download(result.payload)
  } catch {
    reportError(EXPORT_GENERIC_ERROR)
  } finally {
    lock.current = false
    setBusy(false)
  }
}
