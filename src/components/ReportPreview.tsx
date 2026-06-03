'use client'
import { ReportData } from '@/types'
import { NURSING_LICENSED, NURSING_MEDAIDES, NURSING_AIDES, NURSING_ADMIN, SHIFTKEY_SPECIALTY_MAP } from '@/lib/departments'
import { shortDate } from '@/lib/cycle'
import { useEffect, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Tooltip, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

// ── PPD color ──────────────────────────────────────────
function ppdColor(v: number): string {
  if (v >= 3.49) return '#A32D2D'
  if (v >= 3.00) return '#854F0B'
  return '#185FA5'
}

// ── Compute per-day nursing totals ────────────────────
function computeDay(day: ReportData['days'][0], census: number | null) {
  const emp = day.empeon
  const sk = day.shiftkey

  // Map shiftkey specialties to canonical names
  const skCanon: Record<string, number> = {}
  for (const [spec, hrs] of Object.entries(sk)) {
    const canon = SHIFTKEY_SPECIALTY_MAP[spec] || spec
    skCanon[canon] = (skCanon[canon] || 0) + hrs
  }

  const get = (names: string[]) =>
    names.reduce((sum, n) => sum + (emp[n]?.reg || 0) + (emp[n]?.ot || 0), 0)
  const getOT = (names: string[]) =>
    names.reduce((sum, n) => sum + (emp[n]?.ot || 0), 0)
  const getSK = (names: string[]) =>
    names.reduce((sum, n) => sum + (skCanon[n] || 0), 0)

  const rnHrs    = get(['RN'])
  const lvnHrs   = get(['LVN'])
  const rnlvnAg  = getSK(['RN', 'LVN'])
  const cmaHrs   = get(['CMT'])
  const cmaAg    = getSK(['CMT'])
  const cnaHrs   = get(['CNA'])
  const cnaAg    = getSK(['CNA'])
  const adminHrs = get(NURSING_ADMIN)
  const totalOT  = getOT([...NURSING_LICENSED, ...NURSING_MEDAIDES, ...NURSING_AIDES])
  const agencyTotal = rnlvnAg + cmaAg + cnaAg

  const rnlvnTotal  = rnHrs + lvnHrs + rnlvnAg
  const rnlvncma    = rnlvnTotal + cmaHrs + cmaAg
  const rnlvncmacna = rnlvncma + cnaHrs + cnaAg
  const allNursing  = rnlvncmacna + adminHrs

  const ppd = (hrs: number) => census ? hrs / census : 0

  return {
    rnHrs, lvnHrs, rnlvnAg, cmaHrs, cmaAg, cnaHrs, cnaAg, adminHrs,
    totalOT, agencyTotal,
    rnlvnTotal, rnlvncma, rnlvncmacna, allNursing,
    ppd,
    skCanon,
  }
}

// ── Format helpers ─────────────────────────────────────
const f2 = (n: number) => n === 0 ? '—' : n.toFixed(2)
const fh = (n: number) => n === 0 ? '—' : n.toFixed(1)

export function ReportPreview({ data, reportId }: { data: ReportData; reportId: string }) {
  const today = data.days[data.currentDay - 1]
  const census = today?.census ?? null
  const computed = today ? computeDay(today, census) : null
  const cycleAvgCensus = data.days.filter(d => d.census).reduce((s, d, _, a) => s + (d.census || 0) / a.length, 0)

  // Cycle-level totals for KPIs
  const cycleAgency = data.days.reduce((sum, d) => {
    const skVals = Object.values(d.shiftkey).reduce((a, b) => a + b, 0)
    return sum + skVals
  }, 0)

  const completedDays = data.days.filter(d => d.census !== null)

  // PPD trend data — divide hours by census to get actual PPD values
  const trendDays = data.days.slice(0, data.currentDay)
  const allNursingPPD = trendDays.map(d => {
    const c = computeDay(d, d.census)
    return d.census ? parseFloat((c.allNursing / d.census).toFixed(2)) : null
  })
  const combPPD = trendDays.map(d => {
    const c = computeDay(d, d.census)
    return d.census ? parseFloat((c.rnlvncmacna / d.census).toFixed(2)) : null
  })
  const cycleAvgPPD = allNursingPPD.filter(Boolean).reduce((s, v, _, a) => s! + v! / a.length, 0) || 0
  const chartLabels = trendDays.map(d => shortDate(d.date))

  // Ancillary departments (non-nursing, non-agency)
  const ANCILLARY_GROUPS = ['Housekeeping/Laundry', 'Dietary', 'Maintenance', 'Rehab', 'Activities', 'Social Service', 'Administration']

  function getAncillaryRows(day: ReportData['days'][0]) {
    const rows: { group: string; reg: number; ot: number; total: number }[] = []
    const grouped: Record<string, { reg: number; ot: number }> = {}
    for (const [name, hrs] of Object.entries(day.empeon)) {
      const group = getGroup(name)
      if (!group || group === 'Nursing') continue
      if (!grouped[group]) grouped[group] = { reg: 0, ot: 0 }
      grouped[group].reg += hrs.reg
      grouped[group].ot += hrs.ot
    }
    for (const g of ANCILLARY_GROUPS) {
      if (grouped[g]) {
        rows.push({ group: g, ...grouped[g], total: grouped[g].reg + grouped[g].ot })
      }
    }
    return rows
  }

  return (
    <div id={reportId} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: '#1A1A18', background: '#FAFAF8', padding: '32px 28px', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1A1A18', paddingBottom: 14, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{data.facility.name}</div>
          <div style={{ fontSize: 13, color: '#5F5E5A', marginTop: 2 }}>
            Payroll report &nbsp;·&nbsp; {today ? new Date(today.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 3, background: '#E6F1FB', color: '#185FA5', marginBottom: 4 }}>
            Cycle day {data.currentDay} of 14
          </div>
          <div style={{ fontSize: 12, color: '#5F5E5A' }}>
            Cycle: {shortDate(data.cycleStart)} – {shortDate(data.cycleEnd)}&nbsp;·&nbsp;CMS {data.facility.cms_id}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <SectionLabel>Today at a glance</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        <KPI label="Census" value={census ?? '—'} sub={`Cycle avg: ${cycleAvgCensus.toFixed(0)}`} />
        <KPI label="All nursing PPD" value={computed ? computed.ppd(computed.allNursing).toFixed(2) : '—'} valueColor="#185FA5" accent sub={`Cycle avg: ${cycleAvgPPD.toFixed(2)}`} />
        <KPI label="Total OT hours" value={computed ? fh(computed.totalOT) : '—'} valueColor="#A32D2D" sub="RN/LVN/CMA/CNA" />
        <KPI label="Agency hours (today)" value={computed ? fh(computed.agencyTotal) : '—'} valueColor="#854F0B" sub={`Cycle cumulative: ${cycleAgency.toFixed(1)}`} />
      </div>

      {/* Nursing table */}
      {computed && census && (
        <>
          <SectionLabel>Nursing — daily detail</SectionLabel>
          <TableWrap>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <THead cols={['Department', 'Reg hrs', 'OT hrs', 'Agency hrs', 'Total hrs', 'PPD']} />
              </thead>
              <tbody>
                <GroupRow label="Licensed nursing" />
                <TR cells={['RN', fh(computed.rnHrs - (today.empeon['RN']?.ot||0)), f2(today.empeon['RN']?.ot||0), '—', fh(computed.rnHrs), <PPDCell v={computed.ppd(computed.rnHrs)} />]} />
                <TR cells={['LVN', fh((today.empeon['LVN']?.reg||0)), f2(today.empeon['LVN']?.ot||0), '—', fh(computed.lvnHrs), <PPDCell v={computed.ppd(computed.lvnHrs)} />]} />
                <AgencyRow label="RN / LVN agency" hrs={computed.rnlvnAg} ppd={computed.ppd(computed.rnlvnAg)} />
                <SubRow cells={['RN / LVN combined', fh(computed.rnHrs+computed.lvnHrs), '—', fh(computed.rnlvnAg), fh(computed.rnlvnTotal), <PPDCell v={computed.ppd(computed.rnlvnTotal)} bold />]} />

                <GroupRow label="Medication aides" />
                <TR cells={['CMA', fh(today.empeon['CMT']?.reg||0), f2(today.empeon['CMT']?.ot||0), '—', fh(computed.cmaHrs), <PPDCell v={computed.ppd(computed.cmaHrs)} />]} />
                <AgencyRow label="CMA agency" hrs={computed.cmaAg} ppd={computed.ppd(computed.cmaAg)} />
                <SubRow cells={['RN / LVN / CMA', fh(computed.rnHrs+computed.lvnHrs+computed.cmaHrs), '—', fh(computed.rnlvnAg+computed.cmaAg), fh(computed.rnlvncma), <PPDCell v={computed.ppd(computed.rnlvncma)} bold />]} />

                <GroupRow label="Aides" />
                <TR cells={['CNA', fh(today.empeon['CNA']?.reg||0), f2(today.empeon['CNA']?.ot||0), '—', fh(computed.cnaHrs), <PPDCell v={computed.ppd(computed.cnaHrs)} />]} />
                <AgencyRow label="CNA agency" hrs={computed.cnaAg} ppd={computed.ppd(computed.cnaAg)} />
                <SubRow cells={['RN / LVN / CMA / CNA', fh(computed.rnHrs+computed.lvnHrs+computed.cmaHrs+computed.cnaHrs), '—', fh(computed.cnaAg+computed.rnlvnAg+computed.cmaAg), fh(computed.rnlvncmacna), <PPDCell v={computed.ppd(computed.rnlvncmacna)} bold />]} />

                <GroupRow label="Nursing administration" />
                <TR cells={['Nursing admin (combined)', fh(computed.adminHrs), '—', '—', fh(computed.adminHrs), <PPDCell v={computed.ppd(computed.adminHrs)} />]} />

                <TotalRow cells={['All nursing', '', '', '', fh(computed.allNursing), <span style={{ fontSize:15, color: ppdColor(computed.ppd(computed.allNursing)), fontWeight:600 }}>{computed.ppd(computed.allNursing).toFixed(2)}</span>]} />
              </tbody>
            </table>
          </TableWrap>

          {/* Ancillary */}
          <SectionLabel style={{ marginTop: 20 }}>Ancillary &amp; support — daily detail</SectionLabel>
          <TableWrap>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><THead cols={['Department', 'Reg hrs', 'OT hrs', 'Agency hrs', 'Total hrs', 'PPD']} /></thead>
              <tbody>
                {getAncillaryRows(today).map(r => (
                  <TR key={r.group} cells={[r.group, fh(r.reg), f2(r.ot), '—', fh(r.total), <PPDCell v={census ? r.total/census : 0} dim />]} />
                ))}
              </tbody>
            </table>
          </TableWrap>
        </>
      )}

      {/* Page break visual */}
      <div style={{ display:'flex', alignItems:'center', gap:12, margin:'36px 0 28px', color:'#9A9890', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' }}>
        <div style={{ flex:1, height:0.5, background:'#C8C6BE' }} />
        Page 2 — PPD trend
        <div style={{ flex:1, height:0.5, background:'#C8C6BE' }} />
      </div>

      {/* Trend chart */}
      <div style={{ background:'#fff', border:'0.5px solid #E0DED6', borderRadius:6, padding:'18px 20px 12px', marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600 }}>All nursing PPD — cycle trend</div>
            <div style={{ fontSize:11, color:'#9A9890' }}>Days 1–{data.currentDay} complete &nbsp;·&nbsp; Days {data.currentDay+1}–14 pending &nbsp;·&nbsp; Cycle avg: {cycleAvgPPD.toFixed(2)}</div>
          </div>
          <span style={{ fontSize:11, background:'#EAF3DE', color:'#3B6D11', fontWeight:600, padding:'3px 9px', borderRadius:3 }}>Avg {cycleAvgPPD.toFixed(2)}</span>
        </div>
        <div style={{ height: 130 }}>
          <Line
            data={{
              labels: chartLabels,
              datasets: [
                { label: 'All nursing PPD', data: allNursingPPD, borderColor: '#378ADD', backgroundColor: 'rgba(55,138,221,0.07)', fill: true, tension: 0.35, pointRadius: 4, borderWidth: 2.5 },
                { label: 'RN/LVN/CMA/CNA', data: combPPD, borderColor: '#639922', backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, borderWidth: 1.5, borderDash: [5,4] },
                { label: 'Cycle avg', data: chartLabels.map(() => cycleAvgPPD), borderColor: '#EF9F27', backgroundColor: 'transparent', tension: 0, pointRadius: 0, borderWidth: 1, borderDash: [8,5] },
              ]
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { min: 0, max: 4, ticks: { stepSize: 0.5, font: { size: 11 } } } } }}
          />
        </div>
        <div style={{ display:'flex', gap:18, marginTop:10 }}>
          <LegLine color="#378ADD" label="All nursing PPD" />
          <LegLine color="#639922" label="RN/LVN/CMA/CNA" dash />
          <LegLine color="#EF9F27" label="Cycle avg" dash />
        </div>
      </div>

      {/* PPD trend grid */}
      <SectionLabel>PPD by category — full cycle grid</SectionLabel>
      <TrendGrid data={data} ppdColor={ppdColor} cycleAvgPPD={cycleAvgPPD} />

      {/* Footer */}
      <div style={{ marginTop:40, paddingTop:14, borderTop:'0.5px solid #E0DED6', fontSize:11, color:'#9A9890', display:'flex', justifyContent:'space-between' }}>
        <span>{data.facility.name} &nbsp;·&nbsp; CMS ID: {data.facility.cms_id}</span>
        <span>Generated {new Date().toLocaleDateString()} &nbsp;·&nbsp; Cycle {shortDate(data.cycleStart)} – {shortDate(data.cycleEnd)}</span>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────

function SectionLabel({ children, style }: any) {
  return <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#5F5E5A', marginBottom:10, ...style }}>{children}</div>
}

function KPI({ label, value, sub, valueColor, accent }: any) {
  return (
    <div style={{ background: accent ? '#E6F1FB' : '#fff', border: `0.5px solid ${accent ? '#378ADD' : '#E0DED6'}`, borderRadius:6, padding:'12px 14px' }}>
      <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'#9A9890', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace", lineHeight:1, color: valueColor || '#1A1A18' }}>{value}</div>
      <div style={{ fontSize:10, color:'#9A9890', marginTop:5 }}>{sub}</div>
    </div>
  )
}

function TableWrap({ children }: any) {
  return <div style={{ background:'#fff', border:'0.5px solid #E0DED6', borderRadius:6, overflow:'hidden', marginBottom:16 }}>{children}</div>
}

function THead({ cols }: { cols: string[] }) {
  return (
    <tr>
      {cols.map((c, i) => (
        <th key={i} style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#9A9890', background:'#F1EFE8', padding:'7px 12px', textAlign: i===0?'left':'right', borderBottom:'0.5px solid #E0DED6', whiteSpace:'nowrap' }}>{c}</th>
      ))}
    </tr>
  )
}

function TR({ cells }: { cells: any[] }) {
  return (
    <tr>
      {cells.map((c, i) => (
        <td key={i} style={{ padding:'6px 12px', textAlign: i===0?'left':'right', borderBottom:'0.5px solid #E0DED6', fontFamily: i===0?"'IBM Plex Sans',sans-serif":"'IBM Plex Mono',monospace", fontSize: i===0?13:12 }}>{c}</td>
      ))}
    </tr>
  )
}

function GroupRow({ label }: { label: string }) {
  return <tr><td colSpan={6} style={{ fontSize:10, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'#9A9890', background:'#F1EFE8', padding:'6px 12px 4px', borderBottom:'0.5px solid #E0DED6' }}>{label}</td></tr>
}

function SubRow({ cells }: { cells: any[] }) {
  return (
    <tr style={{ background:'#F5F4F0' }}>
      {cells.map((c, i) => (
        <td key={i} style={{ padding:'6px 12px', textAlign: i===0?'left':'right', borderBottom:'0.5px solid #E0DED6', fontWeight:600, fontFamily: i===0?"'IBM Plex Sans',sans-serif":"'IBM Plex Mono',monospace", fontSize: i===0?13:12 }}>{c}</td>
      ))}
    </tr>
  )
}

function TotalRow({ cells }: { cells: any[] }) {
  return (
    <tr style={{ background:'#E6F1FB', borderTop:'1px solid #378ADD' }}>
      {cells.map((c, i) => (
        <td key={i} style={{ padding:'6px 12px', textAlign: i===0?'left':'right', fontWeight:600, color:'#185FA5', fontFamily: i===0?"'IBM Plex Sans',sans-serif":"'IBM Plex Mono',monospace", fontSize: i===0?14:13 }}>{c}</td>
      ))}
    </tr>
  )
}

function AgencyRow({ label, hrs, ppd }: { label: string; hrs: number; ppd: number }) {
  return (
    <tr>
      <td style={{ padding:'6px 12px 6px 24px', fontSize:12, color:'#5F5E5A', borderBottom:'0.5px solid #E0DED6' }}>{label}</td>
      <td style={{ textAlign:'right', padding:'6px 12px', borderBottom:'0.5px solid #E0DED6', color:'#9A9890', fontSize:12 }}>—</td>
      <td style={{ textAlign:'right', padding:'6px 12px', borderBottom:'0.5px solid #E0DED6', color:'#9A9890', fontSize:12 }}>—</td>
      <td style={{ textAlign:'right', padding:'6px 12px', borderBottom:'0.5px solid #E0DED6', color: hrs > 0 ? '#854F0B' : '#9A9890', fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{fh(hrs)}</td>
      <td style={{ textAlign:'right', padding:'6px 12px', borderBottom:'0.5px solid #E0DED6', color: hrs > 0 ? '#854F0B' : '#9A9890', fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{fh(hrs)}</td>
      <td style={{ textAlign:'right', padding:'6px 12px', borderBottom:'0.5px solid #E0DED6', color:'#9A9890', fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{ppd > 0 ? ppd.toFixed(2) : '—'}</td>
    </tr>
  )
}

function PPDCell({ v, bold, dim }: { v: number; bold?: boolean; dim?: boolean }) {
  const color = dim ? '#9A9890' : ppdColor(v)
  return <span style={{ color, fontWeight: bold ? 600 : 400 }}>{v > 0 ? v.toFixed(2) : '—'}</span>
}

function LegLine({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#5F5E5A' }}>
      <div style={{ width:20, height: dash ? 0 : 2.5, borderRadius:2, background: dash ? 'transparent' : color, borderTop: dash ? `2px dashed ${color}` : 'none' }} />
      {label}
    </div>
  )
}

function TrendGrid({ data, ppdColor, cycleAvgPPD }: { data: ReportData; ppdColor: (v:number)=>string; cycleAvgPPD: number }) {
  const trendRows = [
    { key: 'census', label: 'Census', isCensus: true },
    { type: 'group', label: 'Licensed nursing' },
    { key: 'rn', label: 'RN' },
    { key: 'lvn', label: 'LVN' },
    { key: 'rnlvnAg', label: 'RN/LVN agency', isAgency: true },
    { key: 'rnlvn', label: 'RN/LVN combined', isSub: true },
    { type: 'group', label: 'Medication aides' },
    { key: 'cma', label: 'CMA' },
    { key: 'cmaAg', label: 'CMA agency', isAgency: true },
    { key: 'rnlvncma', label: 'RN/LVN/CMA', isSub: true },
    { type: 'group', label: 'Aides' },
    { key: 'cna', label: 'CNA' },
    { key: 'cnaAg', label: 'CNA agency', isAgency: true },
    { key: 'nursingAdm', label: 'Nursing admin' },
    { key: 'allNursing', label: 'All nursing PPD', isTotal: true },
  ]

  const dayComputations = data.days.map(d => ({ d, c: computeDay(d, d.census) }))

  function getVal(key: string, dc: typeof dayComputations[0]) {
    const { d, c } = dc
    if (!d.census) return null
    const ppd = (hrs: number) => d.census ? hrs / d.census : 0
    const m: Record<string, number> = {
      census: d.census,
      rn: ppd(c.rnHrs), lvn: ppd(c.lvnHrs), rnlvnAg: ppd(c.rnlvnAg),
      rnlvn: ppd(c.rnlvnTotal), cma: ppd(c.cmaHrs), cmaAg: ppd(c.cmaAg),
      rnlvncma: ppd(c.rnlvncma), cna: ppd(c.cnaHrs), cnaAg: ppd(c.cnaAg),
      nursingAdm: ppd(c.adminHrs), allNursing: ppd(c.allNursing),
    }
    return m[key] ?? null
  }

  const cellStyle = (isToday: boolean, isSub?: boolean, isTotal?: boolean): React.CSSProperties => ({
    padding: '5px 6px', textAlign: 'center', fontSize: 11,
    fontFamily: "'IBM Plex Mono',monospace",
    background: isTotal ? '#E6F1FB' : isSub ? '#F5F4F0' : isToday ? '#E6F1FB' : 'transparent',
    borderBottom: '0.5px solid #E0DED6',
    fontWeight: isSub || isTotal ? 600 : 400,
  })

  return (
    <div style={{ background:'#fff', border:'0.5px solid #E0DED6', borderRadius:6, overflow:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
        <thead>
          <tr>
            <th style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', color:'#9A9890', background:'#F1EFE8', padding:'5px 12px', textAlign:'left', borderBottom:'0.5px solid #E0DED6', minWidth:120 }}>Metric</th>
            {data.days.map((d, i) => (
              <th key={i} style={{ fontSize:10, padding:'5px 4px', textAlign:'center', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color: i===data.currentDay-1?'#185FA5':'#9A9890', background: i===data.currentDay-1?'#E6F1FB':'#F1EFE8', borderBottom:'0.5px solid #E0DED6' }}>
                {d.dow}<br/>{shortDate(d.date)}
              </th>
            ))}
            <th style={{ fontSize:10, padding:'5px 6px', textAlign:'center', fontWeight:600, textTransform:'uppercase', color:'#5F5E5A', background:'#F1EFE8', borderBottom:'0.5px solid #E0DED6' }}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {trendRows.map((row, ri) => {
            if (row.type === 'group') {
              return <tr key={ri}><td colSpan={16} style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9A9890', background:'#F1EFE8', padding:'5px 12px 3px', borderBottom:'0.5px solid #E0DED6' }}>{row.label}</td></tr>
            }
            const vals = data.days.map((_, i) => getVal(row.key!, dayComputations[i]))
            const completedVals = vals.filter(v => v !== null) as number[]
            const avg = completedVals.length ? completedVals.reduce((a,b)=>a+b,0)/completedVals.length : null

            return (
              <tr key={ri}>
                <td style={{ padding:'5px 12px', fontSize: row.isAgency ? 11 : 12, color: row.isAgency?'#5F5E5A':'#1A1A18', paddingLeft: row.isAgency ? 22 : 12, borderBottom:'0.5px solid #E0DED6', background: row.isTotal?'#E6F1FB':row.isSub?'#F5F4F0':'transparent', fontWeight: row.isSub||row.isTotal?600:400 }}>
                  {row.label}
                </td>
                {data.days.map((d, i) => {
                  const v = vals[i]
                  const isToday = i === data.currentDay - 1
                  const isPending = v === null
                  return (
                    <td key={i} style={cellStyle(isToday, row.isSub, row.isTotal)}>
                      {isPending ? <span style={{ color:'#E0DED6' }}>—</span> : (
                        <span style={{ color: row.isTotal ? ppdColor(v!) : row.isAgency && v! > 0 ? '#854F0B' : 'inherit' }}>
                          {row.isCensus ? v : (v === 0 ? '—' : v!.toFixed(2))}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td style={{ padding:'5px 6px', textAlign:'center', fontSize:11, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace", background:'#F5F4F0', borderBottom:'0.5px solid #E0DED6', color: row.isTotal && avg ? ppdColor(avg) : '#1A1A18' }}>
                  {avg === null ? '—' : row.isCensus ? Math.round(avg) : avg.toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Helper: get cc1_group for a cc2_name
function getGroup(name: string): string | null {
  const map: Record<string, string> = {
    'DON':'Nursing','ADON':'Nursing','MDS':'Nursing','Wound Nurse':'Nursing','Corporate Nurse':'Nursing','Staffing Coordinator CNA':'Nursing',
    'RN':'Nursing','LVN':'Nursing','CMT':'Nursing','CNA':'Nursing',
    'Rehab Director':'Rehab','Physical Therapist':'Rehab','PTA':'Rehab','Occupational Therapist':'Rehab','COTA':'Rehab','Speech Therapist':'Rehab',
    'Food Service Director':'Dietary','Cook':'Dietary','Dietary Aide':'Dietary','Dietary':'Dietary',
    'Housekeeping/Laundry Director':'Housekeeping/Laundry','Housekeeping':'Housekeeping/Laundry','Laundry':'Housekeeping/Laundry',
    'Maintenance Director':'Maintenance','Maintenance':'Maintenance',
    'Administrator':'Administration','Assistant Administrator':'Administration','Admissions':'Administration','Marketing':'Administration',
    'Business Office Manager':'Administration','Business Office':'Administration','Purchasing':'Administration','Human Resources':'Administration',
    'Activity Director':'Activities','Activities':'Activities',
    'Social Services':'Social Service',
  }
  return map[name] || null
}
