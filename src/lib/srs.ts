// 间隔重复算法（SRS）- 简化版艾宾浩斯

// 复习间隔（天）—— 答对时按复习次数递增
const INTERVALS: number[] = [1, 2, 4, 7, 15, 30, 60]

export interface SrsResult {
  next_review_at: string
  review_count: number
  correct_count: number
}

/**
 * 根据答题结果计算下次复习时间
 * @param result 'correct' 表示答对，'wrong' 表示答错
 * @param currentCount 当前累计复习次数
 * @param currentCorrect 当前累计答对次数
 */
export function computeNextReview(
  result: 'correct' | 'wrong',
  currentCount: number,
  currentCorrect: number
): SrsResult {
  const now = new Date()
  let intervalDays: number

  if (result === 'wrong') {
    // 答错：重置为 1 天后
    intervalDays = 1
  } else {
    // 答对：按当前复习次数取下一档间隔
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

// 初始化错题的首次复习时间（创建当日）
export function initialReviewDate(): string {
  return new Date().toISOString()
}
