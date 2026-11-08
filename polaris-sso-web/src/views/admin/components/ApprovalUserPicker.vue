<template>
  <a-modal
    :open="open"
    :title="title"
    :width="720"
    centered
    :ok-button-props="{ disabled: !selected }"
    :confirm-loading="usersLoading || treeLoading"
    ok-text="确定"
    @ok="confirm"
    @cancel="close"
  >
    <div class="picker">
      <!-- 左：组织树 -->
      <div class="left">
        <a-input v-model:value="keyword" size="small" placeholder="搜索组织" allow-clear>
          <template #prefix><search-outlined /></template>
        </a-input>
        <a-spin :spinning="treeLoading" class="tree-wrap">
          <a-tree
            v-if="treeData.length"
            :tree-data="treeData"
            :expanded-keys="expanded"
            :selected-keys="selectedOrg ? [selectedOrg.id] : []"
            block-node
            @select="onSelectOrg"
            @expand="onExpand"
          >
            <template #title="{ title: name, disabled }">
              <span :class="{ 'org-disabled': disabled }">{{ name }}</span>
            </template>
          </a-tree>
          <a-empty v-else-if="!treeLoading" :image="simpleImg" description="暂无组织" class="empty" />
        </a-spin>
      </div>
      <!-- 右：成员列表 -->
      <div class="right">
        <div class="right-head">
          <span class="org-name">{{ selectedOrg ? selectedOrg.name : '未选择组织' }}</span>
          <span class="muted">直属 {{ users.length }} 人</span>
        </div>
        <a-spin :spinning="usersLoading" class="user-wrap">
          <template v-if="users.length">
            <div
              v-for="u in users"
              :key="u.id"
              class="user"
              :class="{ active: selected && selected.id === u.id }"
              @click="selected = { id: u.id, name: u.name }"
            >
              <a-avatar :size="26" class="av">{{ u.name.slice(0, 1) }}</a-avatar>
              <span class="uname">{{ u.name }}</span>
              <span class="muted">{{ u.empNo }}</span>
            </div>
          </template>
          <a-empty
            v-else-if="!usersLoading"
            :image="simpleImg"
            :description="selectedOrg ? '该组织下没有可选择的成员' : '选择左侧组织查看成员'"
            class="empty"
          />
        </a-spin>
      </div>
    </div>
    <div class="picked">
      已选择：
      <template v-if="selected">
        <a-tag color="processing">{{ selected.name }}</a-tag>
      </template>
      <span v-else class="muted">尚未选择</span>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Empty, message } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { fetchApprovalOrgTree, fetchApprovalOrgUsers } from '@/api/approvals'
import type { ApprovalOrgNode, ApprovalOrgUser } from '@/api/approvals'

/**
 * 转办 / 加签的按组织选人弹窗（单选）。
 * 组织与成员数据来自 EHR（审批中心代理 /api/accounts/approvals/orgs/**），
 * 只列已开户、未离职的员工——派不了审批任务的人选了也没用。
 */
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', user: { id: string; name: string }): void
}>()

const simpleImg = Empty.PRESENTED_IMAGE_SIMPLE

const treeLoading = ref(false)
const usersLoading = ref(false)
const keyword = ref('')
const nodes = ref<ApprovalOrgNode[]>([])
const selectedOrg = ref<ApprovalOrgNode | null>(null)
const users = ref<ApprovalOrgUser[]>([])
const selected = ref<{ id: string; name: string } | null>(null)
const expanded = ref<string[]>([])

interface TreeNode {
  key: string
  title: string
  disabled?: boolean
  children?: TreeNode[]
}

/** 扁平列表 → 树；搜索时只保留命中节点与其祖先链，父级自动展开 */
const treeData = computed<TreeNode[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  const byParent = new Map<string, ApprovalOrgNode[]>()
  for (const n of nodes.value) {
    const p = n.parentId || '0'
    const list = byParent.get(p) || []
    list.push(n)
    byParent.set(p, list)
  }
  const build = (parentId: string): TreeNode[] => {
    const list = byParent.get(parentId) || []
    const out: TreeNode[] = []
    for (const n of list) {
      const children = build(n.id)
      const selfHit = !kw || n.name.toLowerCase().includes(kw)
      const childHit = children.length > 0
      if (kw && !selfHit && !childHit) continue
      const t: TreeNode = {
        key: n.id,
        title: n.name,
        disabled: n.status === 2
      }
      if (childHit) t.children = children
      out.push(t)
    }
    return out
  }
  return build('0')
})

async function loadTree() {
  treeLoading.value = true
  try {
    nodes.value = ((await fetchApprovalOrgTree()).data) || []
    // 默认展开第一层
    expanded.value = nodes.value
      .filter((n) => !n.parentId)
      .map((n) => n.id)
  } catch (e) {
    message.error((e as Error).message || '组织树加载失败')
  } finally {
    treeLoading.value = false
  }
}

async function onSelectOrg(keys: (string | number)[]) {
  const key = keys[0]
  const node = nodes.value.find((n) => n.id === String(key))
  selectedOrg.value = node || null
  selected.value = null
  users.value = []
  if (!node) return
  usersLoading.value = true
  try {
    users.value = ((await fetchApprovalOrgUsers(node.id)).data) || []
  } catch (e) {
    message.error((e as Error).message || '成员加载失败')
  } finally {
    usersLoading.value = false
  }
}

function onExpand(keys: (string | number)[]) {
  expanded.value = keys.map(String)
}

function confirm() {
  if (!selected.value) return
  emit('confirm', { ...selected.value })
  close()
}

function close() {
  emit('update:open', false)
}

watch(
  () => props.open,
  (o) => {
    if (o) {
      keyword.value = ''
      selectedOrg.value = null
      selected.value = null
      users.value = []
      loadTree()
    }
  }
)
</script>

<style scoped>
.picker {
  display: flex;
  gap: 12px;
  min-height: 360px;
}
.left {
  width: 260px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tree-wrap {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 6px;
  max-height: 380px;
}
.right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.right-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-weight: 600;
}
.right-head .muted {
  font-weight: 400;
  font-size: 12px;
}
.user-wrap {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 6px;
  max-height: 380px;
}
.user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}
.user:hover {
  background: var(--code-bg);
}
.user.active {
  background: rgba(99, 102, 241, 0.12);
}
.user .uname {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user .muted {
  font-size: 12px;
  margin-left: auto;
}
.av {
  background: rgba(99, 102, 241, 0.16);
  color: #6366f1;
  font-size: 12px;
  flex: none;
}
.empty {
  margin-top: 48px;
}
.org-disabled {
  opacity: 0.45;
}
.picked {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-base);
}
.muted {
  color: var(--muted);
}
</style>
