<template>
  <div class="hl">
    <div v-if="items.length === 0" class="hl-empty muted">
      本单标记为「无需交接」，可直接进入审批。
    </div>
    <template v-else>
      <div v-for="item in items" :key="item.id" class="hl-row" :class="{ done: item.status === 1 }">
        <a-checkbox
          v-if="mode === 'confirm'"
          :checked="item.status === 1 || selected.includes(item.id)"
          :disabled="item.status === 1"
          @change="() => toggle(item.id)"
        />
        <span class="hl-seq">{{ item.seq }}</span>
        <span class="hl-content">{{ item.content }}</span>
        <a-tag :color="item.status === 1 ? 'green' : 'orange'" class="hl-tag">
          {{ item.status === 1 ? '已确认' : '待确认' }}
        </a-tag>
        <span v-if="item.confirmedAt" class="hl-time muted">{{ item.confirmedAt }}</span>
      </div>
      <div v-if="mode === 'confirm'" class="hl-actions">
        <span class="muted">{{ doneCount }}/{{ items.length }} 已确认</span>
        <a-space size="small">
          <a-button size="small" :disabled="selected.length === 0" @click="confirmSelected">
            确认选中（{{ selected.length }}）
          </a-button>
          <a-button size="small" type="primary" :disabled="doneCount === items.length" @click="confirmAll">
            全部确认
          </a-button>
        </a-space>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HandoverItem } from '@/api/ehr'

const props = withDefaults(
  defineProps<{
    items: HandoverItem[]
    /** view 只读；confirm 可勾选确认 */
    mode?: 'view' | 'confirm'
  }>(),
  { mode: 'view' }
)

const emit = defineEmits<{ (e: 'confirm', itemIds: string[]): void }>()

const selected = ref<string[]>([])
const doneCount = computed(() => props.items.filter((i) => i.status === 1).length)

watch(
  () => props.items,
  () => {
    selected.value = []
  }
)

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id]
}

function confirmSelected() {
  if (selected.value.length === 0) return
  emit('confirm', [...selected.value])
}

function confirmAll() {
  emit('confirm', [])
}
</script>

<style scoped>
.hl {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hl-empty {
  font-size: 12px;
  padding: 4px 0;
}

.hl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-size: 13px;
}

.hl-row.done {
  background: rgba(0, 0, 0, 0.015);
}

.hl-seq {
  flex: 0 0 18px;
  color: var(--muted);
  font-size: 12px;
  text-align: right;
}

.hl-content {
  flex: 1;
  min-width: 0;
  word-break: break-all;
}

.hl-tag {
  margin-inline-end: 0;
  transform: scale(0.9);
}

.hl-time {
  font-size: 12px;
}

.hl-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}
</style>
