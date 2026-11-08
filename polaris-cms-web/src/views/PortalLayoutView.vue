<script setup lang="ts">
import { useUserStore } from '@/stores/user'
const store = useUserStore()
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { ExportOutlined } from '@ant-design/icons-vue'
import {
  fetchPortalLayout,
  savePortalLayout,
  type PortalLayoutItem
} from '@/api/cms'

/** 门户前端地址（iframe 预览目标，origin 需与 SSO 里 portal 应用注册的 baseUrl 一致） */
const PORTAL_ORIGIN = import.meta.env.VITE_PORTAL_ORIGIN || 'http://localhost:5178'

const MODULE_DESC: Record<string, string> = {
  banner: '顶部大图轮播，取自 CMS Banner 模块',
  featured: '置顶 / 推荐文章，横向卡片',
  latest: '已发布文章列表，按发布时间',
  category: '分类导航入口，取自 CMS 分类',
  tags: '热门标签云，取自 CMS 标签',
  links: '取自 CMS 友情链接，按排序展示'
}

/** 每个模块的数据在哪里维护（点行尾图标直达） */
const MODULE_MANAGE: Record<string, { path: string; label: string }> = {
  banner: { path: '/banners', label: 'Banner 管理' },
  featured: { path: '/articles', label: '内容管理' },
  latest: { path: '/articles', label: '内容管理' },
  category: { path: '/categories', label: '分类管理' },
  tags: { path: '/tags', label: '标签管理' },
  links: { path: '/links', label: '友情链接' }
}

const router = useRouter()

const DEVICES = [
  { key: 'desktop', label: '桌面', width: '100%' },
  { key: 'tablet', label: '平板', width: '834px' },
  { key: 'mobile', label: '手机', width: '390px' }
] as const

const loading = ref(false)
const saving = ref(false)
const list = ref<PortalLayoutItem[]>([])
/** 上次保存 / 加载时的快照，用于判断是否有未保存改动 */
const snapshot = ref('')
const device = ref<(typeof DEVICES)[number]['key']>('desktop')
const reloadKey = ref(0)

const frameRef = ref<HTMLIFrameElement>()

const enabledCount = computed(() => list.value.filter((m) => m.enabled === 1).length)
const dirty = computed(() => snapshot.value !== '' && JSON.stringify(list.value) !== snapshot.value)
const previewSrc = computed(() => `${PORTAL_ORIGIN}/?preview=1&r=${reloadKey.value}`)
const frameWidth = computed(() => DEVICES.find((d) => d.key === device.value)!.width)

onMounted(load)
onBeforeUnmount(() => clearTimeout(sendTimer))

async function load() {
  loading.value = true
  try {
    list.value = await fetchPortalLayout()
    takeSnapshot()
  } catch (e: any) {
    message.error(e?.message || '加载布局失败')
  } finally {
    loading.value = false
  }
}

function takeSnapshot() {
  snapshot.value = JSON.stringify(list.value)
}

function move(index: number, dir: -1 | 1) {
  const to = index + dir
  if (to < 0 || to >= list.value.length) return
  const arr = list.value
  ;[arr[index], arr[to]] = [arr[to], arr[index]]
}

function toggle(item: PortalLayoutItem) {
  item.enabled = item.enabled === 1 ? 0 : 1
}

// ---------------- 拖拽排序 ----------------
const dragIndex = ref(-1)
const overIndex = ref(-1)

function onDragStart(i: number, e: DragEvent) {
  dragIndex.value = i
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Firefox 需要设置数据才触发 drag
    e.dataTransfer.setData('text/plain', String(i))
  }
}

function onDragOver(i: number) {
  overIndex.value = i
}

function onDragLeave(i: number) {
  if (overIndex.value === i) overIndex.value = -1
}

function onDrop(i: number) {
  const from = dragIndex.value
  resetDrag()
  if (from < 0 || from === i) return
  const arr = [...list.value]
  const [moved] = arr.splice(from, 1)
  arr.splice(i, 0, moved)
  list.value = arr
}

