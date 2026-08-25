/* =========================================================
   错题本 - 前端应用（原生 JS SPA，Hash 路由）
   ========================================================= */

const API = '/api'

// ---------- 全局状态 ----------
const state = {
  categories: [],
  questions: [],
  currentQuestion: null,
  reviewQueue: [],
  reviewIndex: 0
}

// ---------- 工具函数 ----------
const $ = (sel) => document.querySelector(sel)
const app = () => $('#app')
const escapeHtml = (str) => {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

const formatShortDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const isDue = (q) => {
  if (!q.next_review_at) return true
  return new Date(q.next_review_at) <= new Date()
}

const showToast = (msg, type = '') => {
  const el = $('#toast')
  if (!el) return
  el.textContent = msg
  el.className = 'toast ' + type
  el.hidden = false
  clearTimeout(el._timer)
  el._timer = setTimeout(() => { el.hidden = true }, 2500)
}

// ---------- API 客户端 ----------
async function api(path, options = {}) {
  const opts = {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  }
  const res = await fetch(`${API}${path}`, opts)
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data.data
}

async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}/uploads`, { method: 'POST', body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `上传失败 (HTTP ${res.status})`)
  return data.data
}

// ---------- 加载分类 ----------
async function loadCategories() {
  try {
    state.categories = await api('/categories')
  } catch (err) {
    state.categories = []
  }
}

// ---------- 视图渲染 ----------
function renderLoading(msg = '加载中…') {
  app().innerHTML = `<div class="loading">${escapeHtml(msg)}</div>`
}

function renderEmpty(text, icon = '📭') {
  app().innerHTML = `<div class="empty"><span class="empty-icon">${icon}</span>${escapeHtml(text)}</div>`
}

// 列表页
function renderListView() {
  const categories = state.categories
  const categoryOptions = categories.map(c =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join('')

  app().innerHTML = `
    <div class="list-toolbar">
      <input id="searchInput" class="input search" type="search" placeholder="搜索标题/内容/答案…" />
      <select id="filterCategory" class="select">
        <option value="">全部分类</option>
        ${categoryOptions}
      </select>
      <label class="chip" style="cursor:pointer">
        <input type="checkbox" id="filterDue" /> 仅看待复习
      </label>
    </div>
    <div id="questionList" class="question-list">
      <div class="loading">加载中…</div>
    </div>
  `

  $('#searchInput').addEventListener('input', debounce(loadQuestions, 300))
  $('#filterCategory').addEventListener('change', loadQuestions)
  $('#filterDue').addEventListener('change', loadQuestions)
  loadQuestions()
}

async function loadQuestions() {
  const search = $('#searchInput')?.value?.trim() || ''
  const category = $('#filterCategory')?.value || ''
  const dueOnly = $('#filterDue')?.checked || false

  const params = new URLSearchParams()
  if (search) params.set('q', search)
  if (category) params.set('category', category)
  if (dueOnly) params.set('due', '1')

  const listEl = $('#questionList')
  if (!listEl) return
  listEl.innerHTML = '<div class="loading">加载中…</div>'

  try {
    const questions = await api(`/questions?${params.toString()}`)
    state.questions = questions
    if (questions.length === 0) {
      renderEmptyInto(listEl, '还没有错题，点击右上角"+ 新建"添加一条', '📝')
      return
    }
    listEl.innerHTML = questions.map(q => renderQuestionCard(q)).join('')
    listEl.querySelectorAll('[data-id]').forEach(card => {
      card.addEventListener('click', () => location.hash = `#/question/${card.dataset.id}`)
    })
  } catch (err) {
    listEl.innerHTML = `<div class="empty">加载失败：${escapeHtml(err.message)}</div>`
  }
}

function renderEmptyInto(el, text, icon) {
  el.innerHTML = `<div class="empty"><span class="empty-icon">${icon}</span>${escapeHtml(text)}</div>`
}

