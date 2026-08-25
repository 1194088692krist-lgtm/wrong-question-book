// Cloudflare Workers 绑定环境类型声明

export interface Env {
  // D1 数据库
  DB: D1Database
  // R2 对象存储（图片）
  BUCKET: R2Bucket
  // 静态资源 Fetcher（前端 public/）
  ASSETS: Fetcher
}

// 错题实体
export interface Question {
  id: number
  title: string
  content: string
  answer: string | null
  explanation: string | null
  category_id: number | null
  category_name?: string | null
  category_color?: string | null
  tags: string | null
  image_url: string | null
  difficulty: number
  review_count: number
  correct_count: number
  next_review_at: string | null
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

// 分类实体
export interface Category {
  id: number
  name: string
  color: string
  created_at: string
  question_count?: number
}

// 复习记录
export interface ReviewLog {
  id: number
  question_id: number
  result: 'correct' | 'wrong'
  reviewed_at: string
}
