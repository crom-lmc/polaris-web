<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Empty, message } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import {
  listAlarmReceiverOrgs,
  listAlarmReceiverOrgUsers,
  type AlarmReceiverOrg,
  type AlarmReceiverUser
} from '@/api/alarm'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', users: AlarmReceiverUser[]): void
}>()

const simpleImg = Empty.PRESENTED_IMAGE_SIMPLE
const treeLoading = ref(false)
const usersLoading = ref(false)
const keyword = ref('')
const nodes = ref<AlarmReceiverOrg[]>([])
const selectedOrg = ref<AlarmReceiverOrg | null>(null)
const users = ref<AlarmReceiverUser[]>([])
const selected = ref<AlarmReceiverUser[]>([])
const expanded = ref<string[]>([])

interface TreeNode {
  key: string
  title: string
  disabled?: boolean
  children?: TreeNode[]
}

const treeData = computed<TreeNode[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  const byParent = new Map<string, AlarmReceiverOrg[]>()
  for (const node of nodes.value) {
    const parentId = node.parentId || '0'
    const list = byParent.get(parentId) || []
    list.push(node)
    byParent.set(parentId, list)
  }
  const build = (parentId: string): TreeNode[] => {
    const result: TreeNode[] = []
    for (const node of byParent.get(parentId) || []) {
      const children = build(node.id)
      const selfHit = !kw || node.name.toLowerCase().includes(kw)
      if (kw && !selfHit && !children.length) continue
      const item: TreeNode = {
        key: node.id,
        title: node.name,
        disabled: node.status === 2
      }
      if (children.length) item.children = children
      result.push(item)
    }
    return result
  }
  return build('0')
})

function isSelected(id: string) {
  return selected.value.some((user) => user.id === id)
}

function toggleUser(user: AlarmReceiverUser) {
  if (isSelected(user.id)) {
    selected.value = selected.value.filter((item) => item.id !== user.id)
  } else {
    selected.value = [...selected.value, user]
  }
}

async function loadTree() {
  treeLoading.value = true
  try {
    nodes.value = (await listAlarmReceiverOrgs()) || []
    expanded.value = nodes.value.filter((node) => !node.parentId).map((node) => node.id)
  } catch (error) {
    message.error((error as Error).message || '组织树加载失败')
  } finally {
    treeLoading.value = false
  }
}

async function onSelectOrg(keys: (string | number)[]) {
  const node = nodes.value.find((item) => item.id === String(keys[0]))
  selectedOrg.value = node || null
  users.value = []
  if (!node) return
  usersLoading.value = true
  try {
    users.value = (await listAlarmReceiverOrgUsers(node.id)) || []
  } catch (error) {
    message.error((error as Error).message || '组织成员加载失败')
  } finally {
    usersLoading.value = false
  }
}

function onExpand(keys: (string | number)[]) {
  expanded.value = keys.map(String)
}

function close() {
  emit('update:open', false)
}

function confirm() {
  if (!selected.value.length) return
  emit('confirm', [...selected.value])
  close()
}

watch(keyword, (value) => {
  expanded.value = value.trim()
    ? nodes.value.map((node) => node.id)
    : nodes.value.filter((node) => !node.parentId).map((node) => node.id)
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    keyword.value = ''
    selectedOrg.value = null
    users.value = []
    selected.value = []
    loadTree()
  }
)
</script>

<template>
  <a-modal
    :open="open"
    title="从组织选择接收人"
    :width="760"
    :z-index="1100"
    centered
    ok-text="添加所选人员"
    :ok-button-props="{ disabled: !selected.length }"
    :confirm-loading="treeLoading || usersLoading"
    @ok="confirm"
    @cancel="close"
  >
    <div class="picker">
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

      <div class="right">
        <div class="right-head">
          <span>{{ selectedOrg ? selectedOrg.name : '未选择组织' }}</span>
          <span class="muted">直属 {{ users.length }} 人</span>
        </div>
        <a-spin :spinning="usersLoading" class="user-wrap">
          <template v-if="users.length">
            <div
              v-for="user in users"
              :key="user.id"
              class="user"
              :class="{ active: isSelected(user.id) }"
              @click="toggleUser(user)"
            >
              <a-checkbox :checked="isSelected(user.id)" @click.stop @change="toggleUser(user)" />
              <a-avatar :size="28" class="avatar">{{ user.name.slice(0, 1) }}</a-avatar>
              <div class="user-info">
                <div class="user-name">{{ user.name }}</div>
                <div class="muted">账号 {{ user.id }}<span v-if="user.empNo"> · {{ user.empNo }}</span></div>
              </div>
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
      <span>本次已选 {{ selected.length }} 人</span>
      <div v-if="selected.length" class="picked-tags">
        <a-tag
          v-for="user in selected"
          :key="user.id"
          closable
          color="processing"
          @close="toggleUser(user)"
        >
          {{ user.name }}
        </a-tag>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.picker {
  display: flex;
  gap: 12px;
  min-height: 360px;
}

.left {
  width: 250px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-wrap,
.user-wrap {
  flex: 1;
  max-height: 380px;
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
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

.user {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: 7px;
  cursor: pointer;
}

.user:hover {
  background: var(--code-bg);
}

.user.active {
  background: rgba(47, 84, 235, 0.1);
}

.avatar {
  flex: none;
  background: rgba(47, 84, 235, 0.14);
  color: var(--primary);
}

.user-info {
  min-width: 0;
}

.user-name {
  color: var(--text);
  font-size: 13px;
}

.muted {
  color: var(--text-3);
  font-size: 12px;
  font-weight: 400;
}

.empty {
  margin-top: 48px;
}

.org-disabled {
  opacity: 0.45;
}

.picked {
  margin-top: 12px;
  color: var(--text-2);
  font-size: 13px;
}

.picked-tags {
  max-height: 64px;
  margin-top: 8px;
  overflow-y: auto;
}

@media (max-width: 700px) {
  .picker {
    flex-direction: column;
  }

  .left {
    width: 100%;
  }

  .tree-wrap,
  .user-wrap {
    max-height: 220px;
  }
}
</style>