function renderQuestionCard(q) {
  const cat = state.categories.find(c => c.id === q.category_id)
  const catChip = cat
    ? `<span class="chip category" style="background:${escapeHtml(cat.color)}">${escapeHtml(cat.name)}</span>`
    : ''
  const tagChips = (q.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    .map(t => `<span class="chip">#${escapeHtml(t)}</span>`).join('')
  const due = isDue(q)
  const difficultyStars = '★'.repeat(q.difficulty || 3) + '☆'.repeat(5 - (q.difficulty || 3))

  return `
    <article class="question-card" data-id="${q.id}">
      <div class="qc-header">
        <div class="qc-title">${escapeHtml(q.title)}</div>
        ${due ? '<span class="due-tag">待复习</span>' : ''}
      </div>
      ${q.image_url ? `<img class="qc-content" src="${escapeHtml(q.image_url)}" alt="" style="max-height:80px;object-fit:cover;border-radius:6px" />` : ''}
      <div class="qc-content">${escapeHtml(q.content)}</div>
      <div class="qc-meta">${catChip}${tagChips}</div>
      <div class="qc-footer">
        <span class="difficulty" title="难度">${difficultyStars}</span>
        <span>下次复习：${formatShortDate(q.next_review_at)}</span>
      </div>
    </article>
  `
}

// 详情页
async function renderDetailView(id) {
  renderLoading()
  try {
    const q = await api(`/questions/${id}`)
    state.currentQuestion = q
    const cat = state.categories.find(c => c.id === q.category_id)
    const tags = (q.tags || '').split(',').map(t => t.trim()).filter(Boolean)
      .map(t => `<span class="chip">#${escapeHtml(t)}</span>`).join('')
    const difficultyStars = '★'.repeat(q.difficulty || 3) + '☆'.repeat(5 - (q.difficulty || 3))

    app().innerHTML = `
      <div class="detail-card">
        <h2>${escapeHtml(q.title)}</h2>
        <div class="qc-meta" style="margin-bottom:12px">
          ${cat ? `<span class="chip category" style="background:${escapeHtml(cat.color)}">${escapeHtml(cat.name)}</span>` : ''}
          ${tags}
          <span class="difficulty">${difficultyStars}</span>
          <span>复习 ${q.review_count} 次 · 答对 ${q.correct_count} 次</span>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">题干</div>
          <div>${escapeHtml(q.content)}</div>
          ${q.image_url ? `<img class="detail-image" src="${escapeHtml(q.image_url)}" alt="错题截图" />` : ''}
        </div>

        ${q.answer ? `
        <div class="detail-section">
          <div class="detail-section-title">答案</div>
          <div>${escapeHtml(q.answer)}</div>
        </div>` : ''}

        ${q.explanation ? `
        <div class="detail-section">
          <div class="detail-section-title">解析</div>
          <div>${escapeHtml(q.explanation)}</div>
        </div>` : ''}

        <div class="qc-meta" style="margin-top:16px">
          <span>创建：${formatDate(q.created_at)}</span>
          <span>更新：${formatDate(q.updated_at)}</span>
          <span>上次复习：${formatDate(q.last_reviewed_at)}</span>
          <span>下次复习：${formatDate(q.next_review_at)}</span>
        </div>

        <div class="detail-actions">
          <a href="#/edit/${q.id}" class="btn btn-primary">编辑</a>
          <button id="printBtn" class="btn btn-ghost">打印</button>
          <button id="deleteBtn" class="btn btn-danger">删除</button>
          <a href="#/" class="btn btn-ghost">返回列表</a>
        </div>
      </div>
    `
    $('#printBtn').addEventListener('click', () => window.print())
    $('#deleteBtn').addEventListener('click', async () => {
      if (!confirm('确认删除这条错题？删除后无法恢复。')) return
      try {
        await api(`/questions/${q.id}`, { method: 'DELETE' })
        showToast('已删除', 'success')
        location.hash = '#/'
      } catch (err) {
        showToast(`删除失败：${err.message}`, 'error')
      }
    })
  } catch (err) {
    renderEmpty(`加载失败：${err.message}`, '⚠️')
  }
}

// 表单页（新建/编辑）
function renderFormView(mode, id = null) {
  const isEdit = mode === 'edit'
  const q = isEdit ? state.currentQuestion : null
  const categoryOptions = state.categories.map(c =>
    `<option value="${c.id}" ${q && q.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('')

  app().innerHTML = `
    <div class="form-card">
      <h2 style="margin-bottom:24px">${isEdit ? '编辑错题' : '新建错题'}</h2>
      <form id="questionForm">
        <div class="form-group">
          <label class="form-label">标题 *</label>
          <input class="input" type="text" name="title" required
            value="${q ? escapeHtml(q.title) : ''}" placeholder="简短描述这道题" />
        </div>
        <div class="form-group">
          <label class="form-label">题干 *</label>
          <textarea class="textarea" name="content" required placeholder="完整题目内容（支持纯文本）">${q ? escapeHtml(q.content) : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">截图</label>
          <input class="input" type="file" id="imageInput" accept="image/*" />
          ${q && q.image_url ? `<img src="${escapeHtml(q.image_url)}" style="max-height:100px;margin-top:8px;border-radius:6px" />` : ''}
          <input type="hidden" name="image_url" value="${q && q.image_url ? escapeHtml(q.image_url) : ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">分类</label>
            <select class="select" name="category_id">
              <option value="">— 选择分类 —</option>
              ${categoryOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">难度</label>
            <select class="select" name="difficulty">
              ${[1, 2, 3, 4, 5].map(n =>
                `<option value="${n}" ${(q ? q.difficulty : 3) === n ? 'selected' : ''}>${n} 星</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">标签（逗号分隔）</label>
          <input class="input" type="text" name="tags"
            value="${q ? escapeHtml(q.tags || '') : ''}" placeholder="例如: 民法典,合同编" />
        </div>
        <div class="form-group">
          <label class="form-label">答案</label>
          <textarea class="textarea" name="answer" placeholder="正确答案">${q ? escapeHtml(q.answer || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">解析</label>
          <textarea class="textarea" name="explanation" placeholder="解题思路、知识点">${q ? escapeHtml(q.explanation || '') : ''}</textarea>
        </div>
        <div class="form-actions">
          <a href="${isEdit ? `#/question/${q?.id}` : '#/'}" class="btn btn-ghost">取消</a>
          <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '添加'}</button>
        </div>
      </form>
    </div>
  `

  // 文件上传
  const fileInput = $('#imageInput')
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        showToast('上传中…')
        const data = await uploadFile(file)
        document.querySelector('[name=image_url]').value = data.url
        showToast('图片已上传', 'success')
      } catch (err) {
        showToast(`上传失败：${err.message}`, 'error')
      }
    })
  }

  // 表单提交
  $('#questionForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const fd = new FormData(form)
    const body = Object.fromEntries(fd.entries())
    body.difficulty = Number(body.difficulty)
    body.category_id = body.category_id ? Number(body.category_id) : null

    try {
      if (isEdit && q) {
        await api(`/questions/${q.id}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        })
        showToast('已保存', 'success')
        location.hash = `#/question/${q.id}`
      } else {
        const created = await api('/questions', {
          method: 'POST',
          body: JSON.stringify(body)
        })
        showToast('已添加', 'success')
        location.hash = `#/question/${created.id}`
      }
    } catch (err) {
      showToast(`保存失败：${err.message}`, 'error')
    }
  })
}

