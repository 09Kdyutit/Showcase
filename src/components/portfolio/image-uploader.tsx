'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageUploaderProps {
  label: string
  value?: string | null
  slot: string
  onUpload: (url: string) => void
  onRemove: () => void
  className?: string
  aspectRatio?: 'square' | 'wide' | 'portrait'
  hint?: string
}

export function ImageUploader({ label, value, slot, onUpload, onRemove, className, aspectRatio = 'wide', hint }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const upload = useCallback(async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('slot', slot)
      const res = await fetch('/api/portfolio/upload-image', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
        return
      }
      onUpload(json.data.url)
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [slot, onUpload])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }, [upload])

  const aspectClass = aspectRatio === 'square' ? 'aspect-square' : aspectRatio === 'portrait' ? 'aspect-[3/4]' : 'aspect-video'

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-surface-300">{label}</label>
        {value && (
          <button onClick={onRemove} className="text-xs text-surface-500 hover:text-red-400 transition-colors flex items-center gap-1">
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>

      {value ? (
        <div className={cn('relative rounded-lg overflow-hidden border border-surface-700', aspectClass)}>
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs">
              <Upload className="h-3 w-3" /> Replace
            </div>
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'relative rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center',
            aspectClass,
            dragOver ? 'border-brand-400 bg-brand-400/5' : 'border-surface-700 hover:border-surface-500 bg-surface-800/30',
          )}>
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-surface-500" />
              <div className="text-xs text-surface-500">
                <span className="font-medium text-surface-300">Upload</span> or drag & drop
              </div>
              {hint && <div className="text-[10px] text-surface-600">{hint}</div>}
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" onChange={onFileChange} className="hidden" />
    </div>
  )
}
