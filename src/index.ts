// Hono 应用入口：错题本 Web 应用

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './types'
import questions from './routes/questions'
import categories from './routes/categories'
import reviews from './routes/reviews'
import uploads from './routes/uploads'

const app = new Hono<{ Bindings: Env }>()

// 全局中间件
app.use('*', logger())
app.use('*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}))

// 健康检查
app.get('/api/health', (c) => c.json({ ok: true, service: 'wrong-question-book', ts: Date.now() }))

// API 路由
app.route('/api/questions', questions)
app.route('/api/categories', categories)
app.route('/api/reviews', reviews)
app.route('/api/uploads', uploads)

// 静态资源兜底：所有非 /api/* 请求通过 ASSETS 绑定返回 public/ 中的文件
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
