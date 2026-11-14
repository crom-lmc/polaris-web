<template>
  <div class="page-container">
    <div class="page-root">
      <section class="panel">
        <div class="panel-head">
          <span>
            待办 / 消息配置
            <span class="muted head-sub">运营维护模板，业务按事件编码触发</span>
          </span>
          <a-space :size="8">
            <a-input
              v-model:value="keyword"
              placeholder="搜模块 / 描述 / 事件编码"
              allow-clear
              style="width: 220px"
              @press-enter="load"
            />
            <a-button @click="load">查询</a-button>
            <a-button v-if="canManage" type="primary" @click="openCreate">新增配置</a-button>
          </a-space>
        </div>

        <div class="panel-body table-body">
          <a-table
            :columns="columns"
            :data-source="rows"
            :loading="loading"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'index'">
                {{ index + 1 }}
              </template>
              <template v-else-if="column.key === 'module'">
                {{ record.module || '-' }}
              </template>
              <template v-else-if="column.key === 'content'">
                <span class="tpl-title">{{ record.titleTpl || '-' }}</span>
                <span v-if="record.contentTpl" class="cell-sub">{{ record.contentTpl }}</span>
              </template>
              <template v-else-if="column.key === 'todo'">
                <a-switch
                  size="small"
                  :checked="record.channel === 1"
                  :disabled="!canManage"
                  @change="(v: boolean) => switchChannel(record, 1, v)"
                />
              </template>
              <template v-else-if="column.key === 'msg'">
                <a-switch
                  size="small"
                  :checked="record.channel === 2"
                  :disabled="!canManage"
                  @change="(v: boolean) => switchChannel(record, 2, v)"
                />
              </template>
              <template v-else-if="column.key === 'email'">
                <a-switch
                  size="small"
                  :checked="record.email === 1"
                  :disabled="!canManage"
                  @change="(v: boolean) => switchEmail(record, v)"
                />
              </template>
              <template v-else-if="column.key === 'enabled'">
                <a-switch
                  size="small"
                  :checked="record.enabled === 1"
                  :disabled="!canManage"
                  @change="(v: boolean) => switchEnabled(record, v)"
                />
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="12">
                  <a v-if="canManage" @click="openEdit(record)">编辑</a>
                  <a v-if="canManage && record.builtIn !== 1" class="danger" @click="remove(record)">删除</a>
                  <a-tooltip v-else-if="record.builtIn === 1" title="内置配置不可删除，停用即可">
                    <span class="muted">内置</span>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </div>

    <a-modal
      v-model:open="modalOpen"
      :title="editing ? '编辑消息配置' : '新增消息配置'"
      :confirm-loading="saving"
      width="620px"
      centered
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item
              label="事件编码"
              name="code"
              :rules="[
                { required: true, message: '请输入事件编码' },
                { pattern: /^[a-z][a-z0-9._-]{1,63}$/, message: '小写字母开头，仅小写字母/数字/点/下划线/中划线' }
              ]"
            >
              <a-input v-model:value="form.code" :disabled="!!editing" placeholder="如 approval.approved" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="模块" name="module">
              <a-input v-model:value="form.module" placeholder="如 审批中心" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="配置描述" name="name" :rules="[{ required: true, message: '请输入配置描述' }]">
          <a-input v-model:value="form.name" placeholder="如 审批通过通知发起人" />
        </a-form-item>

        <a-form-item label="标题模板" name="titleTpl">
          <a-input v-model:value="form.titleTpl" placeholder="如 审批已通过：{bizName}" />
        </a-form-item>

        <a-form-item label="内容模板" name="contentTpl">
          <a-textarea v-model:value="form.contentTpl" :rows="3" placeholder="如 你发起的「{title}」已审批通过。" />
        </a-form-item>

        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 16px"
          message="模板变量由调用方传入，未传的变量渲染为空。可用变量：{bizName} {title} {bizNo} {applicantName} {opinion}"
        />

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="站内方式（二选一）">
              <a-radio-group v-model:value="form.channel">
                <a-radio :value="1">Web 待办</a-radio>
                <a-radio :value="2">Web 消息</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="同时发邮件">
              <a-switch v-model:checked="emailChecked" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="启用">
              <a-switch v-model:checked="enabledChecked" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import {
  createNoticeRule,
  deleteNoticeRule,
  listNoticeRules,
  updateNoticeRule,
  type NoticeRule
} from '@/api/notice'

