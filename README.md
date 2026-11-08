# Polaris Web

Polaris 平台前端：6 个独立部署的 Vue 3 单页应用，统一视觉语言与深浅色主题，全部通过 sso-gateway 访问后端。

## 一、应用总览

| 应用 | 端口(dev) | 面向 | 主要页面 |
|---|---|---|---|
| polaris-sso-web | 5173 | 全员 + 管理员 | 登录、工作台概览、账号/角色/菜单管理、通知中心 |
| polaris-ehr-web | 5179 | HR + 全员 | 工作台、组织架构、人员管理、假勤、审批中心、通知管理 |
| polaris-settings-web | 5180 | 管理员 | 数据字典、单号规则、审批配置（模板/场景/业务点/消息）、安全配置 |
| polaris-cms-web | 5177 | 内容运营 | 文章管理（Markdown 编辑器）、栏目管理、门户设置 |
| polaris-portal-web | 5178 | 访客 | 门户首页（Banner/推荐）、栏目文章列表、文章详情 |
| polaris-blog-web | 默认 | 博客 | `packages/web` 前台 + `packages/admin` 后台 |

## 二、各应用功能

### polaris-sso-web（统一账号中心）

- **登录**：账号/邮箱双登录、验证码、深浅色自适应
- **工作台概览**：待办提醒、最新通知列表（行点击弹窗详情 + 自动记读）
- **系统管理**：账号管理（重置密码、启停）、角色权限、菜单管理
- **通知中心**：类型筛选、未读高亮/已读淡化、分页列表

### polaris-ehr-web（人力中心）

- **工作台**：组织节点数 / 在职员工 / 待我审批数字卡片，点击直达对应页面（按权限降级）
- **组织架构**：左侧组织树 + 右侧节点员工列表；树选中/悬浮与人员管理统一样式；空态居中撑满
- **人员管理**：组织树（含「全部人员」）、关键字搜索、入转调离操作
- **假勤**：请假 / 转正 / 离职申请单
- **审批中心**：待我审批 / 我发起的，详情抽屉（分组卡片渲染，或自定义路由 iframe）
- **通知管理**：自研富文本（contenteditable，无第三方依赖）、部门树定向（含子部门）、草稿/发布/下架、类型字典（节假日/表彰/部门/制度/部门任命/其他）

### polaris-settings-web（配置中心）

- **数据字典**：类型 + 字典项两级维护，供各业务系统消费
- **单号规则**：前缀 + 流水位数，供 EHR 公告等编号使用
- **审批配置**：审批模板 / 业务场景 / 业务点 / 消息配置，统一「左侧树 + 右侧列表」布局，树样式与人力中心组织树一致
- **安全配置**：初始密码规则（默认随机）、密码复杂度、登录失败锁定、会话超时

### polaris-cms-web（内容中心）

- **文章管理**：列表筛选 + [md-editor-v3](https://github.com/imzbf/md-editor-v3) 编辑器（深浅色跟随系统）
- **栏目管理**：树形栏目维护
- **门户设置**：Banner / 推荐位配置，iframe 内嵌门户首页实时预览

### polaris-portal-web（内容门户）

- 对外浏览：首页 Banner 轮播、推荐文章、栏目文章列表、文章详情（代码块/封面深浅色适配）
- 头部：搜索框 + 深浅色切换按钮；可被 CMS 门户设置 iframe 预览

### polaris-blog-web（博客）

- `packages/web`：博客前台；`packages/admin`：博客后台，均独立构建

## 三、技术栈

| 层 | 选型 |
|---|---|
| 框架 | Vue 3（`<script setup>`） · Vite · TypeScript |
| UI | ant-design-vue 4.2.6（ConfigProvider 注入 darkAlgorithm） |
| 状态/路由 | Pinia · vue-router |
| 其他 | dayjs · md-editor-v3（仅 cms） |
| 校验 | vue-tsc --noEmit（六应用全量通过） |

## 四、开发

```bash
cd polaris-sso-web        # 任选其一
npm install
npm run dev               # 本地开发
npm run build             # 构建产物在 dist/
node_modules\.bin\vue-tsc.cmd --noEmit   # 类型检查（Windows）
```

## 五、主题系统（跨应用同步）

- 每个应用有独立的 `src/stores/theme.ts`：`mode: light|dark` → `antTheme`（darkAlgorithm）→ `<html data-theme>` + CSS 变量
- **跨应用同步**：写入共享 cookie `polaris_theme`（path=/，一年，SameSite=Lax；多级域名写顶级域），读取优先级：**cookie > 本应用 localStorage > 系统偏好**；`focus` 事件时重读 cookie，切回标签页即同步
- 首屏防闪烁：各 `index.html` 内联脚本在渲染前设置 `data-theme`（cookie 优先）
- **ehr-web 特例**：支持 `?theme=dark|light` URL 参数（供 iframe 嵌入），优先级最高且**不写回**偏好

## 六、约定

- 后端地址走 `.env` 系列文件（只含网关地址，无密钥）；`.env.local` 不入库
- 表格统一 `ft-page / ft-head / ft-scroll / ft-bottom` 布局，分页条 sticky 右下
- 树组件选中/悬浮样式、空态（`.tbl-empty` / `.org-empty`）跨应用统一
- `dist/`、`node_modules/` 不入库
