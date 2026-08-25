// 图片上传到 R2 路由

import { Hono } from 'hono'
import type { Env } from '../types'
import { success, error, handleError } from '../lib/response'

const app = new Hono<{ Bindings: Env }>()

// 允许的图片 MIME
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
])
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// 上传图片
app.post('/', async (c) => {
  try {
    const formData = await c.req.formData()
    // Workers 运行时实际返回 File，但 @cloudflare/workers-types 根类型将其声明为 string | null，故断言为 Blob
    const file = formData.get('file') as unknown as Blob | string | null
    if (!file || typeof file === 'string') {
      return error(c, 'No file uploaded (field name: file)', 422)
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return error(c, `Unsupported file type: ${file.type}`, 415)
    }
    if (file.size > MAX_SIZE) {
      return error(c, `File too large (max ${MAX_SIZE / 1024 / 1024}MB)`, 413)
    }

    // File 类型在运行时具有 name 属性；TS 类型层仅声明为 Blob，故通过运行时探测获取文件名
    const fileName = 'name' in file && typeof file.name === 'string' ? file.name : 'upload.bin'

    // 生成唯一键: uploads/2026/08/25/<timestamp>-<random>.ext
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    const ext = fileName.split('.').pop()?.toLowerCase() || 'bin'
    const rand = Math.random().toString(36).slice(2, 10)
    const key = `uploads/${y}/${m}/${d}/${Date.now()}-${rand}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    await c.env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable'
      }
    })

    // 返回通过 Worker 转发的访问路径（推荐前端直接调用此相对路径）
    const url = `/api/uploads/${key}`
    return success(c, { key, url, name: fileName, size: file.size }, 201)
  } catch (err) {
    return handleError(c, err)
  }
})

// 访问已上传的图片（通过 R2 GET）
app.get('*', async (c) => {
  try {
    // 提取 /api/uploads/ 之后的路径作为 R2 key
    const url = new URL(c.req.url)
    const key = url.pathname.replace(/^\/api\/uploads\//, '')
    if (!key) return error(c, 'Invalid key', 400)

    const object = await c.env.BUCKET.get(key)
    if (!object) return error(c, 'Object not found', 404)

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('ETag', object.httpEtag)

    return new Response(object.body, { headers })
  } catch (err) {
    return handleError(c, err)
  }
})

export default app