const store = useUserStore()
const canManage = computed(() => store.can('notice:manage'))

const columns = [
  { title: '序号', key: 'index', width: 60 },
  { title: '模块', key: 'module', width: 110, ellipsis: true },
  { title: '描述', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '推送内容', key: 'content' },
  { title: 'Web 待办', key: 'todo', width: 90, align: 'center' as const },
  { title: 'Web 消息', key: 'msg', width: 90, align: 'center' as const },
  { title: '邮件', key: 'email', width: 70, align: 'center' as const },
  { title: '启用', key: 'enabled', width: 70, align: 'center' as const },
  { title: '操作', key: 'action', width: 110 }
]

const rows = ref<NoticeRule[]>([])
const loading = ref(false)
const keyword = ref('')

const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<NoticeRule | null>(null)
const formRef = ref()
const form = reactive({
  code: '',
  module: '',
  name: '',
  titleTpl: '',
  contentTpl: '',
  channel: 2
})
const emailChecked = ref(false)
const enabledChecked = ref(true)

onMounted(load)

async function load() {
  loading.value = true
  try {
    rows.value = await listNoticeRules(keyword.value || undefined)
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { code: '', module: '', name: '', titleTpl: '', contentTpl: '', channel: 2 })
  emailChecked.value = false
  enabledChecked.value = true
  modalOpen.value = true
}

function openEdit(record: NoticeRule) {
  editing.value = record
  Object.assign(form, {
    code: record.code,
    module: record.module || '',
    name: record.name,
    titleTpl: record.titleTpl || '',
    contentTpl: record.contentTpl || '',
    channel: record.channel === 1 ? 1 : 2
  })
  emailChecked.value = record.email === 1
  enabledChecked.value = record.enabled === 1
  modalOpen.value = true
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form,
      email: emailChecked.value ? 1 : 0,
      enabled: enabledChecked.value ? 1 : 0
    }
    if (editing.value) {
      await updateNoticeRule(editing.value.id, payload)
      message.success('已保存')
    } else {
      await createNoticeRule(payload)
      message.success('已创建')
    }
    modalOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 站内待办与站内消息互斥：打开一个自动关掉另一个，且不允许两个都关
async function switchChannel(record: NoticeRule, target: number, checked: boolean) {
  if (!checked) {
    message.warning('站内待办与站内消息需保留一个')
    return
  }
  await patch(record, { channel: target })
}

async function switchEmail(record: NoticeRule, checked: boolean) {
  await patch(record, { email: checked ? 1 : 0 })
}

async function switchEnabled(record: NoticeRule, checked: boolean) {
  await patch(record, { enabled: checked ? 1 : 0 })
}

async function patch(record: NoticeRule, payload: Record<string, unknown>) {
  try {
    const updated = await updateNoticeRule(record.id, payload)
    Object.assign(record, updated)
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

function remove(record: NoticeRule) {
  Modal.confirm({
    title: '删除消息配置',
    content: `删除「${record.name}」后，业务再按 ${record.code} 触发将不会发送任何通知，确定吗？`,
    okText: '删除',
    okType: 'danger',
    centered: true,
    onOk: async () => {
      await deleteNoticeRule(record.id)
      message.success('已删除')
      await load()
    }
  })
}
</script>

<style scoped>
.head-sub {
  margin-left: 8px;
  font-weight: 400;
}

.tpl-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.danger {
  color: #ff4d4f;
}
</style>