function resetDrag() {
  dragIndex.value = -1
  overIndex.value = -1
}

// ---------------- 预览下发 ----------------
let sendTimer: ReturnType<typeof setTimeout> | undefined

/** 把当前（可能未保存的）布局推给 iframe，让门户实时重排 */
function pushLayout() {
  if (!list.value.length) return
  const win = frameRef.value?.contentWindow
  if (!win) return
  const payload = list.value.map((m, i) => ({ ...m, sort: i + 1 }))
  win.postMessage({ type: 'portal:preview-layout', modules: payload }, PORTAL_ORIGIN)
}

function schedulePush() {
  clearTimeout(sendTimer)
  sendTimer = setTimeout(pushLayout, 80)
}

function onFrameLoad() {
  // 首屏加载完立刻同步一次，之后靠 watch 增量下发
  pushLayout()
}

function reloadPreview() {
  reloadKey.value = Date.now()
}

function openPortal() {
  window.open(`${PORTAL_ORIGIN}/`, '_blank', 'noopener')
}

watch(
  list,
  () => {
    schedulePush()
  },
  { deep: true }
)

// ---------------- 保存 / 重置 ----------------
async function save() {
  saving.value = true
  try {
    const payload = list.value.map((m, i) => ({
      moduleKey: m.moduleKey,
      moduleName: m.moduleName,
      enabled: m.enabled,
      sort: i + 1,
      config: m.config || ''
    }))
    list.value = await savePortalLayout(payload)
    takeSnapshot()
    message.success('门户布局已保存，门户刷新即可看到变化')
    // 保存后重新拉一次预览，确保看到的是服务端最终状态
    reloadPreview()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function reset() {
  list.value = JSON.parse(snapshot.value)
  message.info('已还原为上次保存的布局')
}

/** 跳到该模块的数据维护页 */
function goManage(key: string) {
  const target = MODULE_MANAGE[key]
  if (target) router.push(target.path)
}

/** 有未保存改动时离开页面先确认，避免误操作丢配置 */
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '有未保存的布局改动',
      content: '门户布局还没保存，离开后这些改动会丢失。',
      okText: '放弃并离开',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })
})
</script>

<template>
  <div class="pl">
    <!-- 左：布局配置 -->
    <aside class="pl-side">
      <div class="side-head">
        <div class="side-title">首页布局</div>
        <div class="side-sub">
          勾选要展示的区块，拖动或 ↑ ↓ 调整顺序 · 已启用
          <b>{{ enabledCount }}</b> / {{ list.length }}
        </div>
      </div>

      <a-spin :spinning="loading">
        <div class="side-list">
          <div
            v-for="(m, i) in list"
            :key="m.moduleKey"
            class="mod"
            :class="{ off: m.enabled !== 1, dragging: dragIndex === i, over: overIndex === i && dragIndex !== i }"
            draggable="true"
            @dragstart="onDragStart(i, $event)"
            @dragover.prevent="onDragOver(i)"
            @dragleave="onDragLeave(i)"
            @drop.prevent="onDrop(i)"
            @dragend="resetDrag"
          >
            <span class="grip" title="拖动排序">⠿</span>
            <span class="idx">{{ i + 1 }}</span>
            <div class="mod-meta">
              <div class="mod-name">{{ m.moduleName }}</div>
              <div class="mod-desc">{{ MODULE_DESC[m.moduleKey] || '自定义区块' }}</div>
            </div>
            <div class="mod-ops">
              <a-tooltip v-if="MODULE_MANAGE[m.moduleKey]" :title="`去「${MODULE_MANAGE[m.moduleKey].label}」维护数据`">
                <a-button size="small" type="text" class="go" @click.stop="goManage(m.moduleKey)">
                  <template #icon><export-outlined /></template>
                </a-button>
              </a-tooltip>
              <a-button v-if="store.can('portal:config')" size="small" type="text" :disabled="i === 0" title="上移" @click="move(i, -1)">↑</a-button>
              <a-button
                v-if="store.can('portal:config')"
                size="small"
                type="text"
                :disabled="i === list.length - 1"
                title="下移"
                @click="move(i, 1)"
              >↓</a-button>
              <a-switch size="small" :checked="m.enabled === 1" :disabled="!store.can('portal:config')" @change="toggle(m)" />
            </div>
          </div>
          <a-empty v-if="!loading && list.length === 0" description="暂无模块" />
        </div>
      </a-spin>

      <div class="side-foot">
        <a-button block :disabled="!dirty" @click="reset">放弃修改</a-button>
        <a-button v-if="store.can('portal:config')" block type="primary" :loading="saving" :disabled="!dirty" @click="save">
          保存布局
        </a-button>
      </div>
    </aside>

    <!-- 右：实时预览 -->
    <section class="pl-main">
      <div class="pv-bar">
        <div class="pv-title">
          实时预览
          <span class="pv-tip">{{ dirty ? '含未保存改动' : '与线上一致' }}</span>
        </div>
        <a-radio-group v-model:value="device" size="small" button-style="solid" class="pv-device">
          <a-radio-button v-for="d in DEVICES" :key="d.key" :value="d.key">{{ d.label }}</a-radio-button>
        </a-radio-group>
        <a-button size="small" @click="reloadPreview">刷新</a-button>
        <a-button size="small" type="link" @click="openPortal">新窗口打开</a-button>
      </div>

      <div class="pv-stage">
        <div class="pv-frame" :style="{ width: frameWidth }">
          <iframe ref="frameRef" :src="previewSrc" title="门户首页预览" @load="onFrameLoad" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pl {
  display: flex;
  gap: 16px;
  height: calc(100vh - 96px);
  min-height: 520px;
}

