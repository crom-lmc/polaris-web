<template>
  <div class="chain">
    <!-- 分支子链开头也要有 +，才能在该分支下插入第一个节点 -->
    <div v-if="scope === 'branch'" class="conn">
      <a-dropdown :trigger="['click']">
        <button class="plus dim" title="在本分支下追加节点">+</button>
        <template #overlay>
          <a-menu @click="(e: MenuInfo) => onAdd(e.key as string, '')">
            <a-menu-item key="approver">审批人节点</a-menu-item>
            <a-menu-item key="parallel">并行会签</a-menu-item>
            <a-menu-item key="gateway" :disabled="depth >= 3">
              条件分流{{ depth >= 3 ? '（已达 3 层上限）' : '' }}
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <template v-for="item in items" :key="item.cid">
      <!-- ============ 审批人 ============ -->
      <div v-if="item.kind === 'approver'" class="node-wrap">
        <div class="card" :class="{ invalid: !nodeOk(item.nodes[0]), sel: selected === item.cid }"
             @click="emit('action', { type: 'select', cid: item.cid })">
          <div class="card-head h-approver">
            <span>审批人{{ scope === 'branch' ? ' · 分支专属' : '' }}</span>
            <span class="x" title="删除节点" @click.stop="emit('action', { type: 'remove', cid: item.cid })">×</span>
          </div>
          <div class="card-body"><span class="nm">{{ item.name || '未命名节点' }}</span><span class="ar">›</span></div>
          <div class="card-tags">
            <span class="tag" :class="{ warn: !nodeOk(item.nodes[0]) }">
              {{ nodeOk(item.nodes[0]) ? summary(item.nodes[0]) : '请设置审批人' }}
            </span>
          </div>
        </div>
      </div>

      <!-- ============ 并行会签 ============ -->
      <div v-else-if="item.kind === 'parallel'" class="parallel">
        <div class="gw-title" @click="emit('action', { type: 'select', cid: item.cid })">
          {{ item.name || '并行会签' }} · {{ item.nodes.length }} 人同时审批
          <span class="x" title="删除节点" @click.stop="emit('action', { type: 'remove', cid: item.cid })">×</span>
        </div>
        <div class="parallel-pad"></div>
        <div class="parallel-lanes" :style="{ '--half': (50 / Math.max(item.nodes.length, 2)).toFixed(2) + '%' }">
          <div v-for="lane in item.nodes" :key="lane.cid" class="lane">
            <div class="card" :class="{ invalid: !nodeOk(lane), sel: selected === lane.cid }"
                 @click="emit('action', { type: 'select', cid: lane.cid })">
              <div class="card-head h-parallel">
                <span>并行 · {{ lane.name || '审批人' }}</span>
                <span class="x" title="移除该审批人" @click.stop="emit('action', { type: 'del-lane', cid: item.cid, laneCid: lane.cid })">×</span>
              </div>
              <div class="card-body"><span class="nm">{{ modeText(lane.approveMode) }}</span><span class="ar">›</span></div>
              <div class="card-tags">
                <span class="tag" :class="{ warn: !nodeOk(lane) }">
                  {{ nodeOk(lane) ? summary(lane) : '请设置审批人' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="parallel-pad"></div>
        <button class="add-branch" @click="emit('action', { type: 'add-lane', cid: item.cid })">+ 添加并行审批人</button>
      </div>

      <!-- ============ 条件网关（可递归嵌套，最多 3 层） ============ -->
      <div v-else class="gw" :style="{ '--half': (50 / Math.max((item.branches || []).length, 1)).toFixed(2) + '%' }">
        <div class="gw-addbar">
          <span class="gw-title" @click="emit('action', { type: 'select', cid: item.cid })">{{ item.name || '条件分流' }}</span>
          <span class="gw-meta">{{ (item.branches || []).length }} 个分支 · 第 {{ depth + 1 }} 层</span>
          <button class="add-branch" @click="emit('action', { type: 'add-branch', cid: item.cid })">+ 添加条件分支</button>
          <button class="add-branch ghost" @click="emit('action', { type: 'remove', cid: item.cid })">删除网关</button>
        </div>
        <div class="branches">
          <div v-for="(b, bi) in (item.branches || [])" :key="b.cid" class="branch">
            <div class="cond" :class="{ fallback: b.isFallback, sel: selected === b.cid }"
                 @click="emit('action', { type: 'select', cid: b.cid })">
              <div class="cond-top">
                <span>{{ b.name || `条件${bi + 1}` }}</span>
                <span class="pri">{{ b.isFallback ? '兜底' : '#' + (bi + 1) }}</span>
                <span class="del" title="删除分支" @click.stop="emit('action', { type: 'del-branch', cid: item.cid, branchCid: b.cid })">×</span>
              </div>
              <div class="cond-expr" :class="{ empty: !b.isFallback && !b.conditionExpr }">
                {{ b.isFallback ? '其它条件默认进入此流程' : (b.conditionExpr || '未设置条件') }}
              </div>
            </div>
            <div class="card" :class="{ invalid: !nodeOk(b.card), sel: selected === b.card.cid }"
                 @click="emit('action', { type: 'select', cid: b.card.cid })">
              <div class="card-head h-approver"><span>审批人</span></div>
              <div class="card-body"><span class="nm">{{ b.card.name || '未命名审批人' }}</span><span class="ar">›</span></div>
              <div class="card-tags">
                <span class="tag" :class="{ warn: !nodeOk(b.card) }">
                  {{ nodeOk(b.card) ? summary(b.card) : '请设置审批人' }}
                </span>
              </div>
            </div>
            <div class="branch-body">
              <!-- 递归：分支子链里还能再放条件网关，直到第 3 层 -->
              <FlowNode
                :items="b.chain" :depth="depth + 1" scope="branch" :branch-cid="b.cid" :selected="selected"
                @action="(a: FlowAction) => emit('action', a)"
              />
            </div>
          </div>
        </div>
        <div class="join"><div class="join-line"></div><span class="join-chip">汇合 · 所有分支完成后继续</span></div>
      </div>

      <!-- 节点之间的连接线 + 加号 -->
      <div class="conn">
        <a-dropdown :trigger="['click']">
          <button class="plus" :class="{ dim: scope === 'branch' }" title="添加节点">+</button>
          <template #overlay>
            <a-menu @click="(e: MenuInfo) => onAdd(e.key as string, item.cid)">
              <a-menu-item key="approver">审批人节点</a-menu-item>
              <a-menu-item key="parallel">并行会签</a-menu-item>
              <a-menu-item key="gateway" :disabled="depth >= 3">
                条件分流{{ depth >= 3 ? '（已达 3 层上限）' : '' }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Key } from 'ant-design-vue/es/_util/type'
import type { FlowAction, FlowStep, NodeEdit, ApproverRule } from '@/api/approval'

/** 菜单点击参数（antd 的 MenuInfo 结构，只取 key） */
interface MenuInfo { key: Key }

defineOptions({ name: 'FlowNode' })

const props = withDefaults(defineProps<{
  items: FlowStep[]
  depth?: number
  scope?: 'main' | 'branch'
  branchCid?: string
  selected?: string
}>(), { depth: 0, scope: 'main', branchCid: '', selected: '' })

const emit = defineEmits<{ (e: 'action', a: FlowAction): void }>()

function onAdd(kind: string, afterCid: string) {
  emit('action', {
    type: 'add', kind: kind as FlowAction['kind'], afterCid,
    branchCid: props.branchCid, depth: props.depth, scope: props.scope
  } as FlowAction)
}

function nodeOk(n?: NodeEdit) { return !!n && (n.approvers || []).length > 0 }
function summary(n?: NodeEdit) {
  if (!n) return ''
  return n.approvers.map(ruleText).join(' / ')
}
function ruleText(r: ApproverRule) {
  switch (r.type) {
    case 'ORG_LEADER': return r.levelOffset ? `上溯${r.levelOffset}级负责人` : '直属负责人'
    case 'ROLE': return `角色:${r.code}`
    case 'ORG_LEADER_BY_NAME': return `指定组织:${r.code}`
    case 'USER': return r.userName || `账号:${r.userId}`
    case 'APPLICANT': return '发起人本人'
    default: return r.type
  }
}
function modeText(m: string) {
  return ({ ANY: '或签', ALL: '会签', SEQ: '依次' } as Record<string, string>)[m] || m
}
</script>

<style scoped>
/* ---------- 连接线（docs 16.1：2px + 贯穿线 + 向下箭头） ---------- */
.chain { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
.conn {
  width: 2px; min-height: 30px; height: 30px; background: var(--line, #a9bad0);
  display: flex; align-items: center; justify-content: center; position: relative; flex: none;
}
.plus {
  width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #a1b4cd;
  background: #fff; color: #1677ff; font-size: 12px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center; padding: 0;
}
.plus:hover { background: #1677ff; color: #fff; border-color: #1677ff; }
.plus.dim { opacity: .7; }

/* ---------- 卡片 ---------- */
.node-wrap { display: flex; flex-direction: column; align-items: center; }
.card {
  width: var(--card-w, 220px); background: var(--panel-bg, #fff);
  border: 1px solid var(--panel-border, #e3e8ef); border-radius: 8px; overflow: hidden; cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
}
.card:hover { border-color: #1677ff; }
.card.sel { outline: 2px solid #1677ff; outline-offset: 1px; }
.card.invalid { border-color: #ff4d4f; }
.card-head {
  display: flex; align-items: center; justify-content: space-between;
  background: #f8fafc; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #475569;
  border-left: 3px solid #e2955c;
}
.card-head.h-parallel { border-left-color: #6f9ada; }
.card-head .x { color: #94a3b8; font-size: 14px; line-height: 1; padding: 0 2px; }
.card-head .x:hover { color: #ff4d4f; }
.card-body { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; font-size: 13px; gap: 8px; }
.card-body .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 0%; min-width: 0; }
.card-body .ar { color: #94a3b8; flex: none; }
.card-tags { padding: 0 10px 8px; min-width: 0; }
.tag {
  display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px; line-height: 18px; padding: 0 6px; border-radius: 4px;
  background: rgba(127, 127, 127, .08);
}
.tag.warn { color: #ff4d4f; background: rgba(255, 77, 79, .08); }
.tag.blue { color: #1677ff; background: rgba(22, 119, 255, .08); }

/* ---------- 并行会签 ---------- */
.parallel { display: flex; flex-direction: column; align-items: center; }
.gw-title {
  width: var(--card-w, 220px); font-size: 12px; font-weight: 600; color: #475569;
  padding: 5px 8px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;
}
.gw-title .x { color: #94a3b8; }
.parallel-pad { width: 2px; height: 14px; background: var(--line, #a9bad0); }
.parallel-lanes { display: flex; align-items: stretch; gap: 14px; position: relative; padding: 14px 0; }
.parallel-lanes::before, .parallel-lanes::after {
  content: ''; position: absolute; left: var(--half); right: var(--half); height: 2px; background: var(--line-strong, #8da3be);
}
.parallel-lanes::before { top: 0; }
.parallel-lanes::after { bottom: 0; }
.lane { display: flex; flex-direction: column; align-items: center; position: relative; }
.lane::before {
  content: ''; position: absolute; top: -14px; height: 14px; width: 2px; background: var(--line, #a9bad0);
}
.lane::after {
  content: ''; position: absolute; bottom: -14px; height: 14px; width: 2px; background: var(--line, #a9bad0);
}
.add-branch {
  border: 1px dashed var(--panel-border, #d6deea); background: #fff; color: #64748b;
  border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 12px;
}
.add-branch:hover { color: #1677ff; border-color: #1677ff; }
.add-branch.ghost { border-style: solid; border-color: transparent; }

/* ---------- 条件网关 ---------- */
.gw { display: flex; flex-direction: column; align-items: center; }
.gw-addbar {
  display: flex; align-items: center; gap: 10px; padding: 6px 10px; margin-bottom: 14px;
  border: 1px solid var(--panel-border, #e3e8ef); border-radius: 8px; background: #fff;
}
.gw-addbar .gw-title { width: auto; cursor: pointer; }
.gw-meta { font-size: 12px; color: #94a3b8; }
.branches { display: flex; align-items: stretch; gap: 14px; position: relative; padding: 22px 0 0; }.branches::before {
  content: ''; position: absolute; top: 0; left: var(--half); right: var(--half);
  height: 2px; background: var(--line-strong, #8da3be);
}
/* 分支列等宽，不压缩：分支多了就让画布横向滚，避免条件表头被挤成省略号 */
.branch { display: flex; flex-direction: column; align-items: center; position: relative; flex: 0 0 auto; width: var(--card-w, 220px); }
.branch::before {
  content: ''; position: absolute; top: 0; left: 50%; width: 2px; height: 22px;
  background: var(--line-strong, #8da3be);
}
.cond {
  width: var(--card-w, 220px); max-width: 100%; border: 1px solid #c8e6d0; border-radius: 6px 6px 0 0;
  background: #f2f8f4; cursor: pointer; margin-bottom: -1px;
}
.cond.fallback { border-color: #dfe3e9; background: #f5f6f8; }
.cond.sel { outline: 2px solid #1677ff; outline-offset: 1px; }
.cond-top { display: flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
.cond-top > span:first-child { flex: 1 1 0%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cond-top .pri { color: #94a3b8; font-weight: 400; white-space: nowrap; }
.cond-top .del { color: #94a3b8; }
.cond-top .del:hover { color: #ff4d4f; }
.cond-expr {
  padding: 5px 10px; font-size: 11px; color: #64748b; border-top: 1px solid rgba(0, 0, 0, .05);
  font-family: var(--mono, monospace); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cond-expr.empty { color: #ff4d4f; }
.branch-body { position: relative; width: 100%; display: flex; justify-content: center; flex: 1 1 auto; min-height: 14px; }
/* 贯穿线：没有子节点的分支列也有一条完整的竖线，视觉上不断裂 */
.branch-body::before {
  content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 2px;
  background: var(--line, #a9bad0);
}
/* 汇合：一条横线把所有分支列收拢，再从中间接主干下一步 */
.join { width: 100%; display: flex; flex-direction: column; align-items: center; position: relative; }
.join::before {
  content: ''; position: absolute; top: 0; left: var(--half); right: var(--half);
  height: 2px; background: var(--line-strong, #8da3be);
}
.join-line { width: 2px; height: 16px; background: var(--line, #a9bad0); }
.join-chip { font-size: 12px; color: #94a3b8; padding-bottom: 2px; }
</style>
