'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ALL_DEPARTMENTS } from '@/lib/departments'

const C = {
  bg: '#F7F5EE', bgStrip: '#F1EFE8', white: '#fff',
  border: '#E0DED6', borderMid: '#DDD9CF',
  text: '#2C2C2A', textSoft: '#3A3A38', textMuted: '#888780', textFaint: '#A8A69E',
  blue: '#185FA5', blueLight: '#E6F1FB', green: '#3B6D11',
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [facilities, setFacilities] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [depts, setDepts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleAuth() {
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSCODE) setAuthed(true)
    else setAuthed(false)
  }

  useEffect(() => {
    if (!authed) return
    supabase.from('facilities').select('*').then(({ data }) => { if (data) setFacilities(data) })
  }, [authed])

  useEffect(() => {
    if (!selected) return
    supabase.from('facility_departments').select('*').eq('facility_id', selected.id).then(({ data }) => { if (data) setDepts(data) })
  }, [selected])

  function toggleDept(cc2_name: string) {
    setDepts(prev => prev.map(d => d.cc2_name === cc2_name ? { ...d, included: !d.included } : d))
    setSaved(false)
  }

  async function saveDepts() {
    setSaving(true)
    for (const d of depts) {
      await supabase.from('facility_departments').update({ included: d.included }).eq('id', d.id)
    }
    setSaving(false)
    setSaved(true)
  }

  async function saveContacts(contacts: string) {
    const arr = contacts.split(',').map(s => s.trim()).filter(Boolean)
    await supabase.from('facilities').update({ email_contacts: arr }).eq('id', selected.id)
    setSelected((prev: any) => ({ ...prev, email_contacts: arr }))
  }

  const card: React.CSSProperties = { background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: '20px 24px', marginBottom: 12 }
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textMuted, marginBottom: 6, display: 'block' }
  const inputStyle: React.CSSProperties = { width: '100%', border: `0.5px solid ${C.borderMid}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: 'none', background: '#FAFAF8', color: C.text }
  const btnPrimary: React.CSSProperties = { padding: '9px 20px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#fff', background: C.blue, cursor: 'pointer', fontFamily: "'IBM Plex Sans',sans-serif" }

  const TopBar = () => (
    <div style={{ background: C.white, borderBottom: `0.5px solid ${C.border}`, padding: '0 28px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky' as const, top: 0, zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 26, height: 26, background: C.blue, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.text, letterSpacing: '-0.01em' }}>Payroll PPD Report</span>
        <span style={{ fontSize: 12, color: C.textFaint }}>— Admin</span>
      </div>
      <a href="/" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'none' }}>← Back to app</a>
    </div>
  )

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans',sans-serif" }}>
      <TopBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 48px)' }}>
        <div style={{ ...card, width: 320, marginBottom: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 16 }}>Admin access</div>
          <label style={labelStyle}>Passcode</label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} style={inputStyle} placeholder="Enter admin passcode" />
          <button onClick={handleAuth} style={{ ...btnPrimary, marginTop: 12, width: '100%' }}>Enter</button>
        </div>
      </div>
    </div>
  )

  const groups = [...new Set(ALL_DEPARTMENTS.map(d => d.cc1_group))]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans',sans-serif" }}>
      <TopBar />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px' }}>

        <div style={card}>
          <label style={labelStyle}>Select facility</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {facilities.map(f => (
              <button key={f.id} onClick={() => setSelected(f)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'IBM Plex Sans',sans-serif", background: selected?.id === f.id ? C.blue : C.blueLight, color: selected?.id === f.id ? '#fff' : C.blue, transition: 'all 0.1s' }}>
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <>
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 12 }}>Email contacts</div>
              <label style={labelStyle}>Comma-separated addresses</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input defaultValue={selected.email_contacts?.join(', ')} id="contacts-input" style={inputStyle} placeholder="email1@example.com, email2@example.com" />
                <button onClick={() => saveContacts((document.getElementById('contacts-input') as HTMLInputElement).value)} style={{ ...btnPrimary, whiteSpace: 'nowrap' }}>Save</button>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 8 }}>Facility passcode</div>
              <div style={{ fontSize: 13, color: C.textSoft }}>Current: <code style={{ background: C.bgStrip, padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>{selected.passcode}</code></div>
              <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6 }}>To change, edit directly in Supabase → facilities table.</div>
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Active departments</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {saved && <span style={{ fontSize: 12, color: C.green }}>✓ Saved</span>}
                  <button onClick={saveDepts} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Save changes'}</button>
                </div>
              </div>
              {groups.map(group => {
                const groupDepts = depts.filter(d => d.cc1_group === group)
                if (!groupDepts.length) return null
                return (
                  <div key={group} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: C.textFaint, marginBottom: 8 }}>{group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {groupDepts.map(d => (
                        <label key={d.cc2_name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '5px 10px', borderRadius: 6, background: d.included ? C.blueLight : C.bgStrip, border: `0.5px solid ${d.included ? '#378ADD' : C.borderMid}`, color: d.included ? C.blue : C.textMuted, transition: 'all 0.1s' }}>
                          <input type="checkbox" checked={d.included} onChange={() => toggleDept(d.cc2_name)} style={{ accentColor: C.blue }} />
                          {d.cc2_name}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
