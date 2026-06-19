'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ─── 发音 ────────────────────────────────────────────────────────────────────
function speakWord(word, setSpeaking) {
  if (typeof window === 'undefined') return
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel()
    setSpeaking(false)
    return
  }
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'de-DE'
  u.rate = 0.9
  u.onend = () => setSpeaking(false)
  setSpeaking(true)
  window.speechSynthesis.speak(u)
}

// ─── 视频工具函数 ─────────────────────────────────────────────────────────────
function getYouTubeId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

function getBilibiliId(url) {
  const m = url?.match(/bilibili\.com\/video\/(BV[\w]+|av\d+)/i)
  return m ? m[1] : null
}

function getVideoThumb(url) {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  return null
}

function getEmbedUrl(url) {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1`
  const bvId = getBilibiliId(url)
  if (bvId) return `https://player.bilibili.com/player.html?bvid=${bvId}&autoplay=1`
  return null
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ items, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const item = items[idx]

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, items.length - 1))
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length, onClose])

  const embedUrl = item.media_type === 'video' ? getEmbedUrl(item.file_url) : null

  return (
    <div className="wc-lightbox-bg" onClick={onClose}>
      <div className="wc-lightbox-box" onClick={e => e.stopPropagation()}>
        <button className="wc-lightbox-close" onClick={onClose} aria-label="关闭">✕</button>
        {item.media_type === 'video' ? (
          embedUrl ? (
            <div className="wc-lightbox-video-wrap">
              <iframe
                src={embedUrl}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="wc-lightbox-iframe"
              />
            </div>
          ) : (
            <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="wc-lightbox-video-link">
              在新标签页打开视频 →
            </a>
          )
        ) : (
          <img src={item.file_url} alt={item.title || ''} className="wc-lightbox-img" />
        )}
        {item.title && <p className="wc-lightbox-caption">{item.title}</p>}
        {items.length > 1 && (
          <div className="wc-lightbox-nav">
            <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0}>‹</button>
            <span>{idx + 1} / {items.length}</span>
            <button onClick={() => setIdx(i => Math.min(i + 1, items.length - 1))} disabled={idx === items.length - 1}>›</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 素材画廊 ────────────────────────────────────────────────────────────────
function MaterialGallery({ materials: initialMaterials, isAdmin }) {
  const [materials, setMaterials] = useState(initialMaterials || [])
  const [lightbox, setLightbox] = useState(null)
  const [deleting, setDeleting] = useState(null) // id or groupId being deleted

  useEffect(() => { setMaterials(initialMaterials || []) }, [initialMaterials])

  async function deleteSingle(m, e) {
    e.stopPropagation()
    if (!confirm(`确认删除「${m.title || '此素材'}」？`)) return
    setDeleting(m.id)
    // 删除 Storage 文件（视频链接无需删 storage）
    if (m.media_type !== 'video' && m.file_url) {
      const path = m.file_url.split('/materials/').pop()
      if (path) await supabase.storage.from('materials').remove([path])
    }
    await supabase.from('materials').delete().eq('id', m.id)
    setMaterials(prev => prev.filter(x => x.id !== m.id))
    setDeleting(null)
  }

  async function deletePPTGroup(groupId, slides, e) {
    e.stopPropagation()
    const title = slides[0]?.group_title || 'PPT 组'
    if (!confirm(`确认删除整组「${title}」共 ${slides.length} 张？`)) return
    setDeleting(groupId)
    const paths = slides.filter(s => s.file_url).map(s => s.file_url.split('/materials/').pop()).filter(Boolean)
    if (paths.length) await supabase.storage.from('materials').remove(paths)
    const ids = slides.map(s => s.id)
    await supabase.from('materials').delete().in('id', ids)
    setMaterials(prev => prev.filter(x => !ids.includes(x.id)))
    setDeleting(null)
  }

  if (!materials || materials.length === 0) return (
    <p className="wc-empty">暂无精选素材</p>
  )

  const pptGroups = {}
  const singles = []
  materials.forEach(m => {
    if (m.media_type === 'ppt' && m.group_id) {
      if (!pptGroups[m.group_id]) pptGroups[m.group_id] = []
      pptGroups[m.group_id].push(m)
    } else {
      singles.push(m)
    }
  })
  Object.values(pptGroups).forEach(g => g.sort((a, b) => (a.slide_order ?? 0) - (b.slide_order ?? 0)))

  return (
    <>
      <div className="wc-gallery">
        {Object.entries(pptGroups).map(([groupId, slides]) => {
          const cover = slides.find(s => s.is_cover) || slides[0]
          const isDeleting = deleting === groupId
          return (
            <div key={groupId} className="wc-thumb wc-thumb--wide" onClick={() => setLightbox({ items: slides, startIndex: 0 })}>
              {cover?.file_url
                ? <img src={cover.file_url} alt={cover.group_title || 'PPT'} className="wc-thumb-img" />
                : <div className="wc-thumb-placeholder"><span className="wc-thumb-icon">📊</span></div>
              }
              <span className="wc-badge wc-badge--ppt">PPT · {slides.length}张</span>
              {isAdmin && (
                <button className="wc-thumb-delete" onClick={e => deletePPTGroup(groupId, slides, e)} disabled={isDeleting} title="删除整组">
                  {isDeleting ? '…' : '✕'}
                </button>
              )}
              <p className="wc-thumb-label">{cover?.group_title || 'PPT 组'}</p>
            </div>
          )
        })}
        {singles.map(m => {
          const thumb = m.media_type === 'video' ? getVideoThumb(m.file_url) : null
          const isDeleting = deleting === m.id
          return (
            <div key={m.id} className="wc-thumb" onClick={() => setLightbox({ items: [m], startIndex: 0 })}>
              {m.media_type === 'image' && m.file_url
                ? <img src={m.file_url} alt={m.title || ''} className="wc-thumb-img" />
                : thumb
                  ? <div className="wc-thumb-video-wrap">
                      <img src={thumb} alt={m.title || ''} className="wc-thumb-img" />
                      <div className="wc-thumb-play-overlay"><span>▶</span></div>
                    </div>
                  : <div className="wc-thumb-placeholder"><span className="wc-thumb-icon">▶</span></div>
              }
              {m.media_type === 'video' && <span className="wc-badge wc-badge--video">▶ 视频</span>}
              {isAdmin && (
                <button className="wc-thumb-delete" onClick={e => deleteSingle(m, e)} disabled={isDeleting} title="删除素材">
                  {isDeleting ? '…' : '✕'}
                </button>
              )}
              <p className="wc-thumb-label">{m.title || '素材'}</p>
            </div>
          )
        })}
      </div>
      {lightbox && (
        <Lightbox items={lightbox.items} startIndex={lightbox.startIndex} onClose={() => setLightbox(null)} />
      )}
    </>
  )
}

// ─── 词族 ────────────────────────────────────────────────────────────────────
function WordFamily({ wordFamily: initialFamily, onWordClick, isAdmin, word, onFamilyUpdate }) {
  const [localFamily, setLocalFamily] = useState(initialFamily || [])
  const [showAdd, setShowAdd] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [newMeaning, setNewMeaning] = useState('')
  const [newType, setNewType] = useState('verb')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { setLocalFamily(initialFamily || []) }, [initialFamily])

  async function addFamilyWord() {
    if (!newWord.trim() || !newMeaning.trim()) return
    setAdding(true)
    const { error } = await supabase.from('word_family').insert({
      word,
      related_word: newWord.trim(),
      meaning: newMeaning.trim(),
      type: newType,
      source: 'manual',
      is_featured: true,
      sort_order: -1
    })
    if (error) {
      alert('添加失败：' + error.message)
    } else {
      const newEntry = { related_word: newWord.trim(), meaning: newMeaning.trim(), type: newType, source: 'manual', is_featured: true }
      setLocalFamily(prev => [newEntry, ...prev])
      onFamilyUpdate(newEntry)
      setNewWord(''); setNewMeaning(''); setNewType('verb'); setShowAdd(false)
    }
    setAdding(false)
  }

  async function deleteFamilyWord(w, e) {
    e.stopPropagation()
    setDeleting(w.related_word)
    const { error } = await supabase.from('word_family')
      .delete()
      .eq('word', word)
      .eq('related_word', w.related_word)
    if (error) {
      alert('删除失败：' + error.message)
    } else {
      setLocalFamily(prev => prev.filter(x => x.related_word !== w.related_word))
    }
    setDeleting(null)
  }

  const groups = { verb: [], noun: [], adj: [], other: [] }
  ;(localFamily || []).forEach(w => {
    const t = w.type?.toLowerCase()
    if (t === 'verb') groups.verb.push(w)
    else if (t === 'noun') groups.noun.push(w)
    else if (t === 'adj') groups.adj.push(w)
    else groups.other.push(w)
  })

  const labels = { verb: '动词', noun: '名词', adj: '形容词', other: '其他' }
  const colors = { verb: '#1a1a2e', noun: '#2d6a4f', adj: '#7b2d8b', other: '#666' }

  return (
    <div>
      {isAdmin && (
        <div style={{ marginBottom: '10px' }}>
          <button className="wc-admin-btn" onClick={() => setShowAdd(!showAdd)}>＋ 手动添加</button>
        </div>
      )}

      {showAdd && (
        <div className="wc-add-family-form">
          <p className="wc-add-family-title">添加词族词汇</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <input value={newWord} onChange={e => setNewWord(e.target.value)}
              placeholder="词汇（如：auszeichnen）" className="wc-input" style={{ flex: '2 1 120px' }} />
            <input value={newMeaning} onChange={e => setNewMeaning(e.target.value)}
              placeholder="含义" className="wc-input" style={{ flex: '2 1 100px' }} />
            <select value={newType} onChange={e => setNewType(e.target.value)} className="wc-input" style={{ flex: '1 1 80px' }}>
              <option value="verb">动词</option>
              <option value="noun">名词</option>
              <option value="adj">形容词</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addFamilyWord} disabled={adding} className="wc-btn-primary">
              {adding ? '添加中...' : '确认添加'}
            </button>
            <button onClick={() => setShowAdd(false)} className="wc-btn-secondary">取消</button>
          </div>
        </div>
      )}

      {Object.entries(groups).map(([type, words]) =>
        words.length > 0 ? (
          <div key={type} className="wc-family-group">
            <p className="wc-family-group-label">{labels[type]}</p>
            <div className="wc-family-tags">
              {words.map((w, i) => {
                const isManual = w.source === 'manual'
                const isDeleting = deleting === w.related_word
                return (
                  <div key={i} className="wc-tag-wrap">
                    <button
                      className="wc-tag"
                      style={{ borderLeftColor: colors[type] }}
                      onClick={() => onWordClick?.(w.related_word.replace(/^(der|die|das|sich)\s/i, ''))}
                      title={w.meaning}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{w.related_word}</span>
                      <span style={{ fontSize: '0.75rem', color: '#666', display: 'block' }}>{w.meaning}</span>
                      {isManual && (
                        <span style={{ fontSize: '0.65rem', color: '#2d6a4f' }}>✦ 精选</span>
                      )}
                    </button>
                    {isAdmin && isManual && (
                      <button
                        className="wc-tag-delete"
                        onClick={e => deleteFamilyWord(w, e)}
                        disabled={isDeleting}
                        title="删除此词"
                      >
                        {isDeleting ? '…' : '✕'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null
      )}

      {(!localFamily || localFamily.length === 0) && <p className="wc-empty">暂无词族数据</p>}
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function WordCard({ data, onWordClick }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [regenerating, setRegenerating] = useState('')
  const [editingHook, setEditingHook] = useState(false)
  const [hookDraft, setHookDraft] = useState('')
  const [localData, setLocalData] = useState(null)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    if (localStorage.getItem('isAdmin') === 'true') setIsAdmin(true)
  }, [])

  useEffect(() => {
    setLocalData(data)
    setEditingHook(false)
    setActiveTab(0)
  }, [data])

  if (!localData) return null

  const { word, wordData, wordFamily, materials } = localData
  const { part_of_speech, definitions, memory_hook, sentences, lemma, is_inflected, inflection_note } = wordData || {}
  const materialCount = materials?.length ?? 0

  async function handleLogin() {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput })
    })
    const result = await res.json()
    if (result.success) {
      setIsAdmin(true)
      localStorage.setItem('isAdmin', 'true')
      localStorage.setItem('adminPwd', passwordInput)
      setShowLogin(false); setLoginError(''); setPasswordInput('')
    } else {
      setLoginError('密码错误')
    }
  }

  function handleLogout() {
    setIsAdmin(false)
    localStorage.removeItem('isAdmin')
    localStorage.removeItem('adminPwd')
  }

  async function regenerate(type) {
    setRegenerating(type)
    const password = localStorage.getItem('adminPwd') || ''
    const res = await fetch('/api/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, type, password })
    })
    const result = await res.json()
    if (result.error) {
      alert('操作失败：' + result.error)
    } else {
      if (type === 'hook') {
        setLocalData(prev => ({ ...prev, wordData: { ...prev.wordData, memory_hook: result.result } }))
      } else if (type === 'sentences') {
        setLocalData(prev => ({ ...prev, wordData: { ...prev.wordData, sentences: result.result } }))
      } else if (type === 'word_family') {
        const newFamily = result.result.map((w, i) => ({ ...w, related_word: w.word, source: 'ai', sort_order: i }))
        setLocalData(prev => ({ ...prev, wordFamily: newFamily }))
      }
    }
    setRegenerating('')
  }

  async function saveHook() {
    await supabase.from('word_cache').update({ memory_hook: hookDraft }).eq('word', word)
    setLocalData(prev => ({ ...prev, wordData: { ...prev.wordData, memory_hook: hookDraft } }))
    setEditingHook(false)
  }

  function handleFamilyUpdate(newEntry) {
    setLocalData(prev => ({ ...prev, wordFamily: [newEntry, ...(prev.wordFamily || [])] }))
  }

  const btnStyle = {
    background: 'none', border: '1px solid #ddd', borderRadius: '6px',
    padding: '3px 10px', fontSize: '0.75rem', cursor: 'pointer', color: '#666', marginLeft: '8px'
  }

  const HookBlock = () => (
    <div className="wc-hook" style={{ marginBottom: '1.1rem' }}>
      <p className="wc-hook-label">
        💡 记忆钩子
        {isAdmin && (
          <>
            <button style={btnStyle} onClick={() => { setEditingHook(true); setHookDraft(memory_hook) }}>✏️ 编辑</button>
            <button style={btnStyle} onClick={() => regenerate('hook')} disabled={regenerating === 'hook'}>
              {regenerating === 'hook' ? '生成中...' : '🔄 重新生成'}
            </button>
          </>
        )}
      </p>
      {editingHook ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <textarea value={hookDraft} onChange={e => setHookDraft(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem', lineHeight: '1.6', minHeight: '80px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button onClick={saveHook} className="wc-btn-primary" style={{ padding: '7px 12px' }}>保存</button>
            <button onClick={() => setEditingHook(false)} className="wc-btn-secondary" style={{ padding: '7px 12px' }}>取消</button>
          </div>
        </div>
      ) : (
        <p className="wc-hook-text">{memory_hook}</p>
      )}
    </div>
  )

  const DefinitionsBlock = () => (
    <div>
      <p className="wc-section-label">词义</p>
      {definitions?.length > 0 ? (
        <ol className="wc-defs">
          {definitions.map((d, i) => (
            <li key={i} className="wc-def-item">
              <span className="wc-def-de">{d.meaning || d.german || d.definition}</span>
              {(d.note || d.chinese) && <span className="wc-def-zh">{d.note || d.chinese}</span>}
            </li>
          ))}
        </ol>
      ) : <p className="wc-empty">暂无词义数据</p>}
    </div>
  )

  const SentencesBlock = () => (
    <div>
      <p className="wc-section-label" style={{ marginTop: '1.25rem' }}>
        例句
        {isAdmin && (
          <button style={btnStyle} onClick={() => regenerate('sentences')} disabled={regenerating === 'sentences'}>
            {regenerating === 'sentences' ? '生成中...' : '🔄 重新生成'}
          </button>
        )}
      </p>
      {sentences?.length > 0 ? (
        <ul className="wc-sentences">
          {sentences.map((s, i) => (
            <li key={i} className="wc-sentence-item">
              <p className="wc-sentence-de">{s.de || s.german || s.sentence}</p>
              {(s.zh || s.chinese) && <p className="wc-sentence-zh">{s.zh || s.chinese}</p>}
            </li>
          ))}
        </ul>
      ) : <p className="wc-empty">暂无例句</p>}
    </div>
  )

  const FamilyWithAdmin = () => (
    <div>
      {isAdmin && (
        <div style={{ marginBottom: '8px' }}>
          <button style={btnStyle} onClick={() => regenerate('word_family')} disabled={regenerating === 'word_family'}>
            {regenerating === 'word_family' ? '生成中...' : '🔄 重新生成'}
          </button>
        </div>
      )}
      <WordFamily
        wordFamily={localData.wordFamily}
        onWordClick={onWordClick}
        isAdmin={isAdmin}
        word={word}
        onFamilyUpdate={handleFamilyUpdate}
      />
    </div>
  )

  const tabPanels = [
    { label: '📖 词义', content: <><HookBlock /><DefinitionsBlock /><SentencesBlock /></> },
    { label: '🌿 词族', content: <FamilyWithAdmin /> },
    { label: materialCount > 0 ? `✦ 素材 ${materialCount}` : '✦ 素材', content: <MaterialGallery materials={materials} isAdmin={isAdmin} /> },
  ]

  return (
    <div className="wc-root">

      {/* 管理员栏 */}
      <div style={{ textAlign: 'right', marginBottom: '8px' }}>
        {isAdmin ? (
          <span style={{ fontSize: '0.8rem', color: '#999' }}>
            🔑 管理员模式
            <button onClick={handleLogout} style={btnStyle}>退出</button>
          </span>
        ) : (
          <button onClick={() => setShowLogin(!showLogin)} style={btnStyle}>管理员登录</button>
        )}
      </div>

      {showLogin && !isAdmin && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '16px',
          marginBottom: '12px', border: '1px solid #e5e7eb',
          display: 'flex', gap: '10px', alignItems: 'center'
        }}>
          <input type="password" value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="管理员密码"
            style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem' }} />
          <button onClick={handleLogin} className="wc-btn-primary">确认</button>
          {loginError && <span style={{ color: 'red', fontSize: '0.85rem' }}>{loginError}</span>}
        </div>
      )}

      {/* 桌面三栏 */}
      <div className="wc-desktop">
        <div className="wc-grid">
          <aside className="wc-left">
            <div className="wc-word-head">
              <h1 className="wc-word">{word}</h1>
              {part_of_speech && <span className="wc-pos">{part_of_speech}</span>}
              {is_inflected && lemma && lemma !== word && (
                <button
                  className="wc-lemma-hint"
                  onClick={() => onWordClick?.(lemma)}
                  title={inflection_note || ''}
                >
                  → 原形：{lemma}
                </button>
              )}
              <button className="wc-speak" onClick={() => speakWord(word, setSpeaking)}>
                {speaking ? '⏹ 停止' : '🔊 发音'}
              </button>
            </div>
            <p className="wc-section-label" style={{ marginTop: '1.25rem' }}>
              词族
              {isAdmin && (
                <button style={{ ...btnStyle, marginLeft: '6px' }} onClick={() => regenerate('word_family')} disabled={regenerating === 'word_family'}>
                  {regenerating === 'word_family' ? '生成中...' : '🔄'}
                </button>
              )}
            </p>
            <WordFamily
              wordFamily={localData.wordFamily}
              onWordClick={onWordClick}
              isAdmin={isAdmin}
              word={word}
              onFamilyUpdate={handleFamilyUpdate}
            />
          </aside>

          <section className="wc-mid">
            <HookBlock />
            <DefinitionsBlock />
            <SentencesBlock />
          </section>

          <aside className="wc-right">
            <p className="wc-section-label">
              精选素材
              {materialCount > 0 && <span className="wc-badge wc-badge--count">{materialCount}</span>}
            </p>
            <MaterialGallery materials={materials} isAdmin={isAdmin} />
          </aside>
        </div>
      </div>

      {/* 移动端 Tab */}
      <div className="wc-mobile">
        <div className="wc-mobile-head">
          <div>
            <h1 className="wc-word">{word}</h1>
            {part_of_speech && <span className="wc-pos">{part_of_speech}</span>}
            {is_inflected && lemma && lemma !== word && (
              <button
                className="wc-lemma-hint"
                onClick={() => onWordClick?.(lemma)}
                title={inflection_note || ''}
              >
                → 原形：{lemma}
              </button>
            )}
          </div>
          <button className="wc-speak" onClick={() => speakWord(word, setSpeaking)}>
            {speaking ? '⏹' : '🔊'}
          </button>
        </div>
        <div className="wc-tabs" role="tablist">
          {tabPanels.map((tab, i) => (
            <button key={i} role="tab" aria-selected={activeTab === i}
              className={`wc-tab${activeTab === i ? ' wc-tab--active' : ''}`}
              onClick={() => setActiveTab(i)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="wc-tab-panel">
          {tabPanels[activeTab].content}
        </div>
      </div>

    </div>
  )
}
