<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  AuditOutlined,
  BellOutlined,
  ControlOutlined,
  DatabaseOutlined,
  NumberOutlined
} from '@ant-design/icons-vue'

const router = useRouter()

const stats = [
  { label: '字典类型', value: 12, note: '覆盖 4 个应用', icon: ControlOutlined, color: '#2f54eb', bg: '#eef2ff' },
  { label: '字典项', value: 36, note: '启用 34 项', icon: DatabaseOutlined, color: '#13c2c2', bg: '#e6fffb' },
  { label: '主数据分类', value: 6, note: '全局共享', icon: ApartmentOutlined, color: '#722ed1', bg: '#f9f0ff' },
  { label: '审批模板', value: 8, note: '启用 6 个', icon: AuditOutlined, color: '#fa8c16', bg: '#fff7e6' },
  { label: '业务场景', value: 12, note: '接入 3 个应用', icon: BellOutlined, color: '#eb2f96', bg: '#fff0f6' },
  { label: '单号规则', value: 6, note: '运行正常', icon: NumberOutlined, color: '#52c41a', bg: '#f6ffed' }
]

const apps = [
  { name: '统一账号中心', code: 'account', dict: 6, approval: '—', notice: 3, status: '已接入' },
  { name: '人力中心', code: 'ehr', dict: 12, approval: 5, notice: 4, status: '已接入' },
  { name: '内容中心', code: 'cms', dict: 4, approval: 1, notice: 2, status: '已接入' },
  { name: '博客系统', code: 'blog', dict: 3, approval: '—', notice: 1, status: '已接入' },
  { name: '调度中心', code: 'job', dict: 5, approval: 2, notice: 2, status: '已接入' }
]

const changes = [
  { title: '更新候选人沟通方式字典', module: '字典配置', operator: 'wanghaoran', time: '10:24', color: 'blue' },
  { title: '发布请假审批模板 V3', module: '审批配置', operator: 'admin', time: '09:48', color: 'orange' },
  { title: '新增员工工号规则', module: '单号配置', operator: 'admin', time: '昨天 16:32', color: 'green' },
  { title: '调整邮件通知渠道', module: '消息配置', operator: 'wanghaoran', time: '昨天 14:18', color: 'purple' },
  { title: '启用职位主数据分类', module: '主数据', operator: 'admin', time: '周一 11:06', color: 'cyan' },
  { title: '更新内容审核业务场景', module: '业务场景', operator: 'admin', time: '周一 09:30', color: 'magenta' }
]
</script>

<template>
  <div class="dashboard-page">
    <div class="stat-grid">
      <a-card v-for="item in stats" :key="item.label" class="stat-card" :bordered="false">
        <div class="stat-main">
          <div class="stat-icon" :style="{ color: item.color, background: item.bg }">
            <component :is="item.icon" />
          </div>
          <div class="stat-text">
            <div class="stat-value">{{ item.value }}</div>
            <div class="stat-sub">
              <div class="stat-label">{{ item.label }}</div>
              <div class="stat-note">{{ item.note }}</div>
            </div>
          </div>
        </div>
      </a-card>
    </div>

    <a-card class="quick-card" :bordered="false" :body-style="{ padding: '12px 16px' }">
      <div class="quick-bar">
        <a-space wrap :size="10">
          <span class="quick-title">快捷操作</span>
          <a-button type="primary" size="small" @click="router.push('/dicts')">新建字典类型</a-button>
          <a-button size="small" @click="router.push('/approvals')">新增审批模板</a-button>
          <a-button size="small" @click="router.push('/notices')">消息渠道配置</a-button>
          <a-button size="small" @click="router.push('/code-rules')">单号规则配置</a-button>
        </a-space>
        <span class="health"><span class="health-dot" />配置服务运行正常</span>
      </div>
    </a-card>

    <div class="main-grid">
      <a-card class="fill-card" :bordered="false" title="应用配置概览" :body-style="{ padding: '0 16px' }">
        <template #extra><span class="panel-extra">5 个应用</span></template>
        <div class="app-table">
          <div class="app-row app-header">
            <span>应用</span>
            <span>字典项</span>
            <span>审批模板</span>
            <span>消息渠道</span>
            <span>状态</span>
          </div>
          <div v-for="app in apps" :key="app.code" class="app-row">
            <div class="app-name">
              <span class="app-code">{{ app.code.slice(0, 1).toUpperCase() }}</span>
              <div>
                <div>{{ app.name }}</div>
                <div class="app-code-text">{{ app.code }}</div>
              </div>
            </div>
            <span>{{ app.dict }}</span>
            <span>{{ app.approval }}</span>
            <span>{{ app.notice }}</span>
            <a-tag color="success">{{ app.status }}</a-tag>
          </div>
        </div>
      </a-card>

      <a-card class="fill-card" :bordered="false" title="最近变更" :body-style="{ padding: '0 16px' }">
        <template #extra><span class="panel-extra">近期操作</span></template>
        <div class="change-list">
          <div v-for="item in changes" :key="item.title" class="change-row">
            <div class="change-content">
              <div class="change-title">{{ item.title }}</div>
              <div class="change-meta">{{ item.operator }} · {{ item.time }}</div>
            </div>
            <a-tag :color="item.color">{{ item.module }}</a-tag>
          </div>
        </div>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stat-grid {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  border: 1px solid var(--panel-border);
}

