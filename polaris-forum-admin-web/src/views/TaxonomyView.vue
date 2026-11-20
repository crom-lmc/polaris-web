<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useTablePagination } from '@/composables/useTablePagination'
import { useUserStore } from '@/stores/user'
import {
  createAdminBoard,
  createAdminTag,
  fetchAdminBoards,
  fetchAdminTags,
  updateAdminBoard,
  updateAdminTag,
  type AdminBoard,
  type AdminBoardInput,
  type AdminTag,
  type AdminTagInput
} from '@/api/forum'

const store = useUserStore()
const activeKey = ref('primary')
const boards = ref<AdminBoard[]>([])
const tags = ref<AdminTag[]>([])
const boardFilter = ref('')
const boardLoading = ref(false)
const tagLoading = ref(false)
const boardSaving = ref(false)
const tagSaving = ref(false)
const savingBoardKey = ref('')
const savingTagId = ref('')
const boardModalOpen = ref(false)
const tagModalOpen = ref(false)
const editingBoardKey = ref<string | null>(null)
const editingTag = ref<AdminTag | null>(null)
const boardForm = reactive<AdminBoardInput & { key: string }>({
  key: '',
  parentKey: '',
  name: '',
  description: '',
  color: '#5b67f1',
  sortNo: 0,
  enabled: true
})
const tagForm = reactive<AdminTagInput>({ board: '', name: '', sortNo: 0, enabled: true })
// 一级板块（parentKey 为空）与二级板块（parentKey 非空），由全量列表派生
const primaryBoards = computed(() => boards.value.filter((board) => !board.parentKey))
const childBoards = computed(() => boards.value.filter((board) => !!board.parentKey))
const {
  pagination: boardPagination,
  pagedSource: pagedPrimaryBoards,
  reset: resetBoardPage,
  onChange: onBoardTableChange
} = useTablePagination(primaryBoards)
const {
  pagination: childPagination,
  pagedSource: pagedChildBoards,
  reset: resetChildPage,
  onChange: onChildTableChange
} = useTablePagination(childBoards)
const {
  pagination: tagPagination,
  pagedSource: pagedTags,
  reset: resetTagPage,
  onChange: onTagTableChange
} = useTablePagination(tags)
const boardNames = computed(() => Object.fromEntries(boards.value.map((board) => [board.key, board.name])))
const primaryColumns = [
  { title: '板块', key: 'board', width: 280 },
  { title: '标识', dataIndex: 'key', width: 140 },
  { title: '内容数', key: 'count', width: 90 },
  { title: '排序', dataIndex: 'sortNo', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 170 },
  { title: '操作', key: 'action', width: 150 }
]
const childColumns = [
  { title: '二级板块', key: 'board', width: 240 },
  { title: '所属一级板块', key: 'parent', width: 180 },
  { title: '标识', dataIndex: 'key', width: 160 },
  { title: '排序', dataIndex: 'sortNo', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 150 }
]
const tagColumns = [
  { title: '标签', dataIndex: 'name', width: 220 },
  { title: '所属板块', key: 'board', width: 180 },
  { title: '使用次数', key: 'count', width: 100 },
  { title: '排序', dataIndex: 'sortNo', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 150 }
]

onMounted(() => {
  void loadBoards()
  void loadTags()
})

async function loadBoards() {
  boardLoading.value = true
  try {
    boards.value = await fetchAdminBoards()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '板块加载失败')
  } finally {
    boardLoading.value = false
  }
}

async function loadTags() {
  tagLoading.value = true
  try {
    tags.value = await fetchAdminTags(boardFilter.value || undefined)
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '标签加载失败')
  } finally {
    tagLoading.value = false
  }
}

function reloadBoards() {
  resetBoardPage()
  resetChildPage()
  void loadBoards()
}

function reloadTags() {
  resetTagPage()
  void loadTags()
}

/** level: primary 新增一级板块；child 新增二级板块 */
function openBoardCreate(level: 'primary' | 'child' = 'primary') {
  if (level === 'child' && !primaryBoards.value.length) {
    message.warning('请先新增一级板块')
    return
  }
  editingBoardKey.value = null
  Object.assign(boardForm, {
    key: '',
    parentKey: level === 'child' ? primaryBoards.value[0].key : '',
    name: '',
    description: '',
    color: '#5b67f1',
    sortNo: 0,
    enabled: true
  })
  boardModalOpen.value = true
}

