// 错题 CRUD 路由

import { Hono } from 'hono'
import type { Env } from '../types'
import { success, error, handleError } from '../lib/response'
import {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion
} from '../lib/db'

const app = new Hono<{ Bindings: Env }>()

// 列表（支持 ?category=&tag=&q=&due=1 过滤）
app.get('/', async (c) => {
  try {
    const category = c.req.query('category')
    const tag = c.req.query('tag')
    const q = c.req.query('q')
    const due = c.req.query('due') === '1' || c.req.query('due') === 'true'
    const limit = Math.min(parseInt(c.req.query('limit') ?? '100'), 500)
    const offset = Math.max(parseInt(c.req.query('offset') ?? '0'), 0)

    const questions = await listQuestions(c.env.DB, {
      category: category ? Number(category) : undefined,
      tag: tag || undefined,
      q: q || undefined,
      due,
      limit,
      offset
    })
    return success(c, questions)
  } catch (err) {
    return handleError(c, err)
  }
})

// 详情
app.get('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return error(c, 'Invalid id', 400)
    const question = await getQuestion(c.env.DB, id)
    if (!question) return error(c, 'Question not found', 404)
    return success(c, question)
  } catch (err) {
    return handleError(c, err)
  }
})

// 新建
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.title || !body.content) {
      return error(c, 'title and content are required', 422)
    }
    const id = await createQuestion(c.env.DB, {
      title: String(body.title),
      content: String(body.content),
      answer: body.answer ?? null,
      explanation: body.explanation ?? null,
      category_id: body.category_id ?? null,
      tags: body.tags ?? null,
      image_url: body.image_url ?? null,
      difficulty: body.difficulty ?? 3
    })
    const question = await getQuestion(c.env.DB, id)
    return success(c, question, 201)
  } catch (err) {
    return handleError(c, err)
  }
})

// 更新
app.put('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return error(c, 'Invalid id', 400)
    const body = await c.req.json()

    const updated = await updateQuestion(c.env.DB, id, {
      title: body.title,
      content: body.content,
      answer: body.answer ?? undefined,
      explanation: body.explanation ?? undefined,
      category_id: body.category_id ?? undefined,
      tags: body.tags ?? undefined,
      image_url: body.image_url ?? undefined,
      difficulty: body.difficulty
    })
    if (!updated) return error(c, 'Question not found or no changes', 404)
    const question = await getQuestion(c.env.DB, id)
    return success(c, question)
  } catch (err) {
    return handleError(c, err)
  }
})

// 删除
app.delete('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return error(c, 'Invalid id', 400)
    const deleted = await deleteQuestion(c.env.DB, id)
    if (!deleted) return error(c, 'Question not found', 404)
    return success(c, { id, deleted: true })
  } catch (err) {
    return handleError(c, err)
  }
})

export default app
