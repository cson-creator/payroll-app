'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getCycleForDate, shortDate } from '@/lib/cycle'
import { ReportPreview } from '@/components/ReportPreview'
import { UploadZone } from '@/components/UploadZone'
import { ReportData } from '@/types'
import { format, addDays } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export default function Home() {
  const [facilities, setFacilities] = useState<any[]>([])
  const [selectedFacility, setSelectedFacility] = useState<any>(null)
  const [passcode, setPasscode] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')

  const { cycleStart, cycleEnd, dayNum } = getCycleForDate()
  // Default upload date = yesterday
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
  const [loadingReport, setLoadingReport] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('facilities').select('*').eq('active', true).then(({ data }) => {
      if (data) setFacilities(data)
    })
  }, [])

  // Pre-load census from DB for the date
  useEffect(() => {
    if (!selectedFacility || !authed || !censusDate) return
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
  }

  function handleAuth() {
    if (passcode === selectedFacility.passcode) {
      setAuthed(true)
      setAuthError('')
    } else {
      setAuthError('Incorrect passcode')
    }
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
    if (res.ok) { setEmpeonStatus('success'); setEmpeonMsg(`✓ ${json.rowsIngested} departments ingested`) }
    else { setEmpeonStatus('error'); setEmpeonMsg(json.error || 'Upload failed') }
  }

  async function handleShiftkeyUpload(file: File) {
    setShiftkeyStatus('uploading')
    setShiftkeyMsg('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('facilityId', selectedFacility.id)
    const res = await fetch('/api/upload-shiftkey', { method: 'POST', body: fd })
    const json = await res.json()
    if (res.ok) { setShiftkeyStatus('success'); setShiftkeyMsg(`✓ ${json.rowsIngested} agency rows ingested`) }
    else { setShiftkeyStatus('error'); setShiftkeyMsg(json.error || 'Upload failed') }
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
    const res = await fetch(`/api/report-data?facilityId=${selectedFacility.id}`)
    const data = await res.json()
    setReportData(data)
    setLoadingReport(false)
  }

  async function generatePDF(): Promise<string> {
    const el = reportRef.current!
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
    return pdf.output('datauristring').split(',')[1] // base64
  }

  async function handleGeneratePDF() {
    setGeneratingPDF(true)
    const base64 = await generatePDF()
    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${base64}`
    link.download = `${selectedFacility.name.replace(/\s+/g,'_')}_Payroll_${format(new Date(),'yyyy-MM-dd')}.pdf`
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
      body: JSON.stringify({ facilityId: selectedFacility.id, pdfBase64: base64, reportDate: format(new Date(), 'yyyy-MM-dd') }),
    })
    const json = await res.json()
    if (res.ok) setEmailMsg('✓ Report sent successfully')
    else setEmailMsg(`✗ ${json.error}`)
    setSendingEmail(false)
  }

  // ── Styles ──────────────────────────────────────────
  const s = {
    wrap: { minHeight:'100vh', background:'#F1EFE8', padding:'32px 24px', fontFamily:"'IBM Plex Sans',sans-serif" } as React.CSSProperties,
    card: { background:'#fff', border:'0.5px solid #E0DED6', borderRadius:8, padding:'24px', marginBottom:16 } as React.CSSProperties,
    label: { fontSize:11, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase' as const, color:'#5F5E5A', marginBottom:6, display:'block' },
    input: { width:'100%', border:'0.5px solid #C8C6BE', borderRadius:4, padding:'8px 10px', fontSize:13, fontFamily:"'IBM Plex Sans',sans-serif", outline:'none' } as React.CSSProperties,
    btn: (color='#185FA5', bg='#E6F1FB') => ({ padding:'9px 18px', border:'none', borderRadius:4, fontSize:13, fontWeight:600, color, background:bg, cursor:'pointer', fontFamily:"'IBM Plex Sans',sans-serif" }) as React.CSSProperties,
    btnPrimary: { padding:'10px 22px', border:'none', borderRadius:4, fontSize:13, fontWeight:600, color:'#fff', background:'#185FA5', cursor:'pointer', fontFamily:"'IBM Plex Sans',sans-serif" } as React.CSSProperties,
  }

  return (
    <div style={s.wrap}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>

        {/* App header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:600 }}>Payroll Report Builder</div>
            <div style={{ fontSize:12, color:'#9A9890', marginTop:2 }}>
              Cycle {shortDate(format(cycleStart,'yyyy-MM-dd'))} – {shortDate(format(cycleEnd,'yyyy-MM-dd'))} &nbsp;·&nbsp; Day {dayNum} of 14
            </div>
          </div>
          <a href="/admin" style={{ fontSize:12, color:'#9A9890', textDecoration:'none' }}>Admin →</a>
        </div>

        {/* Facility selector */}
        <div style={s.card}>
          <label style={s.label}>Select facility</label>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {facilities.map(f => (
              <button key={f.id} onClick={() => handleSelectFacility(f)} style={{ ...s.btn(selectedFacility?.id===f.id?'#fff':'#185FA5', selectedFacility?.id===f.id?'#185FA5':'#E6F1FB'), transition:'all 0.1s' }}>
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Auth */}
        {selectedFacility && !authed && (
          <div style={s.card}>
            <label style={s.label}>Passcode for {selectedFacility.name}</label>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <input type="password" value={passcode} onChange={e => setPasscode(e.target.value)} onKeyDown={e => e.key==='Enter'&&handleAuth()} style={{ ...s.input, width:200 }} placeholder="Enter passcode" />
              <button onClick={handleAuth} style={s.btnPrimary}>Unlock</button>
            </div>
            {authError && <div style={{ color:'#A32D2D', fontSize:12, marginTop:8 }}>{authError}</div>}
          </div>
        )}

        {/* Upload + census panel */}
        {selectedFacility && authed && (
          <>
            <div style={s.card}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Upload data</div>
              <div style={{ marginBottom:12 }}>
                <label style={s.label}>Data date (for Empeon + census)</label>
                <input type="date" value={uploadDate} onChange={e => { setUploadDate(e.target.value); setCensusDate(e.target.value) }} style={{ ...s.input, width:180 }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <UploadZone label="Empeon CSV" accept=".csv" onFile={handleEmpeonUpload} status={empeonStatus} message={empeonMsg} />
                <UploadZone label="ShiftKey XLS" accept=".xls,.xlsx" onFile={handleShiftkeyUpload} status={shiftkeyStatus} message={shiftkeyMsg} />
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label style={s.label}>Census for {uploadDate}</label>
                  <input type="number" value={census} onChange={e => { setCensus(e.target.value); setCensusSaved(false) }} style={{ ...s.input, width:120 }} placeholder="e.g. 66" />
                </div>
                <button onClick={handleSaveCensus} style={{ ...s.btn('#3B6D11','#EAF3DE'), marginBottom:0 }}>
                  {censusSaved ? '✓ Saved' : 'Save census'}
                </button>
              </div>
            </div>

            {/* Generate report */}
            <div style={{ ...s.card, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>Report preview</div>
                <div style={{ fontSize:11, color:'#9A9890', marginTop:2 }}>Compiles all uploaded data for the current cycle</div>
              </div>
              <button onClick={handleLoadReport} disabled={loadingReport} style={s.btnPrimary}>
                {loadingReport ? 'Loading…' : 'Compile report'}
              </button>
            </div>

            {/* Report + export buttons */}
            {reportData && (
              <>
                <div style={{ display:'flex', gap:10, marginBottom:16, justifyContent:'flex-end', alignItems:'center' }}>
                  {emailMsg && <span style={{ fontSize:12, color: emailMsg.startsWith('✓')?'#3B6D11':'#A32D2D' }}>{emailMsg}</span>}
                  <button onClick={handleGeneratePDF} disabled={generatingPDF} style={s.btnPrimary}>
                    {generatingPDF ? 'Generating…' : '↓ Generate PDF'}
                  </button>
                  <button onClick={handleGenerateAndSend} disabled={sendingEmail} style={{ ...s.btn('#fff','#185FA5'), opacity: sendingEmail?0.6:1 }}>
                    {sendingEmail ? 'Sending…' : '✉ Generate & Send'}
                  </button>
                </div>

                {/* Live preview */}
                <div style={{ border:'0.5px solid #E0DED6', borderRadius:8, overflow:'hidden', background:'#FAFAF8' }}>
                  <div ref={reportRef}>
                    <ReportPreview data={reportData} reportId="report-root" />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}