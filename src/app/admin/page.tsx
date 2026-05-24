'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ALL_DEPARTMENTS } from '@/lib/departments'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [facilities, setFacilities] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [depts, setDepts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleAuth() {
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSCODE || pw === 'admin') setAuthed(true)
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

  const s = {
    wrap: { minHeight:'100vh', background:'#F1EFE8', padding:'32px 24px', fontFamily:"'IBM Plex Sans',sans-serif" },
    card: { background:'#fff', border:'0.5px solid #E0DED6', borderRadius:8, padding:'24px', marginBottom:16 },
    label: { fontSize:11, fontWeight:600 as const, letterSpacing:'0.07em', textTransform:'uppercase' as const, color:'#5F5E5A', marginBottom:6, display:'block' as const },
    input: { width:'100%', border:'0.5px solid #C8C6BE', borderRadius:4, padding:'8px 10px', fontSize:13, fontFamily:"'IBM Plex Sans',sans-serif", outline:'none' },
    btn: { padding:'9px 18px', border:'none', borderRadius:4, fontSize:13, fontWeight:600 as const, color:'#fff', background:'#185FA5', cursor:'pointer', fontFamily:"'IBM Plex Sans',sans-serif" },
  }

  if (!authed) return (
    <div style={{ ...s.wrap, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ ...s.card, width:320 }}>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>Admin access</div>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key==='Enter'&&handleAuth()} style={s.input} placeholder="Admin passcode" />
        <button onClick={handleAuth} style={{ ...s.btn, marginTop:12, width:'100%' }}>Enter</button>
      </div>
    </div>
  )

  const groups = [...new Set(ALL_DEPARTMENTS.map(d => d.cc1_group))]

  return (
    <div style={s.wrap}>
      <div style={{ maxWidth:860, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={{ fontSize:18, fontWeight:600 }}>Admin — Facility configuration</div>
          <a href="/" style={{ fontSize:12, color:'#9A9890', textDecoration:'none' }}>← Back to app</a>
        </div>

        <div style={s.card}>
          <label style={s.label}>Select facility</label>
          <div style={{ display:'flex', gap:10 }}>
            {facilities.map(f => (
              <button key={f.id} onClick={() => setSelected(f)} style={{ padding:'8px 16px', border:'none', borderRadius:4, fontSize:13, fontWeight:600, cursor:'pointer', background: selected?.id===f.id?'#185FA5':'#E6F1FB', color: selected?.id===f.id?'#fff':'#185FA5' }}>
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <>
            {/* Email contacts */}
            <div style={s.card}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>Email contacts</div>
              <label style={s.label}>Comma-separated email addresses</label>
              <div style={{ display:'flex', gap:10 }}>
                <input defaultValue={selected.email_contacts?.join(', ')} id="contacts-input" style={s.input} placeholder="email1@example.com, email2@example.com" />
                <button onClick={() => saveContacts((document.getElementById('contacts-input') as HTMLInputElement).value)} style={{ ...s.btn, whiteSpace:'nowrap' }}>Save</button>
              </div>
            </div>

            {/* Facility passcode */}
            <div style={s.card}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>Facility passcode</div>
              <div style={{ fontSize:13, color:'#5F5E5A' }}>Current passcode: <code style={{ background:'#F1EFE8', padding:'2px 6px', borderRadius:3 }}>{selected.passcode}</code></div>
              <div style={{ fontSize:11, color:'#9A9890', marginTop:6 }}>To change a passcode, update it directly in the Supabase dashboard → facilities table.</div>
            </div>

            {/* Department toggles */}
            <div style={s.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>Active departments</div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  {saved && <span style={{ fontSize:12, color:'#3B6D11' }}>✓ Saved</span>}
                  <button onClick={saveDepts} disabled={saving} style={s.btn}>{saving ? 'Saving…' : 'Save changes'}</button>
                </div>
              </div>
              {groups.map(group => {
                const groupDepts = depts.filter(d => d.cc1_group === group)
                if (!groupDepts.length) return null
                return (
                  <div key={group} style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9A9890', marginBottom:8 }}>{group}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {groupDepts.map(d => (
                        <label key={d.cc2_name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', padding:'5px 10px', borderRadius:4, background: d.included?'#E6F1FB':'#F1EFE8', border:`0.5px solid ${d.included?'#378ADD':'#C8C6BE'}`, color: d.included?'#185FA5':'#5F5E5A' }}>
                          <input type="checkbox" checked={d.included} onChange={() => toggleDept(d.cc2_name)} style={{ accentColor:'#185FA5' }} />
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