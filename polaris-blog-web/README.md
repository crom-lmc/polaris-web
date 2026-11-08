# blog-web — 博客前端（读者端 + 管理端）

`F:\code\sso` 工作区内的博客前端，配套后端为 **`sso-microservices/blog-admin`（端口 9003）**，
经 **SSO 网关（9080）** 统一入口访问，后台登录接入**统一账号中心**。

- **读者端 `packages/web`（5175）免登录**，只访问 `/api/blog/public/**`
- **管理端 `packages/admin`（5176）必须经账号中心登录**，API 走 `/api/blog/admin/**`，按钮级权限由 SSO 下发

## 目录结构

```
blog-web
├─ packages
│  ├─ shared          # 主题内核：ThemeConfig → CSS 变量、预设、token 派生
│  │  └─ src/theme    # color.ts css.ts default.ts presets.ts
│  │     src/mock     # Vite 中间件 Mock（VITE_USE_MOCK=true 时启用，当前关闭）
│  ├─ web             # 读者端：Vue3 + TS + Pinia，零 UI 框架，端口 5175
│  └─ admin           # 管理端：Vue3 + TS + Element Plus + ECharts，端口 5176
└─ tools
   ├─ cdp-e2e.mjs     # 无头浏览器：跳登录 → 填表 → 回跳 → 换票 → 进后台
   └─ cdp-web.mjs     # 无头浏览器：读者端免登录渲染冒烟
```

## 快速开始

```bash
npm install            # 根目录 workspaces 安装

npm run dev:web        # 读者端 http://localhost:5175
npm run dev:admin      # 管理端 http://localhost:5176

npm run typecheck      # 两个包 vue-tsc
npm run build
```

前置依赖（本地七端口）：gateway `9080`、auth `9001`、account `9002`、blog-admin `9003`、
sso-web `5173`、读者端 `5175`、管理端 `5176`。后端启动方式见 `../sso-microservices/README.md`。

### 环境变量

`packages/web/.env`：读者端不需要登录，`VITE_API_TARGET` 指向网关即可。

```ini
VITE_USE_MOCK=false
VITE_API_TARGET=http://127.0.0.1:9080
VITE_WEB_PORT=5175
VITE_WEB_HOST=127.0.0.1
```

`packages/admin/.env`：多了账号中心地址与前台预览地址。

```ini
VITE_USE_MOCK=false
VITE_API_TARGET=http://127.0.0.1:9080
VITE_ADMIN_PORT=5176
VITE_WEB_ORIGIN=http://localhost:5175   # 主题编辑器 iframe 预览
VITE_SSO_ORIGIN=http://localhost:5173   # 账号中心
```

> ⚠️ `VITE_SSO_ORIGIN` 与 `VITE_ADMIN_PORT` 拼出的 origin，**必须等于 `sso_application` 里 blog 应用的 `base_url`**，
> 否则一次性 ticket 的 origin 校验会拒发。改端口后要跑
> `python ../sso-microservices/tools/setup-blog-local.py --base-url http://127.0.0.1:<新端口>`。

## 后台登录（单点，无本地登录）

管理端不再有自己的登录表单、验证码和用户表，登录页 `LoginView.vue` 已退化为跳板：

```
5176 无令牌访问 → redirectToSsoLogin()
  → 5173/login?app=blog&redirect_uri=http://localhost:5176/sso/callback
  → 账号中心登录（账密 / 邮箱验证码）→ 持 SSO_SID 回跳，附带 ?ticket=
  → SsoCallbackView 取 ticket，调后端 POST /api/blog/sso/exchange
  → blog-admin 用 appSecret 向 auth 换 RS256 JWT（app=blog）→ 回传前端
  → localStorage 存 token → router.replace('/')，拉 /api/auth/me 取该账户在 blog 域内的权限码
```

关键点：

- **`appSecret` 只在 blog-admin 服务端**，前端只经手 60 秒有效、一次性的 ticket。
- 令牌带 `app=blog` 作用域，拿去调 SSO 平台接口或别的应用一律 403。
- 管理端的 401 拦截器统一 `redirectToSsoLogin()`；但 `/auth/me` 这类探测接口带 `skipAuthRedirect`，**不能因为一次探测失败就把人踢出去**。

## 权限模型

菜单与按钮都由权限码驱动，前后端一一对应：路由 `meta.perm` ↔ 后端 `@Permit("...")` ↔ `sso_permission(app_code='blog')`。

