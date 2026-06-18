'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

function toSafeFileName(str) {
  return str.trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss').replace(/[^a-z0-9_-]/g, '_')
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')

  const [word, setWord] = useState('')
  const [title, setTitle] = useState('')
  const [mediaType, setMediaType] = useState('image')
  const [videoUrl, setVideoUrl] = useState('')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')

  async function handleAuth() {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    const data = await res.json()
    if (data.success) {
      setAuthed(true)
      setAuthError('')
    } else {
      setAuthError('密码错误')
    }
  }

  async function getOrCreateWord(w) {
    const { data: existing } = await supabase
      .from('words')
      .select('id')
      .eq('word', w)
      .single()
    if (existing) return existing.id
    const { data: newWord } = await supabase
      .from('words')
      .insert({ word: w })
      .select('id')
      .single()
    return newWord.id
  }

  async function handleUpload() {
    if (!word.trim()) return setMessage('请输入单词')
    if (mediaType !== 'video' && files.length === 0) return setMessage('请选择文件')
    if (mediaType === 'video' && !videoUrl.trim()) return setMessage('请输入视频链接')

    setUploading(true)
    setMessage('')

    try {
      const wordKey = word.trim().toLowerCase()
      const safeWord = toSafeFileName(word)
      const wordId = await getOrCreateWord(wordKey)

      if (mediaType === 'video') {
        await supabase.from('materials').insert({
          word_id: wordId,
          type: 'video',
          media_type: 'video',
          title: title || videoUrl,
          file_url: videoUrl,
          uploaded_by: 'admin'
        })
        setMessage('✅ 视频链接添加成功！')

      } else if (mediaType === 'image') {
        const { data: existing } = await supabase
          .from('materials')
          .select('slide_order')
          .eq('word_id', wordId)
          .order('slide_order', { ascending: false })
          .limit(1)
        let startOrder = existing?.[0]?.slide_order != null
          ? existing[0].slide_order + 1 : 0

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          setProgress(`上传中 ${i + 1} / ${files.length}`)
          const ext = file.name.split('.').pop()
          const fileName = `${safeWord}_img_${Date.now()}_${i}.${ext}`
          const { error } = await supabase.storage.from('materials').upload(fileName, file)
          if (error) throw error
          const { data: urlData } = supabase.storage.from('materials').getPublicUrl(fileName)
          await supabase.from('materials').insert({
            word_id: wordId,
            type: 'image',
            media_type: 'image',
            title: title || file.name,
            file_url: urlData.publicUrl,
            slide_order: startOrder + i,
            uploaded_by: 'admin'
          })
        }
        setMessage(`✅ 成功上传 ${files.length} 张图片！`)

      } else if (mediaType === 'ppt') {
        const groupId = `ppt_${safeWord}_${Date.now()}`
        const groupTitle = title || `${word.trim()} PPT`

        const { data: existing } = await supabase
          .from('materials')
          .select('slide_order')
          .eq('word_id', wordId)
          .order('slide_order', { ascending: false })
          .limit(1)
        let startOrder = existing?.[0]?.slide_order != null
          ? existing[0].slide_order + 1 : 0

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          setProgress(`上传中 ${i + 1} / ${files.length}`)
          const ext = file.name.split('.').pop()
          const fileName = `${safeWord}_ppt_${Date.now()}_${i}.${ext}`
          const { error } = await supabase.storage.from('materials').upload(fileName, file)
          if (error) throw error
          const { data: urlData } = supabase.storage.from('materials').getPublicUrl(fileName)
          await supabase.from('materials').insert({
            word_id: wordId,
            type: 'ppt_slide',
            media_type: 'ppt',
            title: groupTitle,
            group_id: groupId,
            group_title: groupTitle,
            is_cover: i === 0,
            file_url: urlData.publicUrl,
            slide_order: startOrder + i,
            uploaded_by: 'admin'
          })
        }
        setMessage(`✅ 成功上传 ${files.length} 张PPT图片，第一张为封面！`)
      }

      setFiles([])
      setTitle('')
      setVideoUrl('')
      setProgress('')
      document.getElementById('fileInput').value = ''

    } catch (err) {
      setMessage('❌ 上传失败：' + err.message)
    }
    setUploading(false)
  }

  const cardStyle = {
    background: 'white', borderRadius: '16px', padding: '32px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '600px', margin: '0 auto'
  }
  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    border: '1px solid #e0e0e0', fontSize: '1rem',
    marginBottom: '16px', boxSizing: 'border-box'
  }
  const labelStyle = {
    fontSize: '0.85rem', color: '#666', marginBottom: '6px', display: 'block'
  }

  if (!authed) {
    return (
      <main style={{ minHeight: '100vh', padding: '40px 20px', background: '#f8f7f4' }}>
        <div style={{ ...cardStyle, maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '24px', fontSize: '1.4rem', fontWeight: '700' }}>
            🔑 管理员登录
          </h2>
          <input
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="输入管理员密码" style={inputStyle}
          />
          <button onClick={handleAuth} style={{
            width: '100%', padding: '14px', background: '#1a1a2e',
            color: 'white', border: 'none', borderRadius: '10px',
            fontSize: '1rem', cursor: 'pointer', fontWeight: '600'
          }}>进入后台</button>
          {authError && (
            <p style={{ color: 'red', marginTop: '12px', textAlign: 'center' }}>{authError}</p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', padding: '40px 20px', background: '#f8f7f4' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '32px'
        }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>📁 素材上传</h1>
          <a href="/" style={{ color: '#666', fontSize: '0.9rem' }}>← 返回首页</a>
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>对应单词 *</label>
          <input
            type="text" value={word}
            onChange={e => setWord(e.target.value)}
            placeholder="例如：schließen" style={inputStyle}
          />

          <label style={labelStyle}>素材标题（可选）</label>
          <input
            type="text" value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="例如：schließen家族图解" style={inputStyle}
          />

          <label style={labelStyle}>素材类型 *</label>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
            {[
              { value: 'image', label: '🖼 独立图片' },
              { value: 'ppt', label: '📊 PPT图片组' },
              { value: 'video', label: '🎥 视频链接' }
            ].map(opt => (
              <button key={opt.value} onClick={() => setMediaType(opt.value)} style={{
                flex: 1, padding: '10px',
                background: mediaType === opt.value ? '#1a1a2e' : '#f0f0f0',
                color: mediaType === opt.value ? 'white' : '#333',
                border: 'none', borderRadius: '10px',
                cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
              }}>{opt.label}</button>
            ))}
          </div>

          <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '16px' }}>
            {mediaType === 'image' && '每张图片独立展示，适合单张示意图或插图'}
            {mediaType === 'ppt' && '多张图片归为一组，只显示封面，点击可翻页查看全部'}
            {mediaType === 'video' && '填入YouTube或Bilibili链接，嵌入播放'}
          </p>

          {mediaType === 'video' ? (
            <>
              <label style={labelStyle}>视频链接 *</label>
              <input
                type="text" value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={inputStyle}
              />
            </>
          ) : (
            <>
              <label style={labelStyle}>
                选择图片 *
                <span style={{ color: '#999', fontWeight: '400', marginLeft: '6px' }}>
                  {mediaType === 'ppt'
                    ? '可多选，按文件名顺序排列，第一张为封面'
                    : '可多选，每张独立展示'}
                </span>
              </label>
              <input
                id="fileInput" type="file"
                accept="image/*" multiple
                onChange={e => setFiles(
                  Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name))
                )}
                style={{ ...inputStyle, padding: '10px' }}
              />
              {files.length > 0 && (
                <div style={{
                  background: '#f8f7f4', borderRadius: '10px',
                  padding: '12px 16px', marginBottom: '16px'
                }}>
                  <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>
                    已选 {files.length} 个文件：
                  </p>
                  {files.map((f, i) => (
                    <p key={i} style={{ fontSize: '0.82rem', color: '#333', marginBottom: '3px' }}>
                      {i === 0 && mediaType === 'ppt'
                        ? `① ${f.name}（封面）`
                        : `${i + 1}. ${f.name}`}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          <button onClick={handleUpload} disabled={uploading} style={{
            width: '100%', padding: '14px',
            background: uploading ? '#999' : '#1a1a2e',
            color: 'white', border: 'none', borderRadius: '10px',
            fontSize: '1rem', cursor: uploading ? 'not-allowed' : 'pointer',
            fontWeight: '600', marginTop: '8px'
          }}>
            {uploading
              ? (progress || '上传中...')
              : `上传${files.length > 1 ? ` ${files.length} 个文件` : '素材'}`}
          </button>

          {message && (
            <p style={{
              marginTop: '16px', textAlign: 'center', fontWeight: '600',
              color: message.startsWith('✅') ? '#2d6a4f' : 'red'
            }}>{message}</p>
          )}
        </div>
      </div>
    </main>
  )
}
