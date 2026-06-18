'use client'
import { useState } from 'react'
import SearchBar from '@/components/SearchBar'
import WordCard from '@/components/WordCard'

export default function Home() {
  const [word, setWord] = useState(null)

  return (
    <main style={{
      minHeight: '100vh',
      padding: '40px 20px',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <header style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '800',
          color: '#1a1a2e',
          marginBottom: '8px'
        }}>
          Deutsch Wörter
        </h1>
        <p style={{ color: '#666', fontSize: '1rem' }}>
          输入一个德语单词，发现它的全部
        </p>
      </header>

      <SearchBar onSearch={setWord} />

      {word && <WordCard word={word} onWordClick={setWord} />}

      <div style={{ textAlign: 'center', marginTop: '60px' }}>
        <a href="/admin" style={{ color: '#ccc', fontSize: '0.75rem' }}>后台管理</a>
      </div>
    </main>
  )
}