/* ---------- 左栏 ---------- */
.pl-side {
  width: 380px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--header-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
}

.side-head {
  padding: 12px 18px;
  min-height: 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-bottom: 1px solid var(--border-subtle);
}

.side-title {
  font-size: 14px;
  font-weight: 600;
}

.side-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

.side-sub b {
  color: var(--text-base);
}

/* a-spin 会插入两层 div，必须让它们撑满并把 flex 传递下去，
   否则 .side-list 的 flex:1 失效，列表只按内容高度、保存按钮悬在中间 */
.pl-side :deep(.ant-spin-nested-loading) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pl-side :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.side-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mod {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--header-bg);
  cursor: grab;
  transition: opacity 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.mod:hover {
  border-color: #c9d3e4;
}

.mod.off {
  opacity: 0.5;
}

.mod.dragging {
  opacity: 0.35;
}

.mod.over {
  border-color: #4c7dff;
  box-shadow: 0 0 0 2px rgba(76, 125, 255, 0.15);
}

.grip {
  color: var(--muted);
  font-size: 13px;
  line-height: 1;
  user-select: none;
}

.idx {
  width: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

.mod-meta {
  flex: 1;
  min-width: 0;
}

.mod-name {
  font-size: 13px;
  font-weight: 500;
}

.mod-desc {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mod-ops {
  display: flex;
  align-items: center;
  gap: 2px;
}

.mod-ops :deep(.ant-btn) {
  padding: 0 4px;
  min-width: 22px;
  height: 22px;
}

.mod-ops .go {
  color: var(--muted);
}

.mod-ops .go:hover {
  color: #4e6ef2;
}

.side-foot {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  background: var(--header-bg);
}

/* ---------- 右栏 ---------- */
.pl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--header-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
}

.pv-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  min-height: 56px;
  border-bottom: 1px solid var(--border-subtle);
}

.pv-title {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.pv-tip {
  font-weight: 400;
  font-size: 11px;
  color: var(--muted);
}

.pv-device {
  margin-left: auto;
}

.pv-stage {
  flex: 1;
  min-height: 0;
  padding: 14px;
  background: var(--bg-page);
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.pv-frame {
  height: 100%;
  max-width: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 14px rgba(20, 25, 40, 0.1);
  transition: width 0.2s ease;
}

.pv-frame iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

@media (max-width: 1180px) {
  .pl-side {
    width: 320px;
  }
}
</style>
