# Polaris Web

Polaris 平台前端，Vue 3 全家桶，共 6 个独立应用。

## 应用

| 应用 | 说明 |
|---|---|
| polaris-sso-web | 统一账号中心（登录、账号管理、通知中心、概览） |
| polaris-ehr-web | 人力中心（组织架构、人员、假勤、审批、通知管理） |
| polaris-settings-web | 配置中心（字典、单号规则、审批流、安全配置） |
| polaris-cms-web | 内容中心（文章、栏目、门户设置） |
| polaris-portal-web | 内容门户（对外浏览） |
| polaris-blog-web | 博客（web + admin 两个子包） |

## 技术栈

Vue 3 · Vite · TypeScript · Pinia · ant-design-vue 4 · vue-tsc

## 开发

每个应用独立开发构建：

```bash
cd polaris-sso-web        # 任选其一
npm install
npm run dev               # 本地开发
npm run build             # 构建产物在 dist/
node_modules/.bin/vue-tsc.cmd --noEmit   # 类型检查
```

## 约定

- 深浅色主题跨应用同步：共享 cookie `polaris_theme`，各应用 localStorage 兜底，切回标签页自动同步。
- 环境差异通过 `.env` 系列文件配置后端网关地址，不含密钥。
- 未构建产物（`dist/`、`node_modules/`）不入库。
