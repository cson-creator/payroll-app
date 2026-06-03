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
  const btnSmall = (color = C.blue, bg = C.blueLight): React.CSSProperties => ({
    padding: '5px 11px', border: 'none', borderRadius: 5, fontSize: 12,
    fontWeight: 600, color, background: bg,
    cursor: 'pointer', fontFamily: "'IBM Plex Sans',sans-serif", whiteSpace: 'nowrap',
  })

  // ── Facility row ─────────────────────────────────────
  function FacilityRow({ fac }: { fac: any }) {
    const selected = selectedFacility?.id === fac.id
    return (
      <div
        onClick={() => handleSelectFacility(fac)}
        style={{
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          background: selected ? C.blue : C.white,
          border: selected ? 'none' : `0.5px solid ${C.borderMid}`,
          transition: 'all 0.1s',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: selected ? 'rgba(255,255,255,0.18)' : '#F4F2EB',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={selected ? '#fff' : '#888780'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21v-4a3 3 0 0 1 6 0v4" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: selected ? '#fff' : C.textSoft }}>{fac.name}</div>
          <div style={{ fontSize: 11, marginTop: 1, color: selected ? C.blueMid : C.textFaint }}>
            {selected ? 'Selected — enter passcode below' : fac.cms_id ? `CMS ${fac.cms_id}` : 'CMS —'}
          </div>
        </div>
        {selected
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.blueMid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.borderMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        }
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans',sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{ background: C.white, borderBottom: `0.5px solid ${C.border}`, padding: '0 28px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, background: C.blue, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.text, letterSpacing: '-0.01em' }}>Payroll PPD Report</span>
        </div>
        <a href="/admin" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Admin
        </a>
      </div>

      {/* ── Facility selection screen (pre-auth) ── */}
      {!authed && (
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>
          <div style={{ background: C.white, border: `0.5px solid ${C.borderMid}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr' }}>

              {/* Left: context */}
              <div style={{ padding: '28px 24px', borderRight: `0.5px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 500, color: C.text, letterSpacing: '-0.02em', marginBottom: 5 }}>Select a facility</div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.65 }}>Enter your facility passcode to upload payroll data and generate reports.</div>
                </div>
                {/* Cycle card */}
                <div style={{ background: C.bluePale, border: `0.5px solid ${C.blueMid}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.blue, marginBottom: 10 }}>Active payroll cycle</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.blueDark, marginBottom: 2 }}>
                    {shortDate(cycleStartStr)} – {shortDate(cycleEndStr)}, {new Date().getFullYear()}
                  </div>
                  <div style={{ fontSize: 11, color: C.blueAccent, marginBottom: 12 }}>Day {dayNum} of 14</div>
                  <div style={{ height: 4, background: C.blueMid, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${cycleProgress}%`, height: '100%', background: C.blue, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <div style={{ fontSize: 10, color: C.blueAccent }}>{shortDate(cycleStartStr)}</div>
                    <div style={{ fontSize: 10, color: C.blue, fontWeight: 500 }}>{dayNum - 1} days complete</div>
                    <div style={{ fontSize: 10, color: C.blueAccent }}>{shortDate(cycleEndStr)}</div>
                  </div>
                </div>
              </div>

              {/* Right: facility list */}
              <div style={{ padding: '28px 24px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.textFaint, marginBottom: 12 }}>Facilities</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {facilities.map(f => <FacilityRow key={f.id} fac={f} />)}

                  {/* Inline passcode */}
                  {selectedFacility && (
                    <div style={{ background: C.bg, border: `0.5px solid ${C.borderMid}`, borderRadius: 10, padding: '14px 16px', marginTop: 2 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: C.textFaint, marginBottom: 8 }}>
                        Passcode for {selectedFacility.name.split(' ')[0]}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="password"
                          value={passcode}
                          onChange={e => setPasscode(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAuth()}
                          placeholder="Enter passcode"
                          style={{ ...inputStyle, flex: 1 }}
                          autoFocus
                        />
                        <button onClick={handleAuth} style={btnPrimary}>Unlock →</button>
                      </div>
                      {authError && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{authError}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step strip */}
            <div style={{ background: C.bgStrip, borderTop: `0.5px solid ${C.border}`, padding: '16px 24px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.textFaint, marginBottom: 10 }}>Daily workflow</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  { n: '1', label: 'Set date', sub: 'Choose report date', accent: false },
                  { n: '2', label: 'Empeon', sub: 'Upload daily CSV', accent: false },
                  { n: '3', label: 'ShiftKey', sub: 'Upload agency XLS', accent: false },
                  { n: '4', label: 'Census + Report', sub: 'Save census, compile', accent: true },
                ].map(step => (
                  <div key={step.n} style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 18, height: 18, minWidth: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, background: step.accent ? C.greenLight : C.blueLight }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: step.accent ? C.green : C.blue }}>{step.n}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: C.textSoft, marginBottom: 2 }}>{step.label}</div>
                      <div style={{ fontSize: 11, color: C.textFaint }}>{step.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Authenticated workspace ── */}
      {authed && selectedFacility && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px' }}>

          {/* Facility header bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{selectedFacility.name}</div>
              <div style={{ fontSize: 11, color: C.textFaint }}>·</div>
              <div style={{ fontSize: 11, color: C.textFaint }}>
                Cycle {shortDate(cycleStartStr)} – {shortDate(cycleEndStr)} &nbsp;·&nbsp; Day {dayNum} of 14
              </div>
            </div>
            <button
              onClick={() => { setAuthed(false); setSelectedFacility(null); setPasscode(''); setReportData(null) }}
              style={{ fontSize: 12, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans',sans-serif" }}
            >
              ← Switch facility
            </button>
          </div>

          {/* Upload card */}
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 16 }}>Upload data</div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Report date</label>
              <input type="date" value={uploadDate} onChange={e => handleDateChange(e.target.value)} style={{ ...inputStyle, width: 180 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <UploadZone label="Empeon CSV" accept=".csv" onFile={handleEmpeonUpload} status={empeonStatus} message={empeonMsg} />
              <UploadZone label="ShiftKey XLS" accept=".xls,.xlsx" onFile={handleShiftkeyUpload} status={shiftkeyStatus} message={shiftkeyMsg} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Census for {uploadDate}</label>
                <input type="number" value={census} onChange={e => { setCensus(e.target.value); setCensusSaved(false) }} style={{ ...inputStyle, width: 120 }} placeholder="e.g. 88" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <button onClick={handleSaveCensus} style={btnSecondary(C.green, C.greenLight)}>
                  {censusSaved ? '✓ Saved' : 'Save census'}
                </button>
                <div style={{ fontSize: 10, color: C.textFaint, textAlign: 'center' }}>Required for PPD</div>
              </div>
            </div>
          </div>

          {/* Cycle history */}
          <div style={card}>
            <button
              onClick={() => { setShowHistory(h => !h); if (!showHistory) loadHistory() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: 0, fontFamily: "'IBM Plex Sans',sans-serif" }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Cycle history</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{showHistory ? '▲ Hide' : '▼ View & edit'}</div>
            </button>

            {showHistory && (
              <div style={{ marginTop: 16 }}>
                {historyLoading ? (
                  <div style={{ fontSize: 13, color: C.textFaint }}>Loading…</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Day', 'Date', 'Census', 'Empeon', 'ShiftKey', 'Actions'].map((h, i) => (
                          <th key={i} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: C.textFaint, background: C.bgStrip, padding: '7px 10px', textAlign: i < 2 ? 'left' : 'center' as const, borderBottom: `0.5px solid ${C.border}`, whiteSpace: 'nowrap' as const }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyDays.map((day, i) => {
                        const isToday = day.date === format(new Date(), 'yyyy-MM-dd')
                        const hasData = day.census !== null || day.empeonDepts > 0 || day.shiftkeyRows > 0
                        const isFuture = day.date > format(new Date(), 'yyyy-MM-dd')
                        const isEditing = editingCensus === day.date
                        const isClearing = clearingDay === day.date
                        return (
                          <tr key={day.date} style={{ background: isToday ? C.bluePale : 'transparent', opacity: isFuture ? 0.4 : 1 }}>
                            <td style={{ padding: '7px 10px', borderBottom: `0.5px solid ${C.border}`, color: C.textFaint, fontSize: 11 }}>{day.dow} {i + 1}</td>
                            <td style={{ padding: '7px 10px', borderBottom: `0.5px solid ${C.border}`, fontWeight: isToday ? 500 : 400, color: C.textSoft }}>{shortDate(day.date)}</td>
                            <td style={{ padding: '7px 10px', borderBottom: `0.5px solid ${C.border}`, textAlign: 'center' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                                  <input
                                    type="number"
                                    value={editingCensusVal}
                                    onChange={e => setEditingCensusVal(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveHistoryCensus(day.date); if (e.key === 'Escape') { setEditingCensus(null); setEditingCensusVal('') } }}
                                    style={{ width: 60, border: `0.5px solid ${C.blueAccent}`, borderRadius: 4, padding: '3px 6px', fontSize: 12, textAlign: 'center', fontFamily: "'IBM Plex Sans',sans-serif", outline: 'none', color: C.text }}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveHistoryCensus(day.date)} style={btnSmall(C.green, C.greenLight)}>✓</button>
                                  <button onClick={() => { setEditingCensus(null); setEditingCensusVal('') }} style={btnSmall(C.textMuted, C.bgStrip)}>✕</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { if (!isFuture) { setEditingCensus(day.date); setEditingCensusVal(day.census !== null ? String(day.census) : '') } }}
                                  style={{ background: 'none', border: 'none', cursor: isFuture ? 'default' : 'pointer', fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", color: day.census !== null ? C.textSoft : C.borderMid, padding: '2px 6px', borderRadius: 3 }}
                                >
                                  {day.census !== null ? day.census : '—'}
                                </button>
                              )}
                            </td>
                            <td style={{ padding: '7px 10px', borderBottom: `0.5px solid ${C.border}`, textAlign: 'center', color: day.empeonDepts > 0 ? C.green : C.borderMid }}>
                              {day.empeonDepts > 0 ? `${day.empeonDepts} depts` : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', borderBottom: `0.5px solid ${C.border}`, textAlign: 'center', color: day.shiftkeyRows > 0 ? '#854F0B' : C.borderMid }}>
                              {day.shiftkeyRows > 0 ? `${day.shiftkeyRows} rows` : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', borderBottom: `0.5px solid ${C.border}`, textAlign: 'center' }}>
                              {!isFuture && hasData && (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                  {(day.empeonDepts > 0 || day.shiftkeyRows > 0) && (
                                    <button
                                      onClick={() => { if (confirm(`Clear Empeon + ShiftKey for ${shortDate(day.date)}? Census kept.`)) handleClearDay(day.date, false) }}
                                      disabled={isClearing}
                                      style={btnSmall('#854F0B', '#FEF3E2')}
                                    >{isClearing ? '…' : 'Clear uploads'}</button>
                                  )}
                                  <button
                                    onClick={() => { if (confirm(`Clear ALL data for ${shortDate(day.date)} including census?`)) handleClearDay(day.date, true) }}
                                    disabled={isClearing}
                                    style={btnSmall(C.red, '#FCEBEB')}
                                  >{isClearing ? '…' : 'Clear all'}</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                <div style={{ marginTop: 10, fontSize: 11, color: C.textFaint }}>
                  Click a census value to edit. "Clear uploads" removes hours but keeps census. "Clear all" removes everything.
                </div>
              </div>
            )}
          </div>

          {/* Compile report */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Report preview</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                Daily snapshot for <strong style={{ color: C.textSoft }}>{uploadDate}</strong>
              </div>
            </div>
            <button onClick={handleLoadReport} disabled={loadingReport} style={btnPrimary}>
              {loadingReport ? 'Loading…' : 'Compile report'}
            </button>
          </div>

          {/* Report + export */}
          {reportData && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, justifyContent: 'flex-end', alignItems: 'center' }}>
                {emailMsg && <span style={{ fontSize: 12, color: emailMsg.startsWith('✓') ? C.green : C.red }}>{emailMsg}</span>}
                <button onClick={handleGeneratePDF} disabled={generatingPDF} style={btnPrimary}>
                  {generatingPDF ? 'Generating…' : '↓ Generate PDF'}
                </button>
                <button onClick={handleGenerateAndSend} disabled={sendingEmail} style={{ ...btnSecondary('#fff', C.blue), opacity: sendingEmail ? 0.6 : 1 }}>
                  {sendingEmail ? 'Sending…' : '✉ Generate & Send'}
                </button>
              </div>
              <div style={{ border: `0.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: '#FAFAF8' }}>
                <div ref={reportRef}>
                  <ReportPreview data={reportData} reportId="report-root" />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
