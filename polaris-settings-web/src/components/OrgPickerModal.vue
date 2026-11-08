<template>
  <a-modal
    v-model:open="visible"
    title="选择组织（指定组织负责人）"
    width="760px"
    :footer="null"
    destroy-on-close
  >
    <div class="opm">
      <div class="opm-left">
        <a-spin :spinning="loading">
          <a-input-search
            v-model:value="keyword"
            size="small"
            placeholder="搜索组织名称 / 层级路径"
            class="opm-search"
            allow-clear
          />
          <div class="opm-tree">
            <a-tree
              v-if="treeData.length"
              :tree-data="treeData"
              :expanded-keys="expandedKeys"
              :selected-keys="selectedKey ? [selectedKey] : []"
              block-node
              @expand="(k: Key[]) => (expandedKeys = k)"
              @select="onSelect"
            />
            <a-empty v-else-if="!loading" :image-style="{ height: '40px' }" description="无组织数据" />
          </div>
        </a-spin>
      </div>

      <div class="opm-right">
        <div class="opm-hd">已选组织</div>
        <template v-if="picked">
          <div class="opm-name">{{ picked.name }}</div>
          <div class="opm-label">完整层级路径</div>
          <div class="opm-path">{{ picked.path }}</div>
          <div class="opm-tags">
            <a-tag v-if="picked.status === 2" color="orange">已禁用</a-tag>
            <a-tag v-if="(nameCounts.get(picked.name) || 0) > 1" color="purple">
              同名 {{ nameCounts.get(picked.name) }} 个
            </a-tag>
          </div>
          <div class="opm-note">
            保存的是组织<strong>名称</strong>：发起审批后按该名称匹配组织负责人。
            <template v-if="(nameCounts.get(picked.name) || 0) > 1">
              组织树里有多个同名组织，后端按名称取其一；若要精确指定，建议改用「组织负责人」或「指定账号」。
            </template>
          </div>
        </template>
        <div v-else class="opm-empty">在左侧组织树中点选一个组织</div>

        <div v-if="current && !treeHasName(current)" class="opm-current">
          当前保存值「{{ current }}」在组织树中已不存在（可能已改名或删除）。
          直接关闭本弹窗即可保留原值，重新选择会覆盖。
        </div>
      </div>
    </div>

    <div class="opm-footer">
      <a-button size="small" @click="visible = false">取消</a-button>
      <a-button type="primary" size="small" :disabled="!picked" @click="confirm">
        确定{{ picked ? `：${picked.name}` : '' }}
      </a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Key } from 'ant-design-vue/es/_util/type'
import { type OrgNodeLite, fetchOrgTree } from '@/api/approval'

/**
 * 「指定组织负责人」专用选组织弹窗。
 *
 * 为什么不用下拉：组织名按完整层级路径展示（如「晨星科技集团 / 星辰科技（西安）有限公司 / 研发部」），
 * 下拉宽度有限会被截断，同名组织也分不清。改成弹窗 + 组织树，层级天然完整，
 * 右侧再给出完整路径、禁用状态、同名提示。
 *
 * 组件自包含：打开时自己拉组织树，父组件只要传当前值、监听 confirm。
 * 对外仍只回传**组织名称**，保持后端 ApproverResolver → /internal/orgs/leader-by-name 的契约，
 * 存量模板与在途单都不受影响。
 */
const props = defineProps<{
  open: boolean
  /** 当前已保存的组织名（存量模板可能引用了已改名 / 已删除的组织） */
  current?: string
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', name: string): void
}>()

const visible = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

interface TreeNode {
  key: string
  title: string
  name: string
  status: number
  children: TreeNode[]
}
interface Picked {
  name: string
  path: string
  status: number
}

const loading = ref(false)
const raw = ref<OrgNodeLite[]>([])
const keyword = ref('')
const treeData = ref<TreeNode[]>([])
const expandedKeys = ref<Key[]>([])
const selectedKey = ref('')
const picked = ref<Picked | null>(null)

const byId = computed(() => new Map(raw.value.map((n) => [n.id, n])))
const nameCounts = computed(() => {
  const m = new Map<string, number>()
  for (const n of raw.value) m.set(n.name, (m.get(n.name) || 0) + 1)
  return m
})

/** 组织 → 完整层级路径（带环保护，脏数据不会死循环） */
function pathOf(n: OrgNodeLite): string {
  const names: string[] = []
  const guard = new Set<string>()
  let cur: OrgNodeLite | undefined = n
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    names.unshift(cur.name)
    cur = cur.parentId ? byId.value.get(cur.parentId) : undefined
  }
  return names.join(' / ')
}

const paths = computed(() => {
  const m = new Map<string, string>()
  for (const n of raw.value) m.set(n.id, pathOf(n))
  return m
})

function treeHasName(name: string) {
  return raw.value.some((n) => n.name === name)
}

