import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  const { word, type, password } = await request.json()

  // 验证管理员密码
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '无权限' }, { status: 401 })
  }

  if (type === 'hook') {
    // 重新生成记忆钩子
    const prompt = `为德语单词"${word}"生成记忆联想，策略优先级：
1. 优先拆解词根和词缀，解释其本义如何推导出现代含义
2. 如果是派生词，解释前缀（如aus-, ver-, be-）如何改变核心词的含义
3. 如果词根解释困难，用生动的画面或场景联想
4. 禁止使用中文谐音
用一到两句话，简洁有力，帮助中文母语者理解和记忆
只返回联想内容本身，不要其他说明`

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9
      })
    })

    const data = await res.json()
    const hook = data.choices[0].message.content.trim()

    await supabase
      .from('word_cache')
      .upsert({ word, memory_hook: hook }, { onConflict: 'word' })

   
    return NextResponse.json({ result: hook })
  }

  if (type === 'sentences') {
    // 重新生成例句
    const prompt = `你是德语词汇专家，为德语单词"${word}"生成3个例句，返回JSON：
[
  { "de": "德语例句", "zh": "中文翻译" },
  { "de": "德语例句", "zh": "中文翻译" },
  { "de": "德语例句", "zh": "中文翻译" }
]
例句要有画面感，覆盖不同使用场景。只返回JSON。`

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9
      })
    })

    const data = await res.json()
    const text = data.choices[0].message.content.replace(/```json|```/g, '').trim()
    const sentences = JSON.parse(text)

    await supabase
       .from('word_cache')
       .upsert({ word, sentences }, { onConflict: 'word' })

    return NextResponse.json({ result: sentences })
  }

  if (type === 'word_family') {
    // 重新生成词族
    const prompt = `你是德语词汇专家，为德语单词"${word}"生成词族，返回JSON：
[
  { "word": "派生词", "meaning": "含义", "type": "verb" },
  ...
]
规则：优先列带前缀派生动词（aus-, be-, ver-, unter-, nach-, an-等），名词含冠词，共8个词。只返回JSON。`

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9
      })
    })

    const data = await res.json()
    const text = data.choices[0].message.content.replace(/```json|```/g, '').trim()
    const family = JSON.parse(text)

    // 删除旧的AI生成词族，保留手动添加的
    await supabase
      .from('word_family')
      .delete()
      .eq('word', word)
      .eq('source', 'ai')

    // 插入新词族
    const rows = family.map((item, i) => ({
      word,
      related_word: item.word,
      meaning: item.meaning,
      type: item.type,
      source: 'ai',
      sort_order: i
    }))

    await supabase.from('word_family').upsert(rows, {
      onConflict: 'word,related_word',
      ignoreDuplicates: true
    })

    return NextResponse.json({ result: family })
  }

  return NextResponse.json({ error: '未知类型' }, { status: 400 })
}