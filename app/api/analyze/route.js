import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  const { word } = await request.json()

  const { data: cached } = await supabase
    .from('word_cache')
    .select('*')
    .eq('word', word)
    .single()

  const { data: familyData } = await supabase
    .from('word_family')
    .select('*')
    .eq('word', word)
    .order('is_featured', { ascending: false })
    .order('sort_order')

  if (cached) {
    return NextResponse.json({
      part_of_speech: cached.part_of_speech,
      definitions: cached.definitions,
      memory_hook: cached.memory_hook,
      sentences: cached.sentences,
      word_family: familyData || []
    })
  }

  const prompt = `你是德语词汇专家，请分析德语单词"${word}"，用中文回答，返回JSON格式：

{
  "part_of_speech": "词性，如：动词、名词（阴性）、形容词等",
  "definitions": [
    { "meaning": "核心词义1", "note": "使用场景或补充说明（可选）" },
    { "meaning": "核心词义2", "note": "" },
    { "meaning": "核心词义3", "note": "" }
  ],
  "memory_hook": "记忆联想：优先拆解词根词缀解释本义，派生词解释前缀逻辑，禁止谐音，一到两句话",
  "sentences": [
    { "de": "德语例句1", "zh": "中文翻译" },
    { "de": "德语例句2", "zh": "中文翻译" },
    { "de": "德语例句3", "zh": "中文翻译" }
  ],
  "word_family": [
    { "word": "派生动词", "meaning": "含义", "type": "verb" },
    { "word": "派生动词", "meaning": "含义", "type": "verb" },
    { "word": "派生动词", "meaning": "含义", "type": "verb" },
    { "word": "派生动词", "meaning": "含义", "type": "verb" },
    { "word": "相关名词（含冠词）", "meaning": "含义", "type": "noun" },
    { "word": "相关名词（含冠词）", "meaning": "含义", "type": "noun" },
    { "word": "相关形容词", "meaning": "含义", "type": "adj" },
    { "word": "相关形容词", "meaning": "含义", "type": "adj" }
  ]
}

word_family规则：优先列带前缀派生动词（aus-, be-, ver-, unter-, nach-, an-等），名词含冠词。只返回JSON。`

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  })

  const data = await res.json()
  const text = data.choices[0].message.content
  const clean = text.replace(/```json|```/g, '').trim()

  let parsed
  try {
    parsed = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: '解析失败' }, { status: 500 })
  }

  await supabase.from('word_cache').upsert({
    word,
    part_of_speech: parsed.part_of_speech,
    definitions: parsed.definitions,
    memory_hook: parsed.memory_hook,
    sentences: parsed.sentences
  }, { onConflict: 'word' })

  if (parsed.word_family?.length) {
    const rows = parsed.word_family.map((item, i) => ({
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
  }

  const { data: allFamily } = await supabase
    .from('word_family')
    .select('*')
    .eq('word', word)
    .order('is_featured', { ascending: false })
    .order('sort_order')

  return NextResponse.json({
    part_of_speech: parsed.part_of_speech,
    definitions: parsed.definitions,
    memory_hook: parsed.memory_hook,
    sentences: parsed.sentences,
    word_family: allFamily || []
  })
}