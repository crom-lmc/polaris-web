# Polaris Web

Polaris 平台前端，Vue 3 全家桶，6 个独立部署的单页应用，统一深浅色主题。

## 应用与功能

### polaris-sso-web（统一账号中心）
- 登录页（账号/邮箱）、个人工作台概览（待办提醒、通知列表弹窗记读）
- 账号管理、角色权限、菜单管理
- 通知中心：通知列表、类型筛选、已读淡化、详情弹窗

### polaris-ehr-web（人力中心）
- 工作台：组织数/在职员工/待我审批数字卡片，点击直达对应页面
- 组织架构：组织树 + 节点员工列表、空态居中
- 人员管理：左侧组织树（含「全部人员」）、搜索、入离职操作
- 假勤：请假、转正、离职申请；审批中心（待我审批/我发起的，详情抽屉）
- 通知管理：富文本（加粗/列表/链接等）、部门树定向选择、状态流转、类型字典

### polaris-settings-web（配置中心）
- 数据字典、单号规则
- 审批配置：审批模板 / 业务场景 / 业务点 / 消息配置（左侧树 + 右侧列表布局）
- 安全配置：初始密码规则、密码复杂度、登录锁定、会话超时

### polaris-cms-web（内容中心）
- 文章管理：列表 + Markdown 编辑器（md-editor-v3，跟随系统深浅色）
- 栏目管理、门户设置（Banner/推荐位，内嵌门户预览）

### polaris-portal-web（内容门户）
- 对外浏览站：首页 Banner、推荐文章、栏目列表、文章详情
- 头部搜索 + 深浅色切换，可被 CMS 门户设置 iframe 预览

### polaris-blog-web（博客）
- `packages/web` 前台浏览、`packages/admin` 后台管理

## 技术栈

Vue 3 · Vite · TypeScript · Pinia · ant-design-vue 4 · vue-router · vue-tsc

## 开发

每个应用独立开发构建：

```bash
cd polaris-sso-web        # 任选其一
npm install
npm run dev               # 本地开发（默认 517x 端口）
npm run build             # 产物在 dist/
node_modules/.bin/vue-tsc.cmd --noEmit   # 类型检查
```

## 约定

- **主题跨应用同步**：共享 cookie `polaris_theme`（同主机不同端口、同顶级子域共享），localStorage 兜底，切回标签页自动同步；ehr-web 支持 `?theme=`（iframe 嵌入优先，不写回偏好）
- 后端地址走 `.env` 系列文件（只含网关地址，无密钥）
- `dist/`、`node_modules/` 不入库
