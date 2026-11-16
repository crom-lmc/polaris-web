# Polaris Web

Polaris 一体化企业平台前端，包含统一账号中心、EHR、配置与审批中心、CMS、门户、调度中心和博客。各应用独立开发、独立构建、独立部署，通过统一 SSO 登录，并经 Gateway 访问后端。

普通应用使用 Vue 3 + TypeScript + Vite + Pinia + Ant Design Vue；Blog 使用 npm workspaces，同时包含读者端和管理端。

> 后端仓库：[polaris-server](https://github.com/crom-lmc/polaris-server)。启动前端前，请先按后端 README 准备 MySQL、Redis、JWT 密钥和所需后端服务。

## 一、应用与端口总览

仓库包含 **7 个应用目录、8 个可运行前端入口**。

| 应用目录 | 可运行入口 | 默认开发端口 | 主要使用者 | 默认开发地址 |
|---|---|---:|---|---|
| `polaris-sso-web` | 统一账号中心 | 5173 | 全员、系统管理员 | `http://localhost:5173` |
| `polaris-blog-web/packages/web` | 博客读者端 | 5175 | 访客 | `http://localhost:5175` |
| `polaris-blog-web/packages/admin` | 博客管理端 | 5176 | 博客管理员 | `http://localhost:5176` |
| `polaris-cms-web` | 内容中心 | 5177 | 内容运营 | `http://localhost:5177` |
| `polaris-portal-web` | 内容门户 | 5178 | 员工、访客 | `http://localhost:5178` |
| `polaris-ehr-web` | 人力中心 | 5179 | 全员、HR、负责人 | `http://localhost:5179` |
| `polaris-settings-web` | 配置与审批中心 | 5180 | 管理员、审批人 | `http://localhost:5180` |
| `polaris-job-web` | 调度中心 | 5181 | 运维、系统管理员 | `http://localhost:5181` |

普通应用的 Vite 开发服务器会把 `/api`、`/actuator` 代理到 `VITE_SSO_TARGET`，默认是 `http://127.0.0.1:9080`。Blog 使用自己的环境变量，见后文。

## 二、功能模块

### 2.1 polaris-sso-web：统一账号中心

- 账号或邮箱登录、验证码、退出登录和跨应用单点登录入口。
- 工作台概览、通知中心、未读状态和通知详情。
- 账号管理：创建、启停、锁定、重置密码、角色分配和员工关联。
- 角色权限：角色维护、菜单/页签/按钮权限码授权。
- 应用管理：应用登记、访问授权、应用地址和换票配置。
- 数据权限：为账号或角色配置组织数据范围，配合后端实现人员数据隔离。
- 登录日志、安全相关管理入口及个人信息能力。

### 2.2 polaris-ehr-web：人力中心

| 功能 | 页面能力 |
|---|---|
| 工作台 | 人员状态、本月入离职、组织、待审批、合同到期等指标卡；最近请假和试用期提醒 |
| 组织架构 | 组织树、节点详情、负责人和节点员工；非 HR 账号按权限只读 |
| 人员管理 | 组织过滤、关键字搜索、新增、查看、编辑、入转调离、导入导出和档案抽屉 |
| 员工档案 | 基本信息、银行卡、教育、工作、家庭、合同和附件；敏感字段按权限脱敏 |
| 合同管理 | 合同列表、新增、续签、终止、到期信息和合同历史 |
| 司龄/年假台账 | 司龄明细、前司工作经历、年假额度和使用情况 |
| 招聘管理 | 招聘需求、候选人及入职流程相关页面 |
| 考勤管理 | 考勤规则、工作日历、日结果、考勤汇总、个人与团队加班 |
| 请假与年假 | 我的请假、团队请假、请假类型、额度和审批状态 |
| 转正/离职 | 申请、详情、审批进度和业务状态展示 |
| 审批中心 | 待我审批、我发起的、审批详情、分组卡片或自定义业务页面 |
| 通知公告 | 富文本编辑、分类、部门定向、草稿、发布、下架和已读信息 |
| 人力台账 | 合同到期、人员流动、考勤异常三个页签，提供服务端筛选、分页、指标和图表 |

“人力台账”的汇总、图表和明细均由后端按当前账号的数据权限及筛选条件返回，前端不使用当前页数据计算全量指标。

页面同时控制菜单、路由、页签和按钮权限；后端仍会再次鉴权和过滤组织数据，前端隐藏按钮不能替代服务端权限。

### 2.3 polaris-settings-web：配置与审批中心

- 数据字典类型和字典项维护，为各应用提供统一下拉选项。
- 单号规则、基础主数据和业务参数配置。
- 审批模板、流程节点、业务场景、业务点和消息配置。
- 统一审批中心，展示待办、已办、我发起的及审批详情。
- 消息配置和通知能力，支持业务审批与站内消息协同。
- 安全配置：初始密码模式、密码复杂度、登录失败锁定及会话参数。

### 2.4 polaris-cms-web：内容中心

- 文章列表、筛选、Markdown 编辑、摘要、封面和栏目归属。
- 草稿、提交审批、发布、下架等内容状态操作。
- 树形栏目维护和排序。
- 门户 Banner、推荐位等配置，并可预览门户首页。
- 深浅色编辑器适配和文章内容安全展示。

### 2.5 polaris-portal-web：内容门户

- 门户首页 Banner、推荐内容和栏目文章列表。
- 文章搜索、文章详情、封面及 Markdown/代码块展示。
- 聚合员工统一待办等工作入口。
- 支持深浅色主题，并可嵌入 CMS 门户设置进行预览。

### 2.6 polaris-job-web：调度中心

- 调度任务列表、任务定义、Cron/调度参数、启停和手工触发。
- 执行器及业务 Handler 查看、注册状态和心跳信息。
- 执行日志、执行结果和失败原因排查。
- 报警规则及通知配置入口。

### 2.7 polaris-blog-web：博客读者端与管理端

**读者端 `packages/web`**

- 公开博客首页、文章列表、分类/标签和文章详情。
- 默认可免登录浏览，开发时可选择 Mock 或真实后端数据。

**管理端 `packages/admin`**

- 博客文章、分类、标签等后台管理。
- 接入统一 SSO，需要管理员应用授权和相应权限。

Blog 不是普通单目录 Vite 应用，安装和启动命令必须在 `polaris-blog-web` 根目录执行，见第五节。

## 三、技术栈与通用结构

| 分类 | 技术 |
|---|---|
| 框架 | Vue 3、`<script setup>`、TypeScript |
| 构建 | Vite 5、`vue-tsc --noEmit` |
| UI | Ant Design Vue 4.2.6 |
| 状态与路由 | Pinia、vue-router |
| 时间与编辑器 | dayjs、md-editor-v3（CMS 等按需使用） |
| 包管理 | npm；Blog 使用 npm workspaces |

普通应用目录结构基本一致：

```text
polaris-xxx-web/
├── src/
│   ├── api/              # 业务接口与统一 request 封装
│   ├── assets/           # 静态资源
│   ├── components/       # 业务组件、档案抽屉、审批组件等
│   ├── router/           # 路由、登录守卫和权限过滤
│   ├── stores/           # 登录用户、权限码、主题等 Pinia 状态
│   ├── styles/           # CSS 变量、深浅色主题和全局布局
│   ├── views/            # 业务页面
│   └── main.ts
├── index.html            # 首屏主题初始化，避免闪烁
├── vite.config.ts        # 开发端口与后端代理
├── package.json
└── package-lock.json
```

### 请求与权限链路

```text
页面操作
  → src/api/*.ts
  → 统一 request 注入 Authorization / 当前应用登录态
  → Vite 开发代理 /api
  → Gateway :9080
  → 后端业务服务

登录后
  → 获取当前用户、应用和权限码
  → 路由守卫判断登录态
  → 菜单/页签按权限展示
  → 操作按钮通过 store.can('资源:动作') 控制
```

### 跨应用主题

- 主题分为 `light`、`dark`，通过 Ant Design Vue 算法和 CSS 变量共同实现。
- 使用共享 cookie `polaris_theme` 在同域应用间同步，读取优先级为 cookie、本应用 localStorage、系统偏好。
- `index.html` 在 Vue 渲染前设置 `data-theme`，减少首屏闪烁。
- EHR 支持 `?theme=dark|light`，用于 iframe 嵌入；URL 参数优先且不会写回用户主题偏好。

## 四、快速开始

### 4.1 准备环境

推荐 Node.js 20 LTS 和配套 npm。项目未强制限定唯一 Node 版本，但请使用仍受维护、兼容 Vite 5 的 Node.js 版本。

```bash
node -v
npm -v
```

后端最小环境：

- 只启动账号中心：Gateway、Auth、Account，以及 MySQL、Redis。
- 启动 EHR：在上述基础上增加 Settings、EHR。
- 启动 CMS 内容审批：增加 CMS、Settings；门户展示再增加 Portal。
- 启动博客管理：增加 Blog；只使用 Blog Mock 数据时可暂不启动 Blog 后端。
- 启动调度中心：增加 Job；报警消息依赖 Settings。

### 4.2 获取代码

```bash
git clone https://github.com/crom-lmc/polaris-server.git
git clone https://github.com/crom-lmc/polaris-web.git
cd polaris-web
```

先按后端 README 启动后端，再启动前端。默认配置已经匹配本仓库端口，后端 Gateway 在 `127.0.0.1:9080` 时，普通应用通常不需要额外配置。

### 4.3 启动统一账号中心

```bash
cd polaris-sso-web
npm ci
npm run dev
```

打开 `http://localhost:5173`。`npm ci` 按 `package-lock.json` 安装，适合首次拉取和 CI；主动更新依赖或 lock 文件时使用 `npm install`。

### 4.4 启动 EHR

另开一个终端：

```bash
cd polaris-ehr-web
npm ci
npm run dev
```

打开 `http://localhost:5179`。未登录时会跳转统一账号中心，登录后通过一次性 ticket 返回 EHR。

其他普通应用使用同样方式：

```bash
cd polaris-cms-web       # 或 polaris-portal-web / polaris-settings-web / polaris-job-web
npm ci
npm run dev
```

每个应用需要独立终端。无需为了开发 EHR 一次启动全部 8 个前端入口。

## 五、Blog 安装与启动

进入 Blog workspace 根目录，一次安装两个包的依赖：

```bash
cd polaris-blog-web
npm ci
```

使用真实后端时，可在当前 PowerShell 设置：

```powershell
$env:VITE_USE_MOCK = "false"
$env:VITE_API_TARGET = "http://127.0.0.1:9080"
$env:VITE_WEB_PORT = "5175"
$env:VITE_ADMIN_PORT = "5176"
$env:VITE_WEB_ORIGIN = "http://localhost:5175"
$env:VITE_SSO_ORIGIN = "http://localhost:5173"
```

启动读者端：

```bash
npm run dev:web
```

另开终端启动管理端：

```bash
cd polaris-blog-web
npm run dev:admin
```

如果只在当前终端设置过环境变量，另一个终端需要重新设置。也可按 `packages/web/.env.example`、`packages/admin/.env.example` 的变量名创建本地配置，但其中旧地址示例不要直接照抄，以本 README 的当前端口和后端地址为准。

Blog 常用命令：

```bash
npm run dev:web       # 读者端开发
npm run dev:admin     # 管理端开发
npm run typecheck     # 两端类型检查
npm run build         # 依次构建读者端和管理端
```

## 六、环境变量与 SSO 联调

### 6.1 普通应用变量

| 变量 | 默认值/示例 | 用途 |
|---|---|---|
| `VITE_SSO_TARGET` | `http://127.0.0.1:9080` | Vite 开发代理目标，即后端 Gateway |
| `VITE_SSO_ORIGIN` | `http://localhost:5173` | 统一账号中心地址，用于跳转登录 |

PowerShell 临时覆盖示例：

```powershell
$env:VITE_SSO_TARGET = "http://127.0.0.1:9080"
$env:VITE_SSO_ORIGIN = "http://localhost:5173"
npm run dev
```

`VITE_SSO_TARGET` 在 Vite 配置阶段读取，因此最稳妥的方式是在启动命令前设置终端环境变量。修改变量后需要重启 Vite。前端环境变量会进入浏览器产物，**不要放入数据库密码、appSecret、JWT 私钥或内部 token**。

### 6.2 应用登记与回调地址

跨应用登录不仅要求前端地址正确，还要求账号中心中的应用登记正确。每个需要登录的应用应检查：

1. 应用已启用，当前账号拥有该应用访问权限。
2. 应用 `base_url` 与浏览器实际访问的 origin 一致，包括协议、主机和端口。
3. 后端对应 `*_APP_SECRET` 与账号中心登记的 appSecret 一致。
4. 账号拥有相应角色、功能权限和数据权限。

本地推荐使用同一组地址，不要混用：

```text
账号中心：http://localhost:5173
EHR：     http://localhost:5179
Settings：http://localhost:5180
CMS：     http://localhost:5177
Portal：  http://localhost:5178
Job：     http://localhost:5181
Blog 管理端：http://localhost:5176
Gateway： http://127.0.0.1:9080
```

`localhost` 与 `127.0.0.1` 是不同 origin；如果 EHR 登记为 `http://localhost:5179`，浏览器就使用这个地址，不要改成 `http://127.0.0.1:5179`。修改端口或部署域名后，要同步修改账号中心应用登记。

### 6.3 推荐联调顺序

1. 启动 Account、Auth、Gateway，启动 `polaris-sso-web`，确认管理员可以登录。
2. 启动 Settings、EHR，启动 `polaris-ehr-web`，确认可以从账号中心返回并获取当前用户。
3. 给测试账号授予较小范围的角色和数据权限，检查菜单、页签、按钮和人员数据是否一致。
4. 再按需要启动 CMS、Portal、Blog、Job，避免把多个应用的问题混在一起排查。

## 七、类型检查、构建与预览

### 7.1 普通应用

在任一普通应用目录执行：

```bash
npm run build
npm run preview
```

普通应用的 `build` 已包含 `vue-tsc --noEmit && vite build`，类型检查不通过时不会生成正式产物。构建结果位于该应用 `dist/`，`preview` 仅用于本地检查构建结果，不是生产服务器。

如果只需要单独执行类型检查，可运行：

```bash
npx vue-tsc --noEmit
```

### 7.2 全部普通应用构建

在 `polaris-web` 根目录，PowerShell 可执行：

```powershell
$apps = @(
  "polaris-sso-web",
  "polaris-cms-web",
  "polaris-portal-web",
  "polaris-ehr-web",
  "polaris-settings-web",
  "polaris-job-web"
)
foreach ($app in $apps) {
  Push-Location $app
  npm ci
  npm run build
  Pop-Location
}
```

Blog 单独进入 `polaris-blog-web` 执行 `npm ci`、`npm run build`。

## 八、生产构建与 Nginx 部署

每个应用独立部署自己的 `dist/`。使用 vue-router history 模式时，Nginx 必须配置 history fallback，否则刷新子路由会出现 404。

下面是单个应用的简化示例，域名、证书、root 和上游地址应替换为实际值：

```nginx
server {
    listen 80;
    server_name ehr.example.com;

    root /opt/polaris/polaris-ehr-web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:9080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

部署检查清单：

- 为每个前端入口配置独立静态目录和正确的 history fallback。
- `/api` 只转发到 Gateway，不要直接暴露各业务服务端口。
- 账号中心所有应用的 `base_url` 改为正式 HTTPS origin。
- 后端审批回调、前端地址和门户内容地址同步改为生产可访问地址。
- 生产全站使用 HTTPS，避免 HTTPS 页面请求 HTTP API 导致 Mixed Content。
- 不在前端环境变量或源码中写任何服务端密钥。
- 部署后验证直接打开子路由、刷新页面、SSO 跳转、退出登录、文件上传下载和跨应用主题。

## 九、开发规范

### 9.1 代码与接口

- 统一使用 Vue 3 组合式 API 和 `<script setup lang="ts">`。
- 接口放在 `src/api/*.ts`，组件不直接散落编写请求；TypeScript 类型与后端 DTO 对齐。
- 登录态和权限通过用户 Store 获取，按钮/入口使用 `store.can('资源:动作')`，不要只判断角色名称。
- 新增菜单时同时评估路由、页签、按钮、后端 `@Permit` 和数据范围。
- 普通应用提交前执行 `npm run build`；Blog 执行 `npm run typecheck` 和 `npm run build`。
- `.env.local`、`dist/`、`node_modules/` 不提交；环境示例只放非敏感配置。

### 9.2 样式与主题

- 颜色使用 CSS 变量（如 `--card-bg`、`--text-base`、`--border-subtle`），新增颜色同时适配浅色和深色。
- 表格布局沿用 `ft-page / ft-head / ft-scroll / ft-bottom`，保持分页、滚动和空态行为一致。
- 表格空态使用 `.tbl-empty`，树/面板空态使用 `.org-empty`，内容应居中并合理利用剩余高度。
- 树样式保持选中透明底、悬浮中性灰、数量右对齐，避免单页另起一套视觉规范。
- 主题读写通过 `src/stores/theme.ts`，页面不要各自直接操作 cookie、localStorage 或 `data-theme`。
- 修改 request、主题、布局 class 等跨应用共同模式时，应评估所有相关应用，不只检查当前页面。

## 十、常见问题

### 10.1 `npm run dev` 后接口连接失败

确认 Gateway 已在 `9080` 启动，`VITE_SSO_TARGET` 指向 Gateway，并且后端所需业务服务已启动。Vite 只代理请求，不会代替启动后端。

### 10.2 登录后又跳回登录页，或 ticket 换取失败

依次检查应用 `base_url`、浏览器 origin、账号应用授权和后端 `*_APP_SECRET`。修改 Vite 端口后必须同步应用登记；不要混用 `localhost` 和 `127.0.0.1`。

### 10.3 请求返回 401

检查登录是否过期、后端 auth/Gateway RSA 密钥是否匹配、Redis 是否正常，以及请求是否经过 Gateway。必要时退出后重新登录，不要通过前端关闭鉴权绕过。

### 10.4 页面能看到菜单但按钮消失

按钮可能使用独立权限码。检查账号中心角色是否同时授予页面、页签和按钮权限；前端权限缓存可在重新登录后刷新。非 HR 对组织、人员只读是预期权限行为。

### 10.5 有页面权限但没有人员数据，或只能看到本团队

这是组织数据范围在服务端生效。检查账号的数据权限和组织负责人关系，不应通过请求全部接口或修改前端来绕过。

### 10.6 出现跨域错误

本地开发优先使用 Vite `/api` 代理，让浏览器请求同源前端地址。生产环境通过 Nginx 把 `/api` 转发到 Gateway。不要在不了解影响的情况下同时放开多个跨域来源和凭据。

### 10.7 修改环境变量没有生效

`VITE_SSO_TARGET` 等变量在 Vite 启动时读取，修改后重启开发服务器。另一个终端不会继承已打开终端的变量；还要确认变量设置在真正执行 `npm run dev` 的终端中。

### 10.8 生产首页正常，刷新子路由 404

Nginx 缺少 `try_files $uri $uri/ /index.html;`。同时检查 `root` 是否指向当前应用的 `dist`，不要指到仓库根目录。

### 10.9 Blog 一直显示模拟数据

确认 `VITE_USE_MOCK=false`、`VITE_API_TARGET` 指向 Gateway，并重启 Blog 开发服务器。管理端还需要 Blog 后端、SSO 应用登记和账号授权。

### 10.10 构建报 TypeScript 错误

普通应用的 `npm run build` 会先执行 `vue-tsc --noEmit`，应先修复类型错误再部署。不要通过删除类型检查脚本生成可能不可用的产物。
