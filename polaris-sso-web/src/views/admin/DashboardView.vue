<template>
  <div class="dash-page">
    <a-alert
      v-if="denied"
      type="warning"
      show-icon
      style="margin-bottom: 16px"
      :message="`你没有「${denied}」权限，已跳过该页面`"
    />

    <a-row :gutter="16" align="stretch" class="dash-row">
      <a-col :span="8">
        <a-card title="当前账号" size="small" class="equal-card">
          <a-descriptions :column="1" size="small">
            <a-descriptions-item label="登录名">
              {{ store.user?.username || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="昵称">
              {{ store.user?.nickname || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="身份">
              <!-- 与 LOGO 徽标/主按钮/侧栏选中态同一支品牌靛蓝，避免预设 blue 的亮青蓝跳出 -->
              <a-tag :color="store.isSuperAdmin ? '#2f54eb' : 'default'">
                {{ store.isSuperAdmin ? '超级管理员' : '普通账号' }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="权限码">
              <a-tag>{{ store.permissions.length }} 项</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="可访问应用">
              <a-tag>{{ store.appList.length }} 个</a-tag>
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>

      <a-col :span="16">
        <a-card title="我的应用" size="small" class="equal-card">
          <template #extra>
            <span class="tip">点「进入」在新页签打开，沿用当前登录态，无需再次输密码</span>
          </template>

          <a-empty v-if="!store.appList.length" description="还没有被授权任何应用" />

          <div v-else class="app-grid">
            <div v-for="app in store.appList" :key="app.id" class="app-tile">
              <img class="app-logo" :src="logoOf(app)" :alt="app.name" />
              <div class="app-name">{{ app.name }}</div>
              <div class="app-code">{{ app.code }}</div>
              <!-- 统一账号中心是平台自身（当前控制台），没有可跳转的目标地址，不显示「进入」 -->
              <a-button
                v-if="!isBuiltin(app)"
                size="small"
                type="primary"
                :loading="entering === app.code"
                @click="enter(app)"
              >
                进入
              </a-button>
            </div>
          </div>

          <a-alert
            v-if="enterError"
            type="error"
            show-icon
            style="margin-top: 12px"
            :message="enterError"
          />
        </a-card>
      </a-col>
    </a-row>

    <!-- 概览数字：放在账号/应用卡下方，卡片与上方保持等高 -->
    <a-row :gutter="16" align="stretch" class="stat-row">
      <a-col :span="8">
        <a-card
          size="small"
          hoverable
          :loading="statLoading"
          class="stat-card"
          @click="goPendingApprovals"
        >
          <a-statistic title="待审批" :value="pendingCount" />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card size="small" hoverable :loading="statLoading" class="stat-card" @click="goMessages(1)">
          <a-statistic title="待办" :value="todoCount" />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card size="small" hoverable :loading="statLoading" class="stat-card" @click="goMessages(2)">
          <a-statistic title="未读消息" :value="unreadMsgCount" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 员工快捷查询：按姓名/工号找人，结果只展示非隐私信息；宽度与「当前账号」同列（span=8） -->
    <a-row :gutter="16" align="stretch" class="lookup-row">
      <a-col :span="8">
        <a-card title="员工快捷查询" size="small" class="lookup-card">
          <template #extra>
            <span class="tip">姓名 / 工号</span>
          </template>

          <a-input-search
            v-model:value="lookupKeyword"
            placeholder="输入姓名或工号后查询"
            enter-button="查询"
            allow-clear
            class="lookup-input"
            :loading="lookupLoading"
            @search="doLookup"
          />

          <div class="lookup-result">
            <div v-if="lookupResults.length" class="lookup-list">
              <div v-for="item in lookupResults" :key="item.employeeId" class="lookup-item">
                <div class="lookup-main">
                  <span class="lookup-name">{{ item.name || '-' }}</span>
                  <span class="lookup-meta">职位：{{ item.position || '-' }}</span>
                  <span class="lookup-meta">邮件：{{ item.email || '-' }}</span>
                </div>
                <a-button type="link" size="small" @click="openLookupDetail(item.employeeId)">
                  查看详情
                </a-button>
              </div>
            </div>
            <!-- 未查询或查无结果都显示暂无数据，水平垂直居中，避免卡片大面积留白 -->
            <a-empty v-else class="lookup-empty" description="暂无数据" />
          </div>
        </a-card>
      </a-col>

      <!-- 通知列表：只展示已发布且当前账号可见的通知，不做搜索；点标题进通知中心看详情 -->
      <a-col v-if="canNotice" :span="16">
        <a-card title="通知" size="small" class="notice-card">
          <template #extra>
            <a class="tip link" @click="goNotices">查看全部</a>
          </template>

          <a-spin :spinning="noticeLoading">
            <a-table
              v-if="noticeRows.length"
              class="notice-table"
              table-layout="fixed"
              size="small"
              :columns="noticeColumns"
              :data-source="noticeRows"
              :pagination="false"
              row-key="id"
              :row-class-name="noticeRowClass"
              :custom-row="noticeRowProps"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'title'">
                  <span class="notice-title" :title="record.title">{{ record.title }}</span>
                  <a-tag v-if="record.pinned" color="red" class="pin-tag">置顶</a-tag>
                </template>
                <template v-else-if="column.key === 'category'">
                  {{ record.categoryName || categoryMap[record.category] || '其他' }}
                </template>
                <template v-else-if="column.key === 'target'">
                  <span class="notice-target" :title="targetText(record)">
                    {{ targetText(record) }}
                  </span>
                </template>
                <template v-else-if="column.key === 'publisher'">
                  {{ record.publisherName || '—' }}
                </template>
                <template v-else-if="column.key === 'time'">
                  {{ formatTime(record.publishAt) }}
                </template>
              </template>
            </a-table>
            <a-empty v-else-if="!noticeLoading" class="notice-empty" description="暂无通知" />
          </a-spin>
        </a-card>
      </a-col>
    </a-row>

    <a-modal v-model:open="detailOpen" title="员工信息" :footer="null" :width="600" centered>
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="lookupDetail" :column="1" bordered size="small">
          <a-descriptions-item label="姓名">{{ lookupDetail.name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="工号">{{ lookupDetail.empNo || '-' }}</a-descriptions-item>
          <a-descriptions-item label="账号">{{ lookupDetail.account || '-' }}</a-descriptions-item>
          <a-descriptions-item label="性别">{{ lookupDetail.gender || '-' }}</a-descriptions-item>
          <a-descriptions-item label="职位">{{ lookupDetail.position || '-' }}</a-descriptions-item>
          <a-descriptions-item label="部门">{{ lookupDetail.department || '-' }}</a-descriptions-item>
          <a-descriptions-item label="邮件">{{ lookupDetail.email || '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-spin>
    </a-modal>

    <!-- 通知详情：打开即记读，后端按 (通知, 账号) 幂等 -->
    <a-modal
      v-model:open="noticeOpen"
      :title="currentNotice?.title || '通知详情'"
      :footer="null"
      width="760px"
      centered
    >
      <a-spin :spinning="noticeDetailLoading">
        <div v-if="currentNotice" class="notice-meta">
          <a-tag color="blue">
            {{ currentNotice.categoryName || categoryMap[currentNotice.category] || '其他' }}
          </a-tag>
          <a-tag v-if="currentNotice.pinned" color="red">置顶</a-tag>
          <span class="tip">目标：{{ targetText(currentNotice) }}</span>
          <span class="tip">
            发布：{{ formatTime(currentNotice.publishAt) }} · {{ currentNotice.publisherName || '—' }}
          </span>
        </div>
        <div v-if="currentNotice" class="notice-content" v-html="currentNotice.content" />
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { oauthAuthorize } from '@/api/oauth'
import { fetchApprovals } from '@/api/approvals'
import { fetchUnreadNoticeCount } from '@/api/notice'
import { fetchNoticeDetail, pageNotices, type NoticeItem } from '@/api/announcement'
import {
  fetchEmployeeLookupDetail,
  searchEmployees,
  type EmployeeLookupDetail,
  type EmployeeLookupItem
} from '@/api/employeeLookup'
import type { ApplicationVO } from '@/types'

const route = useRoute()
const store = useUserStore()

const denied = computed(() => (route.query.denied as string) || '')
const entering = ref('')
const enterError = ref('')

/* ---------- 概览数字卡片：待审批 / 待办 / 未读消息 ---------- */
const statLoading = ref(false)
const pendingCount = ref(0)
const todoCount = ref(0)
const unreadMsgCount = ref(0)

async function loadStats() {
  statLoading.value = true
  try {
    // 三个数字互不依赖，任一接口失败不影响另外两个展示
    const [pending, todo, msg] = await Promise.allSettled([
      fetchApprovals('pending'),
      fetchUnreadNoticeCount(1),
      fetchUnreadNoticeCount(2)
    ])
    if (pending.status === 'fulfilled') pendingCount.value = pending.value.data?.length ?? 0
    if (todo.status === 'fulfilled') todoCount.value = Number(todo.value.data ?? 0)
    if (msg.status === 'fulfilled') unreadMsgCount.value = Number(msg.value.data ?? 0)
  } finally {
    statLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadNotices()
})

/* ---------- 概览「通知」列表：无搜索，只展示标题/类型/目标/发布人/发布时间 ---------- */
const canNotice = computed(() => store.can('notice'))
const noticeLoading = ref(false)
const noticeRows = ref<NoticeItem[]>([])
const noticeOpen = ref(false)
const noticeDetailLoading = ref(false)
const currentNotice = ref<NoticeItem | null>(null)

const noticeColumns = [
  { key: 'title', title: '通知标题', dataIndex: 'title', width: '34%' },
  { key: 'category', title: '类型', width: '12%' },
  { key: 'target', title: '通知目标', width: '22%' },
  { key: 'publisher', title: '发布人', width: '16%' },
  { key: 'time', title: '发布时间', width: '16%' }
]

const categoryMap: Record<string, string> = {
  HOLIDAY: '节假日通知',
  COMMENDATION: '表彰通知',
  DEPARTMENT: '部门通知',
  POLICY: '制度通知',
  APPOINTMENT: '部门任命',
  OTHER: '其他'
}

async function loadNotices() {
  if (!canNotice.value) {
    return
  }
  noticeLoading.value = true
  try {
    const res = await pageNotices({ page: 1, size: 8 })
    noticeRows.value = res.data?.list ?? []
  } catch (e: any) {
    message.error(e?.message || '通知加载失败')
  } finally {
    noticeLoading.value = false
  }
}

function targetText(item: NoticeItem) {
  return item.targetType === 0 ? '全员（集团）' : item.targetOrgNames || '—'
}

/** 已读通知整行文字淡化（与「待办提醒」消息列表一致） */
function noticeRowClass(record: NoticeItem) {
  return record.read ? 'read-row' : ''
}

/** a-table 没有 row-click 事件，行点击通过 customRow 注入 */
function noticeRowProps(record: NoticeItem) {
  return { onClick: () => openNotice(record) }
}

/** 打开详情即记读：后端按 (通知, 账号) 幂等，成功后刷新列表 */
async function openNotice(row: NoticeItem) {
  noticeOpen.value = true
  noticeDetailLoading.value = true
  currentNotice.value = null
  try {
    const res = await fetchNoticeDetail(row.id)
    currentNotice.value = res.data
    loadNotices()
  } catch (e: any) {
    message.error(e?.message || '通知详情加载失败')
    noticeOpen.value = false
  } finally {
    noticeDetailLoading.value = false
  }
}

function formatTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '—'
}

function goNotices() {
  router.push('/notices')
}

/* 数字卡片点击：待审批进「待我审批」，待办/未读消息进待办提醒页 */
const router = useRouter()

function goPendingApprovals() {
  router.push({ name: 'approvals', query: { scope: 'pending' } })
}

/** kind=1 落在「待办」页签，kind=2 落在「消息」页签 */
function goMessages(kind: 1 | 2) {
  router.push({ name: 'messages', query: { kind } })
}

/* ---------- 员工快捷查询：列表只展示姓名/职位/邮件，详情弹窗纵向展示 ---------- */
const lookupKeyword = ref('')
const lookupLoading = ref(false)
const lookupResults = ref<EmployeeLookupItem[]>([])
const detailOpen = ref(false)
const detailLoading = ref(false)
const lookupDetail = ref<EmployeeLookupDetail | null>(null)

async function doLookup() {
  const keyword = lookupKeyword.value.trim()
  if (!keyword) {
    message.warning('请输入姓名或工号')
    return
  }
  lookupLoading.value = true
  try {
    const res = await searchEmployees(keyword)
    lookupResults.value = res.data ?? []
  } catch (e: any) {
    message.error(e?.message || '查询失败')
  } finally {
    lookupLoading.value = false
  }
}

async function openLookupDetail(employeeId: string) {
  lookupDetail.value = null
  detailOpen.value = true
  detailLoading.value = true
  try {
    const res = await fetchEmployeeLookupDetail(employeeId)
    lookupDetail.value = res.data
  } catch (e: any) {
    message.error(e?.message || '加载员工信息失败')
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

/** 平台内置应用（统一账号中心）：只是列表里的常驻标识，不提供跳转 */
function isBuiltin(app: ApplicationVO) {
  return app.code === 'sso-center' || !!app.builtIn
}

/** 应用 logo：优先用中心配置的 icon，缺省回退到内置图标包（/public/icons） */
function logoOf(app: ApplicationVO) {
  return app.icon || `/icons/${app.code}.svg`
}

function randomState(): string {
  const buf = new Uint8Array(12)
  crypto.getRandomValues(buf)
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 单点跳转（OAuth2 授权码模式）。
 * <p>
 * 关键：不经过账号中心自身的 /authorize 路由守卫（整页重载时 me() 偶发 401 会被守卫踢回登录页）。
 * 这里直接以【当前已登录的 Bearer 令牌】调后端 /api/auth/oauth/authorize 静默签码，
 * 拿回 redirectTo（应用侧带 code 的回跳地址）后整页跳转；应用侧换票即登录，无需再次输密码。
 * 与 AuthorizeView 用的是同一个 oauthAuthorize，已验证可用。
 * 无 redirectUri 的存量应用退化为打开 baseUrl，由应用自身守卫完成登录。
 */
async function enter(app: ApplicationVO) {
  enterError.value = ''
  const target = (app.redirectUri && app.redirectUri.trim()) || (app.baseUrl || '').trim()
  if (!target) {
    enterError.value = '该应用未配置访问地址'
    return
  }

  // 必须在 await 之前同步开窗：异步回调里的 window.open 会被浏览器当成弹窗拦截。
  // 先开一个空白页签占位，拿到 redirectTo 后再把它的 location 改掉。
  const tab = window.open('about:blank', '_blank')

  entering.value = app.code
  try {
    const res = await oauthAuthorize({
      responseType: 'code',
      clientId: app.code,
      redirectUri: target,
      state: randomState()
    })
    // 拿回的 redirectTo 形如 http://localhost:5177/callback?code=xxx&state=yyy
    const url = res.data.redirectTo
    if (tab) {
      tab.location.href = url
      // 断开新页签与本控制台的 opener 引用，防止目标站点反向操作当前页
      try {
        tab.opener = null
      } catch {
        /* 跨源后不可写，忽略 */
      }
    } else {
      // 被拦截（多数是浏览器设置问题）时退化为新开一次，再不行才当前页跳
      const fallback = window.open(url, '_blank')
      if (!fallback) window.location.href = url
    }
  } catch (e: any) {
    // 签码失败：关掉占位页签，控制台留在原地
    try {
      tab?.close()
    } catch {
      /* ignore */
    }
    enterError.value = e?.message || '跳转失败'
  } finally {
    entering.value = ''
  }
}
</script>

<style scoped>
/* 上下两行所有卡片统一高度，保证三张数字卡与下方账号/应用卡完全等高 */
.dash-row,
.stat-row {
  --dash-card-height: 180px;
}

.equal-card,
.stat-card {
  /* height:100% 让同行卡片被拉伸到同一高度（我的应用与当前账号严格等高），
     min-height 兜底保证不会低于统一基准高度 */
  height: 100%;
  min-height: var(--dash-card-height);
  display: flex;
  flex-direction: column;
}

.equal-card :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 数字卡在下方，与上方卡片留出间距 */
.stat-row {
  margin-top: 16px;
}

.stat-card :deep(.ant-card-body) {
  flex: 1;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-card :deep(.ant-statistic-title) {
  color: var(--muted);
  margin-bottom: 8px;
}

.stat-card :deep(.ant-statistic-content) {
  font-size: 34px;
  line-height: 1.2;
  font-weight: 600;
}

.tip {
  font-size: 12px;
  color: var(--muted);
}

.link {
  cursor: pointer;
}

/* 通知列表：与员工快捷查询同高，卡片体内滚动，空态居中 */
.notice-card {
  flex: 1;
  min-width: 0;
}

.notice-card :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

.notice-table {
  flex: 0 0 auto;
}

.notice-title {
  font-weight: 500;
}

.pin-tag {
  margin-left: 6px;
}

.notice-target {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.notice-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.notice-table :deep(.ant-table-tbody > tr) {
  cursor: pointer;
}

.notice-table :deep(.read-row > td) {
  color: #9aa4b2;
}

.notice-table :deep(.read-row) .notice-title {
  color: #9aa4b2;
}

.notice-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 12px;
}

.notice-content {
  max-height: 56vh;
  overflow-y: auto;
  line-height: 1.8;
  word-break: break-word;
}

.notice-content :deep(h3) {
  margin: 8px 0 6px;
  font-size: 16px;
  font-weight: 600;
}

/* 概览页纵向撑满：查询卡片吃掉下方剩余高度 */
.dash-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 员工快捷查询：与「当前账号」同列宽（span=8），高度铺满剩余空间 */
.lookup-row {
  flex: 1;
  min-height: 240px;
  margin-top: 16px;
}

.lookup-row :deep(.ant-col),
.lookup-row .lookup-card {
  display: flex;
  flex-direction: column;
}

.lookup-card {
  flex: 1;
}

.lookup-card :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.lookup-input {
  width: 100%;
}

.lookup-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  min-height: 0;
}

/* a-spin 多包了一层容器，flex 高度要继续传下去 */
.lookup-result :deep(.ant-spin-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 结果多时卡片内部滚动，不把卡片撑破 */
.lookup-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 未查询 / 无结果：空状态用 auto 外边距在卡片剩余区域内水平、垂直居中（不改成 flex，避免图标和文字横向排布） */
.lookup-empty {
  margin: auto;
}

/* 表格式对齐：姓名、职位、邮件每行都从同一列起点开始 */
.lookup-item {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) minmax(0, 1.25fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-subtle);
}

.lookup-item:last-child {
  border-bottom: none;
}

/* 让姓名/职位/邮件直接参与外层网格，保证逐行对齐 */
.lookup-main {
  display: contents;
}

.lookup-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lookup-meta {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-grid {
  display: grid;
  /* 150 起步：4 个应用在 1440 宽的窗口里也能排成一行，不会出现 3+1 的孤儿磁贴 */
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  /* 磁贴网格撑满卡片体剩余高度，每行等高拉伸 */
  flex: 1;
  grid-auto-rows: 1fr;
  gap: 12px;
}

.app-tile {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.app-tile:hover {
  /* 用品牌蓝的半透明高亮，避免深色下出现刺眼的浅蓝描边 */
  border-color: rgba(47, 84, 235, 0.7);
  box-shadow: 0 4px 16px rgba(47, 84, 235, 0.22);
}

/* 应用 logo：与浏览器 favicon 同一套图形，保持品牌一致 */
.app-logo {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: block;
  margin-bottom: 2px;
}

/* 把「进入」按钮推到磁贴底部，跨磁贴水平对齐（磁贴高度被网格撑成等高） */
.app-tile :deep(.ant-btn) {
  margin-top: auto;
}

.app-name {
  font-weight: 600;
  font-size: 14px;
}

.app-code {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 4px;
}
</style>