// 复习页
async function renderReviewView() {
  renderLoading('加载今日待复习…')
  try {
    state.reviewQueue = await api('/reviews/today')
    state.reviewIndex = 0

    if (state.reviewQueue.length === 0) {
      renderEmpty('今日没有需要复习的错题 🎉', '✅')
      return
    }
    renderReviewCard()
  } catch (err) {
    renderEmpty(`加载失败：${err.message}`, '⚠️')
  }
}

function renderReviewCard() {
  const queue = state.reviewQueue
  const idx = state.reviewIndex
  if (idx >= queue.length) {
    app().innerHTML = `
      <div class="review-card">
        <div style="font-size:64px;margin-bottom:16px">🎉</div>
        <h2>今日复习完成！</h2>
        <p style="color:var(--color-text-muted);margin:12px 0 24px">共复习 ${queue.length} 题</p>
        <a href="#/" class="btn btn-primary">返回列表</a>
      </div>
    `
    return
  }

  const q = queue[idx]
  const cat = state.categories.find(c => c.id === q.category_id)
  const progress = Math.round((idx / queue.length) * 100)

  app().innerHTML = `
    <div class="review-progress">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:var(--color-text-muted)">
        <span>进度 ${idx + 1} / ${queue.length}</span>
        <span>${progress}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
    </div>
    <div class="review-card" id="reviewCard">
      ${cat ? `<span class="chip category" style="background:${escapeHtml(cat.color)}">${escapeHtml(cat.name)}</span><br/>` : ''}
      <div class="review-q">${escapeHtml(q.title)}</div>
      <div style="color:var(--color-text-muted);margin-bottom:16px">${escapeHtml(q.content)}</div>
      ${q.image_url ? `<img class="detail-image" src="${escapeHtml(q.image_url)}" alt="" />` : ''}
      <div class="review-prompt">
        <button id="flipBtn" class="btn btn-primary">显示答案</button>
      </div>
      <div class="review-answer">
        ${q.answer ? `<div class="detail-section"><div class="detail-section-title">答案</div>${escapeHtml(q.answer)}</div>` : ''}
        ${q.explanation ? `<div class="detail-section"><div class="detail-section-title">解析</div>${escapeHtml(q.explanation)}</div>` : ''}
      </div>
      <div class="review-actions" id="reviewActions" style="display:none">
        <button class="btn btn-danger" data-result="wrong">答错了</button>
        <button class="btn btn-success" data-result="correct">答对了</button>
      </div>
    </div>
  `

  const card = $('#reviewCard')
  $('#flipBtn').addEventListener('click', () => {
    card.classList.add('flipped')
    $('#reviewActions').style.display = 'flex'
  })
  $('#reviewActions').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-result]')
    if (!btn) return
    try {
      await api(`/reviews/${q.id}`, {
        method: 'POST',
        body: JSON.stringify({ result: btn.dataset.result })
      })
      state.reviewIndex++
      renderReviewCard()
    } catch (err) {
      showToast(`提交失败：${err.message}`, 'error')
    }
  })
}

