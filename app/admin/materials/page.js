'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function getVideoThumb(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

function MaterialRow({ material, onUpdate }) {
  const [linkedWords, setLinkedWords] = useState([])
  const [adding, setAdding] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [saving, setSaving] = useState(false)
  const [unlinking, setUnlinking] = useState(null)

  useEffect(() => { fetchLinkedWords() }, [material.id])

  async function fetchLinkedWords() {
    const { data } = await supabase
      .from('material_words')
      .select('word_id, words(word)')
      .eq('material_id', material.id)
    setLinkedWords(data?.map(r => ({ word_id: r.word_id, word: r.words?.word })).filter(r => r.word) || [])
  }

  async function addWord() {
    const w = newWord.trim().toLowerCase()
    if (!w) return
    setSaving(true)
    try {
      const upper = w.charAt(0).toUpperCase() + w.slice(1)
      const { data: existingUpper } = await supabase.from('words').select('id').eq('word', upper).single()
      const { data: existingLower } = !existingUpper
        ? await supabase.from('words').select('id').eq('word', w).single()
        : { data: null }
      let wordId = existingUpper?.id || existingLower?.id
      if (!wordId) {
        const { data: created } = await supabase.from('words').insert({ word: w }).select('id').single()
        wordId = created?.id
      }
      if (wordId) {
        await supabase.from('material_words').upsert(
          { material_id: material.id, word_id: wordId },
          { onConflict: 'material_id,word_id', ignoreDuplicates: true }
        )
        await fetchLinkedWords()
        setNewWord('')
        setAdding(false)
        onUpdate?.()
      }
    } catch (err) {
      alert('添加失败：' + err.message)
    }
    setSaving(false)
  }

  async function removeWord(wordId) {
    setUnlinking(wordId)
    await supabase.from('material_words').delete()
      .eq('material_id', material.id).eq('word_id', wordId)
    setLinkedWords(prev => prev.filter(r => r.word_id !== wordId))
    setUnlinking(null)
  }

  const thumb = material.media_type === 'video' ? getVideoThumb(material.file_url) : material.file_url

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px',
      padding: '16px', background: 'white', borderRadius: '12px',
      border: '1px solid #e5e7eb', marginBottom: '10px', alignItems: 'start'
    }}>
      <div style={{
        width: '80px', height: '60px', borderRadius: '8px', overflow: 'hidden',
        background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {thumb
          ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: '1.5rem' }}>
              {material.media_type === 'video' ? '▶' : material.media_type === 'ppt' ? '📊' : '🖼'}
            </span>
        }
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111' }}>
            {material.group_title || material.title || '无标题'}
          </p>
          <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', background: '#f0f0f0', color: '#666' }}>
            {material.media_type === 'ppt' ? 'PPT' : material.media_type === 'video' ? '视频' : '图片'}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {linkedWords.length === 0 && <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>暂无关联词</span>}
          {linkedWords.map(r => (
            <span key={r.word_id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: '#eff6ff', color: '#1d4ed8', borderRadius: '20px',
              padding: '3px 10px', fontSize: '0.78rem', border: '1px solid #bfdbfe'
            }}>
              {r.word}
              <button onClick={() => removeWord(r.word_id)} disabled={unlinking === r.word_id}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '0.7rem', padding: 0, lineHeight: 1 }}>
                {unlinking === r.word_id ? '…' : '✕'}
              </button>
            </span>
          ))}
          {adding ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <input autoFocus value={newWord} onChange={e => setNewWord(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addWord(); if (e.key === 'Escape') setAdding(false) }}
                placeholder="输入单词"
                style={{ width: '100px', padding: '3px 8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.78rem' }} />
              <button onClick={() => addWord()} disabled={saving}
                style={{ background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                {saving ? '…' : '确认'}
              </button>
              <button onClick={() => { setAdding(false); setNewWord('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem' }}>取消</button>
            </span>
          ) : (
            <button onClick={() => setAdding(true)}
              style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: '20px', padding: '3px 10px', fontSize: '0.75rem', color: '#6b7280', cursor: 'pointer' }}>
              ＋ 关联词
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MaterialsManagePage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const searchParams = useSearchParams()
  const backWord = searchParams.get('back') || ''

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('materials').select('*').order('slide_order')
    const seen = new Set()
    const deduped = (data || []).filter(m => {
      if (!m.group_id) return true
      if (seen.has(m.group_id)) return false
      seen.add(m.group_id)
      return true
    })
    setMaterials(deduped)
    setLoading(false)
  }, [])

  const authWithPassword = useCallback(async (pwd) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    })
    const data = await res.json()
    if (data.success) { setAuthed(true); setAuthError('') }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('adminPwd')
    if (saved) authWithPassword(saved)
  }, [authWithPassword])

  useEffect(() => {
    if (authed) loadMaterials()
  }, [authed, loadMaterials])

  async function handleAuth() {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    const data = await res.json()
    if (data.success) {
      localStorage.setItem('adminPwd', password)
      setAuthed(true); setAuthError('')
    } else {
      setAuthError('密码错误')
    }
  }

  const filtered = materials.filter(m =>
    !filter || (m.group_title || m.title || '').toLowerCase().includes(filter.toLowerCase())
  )

  if (!authed) {
    return (
      <main style={{ minHeight: '100vh', padding: '40px 20px', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '360px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ marginBottom: '24px', fontSize: '1.2rem', fontWeight: '700' }}>🔑 管理员登录</h2>
          <input type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="输入管理员密码"
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '0.95rem', marginBottom: '12px', boxSizing: 'border-box' }} />
          <button onClick={handleAuth} style={{
            width: '100%', padding: '12px', background: '#1a1a2e', color: 'white',
            border: 'none', borderRadius: '8px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '600'
          }}>进入</button>
          {authError && <p style={{ color: 'red', marginTop: '10px', textAlign: 'center', fontSize: '0.85rem' }}>{authError}</p>}
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', padding: '40px 20px', background: '#f8f7f4' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>📎 素材关联管理</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <a href={backWord ? `/admin?back=${encodeURIComponent(backWord)}` : '/admin'} style={{ color: '#666', fontSize: '0.85rem' }}>← 上传素材</a>
            <a href={backWord ? `/?w=${encodeURIComponent(backWord)}` : '/'} style={{ color: '#666', fontSize: '0.85rem' }}>← 返回首页</a>
          </div>
        </div>
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="搜索素材标题..."
          style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '0.9rem', marginBottom: '16px', boxSizing: 'border-box', background: 'white' }} />
        {loading
          ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>加载中...</p>
          : filtered.length === 0
            ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>暂无素材</p>
            : filtered.map(m => <MaterialRow key={m.id} material={m} onUpdate={loadMaterials} />)
        }
      </div>
    </main>
  )
}

export default function Page() {
  return (
    <Suspense>
      <MaterialsManagePage />
    </Suspense>
  )
}