| 分组 | 权限码 |
| --- | --- |
| 仪表盘 | `stat:view` |
| 文章 | `article:list` `article:create` `article:edit` `article:delete` `article:publish` |
| 评论 | `comment:list` `comment:audit` `comment:delete` `comment:reply` |
| 分类 | `category:list` `category:edit` `category:delete` |
| 标签 | `tag:list` `tag:edit` `tag:delete` |
| 媒体 | `media:list` `media:upload` `media:edit` `media:delete` |
| 主题 | `theme:list` `theme:edit` `theme:publish` `theme:delete` |
| 设置 / 日志 | `setting:view` `setting:edit` `log:list` `log:clean` |

后端判定顺序：**未登录 401 → 令牌作用域非 blog 403 → 超管旁路 → 比对权限码**。
`AdminLayout.vue` 按 `auth.can(perm)` 过滤侧边栏，权限不足的页面在路由守卫里直接 `ElMessage` 拦下。

超管（`super=1`）可见全部 9 个菜单（10 条路由，文章编辑页不入菜单）；受限账号只看到被授权的几项。
实测 `blog_editor01`（仅仪表盘/文章/媒体）登录后侧边栏 3 项，越权接口返回 403。

## 接口约定

读者端（网关直通、免登录）：

| 能力 | 接口 |
| --- | --- |
| 首屏聚合 | `GET /api/blog/public/bootstrap` |
| 主题 | `GET /api/blog/public/theme/active` |
| 站点设置 | `GET /api/blog/public/settings` |
| 文章 | `GET /api/blog/public/articles`、`/{idOrSlug}`、`POST /{idOrSlug}/like`、`GET /pages/{slug}` |
| 分类 / 标签 / 归档 / 搜索 | `/categories`、`/tags`、`/archives`、`/search?q=` |
| 评论 | `GET /articles/{idOrSlug}/comments`、`POST /comments` |

管理端（`Authorization: Bearer <jwt>`）：

| 能力 | 接口 |
| --- | --- |
| 身份 | `GET /api/auth/me`（账号中心，Bearer；返回账户、`permissions`、`apps`） |
| 换票 | `POST /api/blog/sso/exchange`（免鉴权，body 带 ticket） |
| 文章 / 分类 / 标签 | CRUD、`POST /{id}/publish`、`/top`、`/batch/delete`、Markdown 导入导出 |
| 评论 | `PUT /{id}/approve`、`/reject`、`POST /batch/*`、`/reply` |
| 媒体 | `/media`、`/folders`、`POST /upload`（multipart）、批量删除 |
| 主题 | `/themes`、`/{id}/config`、`/publish`、`/preview`、`/import`、`/{id}/export` |
| 其它 | `/dashboard/stats`、`/settings`(KV)、`/logs` |

统一响应体 `{ code, message, data }`，分页字段 `records`（拦截器归一化为 `list`）。
**雪花 ID 一律是字符串**（19 位超 JS 2^53），前端 `types` 里全部声明为 `string`。

> 与原 `Blob-Frontend` 的差异：所有路径前缀由 `/api/public`、`/api/admin` 改为 `/api/blog/public`、`/api/blog/admin`。
> 前端 `api/http.ts` 的 `baseURL` 已设为 `/api/blog`，页面代码零改动。
> 已随 `t_user` 一起移除：登录页表单、用户管理页、修改密码入口。

## 动态主题机制

1. `packages/shared/src/theme/css.ts` 是前后端唯一约定：把 `ThemeConfig` 映射为 CSS 变量
   （颜色 / 字体 / 字号阶 / 圆角 / 间距刻度 / 容器宽度），生成 `:root` 与 `[data-theme="dark"]` 两段。
2. 读者端 `index.html` 内联脚本先读 `localStorage.blog.theme.cache` 注入 `<style id="theme-vars">`，
   首屏零闪烁；随后按 `/theme/active` 的 `version` 决定是否刷新缓存。
3. 组件样式只允许使用 CSS 变量，硬编码色值只出现在 `shared/src/theme/default.ts` 与 `web/src/styles/base.css` 的兜底变量里。
4. 后台主题编辑器三栏：左侧配置（预设/颜色/字体/间距/布局/区块拖拽/深色/自定义 CSS），
   中间 iframe 预览真实前台，右侧撤销重做 20 步 / 保存草稿 / 发布 / 导入导出；编辑时经 `postMessage` 实时下发，输入即生效。

## 冒烟脚本

```bash
node tools/cdp-web.mjs      # 读者端：断言首页/文章/分类渲染，且全程未跳登录
BLOG_USER=admin BLOG_PWD=... node tools/cdp-e2e.mjs   # 后台：完整单点链路 + 菜单数量
```

脚本用无头 Edge + CDP（flat session），失败时截图落在临时目录。
