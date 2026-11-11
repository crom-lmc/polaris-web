<template>
  <div class="page-root">
    <div class="toolbar">
      <div class="toolbar-left">
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索名称 / 编码 / 负责人"
          allow-clear
          style="width: 260px"
          @search="load()"
        />
        <span class="muted">共 {{ flat.length }} 个节点</span>
      </div>
      <div class="toolbar-right">
        <a-button @click="chartOpen = true">
          <template #icon><apartment-outlined /></template>
          查看组织架构图
        </a-button>
        <a-button @click="load()">
          <template #icon><reload-outlined /></template>
          刷新
        </a-button>
      </div>
    </div>

    <div class="split">
      <!-- 左：完整组织树，始终展示层级 -->
      <section class="panel tree-panel">
        <div class="panel-head">
          <span>组织架构</span>
          <span class="panel-tools">
            <a-button size="small" type="link" @click="expandAll">展开全部</a-button>
            <a-button size="small" type="link" @click="collapseAll">收起全部</a-button>
          </span>
        </div>
        <div class="panel-body tree-body">
          <a-spin :spinning="loading">
            <a-empty v-if="!treeData.length && !loading" class="org-empty" description="还没有组织节点" />
            <a-tree
              v-else
              v-model:expanded-keys="expandedKeys"
              :selected-keys="selectedKeys"
              :tree-data="treeData"
              block-node
              @select="onSelect"
            >
              <template #title="data">
                <span class="node-title">
                  <a-tag :color="typeColor(data.raw.type)" class="node-tag">{{ data.raw.typeName }}</a-tag>
                  <span class="node-name" :class="{ 'is-off': data.raw.status === 2 }">{{ data.raw.name }}</span>
                  <span v-if="data.raw.employeeCount" class="node-count">{{ data.raw.employeeCount }}人</span>
                </span>
              </template>
            </a-tree>
          </a-spin>
        </div>
      </section>

      <!-- 右：选中节点及其所有下级（含自己），扁平平铺不缩进 -->
      <section class="panel list-panel">
        <div class="panel-head">
          <span class="head-title">
            <template v-if="selectedRoot">
              <a-tag :color="typeColor(selectedRoot.type)" class="node-tag">{{ selectedRoot.typeName }}</a-tag>
              <span class="head-name" :class="{ 'is-off': selectedRoot.status === 2 }">{{ selectedRoot.name }}</span>
              <span class="muted">含自己共 {{ listRows.length }} 个节点</span>
            </template>
            <template v-else>组织列表</template>
          </span>
          <span v-if="canManage && selectedRoot" class="panel-tools">
            <a-tooltip :title="`在「${selectedRoot.name}」下新增下级`">
              <a-button
                size="small"
                type="primary"
                :disabled="selectedRoot.status === 2 || !(selectedRoot.allowedChildTypes || []).length"
                @click="openCreate(selectedRoot)"
              >
                在选中节点下新增
              </a-button>
            </a-tooltip>
          </span>
        </div>
        <div class="panel-body table-body">
          <a-spin :spinning="loading">
            <a-empty v-if="!listRows.length && !loading" class="org-empty" description="还没有组织节点" />
            <a-table
              v-else
              class="org-table"
              :columns="columns"
              :data-source="listRows"
              row-key="id"
              size="middle"
              :pagination="false"
              :row-class-name="rowClassName"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <div class="org-name-cell">
                    <a-tag :color="typeColor(record.type)" class="node-tag">{{ record.typeName }}</a-tag>
                    <span class="node-name" :class="{ 'is-off': record.status === 2 }">{{ record.name }}</span>
                  </div>
                </template>
                <template v-else-if="column.key === 'path'">
                  <a-tooltip :title="pathText(record)">
                    <span class="ellipsis">{{ pathText(record) }}</span>
                  </a-tooltip>
                </template>
                <template v-else-if="column.key === 'leader'">
                  <span v-if="record.leaderEmployeeName">{{ record.leaderEmployeeName }}</span>
                  <span v-else class="muted">未指定</span>
                  <!-- 负责人变更记录只展示驳回终态；已撤销只留档，不在列表回显 -->
                  <a-tooltip
                    v-if="!record.approvalInstanceId && record.leaderChangeStatus === 2"
                    :title="`${record.leaderChangeReason || '未填写原因'}${record.leaderChangeAt ? ' · ' + fmtTime(record.leaderChangeAt) : ''}`"
                  >
                    <a-tag color="red" class="lc-tag">
                      {{ record.leaderChangeStatusName }}
                    </a-tag>
                  </a-tooltip>
                </template>
                <template v-else-if="column.key === 'employeeCount'">
                  {{ record.employeeCount || 0 }} 人
                </template>
                <template v-else-if="column.key === 'total'">
                  {{ record.totalEmployeeCount || 0 }} 人
                </template>
                <template v-else-if="column.key === 'headcount'">
                  {{ record.headcount == null ? '—' : record.headcount }}
                </template>
                <template v-else-if="column.key === 'status'">
                  <a-tag :color="record.status === 2 ? 'default' : 'green'">
                    {{ record.status === 2 ? '已禁用' : '启用' }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'action'">
                  <a-space :size="10" wrap class="row-actions">
                    <a @click="openView(record)">查看</a>
                    <!-- 审批入口统一放操作列：在途看流程、驳回看意见 -->
                    <a
                      v-if="runningBriefForRow(record)"
                      @click="openApprovalDetail(runningBriefForRow(record)!.id)"
                    >审批详情</a>
                    <a
                      v-else-if="rejectedBriefForRow(record)"
                      @click="openApprovalDetail(rejectedBriefForRow(record)!.id)"
                    >审批信息</a>
                    <a-tooltip
                      v-if="(record.allowedChildTypes || []).length"
                      :title="record.status === 2 ? '节点已禁用，请先启用再新增下级' : ''"
                    >
                      <a
                        :class="{ 'op-disabled': record.status === 2 }"
                        @click="record.status === 2 ? undefined : openCreate(record)"
                      >
                        新增下级
                      </a>
                    </a-tooltip>
                    <a @click="openLeader(record)">
                      {{ record.leaderEmployeeId ? '更换负责人' : '设置负责人' }}
                    </a>
                    <a-tooltip :title="toggleTip(record)">
                      <a v-if="toggleTip(record)" class="op-disabled">{{ record.status === 2 ? '启用' : '禁用' }}</a>
                    </a-tooltip>
                    <a-popconfirm
                      v-if="!toggleTip(record)"
                      :title="record.status === 2
                        ? '启用后该节点重新参与审批流转，确定启用？'
                        : '禁用后该节点不再参与审批流转，可随时重新启用。确定禁用？'"
                      ok-text="确定"
                      cancel-text="取消"
                      @confirm="doToggle(record)"
                    >
                      <a :class="{ danger: record.status !== 2 }">{{ record.status === 2 ? '启用' : '禁用' }}</a>
                    </a-popconfirm>
                    <a @click="openEdit(record)">编辑</a>
                    <a-tooltip :title="deleteTip(record)">
                      <a v-if="deleteTip(record)" class="op-disabled">删除</a>
                    </a-tooltip>
                    <a-popconfirm
                      v-if="!deleteTip(record)"
                      title="删除后不可恢复，确定删除该节点？"
                      ok-text="删除"
                      cancel-text="取消"
                      @confirm="doRemove(record)"
                    >
                      <a class="danger">删除</a>
                    </a-popconfirm>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-spin>
        </div>
      </section>
    </div>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      :width="720"
      :body-style="{ maxHeight: '68vh', overflowY: 'auto', overflowX: 'hidden' }"
      centered
      destroy-on-close
      @ok="submit"
    >
      <a-form layout="vertical" class="node-form">
        <div class="muted hint-line form-tip">
          {{ modalMode === 'create'
            ? '组织编码按层级自动生成；负责人不在建节点时填写，创建后在右侧列表用「设置负责人」指定。'
            : '上级、编码、负责人和启用状态都不在这里改：负责人/状态在右侧列表操作，上级与编码创建后锁定。' }}
        </div>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="上级节点">
              <span v-if="!form.parentId" class="muted">无（根节点）</span>
              <span v-else>{{ parentLabel }}</span>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="节点类型" required>
              <a-select
                v-if="modalMode === 'create'"
                v-model:value="form.type"
                :options="typeOptions"
                placeholder="选择类型"
              />
              <span v-else>
                <a-tag :color="typeColor(form.type)">{{ typeLabel(form.type) }}</a-tag>
                <span class="muted">类型不可直接修改</span>
              </span>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="名称" required>
              <a-input v-model:value="form.name" :maxlength="128" placeholder="如：研发中心" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="组织简称">
              <a-input v-model:value="form.shortName" :maxlength="64" placeholder="如：研发中心" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="编码">
              <a-input
                :value="modalMode === 'create' ? '' : form.code"
                :maxlength="64"
                disabled
                :placeholder="modalMode === 'create' ? '保存后自动生成' : ''"
              />
              <div class="muted hint-line">
                {{ modalMode === 'create'
                  ? '按层级自动生成：顶级 XC0001，下级在父编码后追加 4 位序号（如 XC00010001）。'
                  : '编码创建后不可修改，避免外部对接的键被改动。' }}
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="成立日期">
              <a-date-picker
                v-model:value="form.establishDate"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                placeholder="选择日期"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="办公地点">
              <a-input v-model:value="form.address" :maxlength="255" placeholder="如：西安市高新区 3 号楼 5 层" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="编制人数">
              <a-input-number v-model:value="form.headcount" :min="0" :max="99999" style="width: 100%" placeholder="编制" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="同级排序">
              <a-input-number v-model:value="form.sort" :min="0" :max="9999" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="canShowCityRow" :gutter="12">
          <a-col :span="12">
            <a-form-item label="所在城市">
              <template v-if="canEditCity">
                <a-select
                  v-model:value="form.city"
                  :options="cityOptions"
                  placeholder="选择城市（婚假 / 产假 / 陪产假按城市政策）"
                  allow-clear
                />
              </template>
              <template v-else>
                <div class="inherited-city">
                  <span class="inherited-city-value">{{ effectiveCityDisplay }}</span>
                </div>
              </template>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 负责人单独一个入口：节点建好之后再指定，新增时不需要先有档案 -->
    <a-modal
      v-model:open="leaderOpen"
      :title="leaderTitle"
      :width="480"
      centered
      destroy-on-close
      :mask-closable="!leaderSaving"
    >
      <div class="leader-target">
        <a-tag :color="typeColor(leaderNode?.type || '')">{{ leaderNode?.typeName }}</a-tag>
        <span class="detail-name">{{ leaderNode?.name }}</span>
      </div>
      <a-form layout="vertical" class="node-form">
        <a-form-item label="负责人" required>
          <a-select
            v-model:value="leaderId"
            :options="leaderOptions"
            show-search
            option-filter-prop="label"
            :placeholder="employees.length ? '只能选直接挂在当前部门的试用期 / 在职员工' : '本部门暂无可选的试用期 / 在职员工'"
            :not-found-content="leaderLoading ? '加载中…' : '暂无候选人：请先到「人员管理」把员工挂到本部门'"
          />
        </a-form-item>
        <!-- 变更原因必填：它会写进 ehr_leader_change 并作为审批表单的一部分给审批人看 -->
        <a-form-item label="变更原因" required>
          <a-textarea
            v-model:value="leaderReason"
            :rows="3"
            :maxlength="500"
            show-count
            placeholder="说明这次设置 / 更换负责人的原因（如：原负责人调岗、部门新设、离职补位）"
          />
        </a-form-item>
      </a-form>
      <div v-if="leaderStale" class="muted hint-line stale-line">
        当前负责人「{{ leaderNode?.leaderEmployeeName }}」不是直接挂在本部门的人员（历史数据或已调动），请改选本部门员工后保存。
      </div>
      <div class="muted hint-line">
        该节点下的请假、离职由负责人审批；未设置时自动上溯到上级节点负责人。
      </div>
      <div class="muted hint-line">
        保存后发起「部门设置负责人」审批，<b>终审通过才生效</b>；本次变更会连同原因记入该部门的负责人变更记录。
      </div>
      <template #footer>
        <div class="leader-footer">
          <a-button @click="leaderOpen = false">取消</a-button>
          <a-button type="primary" :loading="leaderSaving" @click="submitLeader">保存</a-button>
        </div>
      </template>
    </a-modal>

    <!-- 只读详情：查看组织节点完整信息 + 负责人变更记录 -->
    <a-modal
      v-model:open="viewOpen"
      title="组织节点详情"
      :width="880"
      centered
      destroy-on-close
      :footer="null"
    >
      <a-descriptions
        v-if="viewNode"
        :column="1"
        bordered
        size="small"
        class="org-view-desc"
      >
        <a-descriptions-item label="名称">{{ viewNode.name }}</a-descriptions-item>
        <a-descriptions-item label="简称">{{ viewNode.shortName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="类型">
          <a-tag :color="typeColor(viewNode.type)">{{ viewNode.typeName }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="编码">{{ viewNode.code || '—' }}</a-descriptions-item>
        <a-descriptions-item label="上级节点">{{ viewNode.parentName || '无（根节点）' }}</a-descriptions-item>
        <a-descriptions-item label="层级路径">{{ pathText(viewNode) }}</a-descriptions-item>
        <a-descriptions-item label="负责人">
          {{ viewNode.leaderEmployeeName || '未设置' }}
        </a-descriptions-item>
        <a-descriptions-item label="直属在职">{{ viewNode.employeeCount ?? 0 }} 人</a-descriptions-item>
        <a-descriptions-item label="含下级人数">{{ viewNode.totalEmployeeCount ?? 0 }} 人</a-descriptions-item>
        <a-descriptions-item label="编制人数">{{ viewNode.headcount ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="办公地点">{{ viewNode.address || '—' }}</a-descriptions-item>
        <a-descriptions-item label="所在城市">{{ viewNode.city || '—' }}</a-descriptions-item>
        <a-descriptions-item label="成本中心">{{ viewNode.costCenter || '—' }}</a-descriptions-item>
        <a-descriptions-item label="成立日期">{{ viewNode.establishDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="联系电话">{{ viewNode.phone || '—' }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="viewNode.status === 2 ? 'default' : 'green'">
            {{ viewNode.status === 2 ? '已禁用' : '启用' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="备注">{{ viewNode.remark || '—' }}</a-descriptions-item>
      </a-descriptions>

      <!-- 负责人变更记录：原负责人 → 新负责人 + 变更原因 + 审批结果，一次变更一行 -->
      <div v-if="viewNode" class="lc-block">
        <div class="lc-head">
          <span class="lc-title">负责人变更记录</span>
          <span v-if="leaderChangesLoading" class="muted small">加载中…</span>
          <span v-else class="muted small">共 {{ leaderChanges.length }} 条</span>
        </div>
        <a-table
          v-if="leaderChanges.length"
          :data-source="leaderChanges"
          :columns="leaderChangeColumns"
          row-key="id"
          size="small"
          :pagination="false"
          :scroll="{ y: 240 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'who'">
              <span class="lc-from">{{ record.oldLeaderName || '未设置' }}</span>
              <span class="lc-arrow">→</span>
              <span class="lc-to">{{ record.newLeaderName || '（清除）' }}</span>
              <div v-if="record.changeTypeName" class="muted lc-type">{{ record.changeTypeName }}</div>
            </template>
            <template v-else-if="column.key === 'reason'">
              <a-tooltip :title="record.reason || ''">
                <span class="lc-reason">{{ record.reason || '—' }}</span>
              </a-tooltip>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tooltip :title="record.remark || ''">
                <a-tag :color="changeStatusColor(record.status)">{{ record.statusName }}</a-tag>
              </a-tooltip>
            </template>
            <template v-else-if="column.key === 'time'">
              <span class="muted">{{ fmtTime(record.effectiveAt || record.appliedAt) }}</span>
            </template>
            <template v-else-if="column.key === 'op'">
              <!-- 实例号已退役：按 (bizType, 变更记录ID) 回审批中心反查这张单 -->
              <a v-if="leaderChangeBriefOf(record)" @click="openApprovalDetail(leaderChangeBriefOf(record)!.id)">
                审批单
              </a>
              <span v-else class="muted">—</span>
            </template>
          </template>
        </a-table>
        <div v-else-if="!leaderChangesLoading" class="muted small lc-empty">
          还没有负责人变更记录。
        </div>
      </div>
    </a-modal>

    <!-- 负责人变更在途审批：流程 / 审批人 / 意见 / 我的处理 -->
    <approval-detail-drawer
      v-model:open="approvalDrawerOpen"
      :instance-id="approvalInstanceId"
      @done="load(true)"
    />

    <!-- 组织架构图：把整棵组织树画成自上而下的架构图 -->
    <a-modal
      v-model:open="chartOpen"
      :width="chartFullscreen ? '100vw' : 1400"
      :footer="null"
      :closable="false"
      centered
      destroy-on-close
      :wrap-class-name="chartFullscreen ? 'chart-modal-fullscreen' : ''"
      :body-style="chartFullscreen
        ? { height: 'calc(100vh - 56px)', overflow: 'hidden', padding: '16px 24px' }
        : { height: 'calc(85vh - 56px)', overflow: 'hidden', padding: '16px 24px' }"
      @after-close="chartFullscreen = false"
    >
      <template #title>
        <div class="chart-modal-title">
          <span>组织架构图</span>
          <div class="chart-modal-actions">
            <a-button
              type="text"
              class="chart-fs-btn"
              :title="chartFullscreen ? '退出全屏' : '全屏'"
              @click="chartFullscreen = !chartFullscreen"
            >
              <template #icon>
                <fullscreen-exit-outlined v-if="chartFullscreen" />
                <fullscreen-outlined v-else />
              </template>
            </a-button>
            <button
              type="button"
              class="chart-close-btn"
              title="关闭"
              @click="chartOpen = false"
            >
              <close-outlined />
            </button>
          </div>
        </div>
      </template>
      <div class="chart-scroll">
        <OrgChart v-if="chartOpen" :nodes="nodes" />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  ApartmentOutlined,
  CloseOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'
import {
  createOrg,
  deleteOrg,
  dictOptions,
  orgLeaderChanges,
  orgTree,
  pageEmployees,
  setOrgLeader,
  setOrgStatus,
  updateOrg,
  type DictOption,
  type EmployeeItem,
  type LeaderChange,
  type OrgNode,
  type OrgSaveBody
} from '@/api/ehr'
import { useUserStore } from '@/stores/user'
import ApprovalDetailDrawer from '@/components/ApprovalDetailDrawer.vue'
import OrgChart from '@/components/OrgChart.vue'
import {
  briefsForRow,
  buildBizRefs,
  buildSubjectBizRefs,
  fetchLatestApprovals,
  runningBriefOf,
  rejectedBriefOf,
  type ApprovalBrief
} from '@/api/approvals'

const store = useUserStore()
const canManage = computed(() => store.can('org:manage'))

/* ---------- 在途审批详情：审批动作统一在审批中心完成 ---------- */
const approvalDrawerOpen = ref(false)
const approvalInstanceId = ref<string | null>(null)

/* ---------- 组织架构图弹窗 ---------- */
const chartOpen = ref(false)
const chartFullscreen = ref(false)

function openApprovalDetail(id: string) {
  approvalInstanceId.value = id
  approvalDrawerOpen.value = true
}

const nodes = ref<OrgNode[]>([])
const flat = ref<OrgNode[]>([])

/**
 * 组织节点最新审批单：负责人变更被驳回时本地不留任何状态，只能反查审批中心。
 * 每次变更都会生成一条 ehr_leader_change 记录，bizId 是记录 ID（DOC），
 * 组织列表只有组织 ID —— 必须按 subject_id（组织）反查，精确匹配永远查不到新单。
 */
const approvalBriefs = ref<ApprovalBrief[]>([])

async function loadApprovalBriefs(list: OrgNode[]) {
  // 组织维度：新后端走 bySubject + cfg_biz_scene.subject_field=orgId；
  // 同时带 byOrg 兼容未重启的旧后端（旧单 bizId 恰为组织 ID，仍能精确命中）。
  const refs = buildSubjectBizRefs(list.map((n) => n.id), ['ehr.org_leader', 'ehr.dept_leader'], 'org')
  approvalBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
}

/** 审批入口统一放操作列：在途看流程、驳回看意见，均以审批中心真实状态为准 */
function runningBriefForRow(r: OrgNode) {
  return runningBriefOf(
    briefsForRow(approvalBriefs.value, r.id),
    r.approvalInstanceId,
    r.approvalBizType
  )
}
function rejectedBriefForRow(r: OrgNode) {
  return rejectedBriefOf(briefsForRow(approvalBriefs.value, r.id))
}
const loading = ref(false)
const keyword = ref('')
const selectedId = ref('')
const expandedKeys = ref<string[]>([])

interface TreeItem {
  key: string
  raw: OrgNode
  children?: TreeItem[]
}

const treeData = computed<TreeItem[]>(() => toTree(nodes.value))
const selectedKeys = computed(() => (selectedId.value ? [selectedId.value] : []))

function findNode(list: OrgNode[], id: string): OrgNode | null {
  for (const n of list) {
    if (n.id === id) return n
    if (n.children && n.children.length) {
      const hit = findNode(n.children, id)
      if (hit) return hit
    }
  }
  return null
}

/** 树中选中的节点：作为右侧列表的「根」，过滤出它及其全部下级 */
const selectedRoot = computed<OrgNode | null>(
  () => (selectedId.value ? findNode(nodes.value, selectedId.value) : null) || nodes.value[0] || null
)

/** 右侧列表：选中节点 + 它的所有下级（含自己），扁平平铺（不按层级缩进）。
    必须清掉 children：antd table 见到 record.children 会当树形数据渲染，
    行首多出「+」展开图标，展开后子节点还会再出现一遍（与扁平行重复）。 */
const listRows = computed<OrgNode[]>(() => {
  const root = selectedRoot.value
  if (!root) return []
  const rows: OrgNode[] = []
  const walk = (node: OrgNode) => {
    rows.push({ ...node, children: undefined })
    for (const c of node.children || []) walk(c)
  }
  walk(root)
  return rows
})

function toTree(list: OrgNode[]): TreeItem[] {
  return list.map((n) => ({
    key: n.id,
    raw: n,
    children: n.children && n.children.length ? toTree(n.children) : undefined
  }))
}

function walk(list: OrgNode[]) {
  for (const n of list) {
    flat.value.push(n)
    if (n.children && n.children.length) walk(n.children)
  }
}

async function load(keep = true) {
  loading.value = true
  try {
    const data = await orgTree(keyword.value || undefined)
    nodes.value = data || []
    flat.value = []
    walk(nodes.value)
    void loadApprovalBriefs(flat.value)
    expandedKeys.value = flat.value.map((n) => n.id)
    // 默认停在顶级节点：flat 是 DFS 序，第一个就是最上层那个
    if (!keep || !flat.value.some((n) => n.id === selectedId.value)) {
      selectedId.value = flat.value[0]?.id || ''
    }
  } finally {
    loading.value = false
  }
}

// 始终是「选中即高亮」，不做开关：点击任意节点都切换高亮行，
// 即使用户点的是已选中节点（树会发取消事件），也忽略、保持选中。
function onSelect(_keys: (string | number)[], info: { node?: { key?: string | number } }) {
  const k = info?.node?.key
  if (k !== undefined && k !== null) {
    selectedId.value = String(k)
  }
}

// 选中节点即切换右侧子树；同时把高亮行（选中节点，即列表首行）滚动到可视区
watch(selectedId, async () => {
  await nextTick()
  const el = document.querySelector('.org-table .ant-table-tbody tr.highlight-row')
  if (el) (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })
})

// 展开全部：把整棵组织树全部展开；收起全部：折叠到只剩根
function expandAll() {
  expandedKeys.value = flat.value.map((n) => n.id)
}
function collapseAll() {
  expandedKeys.value = []
}

/* ---------- 类型展示 ---------- */
const TYPE_META: Record<string, { label: string; color: string }> = {
  GROUP: { label: '集团', color: 'magenta' },
  COMPANY: { label: '子公司', color: 'blue' },
  DEPARTMENT: { label: '部门', color: 'green' },
  PROJECT: { label: '项目', color: 'orange' },
  SUB_PROJECT: { label: '子项目', color: 'purple' }
}

function typeColor(code: string) {
  return TYPE_META[code]?.color || 'default'
}

function typeLabel(code: string) {
  return TYPE_META[code]?.label || code
}

function pathText(node: OrgNode) {
  if (!node.path) return node.name
  const byId = new Map(flat.value.map((n) => [n.id, n]))
  return node.path
    .split('/')
    .map((id) => byId.get(id)?.name)
    .filter(Boolean)
    .join(' / ')
}

/** 树中选中的节点：在右侧列表里高亮对应行（点击树节点时定位用） */
function rowClassName(record: OrgNode) {
  return record.id === selectedId.value ? 'highlight-row' : ''
}

/* ---------- 列表列定义 ---------- */
const columns: any[] = [
  { title: '名称', key: 'name', width: 240 },
  { title: '层级路径', key: 'path', width: 170, ellipsis: true },
  { title: '编码', dataIndex: 'code', key: 'code', width: 110, ellipsis: true },
  { title: '负责人', key: 'leader', width: 110 },
  { title: '直属在职', key: 'employeeCount', width: 100, align: 'right' },
  { title: '含下级人数', key: 'total', width: 110, align: 'right' },
  { title: '编制人数', key: 'headcount', width: 100, align: 'right' },
  { title: '办公地点', dataIndex: 'address', key: 'address', width: 180, ellipsis: true },
  { title: '成立日期', dataIndex: 'establishDate', key: 'establishDate', width: 110 },
  { title: '状态', key: 'status', width: 90 },
  // 操作列：横向滚动时始终贴住右边（改用 CSS sticky，见 .org-table 样式）
  { title: '操作', key: 'action', width: 320 }
]

/* ---------- 新增 / 编辑 ---------- */
const modalOpen = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const parentNode = ref<OrgNode | null>(null)
/** 正在编辑的节点：列表不一定有 selectedId，必须记自己那一行 */
const editingNode = ref<OrgNode | null>(null)

/* email / phone / costCenter 已从表单里去掉，但状态仍保留：
   编辑时按接口原值回填、保存时原样回传，避免「改个名字顺手把邮箱电话清空」。
   leader / status 不在这里：负责人走「设置负责人」按钮，状态走「启用 / 禁用」按钮 */
const form = reactive<{
  parentId: string | null
  type: string
  name: string
  shortName: string
  code: string
  email: string
  address: string
  city: string
  headcount: number | null
  costCenter: string
  establishDate: string | null
  phone: string
  sort: number
  remark: string
}>({
  parentId: null,
  type: 'GROUP',
  name: '',
  shortName: '',
  code: '',
  email: '',
  address: '',
  city: '',
  headcount: null,
  costCenter: '',
  establishDate: null,
  phone: '',
  sort: 0,
  remark: ''
})

/* ---------- 负责人候选（只能选直接挂在当前部门的人，且仅试用期/在职） ---------- */
const employees = ref<EmployeeItem[]>([])
/** 原来的负责人不在本部门（人员调动）时给个提示，避免下拉里空着一脸懵 */
const leaderStale = ref(false)
const leaderOptions = computed(() => {
  const opts: { value: string; label: string; disabled?: boolean }[] = employees.value.map((e) => ({
    value: e.id,
    label: `${e.name}（${e.empNo}${e.orgName ? ' · ' + e.orgName : ''}）`
  }))
  // 原负责人不是本部门直属（历史数据 / 人员已调动）时，保留一条不可选的展示项：
  // 否则下拉会显示成一串裸 ID，或者「打开就清空」，用户一保存就把负责人悄悄删了
  const cur = leaderNode.value
  if (cur?.leaderEmployeeId && !opts.some((o) => o.value === cur.leaderEmployeeId)) {
    opts.unshift({
      value: cur.leaderEmployeeId,
      label: `${cur.leaderEmployeeName || '原负责人'}（不在本部门 · 历史数据）`,
      disabled: true
    })
  }
  return opts
})

async function loadEmployees(orgId: string) {
  try {
    // 后端 orgId 按子树查（含下级部门），这里再按 orgId 精确过滤：负责人只能出自本部门直属
    const data = await pageEmployees({ page: 1, size: 500, orgId })
    // 只有能正常履职的人（试用期 30 / 在职 40）才适合当审批负责人
    employees.value = (data.list || []).filter(
      (e) => e.orgId === orgId && (e.status === 30 || e.status === 40)
    )
  } catch {
    // 拿不到员工列表只影响下拉候选，不阻断组织树
    employees.value = []
  }
}

const modalTitle = computed(() => (modalMode.value === 'create' ? '新增组织节点' : '编辑组织节点'))

const typeOptions = computed(() => {
  const list = parentNode.value?.allowedChildTypes
  if (list && list.length) {
    return list.map((c) => ({ value: c.code, label: c.label }))
  }
  // 根节点只能是集团
  return [{ value: 'GROUP', label: '集团' }]
})

const parentLabel = computed(() => {
  // 编辑时 parentNode 不赋值，得按 parentId 去树上找，否则这里永远是「—」
  const p = parentNode.value || flat.value.find((n) => n.id === form.parentId) || null
  return p ? `${p.name}（${p.typeName}）` : '—'
})

/* ---------- 所在城市：仅二级单位（depth=2）可编辑，下级部门自动继承上级城市 ---------- */
const cityOptions = ref<DictOption[]>([])
/** 是否展示城市行：根节点 depth=1 也不展示（它下面直接出 depth=2 的子公司才是城市持有者） */
const canShowCityRow = computed(() => {
  if (modalMode.value === 'create') {
    return parentNode.value?.depth != null && parentNode.value.depth >= 1
  }
  return editingNode.value?.depth != null && editingNode.value.depth >= 2
})
/** 是否可编辑城市：创建时父节点 depth=1 → 新建的子节点 depth=2；编辑时节点自身 depth=2 */
const canEditCity = computed(() => {
  if (modalMode.value === 'create') return parentNode.value?.depth === 1
  return editingNode.value?.depth === 2
})
/** 只读展示时的有效城市：编辑模式用后端已解析好的 editingNode.city，创建模式用父节点已解析好的 city */
const effectiveCityDisplay = computed(() => {
  if (modalMode.value === 'create') {
    return parentNode.value?.city || '未配置（上级二级单位未设置城市）'
  }
  return editingNode.value?.city || '未配置'
})

function resetForm() {
  form.parentId = null
  form.type = 'GROUP'
  form.name = ''
  form.shortName = ''
  form.code = ''
  form.email = ''
  form.address = ''
  form.city = ''
  form.headcount = null
  form.costCenter = ''
  form.establishDate = null
  form.phone = ''
  form.sort = 0
  form.remark = ''
}

function openCreate(parent: OrgNode | null) {
  modalMode.value = 'create'
  parentNode.value = parent
  editingNode.value = null
  resetForm()
  form.parentId = parent ? parent.id : null
  form.type = parent?.allowedChildTypes?.[0]?.code || 'GROUP'
  form.sort = parent ? (parent.children?.length || 0) + 1 : 0
  modalOpen.value = true
}

function openEdit(node: OrgNode) {
  modalMode.value = 'edit'
  parentNode.value = null
  editingNode.value = node
  resetForm()
  form.parentId = node.parentId || null
  form.type = node.type
  form.name = node.name
  form.shortName = node.shortName || ''
  form.code = node.code || ''
  form.email = node.email || ''
  form.address = node.address || ''
  form.city = node.city || ''
  form.headcount = node.headcount == null ? null : node.headcount
  form.costCenter = node.costCenter || ''
  form.establishDate = node.establishDate || null
  form.phone = node.phone || ''
  form.sort = node.sort ?? 0
  form.remark = node.remark || ''
  modalOpen.value = true
}

async function submit() {
  if (!form.name.trim()) {
    message.warning('请填写节点名称')
    return
  }
  const body: OrgSaveBody = {
    type: form.type,
    name: form.name.trim(),
    shortName: form.shortName,
    email: form.email,
    address: form.address,
    // 子节点（depth>2）城市自动继承上级，前端不提交，后端也强制忽略
    city: canEditCity.value ? form.city || undefined : undefined,
    headcount: form.headcount,
    costCenter: form.costCenter,
    establishDate: form.establishDate,
    phone: form.phone,
    sort: form.sort,
    remark: form.remark
  }
  // 上级只在新建时提交：编辑接口拿到不同的值会直接 7033 拒绝。
  // 编码由后端按层级自动生成，前端一律不传（传了也会被忽略）。
  if (modalMode.value === 'create') {
    body.parentId = form.parentId
  }
  saving.value = true
  try {
    if (modalMode.value === 'create') {
      const created = await createOrg(body)
      message.success(`已创建「${created.name}」`)
      modalOpen.value = false
      selectedId.value = created.id
      await load()
    } else if (editingNode.value) {
      await updateOrg(editingNode.value.id, body)
      message.success('已保存')
      modalOpen.value = false
      await load()
    }
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/* ---------- 设置 / 更换负责人 ---------- */
const leaderOpen = ref(false)
const leaderSaving = ref(false)
const leaderLoading = ref(false)
const leaderNode = ref<OrgNode | null>(null)
/** 弹窗里当前选中的员工 ID；也可以从列表里直接打开并预填现有负责人 */
const leaderId = ref<string | null>(null)
/** 变更原因：写入 ehr_leader_change，并作为审批表单给审批人看 */
const leaderReason = ref('')

const leaderTitle = computed(() =>
  leaderNode.value?.leaderEmployeeId ? '更换部门负责人' : '设置部门负责人'
)

/** 只读详情：查看组织节点完整信息 + 负责人变更记录 */
const viewOpen = ref(false)
const viewNode = ref<OrgNode | null>(null)
const leaderChanges = ref<LeaderChange[]>([])
const leaderChangesLoading = ref(false)
/** 变更记录 → 审批单：业务行不再存实例号，打开只读详情时批量反查一次 */
const leaderChangeBriefs = ref<ApprovalBrief[]>([])

const leaderChangeColumns = [
  { title: '变更', key: 'who', width: 220 },
  { title: '变更原因', key: 'reason' },
  { title: '状态', key: 'status', width: 90 },
  { title: '时间', key: 'time', width: 160 },
  { title: '审批', key: 'op', width: 70 }
]

function changeStatusColor(status?: number) {
  if (status === 1) return 'green'
  if (status === 2) return 'red'
  if (status === 3) return 'default'
  return 'blue'
}

function fmtTime(s?: string) {
  return s ? String(s).replace('T', ' ').slice(0, 16) : '—'
}

function openView(node: OrgNode) {
  viewNode.value = node
  viewOpen.value = true
  void loadLeaderChanges(node.id)
}

async function loadLeaderChanges(orgId: string) {
  leaderChanges.value = []
  leaderChangeBriefs.value = []
  leaderChangesLoading.value = true
  try {
    const list = (await orgLeaderChanges(orgId)) || []
    leaderChanges.value = list
    // 新单 bizId 是变更记录 ID（DOC）；存量单 bizId 是组织 ID（SUBJECT），两种都查一遍。
    // 精确匹配即可，不用主体反查——否则同一组织的多条记录会归并成一张单。
    const types = ['ehr.org_leader', 'ehr.dept_leader']
    const ids = list.flatMap((r) => [r.id, (r as { orgId?: string }).orgId].filter(Boolean)) as (string | number)[]
    leaderChangeBriefs.value = ids.length
      ? await fetchLatestApprovals(buildBizRefs(ids, types)).catch(() => [])
      : []
  } catch {
    // 变更记录取不到不影响看组织信息，静默降级
  } finally {
    leaderChangesLoading.value = false
  }
}

/** 一条变更记录对应的审批单：优先按记录 ID，存量单按组织 ID 兜底 */
function leaderChangeBriefOf(r: LeaderChange): ApprovalBrief | null {
  const row = r as LeaderChange & { orgId?: string }
  const keys = [String(row.id), row.orgId ? String(row.orgId) : ''].filter(Boolean)
  // 后端已按 id 倒序，先匹配到的就是最新一张
  return leaderChangeBriefs.value.find((b) => keys.includes(b.bizId)) || null
}

async function openLeader(node: OrgNode) {
  const hadLeader = !!node.leaderEmployeeId
  leaderNode.value = node
  leaderId.value = node.leaderEmployeeId || null
  leaderReason.value = ''
  leaderStale.value = false
  employees.value = []
  leaderOpen.value = true
  leaderLoading.value = true
  try {
    await loadEmployees(node.id)
  } finally {
    leaderLoading.value = false
  }
  // 原负责人不是本部门直属（历史数据 / 人员调动）：保留原值展示并提示，不静默清空
  leaderStale.value = hadLeader && !employees.value.some((e) => e.id === leaderId.value)
}

async function saveLeader(employeeId: string | number | null) {
  if (!leaderNode.value) return
  leaderSaving.value = true
  try {
    await setOrgLeader(leaderNode.value.id, employeeId, leaderReason.value.trim())
    // 指定/更换负责人走「部门设置负责人」审批：接口成功=审批单已受理，负责人要等终审通过才真正变化
    message.success(employeeId ? '负责人变更已提交审批，通过后生效' : '负责人已清除')
    leaderOpen.value = false
    await load()
    // 已打开过详情的话，顺手刷新变更记录
    if (viewOpen.value && viewNode.value) {
      void loadLeaderChanges(viewNode.value.id)
    }
  } catch (e: any) {
    message.error(e?.message || '设置负责人失败')
  } finally {
    leaderSaving.value = false
  }
}

function submitLeader() {
  if (!leaderId.value) {
    message.warning('请选择负责人')
    return
  }
  const hit = leaderOptions.value.find((o) => o.value === leaderId.value)
  if (!hit || hit.disabled) {
    message.warning('原负责人不是本部门的人，请改选本部门员工')
    return
  }
  if (!leaderReason.value.trim()) {
    message.warning('请填写变更原因（会记入变更记录并给审批人看）')
    return
  }
  saveLeader(leaderId.value)
}

/* ---------- 禁用 / 启用 ---------- */
/** 按钮置灰的原因：有下级或有人时后端同样会拒，这里提前把原因说清楚 */
function toggleTip(node: OrgNode) {
  if (node.status === 2) return ''
  if ((node.childCount || 0) > 0) return '该节点下还有下级节点，不能禁用'
  if ((node.employeeCountAll || 0) > 0) return '该节点下还有员工，不能禁用'
  return ''
}

function deleteTip(node: OrgNode) {
  if ((node.childCount || 0) > 0) return '该节点下还有下级节点，不能删除'
  if ((node.employeeCountAll || 0) > 0) return '该节点下还有员工，不能删除'
  return ''
}

async function doToggle(node: OrgNode) {
  const next = node.status === 2 ? 1 : 2
  try {
    await setOrgStatus(node.id, next)
    message.success(next === 1 ? '已启用' : '已禁用')
    await load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function doRemove(node: OrgNode) {
  try {
    await deleteOrg(node.id)
    message.success('已删除')
    // 删的是当前选中节点时，load 会把选中退回第一个（通常是顶级）
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

onMounted(() => {
  load(false)
  dictOptions('ehr.job_city')
    .then((list) => (cityOptions.value = list || []))
    .catch(() => {
      cityOptions.value = []
    })
})
</script>

<style scoped>
.hint-line {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
}

/* 子节点继承上级城市的只读展示 */
.inherited-city {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fafafa;
  line-height: 1.5;
}

.inherited-city-value {
  font-size: 13px;
  color: #333;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.split {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.tree-panel {
  width: 340px;
  flex: 0 0 340px;
}

/* 右侧列表：表格自己横向滚动，操作列 fixed 才贴得住右边 */
.list-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.head-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.head-name {
  font-size: 14px;
  font-weight: 600;
}

.head-name.is-off {
  color: var(--muted);
  text-decoration: line-through;
}

.org-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.danger {
  color: #ff4d4f;
}

/* 置灰的行内操作：条件不满足时不给点，但保留位置和原因 tooltip */
.op-disabled {
  color: var(--muted);
  cursor: not-allowed;
}

.row-actions :deep(a) {
  white-space: nowrap;
}

/* 树中选中的节点：在列表中对应行高亮（名称加粗 + 左侧色条）。
   不用底色——固定列的不透明背景会盖住一半，还会透出下层文字 */
.list-panel :deep(.ant-table-tbody > tr.highlight-row > td:first-child) {
  box-shadow: inset 3px 0 0 0 #6d5efc;
}
.list-panel :deep(.highlight-row .node-name) {
  font-weight: 600;
  color: #6d5efc;
}

/* 操作列 sticky 贴右：横向滚动时始终可见。
   替代 antd 的 fixed 列——fixed 列要求表格内部开一层横向滚动，会把横向滚动条压到长表格
   内容最底部（难够到）。现在横向滚动交给外层 .panel-body，这里只让最后一列（操作）粘在右边。 */
.list-panel .org-table :deep(.ant-table-thead > tr > th:last-child),
.list-panel .org-table :deep(.ant-table-tbody > tr > td:last-child) {
  position: sticky;
  right: 0;
  z-index: 3;
  background: var(--panel-bg);
  border-left: 1px solid var(--panel-border);
}

.tree-body {
  padding: 8px 6px;
}

/* 空态：撑满面板并垂直、水平居中（左右两块统一） */
.tree-body :deep(.ant-spin-nested-loading),
.tree-body :deep(.ant-spin-container),
.table-body :deep(.ant-spin-nested-loading),
.table-body :deep(.ant-spin-container) {
  height: 100%;
}

.org-empty {
  margin: 0;
  height: 100%;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.node-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.node-tag {
  margin-inline-end: 0;
  transform: scale(0.9);
  transform-origin: left center;
}

.node-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-name.is-off {
  color: var(--muted);
  text-decoration: line-through;
}

.node-count {
  font-size: 11px;
  color: var(--muted);
}

.form-tip {
  margin-bottom: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.08);
}

.leader-target {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.detail-name {
  font-size: 16px;
  font-weight: 600;
  margin-left: 4px;
}

.leader-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.stale-line {
  color: #d46b08;
}

.chart-scroll {
  height: 100%;
  padding: 8px 4px;
  overflow: auto;
}

/* 组织架构图弹窗：标题栏（标题左、按钮组右，同一行） */
.chart-modal-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
/* 全屏按钮 + 自绘关闭按钮：同一 flex 容器，gap 精确控制间距，永远同行垂直居中 */
.chart-modal-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.chart-fs-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  width: 32px;
}
.chart-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  width: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted, #8a9099);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.chart-close-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-base, #fff);
}

/* 全屏模式：弹窗铺满视口，内容区可滚动 */
.chart-modal-fullscreen .ant-modal {
  top: 0;
  max-width: 100vw;
  margin: 0;
  padding-bottom: 0;
}
.chart-modal-fullscreen .ant-modal-content {
  height: 100vh;
  display: flex;
  flex-direction: column;
  border-radius: 0;
}
.chart-modal-fullscreen .ant-modal-header {
  border-radius: 0;
}
.chart-modal-fullscreen .ant-modal-body {
  flex: 1;
  overflow: hidden;
}
.chart-modal-fullscreen .chart-scroll {
  min-height: 100%;
}

.node-form :deep(.ant-form-item) {
  margin-bottom: 14px;
}

@media (max-width: 900px) {
  .split {
    flex-direction: column;
  }

  .tree-panel {
    width: 100%;
    flex: 0 0 auto;
    max-height: 320px;
  }
}

/* ---------- 负责人变更记录 ---------- */
.lc-block {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--panel-border);
}

.lc-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.lc-title {
  font-weight: 600;
  font-size: 13px;
}

.lc-from {
  color: var(--muted);
}

.lc-arrow {
  margin: 0 6px;
  color: var(--muted);
}

.lc-to {
  font-weight: 600;
}

.lc-type {
  font-size: 11px;
  margin-top: 2px;
}

.lc-reason {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.lc-empty {
  padding: 4px 0 2px;
}

.lc-tag {
  margin-left: 6px;
  transform: scale(0.9);
  transform-origin: left center;
}
</style>
