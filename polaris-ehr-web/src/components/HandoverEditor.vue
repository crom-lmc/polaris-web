<template>
  <div class="he">
    <a-checkbox v-model:checked="noHandover">无需交接（本岗位没有在办事项）</a-checkbox>

    <template v-if="!noHandover">
      <a-form-item label="交接人" required class="he-item">
        <a-select
          v-model:value="confirmer"
          :options="options"
          show-search
          option-filter-prop="label"
          allow-clear
          placeholder="选择接手工作的人（须已开通统一账号）"
        />
        <div class="he-hint">
          交接人登录后逐项确认；<b>全部确认完</b>才会进入负责人审批。
        </div>
      </a-form-item>

      <a-form-item :label="`交接项目（${validCount} 项，最多 ${MAX_ITEMS} 项）`" required class="he-item">
        <div class="he-list">
          <div v-for="(_, i) in items" :key="i" class="he-row">
            <span class="he-seq">{{ i + 1 }}</span>
            <a-input
              :value="items[i]"
              :maxlength="200"
              :placeholder="PLACEHOLDERS[i] || '其他需要交接的事项'"
              @update:value="(v: string) => setItem(i, v)"
            />
            <a-button type="text" danger :disabled="items.length <= 1" @click="removeItem(i)">
              <template #icon><delete-outlined /></template>
            </a-button>
          </div>
        </div>
        <a-button type="dashed" block :disabled="items.length >= MAX_ITEMS" class="he-add" @click="addItem">
          <template #icon><plus-outlined /></template>
          添加一项
        </a-button>
      </a-form-item>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import type { HandoverCandidate } from '@/api/ehr'

const MAX_ITEMS = 20

/** 前三项给点示例，避免每个人写的颗粒度差太远 */
const PLACEHOLDERS = [
  '如：客户 A 的对接与合同台账',
  '如：进行中的需求（含进度与遗留问题）',
  '如：系统账号、文档与代码仓库权限',
]

const props = defineProps<{
  employees: HandoverCandidate[]
  /** 被办理人：不能选自己当交接人 */
  excludeId?: string
}>()

const confirmer = defineModel<string | undefined>('confirmer', { default: undefined })
const items = defineModel<string[]>('items', { default: () => [] })
const noHandover = defineModel<boolean>('noHandover', { default: false })

/** 只有「在职 + 已开户」的人能当交接人——没账号就没人能登录确认 */
const options = computed(() =>
  (props.employees || [])
    .filter((e) => e.id !== props.excludeId)
    .filter((e) => (e.status ?? 1) !== 2)
    .filter((e) => !!e.accountId)
    .map((e) => ({
      value: e.id,
      label: `${e.name}（${e.empNo}${e.orgName ? ' · ' + e.orgName : ''}）`
    }))
)

const validCount = computed(() => (items.value || []).filter((s) => (s || '').trim()).length)

function setItem(i: number, v: string) {
  const next = [...items.value]
  next[i] = v
  items.value = next
}

function addItem() {
  if (items.value.length >= MAX_ITEMS) return
  items.value = [...items.value, '']
}

function removeItem(i: number) {
  if (items.value.length <= 1) return
  items.value = items.value.filter((_, idx) => idx !== i)
}

onMounted(() => {
  if (!items.value || items.value.length === 0) {
    items.value = ['']
  }
})
</script>

<style scoped>
.he {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.he-item {
  margin-top: 10px;
}

.he-hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}

.he-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.he-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.he-seq {
  flex: 0 0 18px;
  font-size: 12px;
  color: var(--muted);
  text-align: right;
}

.he-add {
  margin-top: 6px;
}
</style>
