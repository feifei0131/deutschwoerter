'use client'
import { useState } from 'react'
import SearchBar from '@/components/SearchBar'
import WordCard from '@/components/WordCard'

export default function Home() {
  const [wordData, setWordData] = useState(null)   // 完整数据对象
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSearch(word) {
    if (!word?.trim()) return
    setLoading(true)
    setError(null)
    setWordData(null)

    try {
      const res = await fetch(`/api/analyze?word=${encodeURIComponent(word.trim())}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || '查询失败，请稍后重试')
      }
      const json = await res.json()
      // json 预期结构：{ word, wordData, wordFamily, materials }
      setWordData(json)
    } catch (e) {
      setError(e.message || '出错了')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', paddingBottom: '60px' }}>

      {/* ── 顶栏 ── */}
      <header style={{
        padding: '18px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',   // ← 加这行
        gap: '24px',
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <h1 style={{
          fontSize: '1.1rem',
          fontWeight: '700',
          color: '#1a1a2e',
          whiteSpace: 'nowrap',
          margin: 0,
        }}>
          Deutsch Wörter
        </h1>
        <div style={{ flex: 1, maxWidth: '480px' }}>
          <SearchBar onSearch={handleSearch} />
        </div>
      </header>

      {/* ── 内容区 ── */}
      <div style={{ padding: '0 16px' }}>

        {/* 初始空态 */}
        {!wordData && !loading && !error && (
          <div style={{
            textAlign: 'center',
            marginTop: '80px',
            color: '#9ca3af',
          }}>
            <p style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</p>
            <p style={{ fontSize: '1rem' }}>输入一个德语单词，发现它的全部</p>
          </div>
        )}

        {/* 加载中 */}
        {loading && (
          <div style={{ textAlign: 'center', marginTop: '80px', color: '#9ca3af' }}>
            <p style={{ fontSize: '1rem' }}>正在查询...</p>
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div style={{
            textAlign: 'center',
            marginTop: '80px',
            color: '#ef4444',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {/* 单词卡片 */}
        {wordData && (
          <WordCard
            data={wordData}
            onWordClick={handleSearch}
          />
        )}

      </div>

      {/* ── 底部 ── */}
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <a href="/admin" style={{ color: '#d1d5db', fontSize: '0.75rem' }}>后台管理</a>
      </div>

    </main>
  )
}
