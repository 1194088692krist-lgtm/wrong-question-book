// 复习计划路由

import { Hono } from 'hono'
import type { Env } from '../types'
import { success, error, handleError } from '../lib/response'
import { listQuestions, recordReview, getStats } from '../lib/db'

const app = new Hono<{ Bindings: Env }>()

// 今日待复习列表
app.get('/today', async (c) => {
  try {
    const questions = await listQuestions(c.env.DB, { due: true, limit: 200 })
    return success(c, questions)
  } catch (err) {
    return handleError(c, err)
  }
})

// 统计概览
app.get('/stats', async (c) => {
  try {
    const stats = await getStats(c.env.DB)
    return success(c, stats)
  } catch (err) {
    return handleError(c, err)
  }
})

// 提交复习结果
app.post('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return error(c, 'Invalid id', 400)
    const body = await c.req.json()
    const result: 'correct' | 'wrong' = body.result === 'correct' ? 'correct' : 'wrong'

    const res = await recordReview(c.env.DB, id, result)
    if (!res.updated) return error(c, 'Question not found', 404)
    return success(c, res.srs)
  } catch (err) {
    return handleError(c, err)
  }
})

export default app
