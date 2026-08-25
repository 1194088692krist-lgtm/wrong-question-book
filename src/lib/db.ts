// D1 数据库查询封装

import type { Env, Question, Category } from '../types'

// 获取错题列表（带分类关联，可选过滤）
export async function listQuestions(
  db: D1Database,
  opts: { category?: number; tag?: string; q?: string; due?: boolean; limit?: number; offset?: number } = {}
): Promise<Question[]> {
  const { category, tag, q, due, limit = 100, offset = 0 } = opts
  const where: string[] = []
  const params: (string | number)[] = []

  if (category) {
    where.push('q.category_id = ?')
    params.push(category)
  }
  if (tag) {
    where.push("(q.tags LIKE ? OR ',' || q.tags || ',' LIKE ?)")
    params.push(`%${tag}%`, `%,${tag},%`)
  }
  if (q) {
    where.push('(q.title LIKE ? OR q.content LIKE ? OR q.answer LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (due) {
    where.push("(q.next_review_at IS NULL OR q.next_review_at <= ?)")
    params.push(new Date().toISOString())
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const sql = `
    SELECT q.*, c.name AS category_name, c.color AS category_color
    FROM questions q
    LEFT JOIN categories c ON q.category_id = c.id
    ${whereClause}
    ORDER BY q.updated_at DESC
    LIMIT ? OFFSET ?
  `
  const result = await db.prepare(sql).bind(...params, limit, offset).all<Question>()
  return result.results ?? []
}

// 获取单条错题
export async function getQuestion(db: D1Database, id: number): Promise<Question | null> {
  const sql = `
    SELECT q.*, c.name AS category_name, c.color AS category_color
    FROM questions q
    LEFT JOIN categories c ON q.category_id = c.id
    WHERE q.id = ?
  `
  return (await db.prepare(sql).bind(id).first<Question>()) ?? null
}

// 创建错题
export async function createQuestion(
  db: D1Database,
  input: {
    title: string
    content: string
    answer?: string | null
    explanation?: string | null
    category_id?: number | null
    tags?: string | null
    image_url?: string | null
    difficulty?: number
  }
): Promise<number> {
  const now = new Date().toISOString()
  const result = await db
    .prepare(
      `INSERT INTO questions
        (title, content, answer, explanation, category_id, tags, image_url, difficulty, next_review_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.title,
      input.content,
      input.answer ?? null,
      input.explanation ?? null,
      input.category_id ?? null,
      input.tags ?? null,
      input.image_url ?? null,
      input.difficulty ?? 3,
      now, // 首次复习时间 = 创建时
      now,
      now
    )
    .run()
  return result.meta.last_row_id as number
}

// 更新错题
export async function updateQuestion(
  db: D1Database,
  id: number,
  input: Partial<{
    title: string
    content: string
    answer: string | null
    explanation: string | null
    category_id: number | null
    tags: string | null
    image_url: string | null
    difficulty: number
  }>
): Promise<boolean> {
  const fields: string[] = []
  const params: (string | number | null)[] = []
  const map: Record<string, string> = {
    title: 'title',
    content: 'content',
    answer: 'answer',
    explanation: 'explanation',
    category_id: 'category_id',
    tags: 'tags',
    image_url: 'image_url',
    difficulty: 'difficulty'
  }
  for (const [k, v] of Object.entries(input)) {
    if (k in map && v !== undefined) {
      fields.push(`${map[k]} = ?`)
      params.push(v ?? null)
    }
  }
  if (!fields.length) return false
  fields.push(`updated_at = ?`)
  params.push(new Date().toISOString())
  params.push(id)

  const result = await db
    .prepare(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run()
  return result.meta.changes > 0
}

// 删除错题
export async function deleteQuestion(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM questions WHERE id = ?').bind(id).run()
  return result.meta.changes > 0
}

// 错题复习结果入库
export async function recordReview(
  db: D1Database,
  id: number,
  result: 'correct' | 'wrong'
): Promise<{ updated: boolean; srs: { next_review_at: string; review_count: number; correct_count: number } }> {
  const q = await getQuestion(db, id)
  if (!q) return { updated: false, srs: { next_review_at: '', review_count: 0, correct_count: 0 } }

  // 写入复习日志
  await db
    .prepare('INSERT INTO review_logs (question_id, result, reviewed_at) VALUES (?, ?, ?)')
    .bind(id, result, new Date().toISOString())
    .run()

  // 计算下次复习时间
  const srs = computeNextReviewLocal(result, q.review_count, q.correct_count)

  await db
    .prepare(
      `UPDATE questions
       SET next_review_at = ?, last_reviewed_at = ?, review_count = ?, correct_count = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(srs.next_review_at, new Date().toISOString(), srs.review_count, srs.correct_count, new Date().toISOString(), id)
    .run()

  return { updated: true, srs }
}

// 本地化的 SRS 计算（避免与 lib/srs.ts 循环依赖）
function computeNextReviewLocal(result: 'correct' | 'wrong', currentCount: number, currentCorrect: number) {
  const INTERVALS: number[] = [1, 2, 4, 7, 15, 30, 60]
  const now = new Date()
  let intervalDays: number

  if (result === 'wrong') {
    intervalDays = 1
  } else {
    const idx = Math.min(currentCount, INTERVALS.length - 1)
    intervalDays = INTERVALS[idx]
  }

  now.setDate(now.getDate() + intervalDays)
  return {
    next_review_at: now.toISOString(),
    review_count: currentCount + 1,
    correct_count: result === 'correct' ? currentCorrect + 1 : currentCorrect
  }
}

// 分类列表（含错题计数）
export async function listCategories(db: D1Database): Promise<Category[]> {
  const sql = `
    SELECT c.*, COUNT(q.id) AS question_count
    FROM categories c
    LEFT JOIN questions q ON q.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `
  const result = await db.prepare(sql).all<Category>()
  return result.results ?? []
}

export async function createCategory(db: D1Database, name: string, color: string = '#3b82f6'): Promise<number> {
  const result = await db
    .prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
    .bind(name, color)
    .run()
  return result.meta.last_row_id as number
}

export async function deleteCategory(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
  return result.meta.changes > 0
}

// 今日待复习数量
export async function getDueCount(db: D1Database): Promise<number> {
  const now = new Date().toISOString()
  const result = await db
    .prepare('SELECT COUNT(*) AS cnt FROM questions WHERE next_review_at IS NULL OR next_review_at <= ?')
    .bind(now)
    .first<{ cnt: number }>()
  return result?.cnt ?? 0
}

// 统计概览
export async function getStats(db: D1Database) {
  const total = await db.prepare('SELECT COUNT(*) AS cnt FROM questions').first<{ cnt: number }>()
  const due = await db.prepare('SELECT COUNT(*) AS cnt FROM questions WHERE next_review_at IS NULL OR next_review_at <= ?').bind(new Date().toISOString()).first<{ cnt: number }>()
  const reviewed = await db.prepare('SELECT COUNT(*) AS cnt FROM review_logs WHERE reviewed_at >= ?').bind(new Date(Date.now() - 86400000).toISOString()).first<{ cnt: number }>()

  return {
    total: total?.cnt ?? 0,
    due: due?.cnt ?? 0,
    reviewed_today: reviewed?.cnt ?? 0
  }
}
