<template>
  <ul class="oc-tree">
    <li v-for="node in nodes" :key="node.id">
      <div class="oc-card" :class="{ 'is-off': node.status === 2 }">
        <span class="oc-dot" :style="{ background: dotColor(node.type) }" />
        <span class="oc-name">{{ node.name }}</span>
        <a-tag class="oc-type" :color="dotColor(node.type)">{{ node.typeName }}</a-tag>
        <div class="oc-sub">
          <span class="oc-leader">
            <template v-if="node.leaderEmployeeName">负责人：{{ node.leaderEmployeeName }}</template>
            <span v-else class="muted">未指定负责人</span>
          </span>
          <span class="oc-count">{{ node.totalEmployeeCount ?? node.employeeCount ?? 0 }} 人</span>
        </div>
      </div>
      <OrgChart v-if="node.children && node.children.length" :nodes="node.children" />
    </li>
  </ul>
</template>

<script setup lang="ts">
import OrgChart from './OrgChart.vue'
import type { OrgNode } from '@/api/ehr'

defineProps<{ nodes: OrgNode[] }>()

const TYPE_COLOR: Record<string, string> = {
  GROUP: 'magenta',
  COMPANY: 'blue',
  DEPARTMENT: 'green',
  PROJECT: 'orange',
  SUB_PROJECT: 'purple'
}

function dotColor(code: string) {
  return TYPE_COLOR[code] || 'default'
}
</script>

<style scoped>
/* 经典自上而下组织架构图：父在上、子在下，连接线用伪元素绘制 */
.oc-tree {
  display: flex;
  flex-wrap: nowrap;
  width: max-content;
  min-width: 100%;
  margin: 0 auto;
  padding-top: 20px;
  position: relative;
  list-style: none;
  padding-left: 0;
  white-space: nowrap;
}

.oc-tree li {
  list-style: none;
  position: relative;
  padding: 22px 12px 0;
  text-align: center;
}

/* 同级之间的横向连线 + 到每个子节点的竖向短线 */
.oc-tree li::before,
.oc-tree li::after {
  content: '';
  position: absolute;
  top: 0;
  right: 50%;
  border-top: 1px solid var(--border-subtle);
  width: 50%;
  height: 22px;
}

.oc-tree li::after {
  right: auto;
  left: 50%;
  border-left: 1px solid var(--border-subtle);
}

/* 只有一个子节点时不画多余连线 */
.oc-tree li:only-child::after,
.oc-tree li:only-child::before {
  display: none;
}

.oc-tree li:only-child {
  padding-top: 22px;
}

/* 收尾节点：去掉一半横线，让连线拐弯对齐父节点 */
.oc-tree li:first-child::before,
.oc-tree li:last-child::after {
  border: 0 none;
}

.oc-tree li:last-child::before {
  border-right: 1px solid var(--border-subtle);
  border-radius: 0 6px 0 0;
}

.oc-tree li:first-child::after {
  border-radius: 6px 0 0 0;
}

/* 父节点下方垂到直线到子节点所在行 */
.oc-tree .oc-tree::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  border-left: 1px solid var(--border-subtle);
  width: 0;
  height: 22px;
}

.oc-card {
  display: inline-block;
  min-width: 168px;
  padding: 10px 14px;
  text-align: left;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.oc-card.is-off {
  opacity: 0.55;
}

.oc-card.is-off .oc-name {
  text-decoration: line-through;
  color: var(--muted);
}

.oc-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.oc-name {
  font-size: 14px;
  font-weight: 600;
  vertical-align: middle;
}

.oc-type {
  margin-left: 6px;
  transform: scale(0.88);
  transform-origin: left center;
}

.oc-sub {
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.oc-leader {
  color: var(--text-base);
  opacity: 0.82;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oc-leader.muted,
.muted {
  color: var(--muted);
}

.oc-count {
  color: var(--muted);
  white-space: nowrap;
}
</style>
