'use client'
import { useState } from 'react'

export default function SearchBar({ onSearch }) {
  const [input, setInput] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) onSearch(input.trim().toLowerCase())
  }

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex',
      gap: '12px',
      marginBottom: '40px'
    }}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入德语单词，例如：zeichnen"
        style={{
          flex: 1,
          padding: '16px 20px',
          fontSize: '1.1rem',
          border: '2px solid #e0e0e0',
          borderRadius: '12px',
          outline: 'none',
          background: 'white',
        }}
      />
      <button type="submit" style={{
        padding: '16px 32px',
        background: '#1a1a2e',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
      }}>
        搜索
      </button>
    </form>
  )
}