// 统计页
async function renderStatsView() {
  renderLoading('加载统计…')
  try {
    const stats = await api('/reviews/stats')
    const duePercent = stats.total > 0 ? Math.round((stats.due / stats.total) * 100) : 0
    app().innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">错题总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--color-danger)">${stats.due}</div>
          <div class="stat-label">待复习（${duePercent}%）</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--color-success)">${stats.reviewed_today}</div>
          <div class="stat-label">今日已复习</div>
        </div>
      </div>
      <div style="margin-top:24px">
        <h3 style="margin-bottom:12px">分类分布</h3>
        <div class="question-list">
          ${state.categories.map(c => `
            <div class="question-card" style="cursor:default">
              <div class="qc-header">
                <span class="chip category" style="background:${escapeHtml(c.color)}">${escapeHtml(c.name)}</span>
                <span class="qc-meta">${c.question_count || 0} 题</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  } catch (err) {
    renderEmpty(`加载失败：${err.message}`, '⚠️')
  }
}

// ---------- 路由 ----------
function getRoute() {
  const hash = location.hash.replace(/^#/, '') || '/'
  return hash
}

function updateActiveNav(route) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active')
    const r = link.dataset.route
    if (route === '/' && r === 'list') link.classList.add('active')
    else if (route === '/review' && r === 'review') link.classList.add('active')
    else if (route === '/stats' && r === 'stats') link.classList.add('active')
    else if (route === '/new' && r === 'new') link.classList.add('active')
  })
}

async function router() {
  const route = getRoute()
  updateActiveNav(route)
  await loadDueBadge()

  if (route === '/' || route === '') {
    renderListView()
  } else if (route === '/review') {
    renderReviewView()
  } else if (route === '/stats') {
    renderStatsView()
  } else if (route === '/new') {
    renderFormView('new')
  } else if (route.startsWith('/edit/')) {
    const id = route.split('/edit/')[1]
    if (!state.currentQuestion || String(state.currentQuestion.id) !== String(id)) {
      try {
        state.currentQuestion = await api(`/questions/${id}`)
      } catch (err) {
        renderEmpty(`加载失败：${err.message}`, '⚠️')
        return
      }
    }
    renderFormView('edit', id)
  } else if (route.startsWith('/question/')) {
    const id = route.split('/question/')[1]
    await renderDetailView(id)
  } else {
    renderEmpty('页面不存在', '🔍')
  }
}

// 更新右上角待复习徽章
async function loadDueBadge() {
  try {
    const stats = await api('/reviews/stats')
    const badge = $('#dueBadge')
    if (!badge) return
    if (stats.due > 0) {
      badge.textContent = stats.due > 99 ? '99+' : String(stats.due)
      badge.hidden = false
    } else {
      badge.hidden = true
    }
  } catch {
    // ignore
  }
}

// ---------- 工具 ----------
function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// ---------- 启动 ----------
async function init() {
  await loadCategories()
  window.addEventListener('hashchange', router)
  await router()
}

init().catch(err => {
  app().innerHTML = `<div class="empty">初始化失败：${escapeHtml(err.message)}</div>`
})
