// 统一 API 响应封装

import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

interface SuccessData<T> {
  ok: true
  data: T
}

interface ErrorData {
  ok: false
  error: string
  details?: unknown
}

export function success<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json<SuccessData<T>>({ ok: true, data }, status)
}

export function error(c: Context, message: string, status: ContentfulStatusCode = 400, details?: unknown) {
  const body: ErrorData = { ok: false, error: message }
  if (details !== undefined) body.details = details
  return c.json<ErrorData>(body, status)
}

// 处理异常，避免直接暴露内部错误
export function handleError(c: Context, err: unknown) {
  console.error('[API Error]', err)
  const message = err instanceof Error ? err.message : 'Internal Server Error'
  return error(c, message, 500)
}
