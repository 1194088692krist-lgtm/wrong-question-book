// 分类管理路由

import { Hono } from 'hono'
import type { Env } from '../types'
import { success, error, handleError } from '../lib/response'
import { listCategories, createCategory, deleteCategory } from '../lib/db'

const app = new Hono<{ Bindings: Env }>()

// 列表（含错题计数）
app.get('/', async (c) => {
  try {
    const categories = await listCategories(c.env.DB)
    return success(c, categories)
  } catch (err) {
    return handleError(c, err)
  }
})

// 新建
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.name) return error(c, 'name is required', 422)
    const id = await createCategory(c.env.DB, String(body.name), body.color ?? '#3b82f6')
    const categories = await listCategories(c.env.DB)
    const created = categories.find((cat) => cat.id === id)
    return success(c, created, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    if (message.includes('UNIQUE')) {
      return error(c, 'Category name already exists', 409)
    }
    return handleError(c, err)
  }
})

// 删除（关联错题的 category_id 会被设为 NULL）
app.delete('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return error(c, 'Invalid id', 400)
    const deleted = await deleteCategory(c.env.DB, id)
    if (!deleted) return error(c, 'Category not found', 404)
    return success(c, { id, deleted: true })
  } catch (err) {
    return handleError(c, err)
  }
})

export default app
