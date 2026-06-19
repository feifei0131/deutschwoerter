import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function fetchMaterialsForWord(wordId) {
  if (!wordId) return []
  const { data } = await supabase
    .from('material_words')
    .select('material_id, materials(*)')
    .eq('word_id', wordId)
    .order('materials(slide_order)')
  if (!data) return []
  return data.map(row => row.materials).filter(Boolean)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const word = searchParams.get('word')?.trim()
  if (!word) return NextResponse.json({ error: '缺少 word 参数' }, { status: 400 })

  // ── 查缓存
  const { data: wordRow } = await supabase
    .from('words').select('id').eq('word', word).single()

  const [{ data: cached }, { data: familyData }] = await Promise.all([
    supabase.from('word_cache').select('*').eq('word', word).single(),
    supabase.from('word_family').select('*').eq('word', word)
      .order('is_featured', { ascending: false }).order('sort_order'),
  ])

  const materials = await fetchMaterialsForWord(wordRow?.id)

  if (cached) {
    return NextResponse.json({
      word,
      wordData: {
        part_of_speech: cached.part_of_speech,
        definitions: cached.definitions,
        memory_hook: cached.memory_hook,
        sentences: cached.sentences,
        lemma: cached.lemma || null,
        is_inflected: cached.is_inflected || false,
        inflection_note: cached.inflection_note || null,
      },
      wordFamily: familyData || [],
      materials,
    })
  }

  // ── 第一步：验证词 + 分析词形
  const validationPrompt = `你是严格的德语语言学家。判断"${word}"是否是合法的德语词（包括变位形式、分词、派生词等）。

返回JSON，不要其他任何内容：

如果不是合法德语词：
{"valid": false}

如果是合法德语词：
{
  "valid": true,
  "lemma": "词典原形（如果本身就是原形则与查询词相同）",
  "is_inflected": true或false（是否为变位/变形形式，即非词典原形）,
  "inflection_note": "变形说明，如'zeichnen 的第三人称单数现在时'，原形则留空字符串",
  "part_of_speech": "精确词性标注，变位动词注明时态人称，分词注明用法，如：动词（第三人称单数现在时）、形容词/动词（过去分词）、名词（中性，复数）等"
}`

  const validationRes = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: validationPrompt }],
      temperature: 0.1
    })
  })

  const validationData = await validationRes.json()
  const validationText = validationData.choices[0].message.content
  const validationClean = validationText.replace(/```json|```/g, '').trim()

  let validation
  try {
    validation = JSON.parse(validationClean)
  } catch {
    return NextResponse.json({ error: '验证失败，请重试' }, { status: 500 })
  }

  if (!validation.valid) {
    return NextResponse.json(
      { error: `「${word}」不是合法的德语词，请检查拼写。` },
      { status: 422 }
    )
  }

  // ── 第二步：生成词义内容
  const contentPrompt = `你是德语词汇专家，请分析德语单词"${word}"（词性：${validation.part_of_speech}），用中文回答，返回JSON：

{
  "definitions": [
    { "meaning": "核心词义1", "note": "使用场景或补充说明（可选）" },
    { "meaning": "核心词义2", "note": "" },
    { "meaning": "核心词义3", "note": "" }
  ],
  "memory_hook": "记忆联想：优先拆解词根词缀解释本义，若为变位/分词则说明构成逻辑，禁止谐音，一到两句话",
  "sentences": [
    { "de": "德语例句1（用"${word}"这个具体形式）", "zh": "中文翻译" },
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

word_family规则：基于原形${validation.lemma}列出词族，优先列带前缀派生动词，名词含冠词。只返回JSON。`

  const contentRes = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: contentPrompt }],
      temperature: 0.7
    })
  })

  const contentData = await contentRes.json()
  const contentText = contentData.choices[0].message.content
  const contentClean = contentText.replace(/```json|```/g, '').trim()

  let parsed
  try {
    parsed = JSON.parse(contentClean)
  } catch {
    return NextResponse.json({ error: '解析失败' }, { status: 500 })
  }

  // ── 写入数据库
  const { data: upsertedWord } = await supabase
    .from('words')
    .upsert({ word }, { onConflict: 'word' })
    .select('id')
    .single()

  await supabase.from('word_cache').upsert({
    word,
    part_of_speech: validation.part_of_speech,
    definitions: parsed.definitions,
    memory_hook: parsed.memory_hook,
    sentences: parsed.sentences,
    lemma: validation.lemma,
    is_inflected: validation.is_inflected,
    inflection_note: validation.inflection_note,
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
    .from('word_family').select('*').eq('word', word)
    .order('is_featured', { ascending: false }).order('sort_order')

  const newMaterials = await fetchMaterialsForWord(upsertedWord?.id)

  return NextResponse.json({
    word,
    wordData: {
      part_of_speech: validation.part_of_speech,
      definitions: parsed.definitions,
      memory_hook: parsed.memory_hook,
      sentences: parsed.sentences,
      lemma: validation.lemma,
      is_inflected: validation.is_inflected,
      inflection_note: validation.inflection_note,
    },
    wordFamily: allFamily || [],
    materials: newMaterials,
  })
}
