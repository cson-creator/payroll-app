'use client'
import { ReportData } from '@/types'
import { SHIFTKEY_SPECIALTY_MAP, FACILITY_CONFIGS, getFacilityConfigKey, NursingLineItem, AncillaryLineItem } from '@/lib/departments'
import { shortDate } from '@/lib/cycle'

// ── PPD threshold ──────────────────────────────────────
const PPD_RED = 3.90

function ppdColor(v: number): string {
  if (v >= PPD_RED) return '#A32D2D'
  if (v >= 3.00) return '#854F0B'
  return '#185FA5'
}

// ── Day-of-week helper ─────────────────────────────────
function isWeekday(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = d.getDay()
  return dow >= 1 && dow <= 5
}

// ── Compute all line item values for one day ──────────
function computeLineItems(
  day: ReportData['days'][0],
  census: number | null,
  nursingLines: NursingLineItem[]
) {
  const emp = day.empeon
  const sk = day.shiftkey

  const skCanon: Record<string, number> = {}
  for (const [spec, hrs] of Object.entries(sk)) {
    const canon = SHIFTKEY_SPECIALTY_MAP[spec] || spec
    skCanon[canon] = (skCanon[canon] || 0) + hrs
  }

  const getEmp = (names: string[]) =>
    names.reduce((sum, n) => sum + (emp[n]?.reg || 0) + (emp[n]?.ot || 0), 0)
  const getEmpReg = (names: string[]) =>
    names.reduce((sum, n) => sum + (emp[n]?.reg || 0), 0)
  const getEmpOT = (names: string[]) =>
    names.reduce((sum, n) => sum + (emp[n]?.ot || 0), 0)
  const getSK = (names: string[]) =>
    names.reduce((sum, n) => sum + (skCanon[n] || 0), 0)

  // Build values per key
  const vals: Record<string, { reg: number; ot: number; agency: number; total: number }> = {}

  // First pass: simple rows
  for (const line of nursingLines) {
    if (line.isSubtotal || line.isTotal) continue
    if (line.isAgency) {
      const agency = getSK(line.skNames || [])
      vals[line.key] = { reg: 0, ot: 0, agency, total: agency }
    } else {
      let reg = getEmpReg(line.empeonNames)
      const ot = getEmpOT(line.empeonNames)
      // DON auto-attribution: 8hrs on weekdays if no Empeon data
      if (line.autoDON && reg === 0 && ot === 0 && isWeekday(day.date)) {
        reg = 8
      }
      vals[line.key] = { reg, ot, agency: 0, total: reg + ot }
    }
  }

  // Second pass: subtotals and totals
  // rnlvn = rn + lvn + rnlvnAg
  const rnTotal   = (vals['rn']?.total || 0) + (vals['lvn']?.total || 0) + (vals['rnlvnAg']?.agency || 0)
  const cmtTotal  = (vals['cmt']?.total || 0) + (vals['cmtAg']?.agency || 0)
  const cnaTotal  = (vals['cna']?.total || 0) + (vals['cnaAg']?.agency || 0)

  // Nursing admin total = sum of all non-rn/lvn/cmt/cna/agency/subtotal/total rows
  const adminKeys = nursingLines
    .filter(l => !l.isAgency && !l.isSubtotal && !l.isTotal && !['rn','lvn','cmt','cna'].includes(l.key))
    .map(l => l.key)
  const adminTotal = adminKeys.reduce((sum, k) => sum + (vals[k]?.total || 0), 0)

  const rnlvnCmtTotal = rnTotal + cmtTotal
  const allNursingTotal = rnlvnCmtTotal + cnaTotal + adminTotal

  vals['rnlvn']      = { reg: 0, ot: 0, agency: 0, total: rnTotal }
  vals['rnlvncmt']   = { reg: 0, ot: 0, agency: 0, total: rnlvnCmtTotal }
  vals['allNursing'] = { reg: 0, ot: 0, agency: 0, total: allNursingTotal }

  // Total OT (nursing staff only, not admin)
  const totalOT = ['rn','lvn','cmt','cna'].reduce((sum, k) => sum + (vals[k]?.ot || 0), 0)
  // Total agency
  const totalAgency = (vals['rnlvnAg']?.agency || 0) + (vals['cmtAg']?.agency || 0) + (vals['cnaAg']?.agency || 0)

  const ppd = (hrs: number) => census ? hrs / census : 0

  return { vals, totalOT, totalAgency, allNursing: allNursingTotal, ppd }
}

