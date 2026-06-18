'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function MaterialsDisplay({ materials }) {
  const [pptStates, setPptStates] = useState({})

  const pptGroups = {}
  const standalone = []

  materials.forEach(m => {
    if (m.group_id) {
      if (!pptGroups[m.group_id]) pptGroups[m.group_id] = []
      pptGroups[m.group_id].push(m)
    } else {
      standalone.push(m)
    }
  })

  function setPage(groupId, page) {
    setPptStates(prev => ({ ...prev, [groupId]: page }))
  }

  return (
    <div>
      {Object.entries(pptGroups).map(([groupId, slides]) => {
        const currentPage = pptStates[groupId] ?? -1
        const cover = slides.find(s => s.is_cover) || slides[0]
        const isExpanded = currentPage >= 0
        const page = isExpanded ? currentPage : 0

        return (
          <div key={groupId} style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '12px'
            }}>
              <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                📊 {cover.group_title || cover.title}
                <span style={{ color: '#999', fontWeight: '400', marginLeft: '8px', fontSize: '0.85rem' }}>
                  共{slides.length}页
                </span>
              </p>
              <button
                onClick={() => setPage(groupId, isExpanded ? -1 : 0)}
                style={{
                  background: '#f0f0f0', border: 'none', borderRadius: '8px',
                  padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'
                }}
              >
                {isExpanded ? '收起' : '▶ 展开查看'}
              </button>
            </div>

            <div>
              <img
                src={isExpanded ? slides[page]?.file_url : cover.file_url}
                alt={cover.title}
                style={{ width: '100%', borderRadius: '10px', display: 'block' }}
              />
              {isExpanded && (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginTop: '12px'
                }}>
                  <button
                    onClick={() => setPage(groupId, Math.max(0, page - 1))}
                    disabled={page === 0}
                    style={{
                      background: page === 0 ? '#f0f0f0' : '#1a1a2e',
                      color: page === 0 ? '#ccc' : 'white',
                      border: 'none', borderRadius: '8px',
                      padding: '8px 20px', cursor: page === 0 ? 'default' : 'pointer',
                      fontWeight: '600', fontSize: '0.9rem'
                    }}
                  >← 上一页</button>
                  <span style={{ color: '#666', fontSize: '0.85rem' }}>
                    {page + 1} / {slides.length}
                  </span>
                  <button
                    onClick={() => setPage(groupId, Math.min(slides.length - 1, page + 1))}
                    disabled={page === slides.length - 1}
                    style={{
                      background: page === slides.length - 1 ? '#f0f0f0' : '#1a1a2e',
                      color: page === slides.length - 1 ? '#ccc' : 'white',
                      border: 'none', borderRadius: '8px',
                      padding: '8px 20px',
                      cursor: page === slides.length - 1 ? 'default' : 'pointer',
                      fontWeight: '600', fontSize: '0.9rem'
                    }}
                  >下一页 →</button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {standalone.map(m => (
        <div key={m.id} style={{ marginBottom: '16px' }}>
          {(m.type === 'image' || m.type === 'ppt_slide') && m.file_url && (
            <div>
              {m.title && (
                <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '8px' }}>
                  🖼 {m.title}
                </p>
              )}
              <img src={m.file_url} alt={m.title}
                style={{ width: '100%', borderRadius: '10px' }} />
            </div>
          )}
          {m.type === 'video' && m.file_url && (
            <div>
              {m.title && (
                <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '8px' }}>
                  🎥 {m.title}
                </p>
              )}
              <div style={{
                background: '#f8f7f4', borderRadius: '10px',
                padding: '16px', textAlign: 'center'
              }}>
                <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#1a1a2e', fontWeight: '600' }}>
                  ▶ 点击观看视频
                </a>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function WordCard({ word, onWordClick }) {
  const [aiContent, setAiContent] = useState(null)
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [regenerating, setRegenerating] = useState('')
  const [editingHook, setEditingHook] = useState(false)
  const [hookDraft, setHookDraft] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [showAddFamily, setShowAddFamily] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [newMeaning, setNewMeaning] = useState('')
  const [newType, setNewType] = useState('verb')
  const [addingFamily, setAddingFamily] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('isAdmin')
    if (saved === 'true') setIsAdmin(true)
  }, [])

  useEffect(() => {
    setLoading(true)
    setAiContent(null)
    setMaterials([])
    fetchAll(word)
  }, [word])

  async function fetchAll(w) {
    await Promise.all([fetchAI(w), fetchMaterials(w)])
    setLoading(false)
  }

  async function fetchAI(w) {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: w })
    })
    const data = await res.json()
    setAiContent(data)
  }

  async function fetchMaterials(w) {
    const { data: wordData } = await supabase
      .from('words')
      .select('id')
      .eq('word', w)
      .single()
    if (!wordData) return
    const { data } = await supabase
      .from('materials')
      .select('*')
      .eq('word_id', wordData.id)
      .order('slide_order')
    if (data) setMaterials(data)
  }

  async function handleLogin() {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput })
    })
    const data = await res.json()
    if (data.success) {
      setIsAdmin(true)
      localStorage.setItem('isAdmin', 'true')
      localStorage.setItem('adminPwd', passwordInput)
      setShowLogin(false)
      setLoginError('')
      setPasswordInput('')
    } else {
      setLoginError('密码错误')
    }
  }

  function handleLogout() {
    setIsAdmin(false)
    localStorage.removeItem('isAdmin')
    localStorage.removeItem('adminPwd')
  }

  function speak() {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utter = new SpeechSynthesisUtterance(word)
    utter.lang = 'de-DE'
    utter.rate = 0.9
    utter.onend = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utter)
  }

  async function regenerate(type) {
    setRegenerating(type)
    const password = localStorage.getItem('adminPwd') || ''
    const res = await fetch('/api/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, type, password })
    })
    const data = await res.json()
    if (data.error) {
      alert('操作失败：' + data.error)
    } else {
      if (type === 'hook') {
        setAiContent(prev => ({ ...prev, memory_hook: data.result }))
      } else if (type === 'sentences') {
        setAiContent(prev => ({ ...prev, sentences: data.result }))
      } else if (type === 'word_family') {
        setAiContent(prev => ({
          ...prev, word_family: data.result.map((w, i) => ({
            ...w, related_word: w.word, source: 'ai', sort_order: i
          }))
        }))
      }
    }
    setRegenerating('')
  }

  async function saveHook() {
    await supabase
      .from('word_cache')
      .update({ memory_hook: hookDraft })
      .eq('word', word)
    setAiContent(prev => ({ ...prev, memory_hook: hookDraft }))
    setEditingHook(false)
  }

  async function addFamilyWord() {
    if (!newWord.trim() || !newMeaning.trim()) return
    setAddingFamily(true)

    const { error } = await supabase.from('word_family').insert({
      word: word,
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
      // 刷新词族数据
      const newEntry = {
        related_word: newWord.trim(),
        meaning: newMeaning.trim(),
        type: newType,
        source: 'manual',
        is_featured: true
      }
      setAiContent(prev => ({
        ...prev,
        word_family: [newEntry, ...(prev.word_family || [])]
      }))
      setNewWord('')
      setNewMeaning('')
      setNewType('verb')
      setShowAddFamily(false)
    }
    setAddingFamily(false)
  }

  const btnStyle = {
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: '6px',
    padding: '3px 10px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    color: '#666',
    marginLeft: '8px'
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
      正在分析「{word}」...
    </div>
  )

  return (
    <div>
      {/* 管理员登录/登出 */}
      <div style={{ textAlign: 'right', marginBottom: '12px' }}>
        {isAdmin ? (
          <span style={{ fontSize: '0.8rem', color: '#999' }}>
            🔑 管理员模式
            <button onClick={handleLogout} style={{ ...btnStyle, marginLeft: '8px' }}>退出</button>
          </span>
        ) : (
          <button onClick={() => setShowLogin(!showLogin)} style={btnStyle}>
            管理员登录
          </button>
        )}
      </div>

      {/* 登录框 */}
      {showLogin && !isAdmin && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '20px',
          marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          display: 'flex', gap: '10px', alignItems: 'center'
        }}>
          <input
            type="password" value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="管理员密码"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #ddd', fontSize: '0.95rem'
            }}
          />
          <button onClick={handleLogin} style={{
            background: '#1a1a2e', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 20px', cursor: 'pointer'
          }}>确认</button>
          {loginError && <span style={{ color: 'red', fontSize: '0.85rem' }}>{loginError}</span>}
        </div>
      )}

      {/* 主内容卡片 */}
      {aiContent && (
        <div style={{
          background: 'white', borderRadius: '16px', padding: '32px',
          marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
        }}>
          {/* 单词标题 + 发音 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>{word}</h2>
            <button onClick={speak} title="点击朗读" style={{
              background: speaking ? '#1a1a2e' : '#f0f0f0',
              border: 'none', borderRadius: '50%',
              width: '42px', height: '42px', cursor: 'pointer',
              fontSize: '1.2rem', display: 'flex',
              alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
            }}>
              {speaking ? '⏹' : '🔊'}
            </button>
          </div>

          {/* 词性 */}
          {aiContent.part_of_speech && (
            <p style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '16px' }}>
              {aiContent.part_of_speech}
            </p>
          )}

          {/* 词义 */}
          {aiContent.definitions?.length > 0 && (
            <div style={{
              background: '#f8f7f4', borderRadius: '12px',
              padding: '16px 20px', marginBottom: '24px'
            }}>
              <h3 style={{ color: '#666', fontSize: '0.85rem', marginBottom: '12px' }}>📖 词义</h3>
              {aiContent.definitions.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '10px',
                  marginBottom: i < aiContent.definitions.length - 1 ? '10px' : '0'
                }}>
                  <span style={{
                    background: '#1a1a2e', color: 'white', borderRadius: '50%',
                    width: '22px', height: '22px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', flexShrink: 0, marginTop: '1px'
                  }}>{i + 1}</span>
                  <div>
                    <span style={{ fontWeight: '600' }}>{d.meaning}</span>
                    {d.note && (
                      <span style={{ color: '#888', fontSize: '0.85rem', marginLeft: '8px' }}>
                        {d.note}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 记忆钩子 */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#666', fontSize: '0.85rem', marginBottom: '8px' }}>
              💡 记忆钩子
              {isAdmin && (
                <>
                  <button style={btnStyle} onClick={() => {
                    setEditingHook(true)
                    setHookDraft(aiContent.memory_hook)
                  }}>✏️ 编辑</button>
                  <button style={btnStyle} onClick={() => regenerate('hook')}
                    disabled={regenerating === 'hook'}>
                    {regenerating === 'hook' ? '生成中...' : '🔄 重新生成'}
                  </button>
                </>
              )}
            </h3>
            {editingHook ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <textarea value={hookDraft} onChange={e => setHookDraft(e.target.value)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: '1px solid #ddd', fontSize: '0.95rem',
                    lineHeight: '1.6', minHeight: '80px'
                  }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button onClick={saveHook} style={{
                    background: '#1a1a2e', color: 'white', border: 'none',
                    borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem'
                  }}>保存</button>
                  <button onClick={() => setEditingHook(false)} style={{
                    background: '#f0f0f0', color: '#666', border: 'none',
                    borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem'
                  }}>取消</button>
                </div>
              </div>
            ) : (
              <p style={{ lineHeight: '1.7' }}>{aiContent.memory_hook}</p>
            )}
          </div>

          {/* 例句 */}
          {aiContent.sentences?.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#666', fontSize: '0.85rem', marginBottom: '12px' }}>
                📝 例句
                {isAdmin && (
                  <button style={btnStyle} onClick={() => regenerate('sentences')}
                    disabled={regenerating === 'sentences'}>
                    {regenerating === 'sentences' ? '生成中...' : '🔄 重新生成'}
                  </button>
                )}
              </h3>
              {aiContent.sentences.map((s, i) => (
                <div key={i} style={{
                  background: '#f8f7f4', borderRadius: '10px',
                  padding: '14px 16px', marginBottom: '10px',
                  borderLeft: '3px solid #1a1a2e'
                }}>
                  <p style={{ fontStyle: 'italic', marginBottom: '4px' }}>{s.de}</p>
                  <p style={{ color: '#666', fontSize: '0.9rem' }}>{s.zh}</p>
                </div>
              ))}
            </div>
          )}

          {/* 词族 */}
          <div>
            <h3 style={{ color: '#666', fontSize: '0.85rem', marginBottom: '12px' }}>
              🌳 词族
              {isAdmin && (
                <>
                  <button style={btnStyle} onClick={() => regenerate('word_family')}
                    disabled={regenerating === 'word_family'}>
                    {regenerating === 'word_family' ? '生成中...' : '🔄 重新生成'}
                  </button>
                  <button style={{ ...btnStyle, color: '#2d6a4f', borderColor: '#2d6a4f' }}
                    onClick={() => setShowAddFamily(!showAddFamily)}>
                    ＋ 手动添加
                  </button>
                </>
              )}
            </h3>

            {/* 手动添加表单 */}
            {showAddFamily && (
              <div style={{
                background: '#f0faf4', borderRadius: '12px',
                padding: '16px', marginBottom: '16px',
                border: '1px solid #b7e4c7'
              }}>
                <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#2d6a4f', marginBottom: '12px' }}>
                  添加词族词汇
                </p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input
                    value={newWord}
                    onChange={e => setNewWord(e.target.value)}
                    placeholder="词汇（如：auszeichnen）"
                    style={{
                      flex: 2, padding: '8px 12px', borderRadius: '8px',
                      border: '1px solid #ddd', fontSize: '0.9rem'
                    }}
                  />
                  <input
                    value={newMeaning}
                    onChange={e => setNewMeaning(e.target.value)}
                    placeholder="含义"
                    style={{
                      flex: 2, padding: '8px 12px', borderRadius: '8px',
                      border: '1px solid #ddd', fontSize: '0.9rem'
                    }}
                  />
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: '8px',
                      border: '1px solid #ddd', fontSize: '0.9rem',
                      background: 'white'
                    }}
                  >
                    <option value="verb">动词</option>
                    <option value="noun">名词</option>
                    <option value="adj">形容词</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={addFamilyWord} disabled={addingFamily} style={{
                    background: '#2d6a4f', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '8px 20px',
                    cursor: addingFamily ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem', fontWeight: '600'
                  }}>
                    {addingFamily ? '添加中...' : '确认添加'}
                  </button>
                  <button onClick={() => setShowAddFamily(false)} style={{
                    background: '#f0f0f0', color: '#666', border: 'none',
                    borderRadius: '8px', padding: '8px 20px',
                    cursor: 'pointer', fontSize: '0.9rem'
                  }}>取消</button>
                </div>
              </div>
            )}

            {aiContent.word_family?.length > 0 && (
              ['verb', 'noun', 'adj'].map(type => {
                const group = aiContent.word_family.filter(w => w.type === type)
                if (!group.length) return null
                const label = type === 'verb' ? '动词' : type === 'noun' ? '名词' : '形容词/副词'
                const color = type === 'verb' ? '#1a1a2e' : type === 'noun' ? '#2d6a4f' : '#7b2d8b'
                return (
                  <div key={type} style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '6px' }}>{label}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {group.map((w, i) => (
                        <button key={i}
                          onClick={() => onWordClick(w.related_word.replace(/^(der|die|das|sich)\s/i, ''))}
                          style={{
                            background: w.source === 'manual' ? '#f0faf4' : '#f0f0f0',
                            border: 'none', borderRadius: '10px',
                            padding: '10px 16px', cursor: 'pointer', textAlign: 'left',
                            borderLeft: `3px solid ${color}`,
                          }}>
                          <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>{w.related_word}</p>
                          <p style={{ fontSize: '0.78rem', color: '#666', marginTop: '2px' }}>{w.meaning}</p>
                          {w.source === 'manual' && (
                            <p style={{ fontSize: '0.7rem', color: '#2d6a4f', marginTop: '2px' }}>✦ 精选</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* 精选素材 */}
      {materials.length > 0 && (
        <div style={{
          background: 'white', borderRadius: '16px', padding: '32px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
        }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', fontWeight: '700' }}>
            📚 精选素材
          </h3>
          <MaterialsDisplay materials={materials} />
        </div>
      )}
    </div>
  )
}