/** 扁平组织 → 树；搜索时剪掉不匹配的枝叶，但保留命中节点的祖先链 */
function rebuild() {
  const map = new Map<string, TreeNode>()
  for (const n of raw.value) {
    const tails: string[] = []
    if ((nameCounts.value.get(n.name) || 0) > 1) tails.push('同名')
    if (n.status === 2) tails.push('已禁用')
    map.set(n.id, {
      key: n.id,
      title: tails.length ? `${n.name}（${tails.join(' · ')}）` : n.name,
      name: n.name,
      status: n.status,
      children: []
    })
  }
  const roots: TreeNode[] = []
  for (const n of raw.value) {
    const tn = map.get(n.id)!
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(tn)
    else roots.push(tn)
  }
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    const keep = (n: TreeNode): boolean => {
      const self = n.name.toLowerCase().includes(k) || (paths.value.get(n.key) || '').toLowerCase().includes(k)
      n.children = n.children.filter(keep)
      return self || n.children.length > 0
    }
    treeData.value = roots.filter(keep)
  } else {
    treeData.value = roots
  }
  expandedKeys.value = collectKeys(treeData.value)
}

function collectKeys(nodes: TreeNode[], acc: Key[] = []): Key[] {
  for (const n of nodes) {
    acc.push(n.key)
    if (n.children.length) collectKeys(n.children, acc)
  }
  return acc
}

function selectKey(id: string) {
  selectedKey.value = id
  const node = raw.value.find((n) => n.id === id)
  if (!node) return
  picked.value = { name: node.name, path: paths.value.get(id) || node.name, status: node.status }
}

function onSelect(keys: Key[]) {
  const id = keys.length ? String(keys[0]) : ''
  // 单选：再点一次已选节点时 antd 会给空 keys（取消选择）。
  // 这里不做取消语义，保持当前选择，否则「打开旧模板默认选中 → 点一下」会把右栏清空。
  if (!id) return
  selectKey(id)
}

function confirm() {
  if (!picked.value) return
  emit('confirm', picked.value.name)
  visible.value = false
}

watch(keyword, () => rebuild())

watch(
  () => props.open,
  async (v) => {
    if (!v) return
    keyword.value = ''
    picked.value = null
    selectedKey.value = ''
    loading.value = true
    try {
      raw.value = (await fetchOrgTree()) || []
    } catch {
      raw.value = []
    } finally {
      loading.value = false
    }
    rebuild()
    // 当前值能对上组织时默认选中并展开，打开旧模板不会一脸空白
    const hit = raw.value.find((n) => n.name === props.current?.trim())
    if (hit) selectKey(hit.id)
  }
)
</script>

<style scoped>
.opm {
  display: flex;
  gap: 12px;
  height: 400px;
}

.opm-left {
  width: 52%;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  /* flex 子项要能收缩出滚动区，否则 overflow 不生效 */
  min-height: 0;
  overflow: hidden;
}

/* a-spin 嵌套模式会在 .opm-left 里额外插两层容器，必须让它们也进入 flex 收缩链，
   否则 .opm-tree 的 flex:1 / overflow 完全不生效：容器按内容撑到 560px，
   超出部分被 .opm-left 的 overflow:hidden 直接裁掉，表现就是「没有滚动条也滚不动」。 */
.opm-left :deep(.ant-spin-nested-loading),
.opm-left :deep(.ant-spin-container) {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.opm-search {
  margin-bottom: 8px;
  flex: none;
}

/* 组织树常超出一屏：滚动条常驻（不是 hover 才浮现的 overlay 细线），
   一眼就能看出这里能往下滚，也不会再把组织列表悄悄裁掉 */
.opm-tree {
  flex: 1;
  min-height: 0;
  overflow-y: scroll;
  overflow-x: hidden;
  padding-right: 6px;
}

.opm-right {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 左右两栏统一滚动条外观：细轨道 + 明显滑块，别用系统默认 overlay 细线 */
.opm-tree::-webkit-scrollbar,
.opm-right::-webkit-scrollbar {
  width: 9px;
}
.opm-tree::-webkit-scrollbar-track,
.opm-right::-webkit-scrollbar-track {
  background: rgba(124, 92, 255, 0.08);
  border-radius: 9px;
}
.opm-tree::-webkit-scrollbar-thumb,
.opm-right::-webkit-scrollbar-thumb {
  background: rgba(124, 92, 255, 0.48);
  border-radius: 9px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.opm-tree::-webkit-scrollbar-thumb:hover,
.opm-right::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 92, 255, 0.78);
  background-clip: padding-box;
}
.opm-tree,
.opm-right {
  scrollbar-width: thin;
  scrollbar-color: rgba(124, 92, 255, 0.48) rgba(124, 92, 255, 0.08);
}

.opm-hd {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  margin-bottom: 8px;
}

.opm-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.opm-label {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  margin-bottom: 4px;
}

/* 完整路径在这里换行展示，不会被截断，这是改用弹窗的核心目的 */
.opm-path {
  font-size: 13px;
  line-height: 1.7;
  word-break: break-all;
  background: rgba(124, 92, 255, 0.08);
  border: 1px solid rgba(124, 92, 255, 0.22);
  border-radius: 6px;
  padding: 8px 10px;
}

.opm-tags {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.opm-note {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary, #aaa);
}

.opm-empty {
  color: var(--text-tertiary, #999);
  font-size: 13px;
  padding: 12px 0;
}

.opm-current {
  margin-top: auto;
  padding-top: 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #ff9c6e;
  border-top: 1px dashed var(--panel-border);
}

.opm-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