// ── Format helpers ─────────────────────────────────────
const fh  = (n: number) => n === 0 ? '—' : n.toFixed(1)
const f2  = (n: number) => n === 0 ? '—' : n.toFixed(2)

export function ReportPreview({ data, reportId }: { data: ReportData; reportId: string }) {
  const today = data.days[data.currentDay - 1]
  const census = today?.census ?? null

  const configKey = getFacilityConfigKey(data.facility?.name || '')
  const config = FACILITY_CONFIGS[configKey]
  const { nursingLines, ancillaryLines } = config

  const computed = today ? computeLineItems(today, census, nursingLines) : null

  const cycleAvgCensus = (() => {
    const days = data.days.filter(d => d.census)
    return days.length ? days.reduce((s, d) => s + (d.census || 0), 0) / days.length : 0
  })()

  // Cycle agency total
  const cycleAgency = data.days.reduce((sum, d) => {
    return sum + Object.values(d.shiftkey).reduce((a, b) => a + b, 0)
  }, 0)

  // Cycle avg PPD
  const completedPPDs = data.days
    .filter(d => d.census)
    .map(d => {
      const c = computeLineItems(d, d.census, nursingLines)
      return d.census ? c.allNursing / d.census : 0
    })
  const cycleAvgPPD = completedPPDs.length
    ? completedPPDs.reduce((a, b) => a + b, 0) / completedPPDs.length
    : 0

  const todayPPD = computed && census ? computed.ppd(computed.allNursing) : 0
  const ppdAboveThreshold = todayPPD >= PPD_RED

  // Ancillary rows — always show all configured lines
  function getAncillaryValue(line: AncillaryLineItem, day: ReportData['days'][0]) {
    const reg = line.empeonNames.reduce((sum, n) => sum + (day.empeon[n]?.reg || 0), 0)
    const ot = line.empeonNames.reduce((sum, n) => sum + (day.empeon[n]?.ot || 0), 0)
    return { reg, ot, total: reg + ot }
  }

  return (
    <div id={reportId} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: '#1A1A18', background: '#FAFAF8', padding: '28px 28px', maxWidth: 860 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1A1A18', paddingBottom: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{data.facility?.name}</div>
          <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 2 }}>
            Payroll report &nbsp;·&nbsp; {today ? new Date(today.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 3, background: '#E6F1FB', color: '#185FA5', marginBottom: 4 }}>
            Cycle day {data.currentDay} of 14
          </div>
          <div style={{ fontSize: 12, color: '#5F5E5A' }}>
            Cycle: {shortDate(data.cycleStart)} – {shortDate(data.cycleEnd)}&nbsp;·&nbsp;CMS {data.facility?.cms_id}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <SectionLabel>Today at a glance</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        <KPI label="Census" value={census ?? '—'} sub={`Cycle avg: ${cycleAvgCensus.toFixed(0)}`} />
        <KPI
          label="All nursing PPD"
          value={todayPPD > 0 ? todayPPD.toFixed(2) : '—'}
          valueColor={ppdAboveThreshold ? '#A32D2D' : '#185FA5'}
          accent
          accentRed={ppdAboveThreshold}
          sub={`Cycle avg: ${cycleAvgPPD.toFixed(2)}`}
        />
        <KPI
          label="Total OT hours"
          value={computed ? fh(computed.totalOT) : '—'}
          valueColor="#A32D2D"
          sub="RN/LVN/CMT/CNA"
        />
        {/* Agency KPI — split display */}
        <div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: '#9A9890', marginBottom: 4 }}>Agency hours</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", color: '#854F0B' }}>
              {computed ? fh(computed.totalAgency) : '—'}
            </span>
            <span style={{ fontSize: 11, color: '#9A9890' }}>today</span>
          </div>
          <div style={{ borderTop: '0.5px solid #E0DED6', paddingTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", color: '#854F0B' }}>
              {cycleAgency.toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: '#9A9890' }}>cycle</span>
          </div>
        </div>
      </div>

      {/* ── Nursing table ── */}
      {census && computed && today && (
        <>
          <SectionLabel>Nursing — daily detail</SectionLabel>
          <TableWrap>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Department', 'Reg hrs', 'OT hrs', 'Agency hrs', 'Total hrs', 'PPD'].map((col, i) => (
                    <th key={i} style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      color: '#9A9890', background: '#F1EFE8', padding: '7px 10px',
                      textAlign: i === 0 ? 'left' : 'right',
                      borderBottom: '0.5px solid #E0DED6', whiteSpace: 'nowrap' as const,
                      textDecoration: i > 0 ? 'underline' : 'none',
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nursingLines.map((line) => {
                  const v = computed.vals[line.key] || { reg: 0, ot: 0, agency: 0, total: 0 }
                  const ppd = computed.ppd(v.total)

                  if (line.isTotal) {
                    // All nursing total row
                    const totalReg = nursingLines
                      .filter(l => !l.isAgency && !l.isSubtotal && !l.isTotal)
                      .reduce((sum, l) => sum + (computed.vals[l.key]?.reg || 0), 0)
                    const totalOT = nursingLines
                      .filter(l => !l.isAgency && !l.isSubtotal && !l.isTotal)
                      .reduce((sum, l) => sum + (computed.vals[l.key]?.ot || 0), 0)
                    const totalAgency = nursingLines
                      .filter(l => l.isAgency)
                      .reduce((sum, l) => sum + (computed.vals[l.key]?.agency || 0), 0)
                    const allTotal = computed.allNursing
                    const allPPD = computed.ppd(allTotal)
                    return (
                      <tr key={line.key} style={{ background: '#E6F1FB', borderTop: '1.5px solid #378ADD' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 700, fontSize: 13, color: '#185FA5', fontFamily: "'IBM Plex Sans',sans-serif" }}>{line.label}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#185FA5', fontFamily: "'IBM Plex Mono',monospace" }}>{fh(totalReg)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#A32D2D', fontFamily: "'IBM Plex Mono',monospace" }}>{fh(totalOT)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#A32D2D', fontFamily: "'IBM Plex Mono',monospace" }}>{fh(totalAgency)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#185FA5', fontFamily: "'IBM Plex Mono',monospace" }}>{fh(allTotal)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: allPPD >= PPD_RED ? '#A32D2D' : '#185FA5', fontFamily: "'IBM Plex Mono',monospace" }}>{allPPD.toFixed(2)}</td>
                      </tr>
                    )
                  }

                  if (line.isSubtotal) {
                    return (
                      <tr key={line.key} style={{ background: '#F5F4F0' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 700, fontSize: 12, fontFamily: "'IBM Plex Sans',sans-serif", borderBottom: '0.5px solid #E0DED6', textDecoration: 'underline' }}>{line.label}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, borderBottom: '0.5px solid #E0DED6' }}>—</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, borderBottom: '0.5px solid #E0DED6' }}>—</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, borderBottom: '0.5px solid #E0DED6' }}>—</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, borderBottom: '0.5px solid #E0DED6' }}>{fh(v.total)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, borderBottom: '0.5px solid #E0DED6' }}>
                          <span style={{ color: ppdColor(ppd) }}>{ppd > 0 ? ppd.toFixed(2) : '—'}</span>
                        </td>
                      </tr>
                    )
                  }

                  if (line.isAgency) {
                    return (
                      <tr key={line.key}>
                        <td style={{ padding: '5px 10px 5px 22px', fontSize: 11, color: '#5F5E5A', borderBottom: '0.5px solid #E0DED6' }}>{line.label}</td>
                        <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', color: '#9A9890', fontSize: 11 }}>—</td>
                        <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', color: '#A32D2D', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>—</td>
                        <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', color: v.agency > 0 ? '#A32D2D' : '#9A9890', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{fh(v.agency)}</td>
                        <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', color: v.agency > 0 ? '#A32D2D' : '#9A9890', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{fh(v.agency)}</td>
                        <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', color: '#9A9890', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{ppd > 0 ? ppd.toFixed(2) : '—'}</td>
                      </tr>
                    )
                  }

                  // Standard row
                  return (
                    <tr key={line.key}>
                      <td style={{ padding: '5px 10px', fontSize: 12, borderBottom: '0.5px solid #E0DED6' }}>{line.label}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{v.reg > 0 ? v.reg.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: v.ot > 0 ? '#A32D2D' : '#9A9890' }}>{v.ot > 0 ? v.ot.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: v.agency > 0 ? '#A32D2D' : '#9A9890' }}>{fh(v.agency)}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{v.total > 0 ? v.total.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
                        <span style={{ color: ppd > 0 ? ppdColor(ppd) : '#9A9890' }}>{ppd > 0 ? ppd.toFixed(2) : '—'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>

          {/* ── Administration & Ancillary ── */}
          <SectionLabel style={{ marginTop: 16 }}>Administration &amp; Ancillary — daily detail</SectionLabel>
          <TableWrap>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Department', 'Reg hrs', 'OT hrs', 'Agency hrs', 'Total hrs', 'PPD'].map((col, i) => (
                    <th key={i} style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      color: '#9A9890', background: '#F1EFE8', padding: '7px 10px',
                      textAlign: i === 0 ? 'left' : 'right',
                      borderBottom: '0.5px solid #E0DED6', whiteSpace: 'nowrap' as const,
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ancillaryLines.map(line => {
                  const v = getAncillaryValue(line, today)
                  const ppd = census ? v.total / census : 0
                  return (
                    <tr key={line.key}>
                      <td style={{ padding: '5px 10px', fontSize: 12, borderBottom: '0.5px solid #E0DED6' }}>{line.label}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{v.reg > 0 ? v.reg.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: v.ot > 0 ? '#A32D2D' : '#9A9890' }}>{v.ot > 0 ? v.ot.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#9A9890' }}>—</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{v.total > 0 ? v.total.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '0.5px solid #E0DED6', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#9A9890' }}>{ppd > 0 ? ppd.toFixed(2) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        </>
      )}

      {/* ── Page break ── */}
      <div id="page-break-marker" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 24px', color: '#9A9890', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
        <div style={{ flex: 1, height: 0.5, background: '#C8C6BE' }} />
        Page 2 — PPD trend
        <div style={{ flex: 1, height: 0.5, background: '#C8C6BE' }} />
      </div>

      {/* ── PPD cycle grid (chart removed) ── */}
      <SectionLabel>PPD by category — full cycle grid</SectionLabel>
      <TrendGrid data={data} nursingLines={nursingLines} />

      {/* ── Footer ── */}
      <div style={{ marginTop: 32, paddingTop: 12, borderTop: '0.5px solid #E0DED6', fontSize: 11, color: '#9A9890', display: 'flex', justifyContent: 'space-between' }}>
        <span>{data.facility?.name} &nbsp;·&nbsp; CMS ID: {data.facility?.cms_id}</span>
        <span>Generated {new Date().toLocaleDateString()} &nbsp;·&nbsp; Cycle {shortDate(data.cycleStart)} – {shortDate(data.cycleEnd)}</span>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────

function SectionLabel({ children, style }: any) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#5F5E5A', marginBottom: 8, ...style }}>{children}</div>
}

function KPI({ label, value, sub, valueColor, accent, accentRed }: any) {
  return (
    <div style={{
      background: accentRed ? '#FDECEA' : accent ? '#E6F1FB' : '#fff',
      border: `0.5px solid ${accentRed ? '#E8A09A' : accent ? '#378ADD' : '#E0DED6'}`,
      borderRadius: 6, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: '#9A9890', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1, color: valueColor || '#1A1A18' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9A9890', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function TableWrap({ children }: any) {
  return <div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>{children}</div>
}

function TrendGrid({ data, nursingLines }: { data: ReportData; nursingLines: NursingLineItem[] }) {
  // Build grid rows from nursingLines — always show all rows
  const gridRows = nursingLines.map(line => ({
    key: line.key,
    label: line.label,
    isAgency: line.isAgency,
    isSubtotal: line.isSubtotal,
    isTotal: line.isTotal,
  }))

  // Add census row at top
  const allRows = [
    { key: 'census', label: 'Census', isCensus: true, isAgency: false, isSubtotal: false, isTotal: false },
    ...gridRows,
  ]

  function getVal(key: string, day: ReportData['days'][0]): number | null {
    if (!day.census) return null
    if (key === 'census') return day.census
    const config = FACILITY_CONFIGS[getFacilityConfigKey(data.facility?.name || '')]
    const c = computeLineItems(day, day.census, config.nursingLines)
    const v = c.vals[key]
    if (!v) return null
    const total = key === 'census' ? day.census : v.total
    if (key === 'census') return day.census
    return day.census ? total / day.census : 0
  }

  const cellBase: React.CSSProperties = {
    padding: '4px 5px', textAlign: 'center', fontSize: 10,
    fontFamily: "'IBM Plex Mono',monospace",
    borderBottom: '0.5px solid #E0DED6',
  }

  return (
    <div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 6, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, color: '#9A9890', background: '#F1EFE8', padding: '5px 10px', textAlign: 'left', borderBottom: '0.5px solid #E0DED6', minWidth: 110 }}>Metric</th>
            {data.days.map((d, i) => (
              <th key={i} style={{ fontSize: 9, padding: '4px 3px', textAlign: 'center', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' as const, color: i === data.currentDay - 1 ? '#185FA5' : '#9A9890', background: i === data.currentDay - 1 ? '#E6F1FB' : '#F1EFE8', borderBottom: '0.5px solid #E0DED6', whiteSpace: 'nowrap' as const }}>
                {d.dow}<br />{shortDate(d.date)}
              </th>
            ))}
            <th style={{ fontSize: 9, padding: '4px 5px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase' as const, color: '#5F5E5A', background: '#F1EFE8', borderBottom: '0.5px solid #E0DED6' }}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((row) => {
            const vals = data.days.map(d => getVal(row.key, d))
            const completed = vals.filter(v => v !== null) as number[]
            const avg = completed.length ? completed.reduce((a, b) => a + b, 0) / completed.length : null

            const rowBg = row.isTotal ? '#E6F1FB' : row.isSubtotal ? '#F5F4F0' : 'transparent'

            return (
              <tr key={row.key} style={{ background: rowBg }}>
                <td style={{
                  padding: '4px 10px', fontSize: row.isAgency ? 10 : 11,
                  paddingLeft: row.isAgency ? 20 : 10,
                  color: row.isAgency ? '#5F5E5A' : '#1A1A18',
                  borderBottom: '0.5px solid #E0DED6',
                  fontWeight: row.isSubtotal || row.isTotal ? 700 : 400,
                  textDecoration: row.isSubtotal ? 'underline' : 'none',
                  background: rowBg,
                }}>
                  {row.label}
                </td>
                {data.days.map((d, i) => {
                  const v = vals[i]
                  const isToday = i === data.currentDay - 1
                  const pending = v === null
                  return (
                    <td key={i} style={{ ...cellBase, background: row.isTotal ? '#E6F1FB' : row.isSubtotal ? '#F5F4F0' : isToday ? '#EEF5FC' : 'transparent', fontWeight: row.isSubtotal || row.isTotal ? 700 : 400 }}>
                      {pending
                        ? <span style={{ color: '#E0DED6' }}>—</span>
                        : <span style={{ color: row.isTotal ? (v! >= PPD_RED / (d.census || 1) ? '#A32D2D' : '#185FA5') : row.isAgency && v! > 0 ? '#854F0B' : 'inherit' }}>
                          {'isCensus' in row && row.isCensus ? v : (v === 0 ? '—' : v!.toFixed(2))}
                        </span>
                      }
                    </td>
                  )
                })}
                <td style={{ ...cellBase, fontWeight: row.isSubtotal || row.isTotal ? 700 : 400, background: '#F5F4F0', color: row.isTotal && avg ? (avg >= PPD_RED ? '#A32D2D' : '#185FA5') : '#1A1A18' }}>
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