function openBoardEdit(board: AdminBoard) {
  editingBoardKey.value = board.key
  Object.assign(boardForm, {
    key: board.key,
    parentKey: board.parentKey || '',
    name: board.name,
    description: board.description || '',
    color: board.color || '#5b67f1',
    sortNo: board.sortNo ?? 0,
    enabled: board.enabled
  })
  boardModalOpen.value = true
}

async function submitBoard() {
  const key = boardForm.key.trim()
  const name = boardForm.name.trim()
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(key)) {
    message.warning('板块标识应为 2-32 位小写字母、数字或连字符，且以字母开头')
    return
  }
  if (!name) {
    message.warning('请输入板块名称')
    return
  }
  boardSaving.value = true
  const data: AdminBoardInput = {
    parentKey: boardForm.parentKey,
    name,
    description: boardForm.description.trim(),
    color: boardForm.color,
    sortNo: boardForm.sortNo,
    enabled: boardForm.enabled
  }
  try {
    if (editingBoardKey.value !== null) {
      await updateAdminBoard(editingBoardKey.value, data)
      message.success('板块已保存')
    } else {
      await createAdminBoard({ key, ...data })
      message.success('板块已创建')
    }
    boardModalOpen.value = false
    await loadBoards()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '板块保存失败')
  } finally {
    boardSaving.value = false
  }
}

async function toggleBoard(board: AdminBoard) {
  savingBoardKey.value = board.key
  try {
    Object.assign(board, await updateAdminBoard(board.key, { enabled: !board.enabled }))
    message.success(board.enabled ? '板块已启用' : '板块已停用')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '板块状态更新失败')
  } finally {
    savingBoardKey.value = ''
  }
}

function openTagCreate() {
  if (!boards.value.length) {
    message.warning('请先新增板块')
    return
  }
  editingTag.value = null
  Object.assign(tagForm, {
    board: boardFilter.value || boards.value[0].key,
    name: '',
    sortNo: 0,
    enabled: true
  })
  tagModalOpen.value = true
}

function openTagSort(tag: AdminTag) {
  editingTag.value = tag
  Object.assign(tagForm, { board: tag.boardKey, name: tag.name, sortNo: tag.sortNo ?? 0, enabled: tag.enabled })
  tagModalOpen.value = true
}

async function submitTag() {
  const name = tagForm.name.trim().replace(/#/g, '')
  if (!tagForm.board) {
    message.warning('请选择所属板块')
    return
  }
  if (!name) {
    message.warning('请输入标签名称')
    return
  }
  tagSaving.value = true
  try {
    if (editingTag.value) {
      await updateAdminTag(editingTag.value.id, { sortNo: tagForm.sortNo })
      message.success('标签排序已保存')
      await loadTags()
    } else {
      await createAdminTag({
        board: tagForm.board,
        name,
        sortNo: tagForm.sortNo,
        enabled: tagForm.enabled
      })
      message.success('标签已创建')
      await loadTags()
    }
    tagModalOpen.value = false
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '标签保存失败')
  } finally {
    tagSaving.value = false
  }
}

