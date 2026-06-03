'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getCycleForDate, getCycleDates, shortDate, dowLabel } from '@/lib/cycle'
import { ReportPreview } from '@/components/ReportPreview'
import { UploadZone } from '@/components/UploadZone'
import { ReportData } from '@/types'
import { format, addDays, parseISO } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface CycleDay {
  date: string
  dow: string
  census: number | null
  empeonDepts: number
  shiftkeyRows: number
}

// ── Design tokens ────────────────────────────────────
const C = {
  bg: '#F7F5EE',
  bgStrip: '#F1EFE8',
  white: '#fff',
  border: '#E0DED6',
  borderMid: '#DDD9CF',
  text: '#2C2C2A',
  textSoft: '#3A3A38',
  textMuted: '#888780',
  textFaint: '#A8A69E',
  blue: '#185FA5',
  blueDark: '#0C447C',
  blueLight: '#E6F1FB',
  bluePale: '#EBF3FB',
  blueMid: '#B5D4F4',
  blueAccent: '#378ADD',
  green: '#3B6D11',
  greenLight: '#EAF3DE',
  red: '#A32D2D',
}

export default function Home() {
  const [facilities, setFacilities] = useState<any[]>([])
  const [selectedFacility, setSelectedFacility] = useState<any>(null)
  const [passcode, setPasscode] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')

  const { cycleStart, cycleEnd, dayNum } = getCycleForDate()
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd')
  const [uploadDate, setUploadDate] = useState(yesterday)

  const [empeonStatus, setEmpeonStatus] = useState<UploadStatus>('idle')
  const [empeonMsg, setEmpeonMsg] = useState('')
  const [shiftkeyStatus, setShiftkeyStatus] = useState<UploadStatus>('idle')
  const [shiftkeyMsg, setShiftkeyMsg] = useState('')

  const [census, setCensus] = useState<string>('')
  const [censusDate, setCensusDate] = useState(yesterday)
  const [censusSaved, setCensusSaved] = useState(false)

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [reportDate, setReportDate] = useState<string>(yesterday)
  const [loadingReport, setLoadingReport] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  const [showHistory, setShowHistory] = useState(false)
  const [historyDays, setHistoryDays] = useState<CycleDay[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editingCensus, setEditingCensus] = useState<string | null>(null)
  const [editingCensusVal, setEditingCensusVal] = useState<string>('')
  const [clearingDay, setClearingDay] = useState<string | null>(null)

  const reportRef = useRef<HTMLDivElement>(null)

  const cycleStartStr = format(cycleStart, 'yyyy-MM-dd')
  const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd')
  const cycleProgress = Math.round((dayNum / 14) * 100)

  useEffect(() => {
    supabase.from('facilities').select('*').eq('active', true).then(({ data }) => {
      if (data) setFacilities(data)
    })
  }, [])

  useEffect(() => {
    if (!selectedFacility || !authed || !censusDate) return
    setCensus('')
    setCensusSaved(false)
    supabase.from('daily_census').select('census').eq('facility_id', selectedFacility.id).eq('date', censusDate).single().then(({ data }) => {
      if (data) setCensus(String(data.census))
    })
  }, [selectedFacility, authed, censusDate])

  function handleSelectFacility(fac: any) {
    setSelectedFacility(fac)
    setAuthed(false)
    setPasscode('')
    setAuthError('')
    setReportData(null)
    setShowHistory(false)
    setHistoryDays([])
  }

  function handleAuth() {
    if (passcode === selectedFacility.passcode) {
      setAuthed(true)
      setAuthError('')
    } else {
      setAuthError('Incorrect passcode')
    }
  }

  function handleDateChange(date: string) {
    setUploadDate(date)
    setCensusDate(date)
    setCensusSaved(false)
    setReportData(null)
  }

  async function handleEmpeonUpload(file: File) {
    setEmpeonStatus('uploading')
    setEmpeonMsg('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('facilityId', selectedFacility.id)
    fd.append('date', uploadDate)
    const res = await fetch('/api/upload-empeon', { method: 'POST', body: fd })
    const json = await res.json()
    if (res.ok) {
      const unknown = json.unknownPositions as string[]
      const base = `✓ ${json.rowsIngested} departments ingested`
      const warn = unknown?.length > 0 ? ` · ⚠ Unknown: ${unknown.join(', ')}` : ''
      setEmpeonStatus(unknown?.length > 0 ? 'error' : 'success')
      setEmpeonMsg(base + warn)
    } else {
      setEmpeonStatus('error')
      setEmpeonMsg(json.error || 'Upload failed')
    }
  }

  async function handleShiftkeyUpload(file: File) {
    setShiftkeyStatus('uploading')
    setShiftkeyMsg('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('facilityId', selectedFacility.id)
    fd.append('date', uploadDate)
    const res = await fetch('/api/upload-shiftkey', { method: 'POST', body: fd })
    const json = await res.json()
    if (res.ok) {
      setShiftkeyStatus('success')
      setShiftkeyMsg(`✓ ${json.rowsIngested} agency rows ingested${json.note || ''}`)
    } else {
      setShiftkeyStatus('error')
      setShiftkeyMsg(json.error || 'Upload failed')
    }
  }

  async function handleSaveCensus() {
    const res = await fetch('/api/save-census', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId: selectedFacility.id, date: censusDate, census: parseInt(census) }),
    })
    if (res.ok) setCensusSaved(true)
  }

  async function handleLoadReport() {
    setLoadingReport(true)
    const res = await fetch(`/api/report-data?facilityId=${selectedFacility.id}&reportDate=${uploadDate}`)
    const data = await res.json()
    setReportData(data)
    setReportDate(uploadDate)
    setLoadingReport(false)
  }

  // ── Two-page PDF ─────────────────────────────────────
  async function generatePDF(): Promise<string> {
    const el = reportRef.current!
    const marker = el.querySelector('#page-break-marker') as HTMLElement | null
    const elRect = el.getBoundingClientRect()
    const markerRect = marker?.getBoundingClientRect()
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false })
    const scale = 2
    const splitY = marker && markerRect
      ? Math.round((markerRect.top - elRect.top) * scale)
      : Math.round(canvas.height * 0.55)
    const p1H = splitY
    const p2H = canvas.height - splitY
    const p1 = document.createElement('canvas')
    p1.width = canvas.width; p1.height = p1H
    p1.getContext('2d')!.drawImage(canvas, 0, 0, canvas.width, p1H, 0, 0, canvas.width, p1H)
    const p2 = document.createElement('canvas')
    p2.width = canvas.width; p2.height = p2H
    p2.getContext('2d')!.drawImage(canvas, 0, splitY, canvas.width, p2H, 0, 0, canvas.width, p2H)
    const pxW = canvas.width / scale
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pxW, p1H / scale] })
    pdf.addImage(p1.toDataURL('image/png'), 'PNG', 0, 0, pxW, p1H / scale)
    pdf.addPage([pxW, p2H / scale], 'portrait')
    pdf.addImage(p2.toDataURL('image/png'), 'PNG', 0, 0, pxW, p2H / scale)
    return pdf.output('datauristring').split(',')[1]
  }

  async function handleGeneratePDF() {
    setGeneratingPDF(true)
    const base64 = await generatePDF()
    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${base64}`
    link.download = `${selectedFacility.name.replace(/\s+/g, '_')}_Payroll_${reportDate}.pdf`
    link.click()
    setGeneratingPDF(false)
  }

  async function handleGenerateAndSend() {
    setSendingEmail(true)
    setEmailMsg('')
    const base64 = await generatePDF()
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId: selectedFacility.id, pdfBase64: base64, reportDate }),
    })
    const json = await res.json()
    if (res.ok) setEmailMsg('✓ Report sent successfully')
    else setEmailMsg(`✗ ${json.error}`)
    setSendingEmail(false)
  }

  // ── Cycle history ────────────────────────────────────
  async function loadHistory() {
    if (!selectedFacility) return
    setHistoryLoading(true)
    const dates = getCycleDates(cycleStart)
    const [{ data: censusRows }, { data: empeonRows }, { data: skRows }] = await Promise.all([
      supabase.from('daily_census').select('date,census').eq('facility_id', selectedFacility.id).gte('date', cycleStartStr).lte('date', cycleEndStr),
      supabase.from('daily_empeon').select('date,cc2_name').eq('facility_id', selectedFacility.id).gte('date', cycleStartStr).lte('date', cycleEndStr),
      supabase.from('daily_shiftkey').select('date,specialty').eq('facility_id', selectedFacility.id).gte('date', cycleStartStr).lte('date', cycleEndStr),
    ])
    const censusMap: Record<string, number> = {}
    for (const r of censusRows || []) censusMap[r.date] = r.census
    const empeonCount: Record<string, number> = {}
    for (const r of empeonRows || []) empeonCount[r.date] = (empeonCount[r.date] || 0) + 1
    const skCount: Record<string, number> = {}
    for (const r of skRows || []) skCount[r.date] = (skCount[r.date] || 0) + 1
    setHistoryDays(dates.map(date => ({
      date, dow: dowLabel(date),
      census: censusMap[date] ?? null,
      empeonDepts: empeonCount[date] || 0,
      shiftkeyRows: skCount[date] || 0,
    })))
    setHistoryLoading(false)
  }

  async function handleSaveHistoryCensus(date: string) {
    const val = parseInt(editingCensusVal)
    if (isNaN(val) || val < 1) return
    await fetch('/api/save-census', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId: selectedFacility.id, date, census: val }),
    })
    setEditingCensus(null)
    setEditingCensusVal('')
    loadHistory()
  }

  async function handleClearDay(date: string, clearCensus: boolean) {
    setClearingDay(date)
    await fetch('/api/clear-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId: selectedFacility.id, date, clearCensus }),
    })
    setClearingDay(null)
    loadHistory()
  }

  // ── Shared style helpers ─────────────────────────────
  const card: React.CSSProperties = {
    background: C.white, border: `0.5px solid ${C.border}`,
    borderRadius: 10, padding: '20px 24px', marginBottom: 12,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: C.textMuted, marginBottom: 6, display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    border: `0.5px solid ${C.borderMid}`, borderRadius: 6,
    padding: '8px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif",
    outline: 'none', background: '#FAFAF8', color: C.text, width: '100%',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '9px 20px', border: 'none', borderRadius: 6, fontSize: 13,
    fontWeight: 600, color: '#fff', background: C.blue,
    cursor: 'pointer', fontFamily: "'IBM Plex Sans',sans-serif", whiteSpace: 'nowrap',
  }
  const btnSecondary = (color = C.blue, bg = C.blueLight): React.CSSProperties => ({
    padding: '9px 18px', border: 'none', borderRadius: 6, fontSize: 13,
    fontWeight: 600, color, background: bg,
    cursor: 'pointer', fontFamily: "'IBM Plex Sans',sans-serif", whiteSpace: 'nowrap',
  })
  const btnSmall = (color = C.blu