.stat-card :deep(.ant-card-body) {
  min-height: 106px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
}

.stat-main {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.stat-icon {
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 22px;
}

.stat-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.stat-value {
  color: var(--text-base);
  font-size: 30px;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.stat-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stat-label {
  color: var(--muted);
  font-size: 13px;
}

.stat-note {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.quick-card {
  flex: 0 0 auto;
  border: 1px solid var(--panel-border);
}

.quick-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.quick-title {
  margin-right: 4px;
  color: var(--text-base);
  font-weight: 600;
}

.health {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
}

.health-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #52c41a;
  box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.12);
}

.main-grid {
  flex: 1;
  min-height: 330px;
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
  gap: 14px;
}

.fill-card {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--panel-border);
}

.fill-card :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.fill-card :deep(.ant-card-body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel-extra {
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
}

.app-table,
.change-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-row {
  flex: 1;
  min-height: 48px;
  display: grid;
  grid-template-columns: minmax(150px, 1.5fr) repeat(3, minmax(68px, 0.7fr)) 76px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-base);
  font-size: 13px;
}

.app-row:last-child,
.change-row:last-child {
  border-bottom: none;
}

.app-header {
  flex: 0 0 42px;
  min-height: 42px;
  color: var(--muted);
  font-size: 12px;
}

.app-name {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-code {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #eef2ff;
  color: #2f54eb;
  font-weight: 600;
}

.app-code-text,
.change-meta {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}

.change-row {
  flex: 1;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.change-content {
  min-width: 0;
}

.change-title {
  overflow: hidden;
  color: var(--text-base);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.change-row :deep(.ant-tag) {
  flex: 0 0 auto;
  margin-inline-end: 0;
}

@media (min-width: 1680px) {
  .stat-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .stat-card :deep(.ant-card-body) {
    padding: 14px;
  }

  .stat-note {
    display: none;
  }
}

@media (max-width: 800px) {
  .stat-note {
    display: none;
  }

  .stat-sub {
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .main-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-card :deep(.ant-card-body) {
    padding: 14px;
  }

  .stat-icon {
    display: none;
  }

  .app-row {
    grid-template-columns: minmax(130px, 1.5fr) repeat(2, minmax(58px, 0.7fr)) 70px;
  }

  .app-row > :nth-child(4) {
    display: none;
  }
}

@media (max-height: 760px) {
  .dashboard-page {
    gap: 10px;
  }

  .stat-grid,
  .main-grid {
    gap: 10px;
  }

  .stat-card :deep(.ant-card-body) {
    min-height: 90px;
    padding-top: 12px;
    padding-bottom: 12px;
  }
}
</style>
