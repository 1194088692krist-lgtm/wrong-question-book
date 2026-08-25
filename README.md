# 错题本 Web 应用

一个轻量级的线上错题本，支持分类管理、图片上传、间隔复习和打印导出。基于 Cloudflare Workers + D1 数据库 + R2 对象存储构建，可通过 GitHub 自动部署。

## 功能

- 错题增删改查（含搜索、分类筛选、待复习过滤）
- 分类管理（自定义名称与颜色）
- 图片上传（Cloudflare R2 存储，支持 5MB 以内常见图片格式）
- 间隔复习（简化版艾宾浩斯：1/2/4/7/15/30/60 天递增）
- 统计概览（总数、待复习、今日已复习、分类分布）
- 暗色模式 + 响应式布局 + 打印导出
- 单用户使用，无登录系统（可选叠加 Cloudflare Access 鉴权）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML/CSS/JS（无构建步骤） |
| 后端 | Hono + Cloudflare Workers |
| 数据库 | Cloudflare D1（SQLite 边缘数据库） |
| 图片存储 | Cloudflare R2 |
| 静态资源 | Cloudflare Workers Static Assets |
| 部署 | GitHub → Cloudflare（自动）或 Wrangler CLI（手动） |

## 目录结构

```
wrong-question-book/
├── src/
│   ├── index.ts              # Hono 应用入口
│   ├── types.ts              # 类型声明
│   ├── routes/               # API 路由（questions/categories/reviews/uploads）
│   └── lib/                  # 工具库（db/srs/response）
├── public/                   # 前端静态资源
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── migrations/               # D1 数据库迁移
│   ├── 0001_init.sql
│   └── seed.sql
├── .github/workflows/deploy.yml  # GitHub Actions 自动部署
├── wrangler.toml             # Cloudflare 配置
├── package.json
├── tsconfig.json
└── .gitignore
```

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库（仅首次）

```bash
npx wrangler login
npx wrangler d1 create wrong-question-book-db
```

将命令输出的 `database_id` 填入 `wrangler.toml` 的 `database_id` 字段。

### 3. 应用迁移

```bash
npm run db:migrate:local      # 本地 D1
# 可选：导入种子数据
npm run db:seed
```

### 4. 启动本地开发服务器

```bash
npm run dev
```

访问 `http://localhost:8788`，可正常使用所有功能。

## 部署到 Cloudflare

### 方式 A：GitHub 自动部署（推荐）

1. 将代码推送到 GitHub 仓库：
   ```bash
   git init
   git add .
   git commit -m "Initial commit: wrong-question-book"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/wrong-question-book.git
   git push -u origin main
   ```

2. 在 Cloudflare Dashboard 创建资源：
   - **D1** → 创建数据库 `wrong-question-book-db`，记下 `database_id`
   - **R2** → 创建桶 `wrong-question-book-assets`

3. 用步骤 2 的 `database_id` 替换 `wrangler.toml` 第 14 行中的占位 UUID（`00000000-0000-0000-0000-000000000000`），提交并推送。

4. 在 GitHub 仓库 → Settings → Secrets and variables → Actions 添加：
   - `CLOUDFLARE_API_TOKEN`（需 Workers 编辑、D1 编辑、R2 编辑权限）
   - `CLOUDFLARE_ACCOUNT_ID`

5. 推送到 `main` 分支即可触发 `.github/workflows/deploy.yml`，自动应用迁移并部署 Worker。

### 方式 B：Cloudflare Pages Git 集成（也可用）

1. 在 Cloudflare Dashboard → Pages → Create a project → Connect to Git
2. 选择本仓库，框架预设选 "None"
3. 构建命令留空（或填 `npm ci`）
4. 输出目录填 `public`
5. Settings → Functions → 添加 D1 绑定（变量名 `DB`）和 R2 绑定（变量名 `BUCKET`）

> 注意：Pages Git 集成不自动跑 D1 迁移，需手动执行 `npx wrangler d1 migrations apply wrong-question-book-db --remote`

### 方式 C：Wrangler CLI 手动部署

```bash
npx wrangler login
npx wrangler r2 bucket create wrong-question-book-assets
npx wrangler d1 create wrong-question-book-db   # 记下 database_id
# 填入 wrangler.toml
npx wrangler d1 migrations apply wrong-question-book-db --remote
npx wrangler deploy
```

## API 文档

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/questions` | 错题列表（支持 `?category=&tag=&q=&due=1`） |
| GET | `/api/questions/:id` | 错题详情 |
| POST | `/api/questions` | 新建错题 |
| PUT | `/api/questions/:id` | 更新错题 |
| DELETE | `/api/questions/:id` | 删除错题 |
| GET | `/api/categories` | 分类列表（含错题计数） |
| POST | `/api/categories` | 新建分类 |
| DELETE | `/api/categories/:id` | 删除分类 |
| GET | `/api/reviews/today` | 今日待复习列表 |
| GET | `/api/reviews/stats` | 统计概览 |
| POST | `/api/reviews/:id` | 提交复习结果（`{ "result": "correct" | "wrong" }`） |
| POST | `/api/uploads` | 上传图片（multipart, field: `file`） |
| GET | `/api/uploads/:key` | 访问已上传的图片 |

## 复习算法

简化版艾宾浩斯间隔重复：
- 答错：下次复习重置为 1 天后
- 答对：按当前复习次数取下一档间隔（1/2/4/7/15/30/60 天）

新错题创建时 `next_review_at` 默认为创建当下，即立刻进入待复习队列。

## 自定义

- 分类颜色：在前端"分类管理"或直接调用 API 指定十六进制色值
- 复习间隔：修改 `src/lib/srs.ts` 中的 `INTERVALS` 数组
- 上传大小/格式限制：修改 `src/routes/uploads.ts` 中的 `MAX_SIZE` 和 `ALLOWED_MIME`

## 许可

仅供个人学习使用。
