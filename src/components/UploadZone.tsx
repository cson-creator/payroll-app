'use client'
import { useState, useCallback } from 'react'

interface Props {
  label: string
  accept: string
  onFile: (file: File) => void
  status?: 'idle' | 'uploading' | 'success' | 'error'
  message?: string
}

export function UploadZone({ label, accept, onFile, status = 'idle', message }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  const borderColor = status === 'success' ? '#3B6D11' : status === 'error' ? '#A32D2D' : dragging ? '#185FA5' : '#C8C6BE'
  const bg = status === 'success' ? '#EAF3DE' : status === 'error' ? '#FCEBEB' : dragging ? '#E6F1FB' : '#FAFAF8'

  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{ display:'block', border:`1.5px dashed ${borderColor}`, borderRadius:6, padding:'16px 20px', cursor:'pointer', background:bg, transition:'all 0.15s' }}
    >
      <input type="file" accept={accept} onChange={handleChange} style={{ display:'none' }} />
      <div style={{ fontSize:12, fontWeight:600, color:'#5F5E5A', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:11, color: status==='error'?'#A32D2D': status==='success'?'#3B6D11':'#9A9890' }}>
        {message || (status === 'idle' ? 'Drag & drop or click to browse' : status === 'uploading' ? 'Uploading…' : '')}
      </div>
    </label>
  )
}