async function toggleTag(tag: AdminTag) {
  savingTagId.value = tag.id
  try {
    Object.assign(tag, await updateAdminTag(tag.id, { enabled: !tag.enabled }))
    message.success(tag.enabled ? '标签已启用' : '标签已停用')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '标签状态更新失败')
  } finally {
    savingTagId.value = ''
  }
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading taxonomy-heading">
      <div>
        <h1>板块与标签</h1>
        <p>一级板块下可维护二级板块；标签为全站内容标签。均可维护展示顺序与启停状态，创建后不可改名、不提供删除。</p>
      </div>
      <a-button v-if="activeKey === 'primary' && store.can('forum:taxonomy:board:manage')" type="primary" @click="openBoardCreate('primary')"><PlusOutlined />新增一级板块</a-button>
      <a-button v-else-if="activeKey === 'child' && store.can('forum:taxonomy:board:manage')" type="primary" @click="openBoardCreate('child')"><PlusOutlined />新增二级板块</a-button>
      <a-button v-else-if="store.can('forum:taxonomy:tag:manage')" type="primary" @click="openTagCreate"><PlusOutlined />新增标签</a-button>
    </header>

    <a-tabs v-model:active-key="activeKey">
      <a-tab-pane key="primary" tab="一级板块">
        <a-card class="filter-card" :bordered="false">
          <div class="filters">
            <a-button v-if="store.can('forum:taxonomy:view')" @click="reloadBoards"><ReloadOutlined />刷新</a-button>
          </div>
        </a-card>
        <a-card class="table-card" :bordered="false">
          <div class="table-scroll" :class="{ 'is-empty': !boardLoading && !pagedPrimaryBoards.length }">
            <!-- children-column-name 指向不存在的字段：后台扁平展示不用树形，避免表格因 BoardVO.children 自动渲染展开"+"图标 -->
            <a-table :columns="primaryColumns" :data-source="pagedPrimaryBoards" :loading="boardLoading" :pagination="boardPagination" row-key="key" size="middle" children-column-name="__no_tree__" @change="onBoardTableChange">
              <template #emptyText>
                <a-empty v-if="!boardLoading" class="table-empty" description="暂无数据" />
              </template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'board'">
                  <div class="board-info">
                    <span class="board-color" :style="{ backgroundColor: record.color || '#5b67f1' }" />
                    <div class="board-text">
                      <strong>{{ record.name }}</strong>
                      <span class="secondary-text long-text">{{ record.description || '暂无描述' }}</span>
                    </div>
                  </div>
                </template>
                <template v-else-if="column.key === 'count'">{{ record.count ?? 0 }}</template>
                <template v-else-if="column.key === 'status'">
                  <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用中' : '已停用' }}</a-tag>
                </template>
                <template v-else-if="column.key === 'updatedAt'">{{ record.updatedAt || '-' }}</template>
                <template v-else-if="column.key === 'action'">
                  <a-space class="action-group" :size="0">
                    <a-button v-if="store.can('forum:taxonomy:board:manage')" type="link" size="small" @click="openBoardEdit(record)">编辑</a-button>
                    <a-button v-if="store.can('forum:taxonomy:board:manage')" type="link" size="small" :loading="savingBoardKey === record.key" @click="toggleBoard(record)">{{ record.enabled ? '停用' : '启用' }}</a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="child" tab="二级板块">
        <a-card class="filter-card" :bordered="false">
          <div class="filters">
            <a-button v-if="store.can('forum:taxonomy:view')" @click="reloadBoards"><ReloadOutlined />刷新</a-button>
          </div>
        </a-card>
        <a-card class="table-card" :bordered="false">
          <div class="table-scroll" :class="{ 'is-empty': !boardLoading && !pagedChildBoards.length }">
            <a-table :columns="childColumns" :data-source="pagedChildBoards" :loading="boardLoading" :pagination="childPagination" row-key="key" size="middle" children-column-name="__no_tree__" @change="onChildTableChange">
              <template #emptyText>
                <a-empty v-if="!boardLoading" class="table-empty" description="暂无数据，请先新增二级板块" />
              </template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'board'"><strong>{{ record.name }}</strong></template>
                <template v-else-if="column.key === 'parent'">{{ boardNames[record.parentKey] || record.parentKey || '-' }}</template>
                <template v-else-if="column.key === 'status'">
                  <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用中' : '已停用' }}</a-tag>
                </template>
                <template v-else-if="column.key === 'action'">
                  <a-space class="action-group" :size="0">
                    <a-button v-if="store.can('forum:taxonomy:board:manage')" type="link" size="small" @click="openBoardEdit(record)">编辑</a-button>
                    <a-button v-if="store.can('forum:taxonomy:board:manage')" type="link" size="small" :loading="savingBoardKey === record.key" @click="toggleBoard(record)">{{ record.enabled ? '停用' : '启用' }}</a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="tags" tab="标签管理">
        <a-card class="filter-card" :bordered="false">
          <div class="filters">
            <a-select v-model:value="boardFilter" class="filter-select" placeholder="全部板块" @change="reloadTags">
              <a-select-option value="">全部板块</a-select-option>
              <a-select-option v-for="board in boards" :key="board.key" :value="board.key">{{ board.name }}{{ board.enabled ? '' : '（已停用）' }}</a-select-option>
            </a-select>
            <a-button v-if="store.can('forum:taxonomy:view')" @click="reloadTags"><ReloadOutlined />刷新</a-button>
          </div>
        </a-card>
        <a-card class="table-card" :bordered="false">
          <div class="table-scroll" :class="{ 'is-empty': !tagLoading && !pagedTags.length }">
            <a-table :columns="tagColumns" :data-source="pagedTags" :loading="tagLoading" :pagination="tagPagination" row-key="id" size="middle" @change="onTagTableChange">
              <template #emptyText>
                <a-empty v-if="!tagLoading" class="table-empty" description="暂无数据" />
              </template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'board'">{{ boardNames[record.boardKey] || record.boardKey }}</template>
                <template v-else-if="column.key === 'count'">{{ record.count ?? 0 }}</template>
                <template v-else-if="column.key === 'status'">
                  <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用中' : '已停用' }}</a-tag>
                </template>
                <template v-else-if="column.key === 'action'">
                  <a-space class="action-group" :size="0">
                    <a-button v-if="store.can('forum:taxonomy:tag:manage')" type="link" size="small" @click="openTagSort(record)">排序</a-button>
                    <a-button v-if="store.can('forum:taxonomy:tag:manage')" type="link" size="small" :loading="savingTagId === record.id" @click="toggleTag(record)">{{ record.enabled ? '停用' : '启用' }}</a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <a-modal v-model:open="boardModalOpen" centered :title="editingBoardKey !== null ? (boardForm.parentKey ? '编辑二级板块' : '编辑一级板块') : (activeKey === 'child' ? '新增二级板块' : '新增一级板块')" ok-text="保存" cancel-text="取消" :confirm-loading="boardSaving" @ok="submitBoard">
      <a-form layout="vertical">
        <a-form-item v-if="activeKey === 'child' && editingBoardKey === null" label="所属一级板块" required>
          <a-select v-model:value="boardForm.parentKey" placeholder="请选择一级板块">
            <a-select-option v-for="board in primaryBoards" :key="board.key" :value="board.key">{{ board.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-row :gutter="12">
          <a-col :xs="24" :sm="12">
            <a-form-item label="板块标识" required>
              <a-input v-model:value="boardForm.key" :disabled="editingBoardKey !== null" :maxlength="32" placeholder="如 general" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-form-item label="板块名称" required><a-input v-model:value="boardForm.name" :maxlength="80" placeholder="请输入板块名称" /></a-form-item>
          </a-col>
        </a-row>
        <a-form-item v-if="!boardForm.parentKey" label="板块描述"><a-textarea v-model:value="boardForm.description" :maxlength="300" :rows="3" placeholder="请输入板块描述" /></a-form-item>
        <a-row :gutter="12">
          <a-col :xs="24" :sm="12">
            <a-form-item label="板块颜色"><input v-model="boardForm.color" class="color-input" type="color" aria-label="板块颜色" /></a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-form-item label="排序"><a-input-number v-model:value="boardForm.sortNo" :min="0" :precision="0" class="full-width" /></a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="启用状态"><a-switch v-model:checked="boardForm.enabled" checked-children="启用" un-checked-children="停用" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="tagModalOpen" centered :title="editingTag ? '调整标签排序' : '新增标签'" ok-text="保存" cancel-text="取消" :confirm-loading="tagSaving" @ok="submitTag">
      <a-form layout="vertical">
        <a-form-item label="所属板块" required>
          <a-select v-model:value="tagForm.board" :disabled="!!editingTag" placeholder="请选择板块">
            <a-select-option v-for="board in boards" :key="board.key" :value="board.key">{{ board.name }}{{ board.enabled ? '' : '（已停用）' }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="标签名称" required>
          <a-input v-model:value="tagForm.name" :disabled="!!editingTag" :maxlength="20" placeholder="请输入标签名称" />
        </a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="tagForm.sortNo" :min="0" :precision="0" class="full-width" /></a-form-item>
        <a-form-item v-if="!editingTag" label="启用状态"><a-switch v-model:checked="tagForm.enabled" checked-children="启用" un-checked-children="停用" /></a-form-item>
        <a-alert v-else type="info" show-icon message="标签名称和所属板块不可修改，仅可调整排序。" />
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
/* 页签内容撑满剩余高度：否则表格卡片拿不到确定高度，分页条会跟着内容走、不贴底 */
.admin-page :deep(.ant-tabs) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.admin-page :deep(.ant-tabs-nav) { flex: 0 0 auto; margin-bottom: 10px; }
.admin-page :deep(.ant-tabs-content-holder) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.admin-page :deep(.ant-tabs-content) { flex: 1; min-height: 0; }
.admin-page :deep(.ant-tabs-tabpane) { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.admin-page :deep(.ant-tabs-tabpane-hidden) { display: none !important; }
.taxonomy-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.board-info { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.board-color { flex: 0 0 10px; width: 10px; height: 10px; margin-top: 7px; border-radius: 50%; }
.board-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.long-text { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
.full-width { width: 100%; }
.color-input { display: block; width: 100%; height: 32px; padding: 2px; border: 1px solid var(--header-border); border-radius: 6px; background: var(--panel-bg); cursor: pointer; }
@media (max-width: 640px) { .taxonomy-heading { flex-direction: column; } }
</style>
