'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, File, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { tryCreateClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type UploadStatus = 'idle' | 'uploading' | 'done' | 'paste-needed' | 'error'

const MAX_FILE_BYTES = 4 * 1024 * 1024

export function FileUploadZone({ onText }: { onText: (text: string) => void }) {
  const [drag, setDrag] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt')
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    const isDocx =
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.docx')

    if (!isTxt && !isPdf && !isDocx) {
      toast.error('Only PDF, DOCX, or TXT files are supported')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File is too large. Max 4MB.')
      return
    }

    setFileName(file.name)

    if (isTxt) {
      const text = await file.text()
      onText(text)
      setStatus('done')
      toast.success('Resume text extracted — ready to analyze')
      return
    }

    // PDF / DOCX — extract text server-side, fall back to manual paste only if extraction fails
    setStatus('uploading')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/resume/extract-text', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.message ?? data.error ?? 'Could not extract text from this file.')
        setStatus('paste-needed')
        return
      }

      onText(data.data.text)
      setStatus('done')
      toast.success('Resume text extracted — ready to analyze')

      // Also archive the original file in storage, best-effort
      try {
        const supabase = tryCreateClient()
        if (supabase) {
          const { data: userData } = await supabase.auth.getUser()
          if (userData.user) {
            // file.name is attacker-controlled — strip anything but safe extension chars
            // so a crafted name like "x.pdf/../../other-user" can't inject path segments.
            const rawExt = file.name.split('.').pop() ?? 'pdf'
            const ext = /^[a-zA-Z0-9]{1,10}$/.test(rawExt) ? rawExt : 'pdf'
            const path = `${userData.user.id}/${Date.now()}.${ext}`
            await supabase.storage.from('resumes').upload(path, file, {
              contentType: file.type,
              upsert: false,
            })
          }
        }
      } catch {
        // archival failure is non-fatal
      }
    } catch {
      setErrorMessage('Could not reach the server to extract text from this file.')
      setStatus('paste-needed')
    }
  }, [onText])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <File className="h-4 w-4 text-emerald-400 shrink-0" />
        <p className="text-xs text-emerald-400 flex-1 truncate">{fileName}</p>
        <Badge variant="success">Text extracted</Badge>
        <button onClick={() => { setStatus('idle'); setFileName(null) }} className="text-muted-foreground hover:text-foreground" aria-label="Remove file">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (status === 'paste-needed') {
    return (
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs font-medium text-amber-400">{fileName}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {errorMessage ?? 'Could not extract text automatically. Open your file, select all text (Cmd+A), and paste it in the box below.'}
        </p>
        <button onClick={() => { setStatus('idle'); setFileName(null); setErrorMessage(null) }} className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline">
          Try a different file
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-xl border-2 border-dashed p-6 transition-all duration-200 text-center cursor-pointer',
        drag
          ? 'border-brand-500/60 bg-brand-500/5'
          : 'border-border hover:border-brand-500/30 hover:bg-surface-200/40',
        status === 'uploading' && 'opacity-60 pointer-events-none',
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="flex flex-col items-center gap-2">
        {status === 'uploading' ? (
          <>
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-brand-400 animate-bounce" />
            </div>
            <p className="text-sm text-muted-foreground">Extracting text…</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-surface-300 flex items-center justify-center">
              <Upload className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Upload your resume</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">PDF, DOCX, or TXT · max 4MB · text extracted automatically</p>
            </div>
          </>
        )}
      </div>
    </button>
  )
}
