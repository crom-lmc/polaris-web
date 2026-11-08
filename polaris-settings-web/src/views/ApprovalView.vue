<template>
  <a-layout class="page-container at-root">
    <a-layout-sider width="300" class="approval-nav-sider" :theme="theme.mode === 'dark' ? 'dark' : 'light'">
      <a-tree
        class="approval-nav-tree"
        :tree-data="treeData"
        :selected-keys="selectedApp ? ['app:' + selectedApp] : []"
        :expanded-keys="expandedKeys"
        block-node
        @select="onSelectApp"
        @expand="onExpand"
      >
        <template #title="node">
          <span class="approval-nav-node">
            <span :class="['approval-nav-name', navTitleClass(String(node.key))]">{{ node.title }}</span>
            <span v-if="navCount(node)" class="approval-nav-count">{{ navCount(node) }}</span>
          </span>
        </template>
      </a-tree>
      <a-empty v-if="!treeData.length" :image-style="{ height: '40px' }" description="暂无应用" />
    </a-layout-sider>

    <a-layout-content class="at-content">
      <section class="panel">
            <div class="panel-head">
              <span>
                审批模板 · {{ selectedAppName || '全部' }}
                <a v-if="selectedApp" class="at-clear" @click="clearSelect">查看全部</a>
              </span>
              <a-space :size="8">
                <a-button @click="loadAll">刷新</a-button>
                <a-button v-if="store.can('approval:manage')" type="primary" @click="openEditor()">
                  新建模板
                </a-button>
              </a-space>
            </div>
            <div class="panel-body table-body">
              <a-table
                :columns="tplColumns"
                :data-source="filteredTemplates"
                :loading="loading"
                row-key="id"
                size="small"
                :pagination="false"
                :scroll="{ x: 980 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'code'">
                    <a-tooltip :title="record.code" placement="topLeft">
                      <span class="mono">{{ record.code }}</span>
                    </a-tooltip>
                  </template>
                  <template v-if="column.key === 'bizType'">
                    <span class="mono">{{ record.bizType }}</span>
                  </template>
                  <template v-if="column.key === 'shape'">
                    <span>{{ record.stepCount }} 步 · {{ record.nodeCount }} 分支</span>
                  </template>
                  <template v-if="column.key === 'running'">
                    <a-badge
                      :count="record.runningCount || 0"
                      :number-style="{ backgroundColor: record.runningCount ? '#faad14' : '#d9d9d9' }"
                      :title="`在途 ${record.runningCount || 0} 单`"
                    />
                  </template>
                  <template v-if="column.key === 'enabled'">
                    <a-switch
                      :checked="record.enabled === 1"
                      :disabled="!store.can('approval:manage')"
                      size="small"
                      @change="(v: boolean) => onToggle(record, v)"
                    />
                  </template>
                  <template v-if="column.key === 'action'">
                    <a-space :size="12">
                      <a v-if="store.can('approval:manage')" @click="openEditor(record)">编辑</a>
                      <a v-if="store.can('approval:manage')" @click="openPage(record)">页面配置</a>
                      <a
                        v-if="store.can('approval:manage') && !(record.runningCount > 0)"
                        class="danger"
                        @click="removeTpl(record)"
                      >删除</a>
                      <a-tooltip v-else-if="record.runningCount > 0" title="有在途单据，不允许删除">
                        <span class="muted">在途</span>
                      </a-tooltip>
                    </a-space>
                  </template>
                </template>
              </a-table>
            </div>
          </section>
        </a-layout-content>

    <!-- ==================== 模板编辑抽屉 ==================== -->
    <a-drawer
      v-model:open="editorOpen"
      :title="editingId ? `编辑模板 · ${editForm.name}` : '新建审批模板'"
      :width="'min(1440px, 94vw)'"
      :body-style="{ padding: '16px' }"
      destroy-on-close
    >
      <div class="editor-body">
        <!-- 基本信息 -->
        <section class="card">
          <div class="card-title">基本信息</div>
          <a-form layout="vertical" class="compact">
            <div class="grid-3">
              <a-form-item label="模板编码" required>
                <a-input v-model:value="editForm.code" placeholder="如 ehr.onboard.v2" :disabled="!!editingId" />
              </a-form-item>
              <a-form-item label="模板名称" required>
                <a-input v-model:value="editForm.name" placeholder="如 入职审批" />
              </a-form-item>
              <a-form-item label="业务类型 bizType" required>
                <a-select
                  v-model:value="editForm.bizType"
                  placeholder="从业务场景里选（没有就先去「业务场景」页签注册）"
                  :disabled="!!editingId"
                  :options="sceneOptions"
                  show-search
                  option-filter-prop="label"
                  @change="onScenePick"
                />
              </a-form-item>
              <a-form-item label="业务侧名称">
                <a-input v-model:value="editForm.bizName" placeholder="选业务类型后自动带出，可改" />
              </a-form-item>
              <a-form-item label="所属应用">
                <a-select
                  v-model:value="editForm.appCode"
                  placeholder="选择应用"
                  :options="appOptions"
                  show-search
                  option-filter-prop="label"
                />
              </a-form-item>
              <a-form-item label="备注">
                <a-input v-model:value="editForm.remark" placeholder="可选" />
              </a-form-item>
            </div>
          </a-form>
        </section>

        <!-- 编辑模式切换：流程图（默认） / 表单 -->
        <a-radio-group v-model:value="editorMode" size="small" button-style="solid" class="mode-switch">
          <a-radio-button value="flow">流程图</a-radio-button>
          <a-radio-button value="form">表单</a-radio-button>
        </a-radio-group>

        <!-- 流程图模式：钉钉式可视化，编辑同一份 editSteps -->
        <ApprovalFlowEditor v-if="editorMode === 'flow'" :steps="editSteps" :points="bizPoints"
                            :biz-label="bizSceneName" @pick-user="openUserPicker" />

        <!-- 表单模式：步骤列表 -->
        <template v-else>
        <section v-for="(item, si) in flatEditSteps" :key="item.step.cid" class="card step-card"
                 :style="{ marginLeft: item.depth * 16 + 'px' }">
          <div class="card-title step-title">
            <span>
              步骤 {{ si + 1 }} · {{ kindText(item.step.kind) }}
              <span v-if="item.depth" class="muted small">· 第 {{ item.depth }} 层分支子链</span>
              <span v-if="item.branchName" class="muted small">· {{ item.branchName }}</span>
              ：{{ item.step.name || '（未命名）' }}
            </span>
            <a-popconfirm
              v-if="store.can('approval:manage') && item.depth === 0 && editSteps.length > 1"
              title="删除该步骤及其全部分支？"
              @confirm="removeFlowStep(item.step)"
            >
              <a class="danger">删除步骤</a>
            </a-popconfirm>
          </div>

          <div class="step-toolbar">
            <a-input v-model:value="item.step.name" placeholder="步骤名，如 部门负责人审批" style="width: 220px" />
            <a-tag color="blue">驳回 = 整单终止（整单 END）</a-tag>
          </div>
          <div class="expr-row">
            <a-input
              v-model:value="item.step.conditionExpr"
              placeholder="进入本步骤的条件（SpEL，空 = 总是进入），如 days > 3"
            />
            <a-button :loading="checking === `s${si}`" @click="checkExpr(item.step.conditionExpr, `s${si}`)">校验</a-button>
          </div>
          <div v-if="exprTip[`s${si}`]" class="expr-tip" :class="{ err: !exprTip[`s${si}`].ok }">
            {{ exprTip[`s${si}`].text }}
          </div>

          <!-- 条件网关的分支：名称 / 条件 / 兜底 -->
          <template v-if="item.step.kind === 'gateway'">
            <div v-for="(b, bi) in (item.step.branches || [])" :key="b.cid" class="branch-form">
              <span class="node-badge">分支 {{ bi + 1 }}</span>
              <a-input v-model:value="b.name" size="small" placeholder="分支名" style="width: 150px" />
              <a-input v-model:value="b.conditionExpr" size="small" placeholder="SpEL，如 days > 3"
                       style="flex: 1 1 0%; min-width: 0" :disabled="b.isFallback" />
              <a-checkbox v-model:checked="b.isFallback" @change="onFormFallback(item.step, b)">兜底</a-checkbox>
            </div>
          </template>

          <!-- 审批节点：网关取各分支审批卡，其余取 nodes -->
          <div v-for="(nd, ni) in formNodes(item.step)" :key="nd.cid" class="node-card">
            <div class="node-head">
              <span class="node-badge">分支 {{ ni + 1 }}</span>
              <a-input v-model:value="nd.name" placeholder="分支名，如 HRBP 加签" style="width: 200px" size="small" />
              <a-space :size="6">
                <a-select v-model:value="nd.approveMode" size="small" style="width: 120px">
                  <a-select-option value="ANY">或签（一人过）</a-select-option>
                  <a-select-option value="ALL">会签（全过）</a-select-option>
                  <a-select-option value="SEQ">依次审批</a-select-option>
                </a-select>
                <a-tooltip title="分支条件不满足时：跳过 / 阻塞整单">
                  <a-select v-model:value="nd.onEmpty" size="small" style="width: 128px">
                    <a-select-option value="SKIP">无审批人则跳过</a-select-option>
                    <a-select-option value="BLOCK">无审批人则阻塞</a-select-option>
                  </a-select>
                </a-tooltip>
                <a-checkbox v-model:checked="nd.allowSelf" :disabled="nd.approveMode !== 'ANY'">允许自审</a-checkbox>
                <a-checkbox v-model:checked="nd.skipSame">同人只审一次</a-checkbox>
                <a-popconfirm title="删除该分支？" @confirm="removeFormNode(item.step, nd)">
                  <a class="danger">删除</a>
                </a-popconfirm>
              </a-space>
            </div>
            <div v-if="item.step.kind !== 'gateway'" class="expr-row">
              <a-input
                v-model:value="nd.conditionExpr"
                placeholder="本分支生效条件（SpEL，空 = 总是生效），如 type == 'annual'"
                size="small"
              />
              <a-button size="small" :loading="checking === `n${si}-${ni}`" @click="checkExpr(nd.conditionExpr, `n${si}-${ni}`)">
                校验
              </a-button>
            </div>
            <div v-if="exprTip[`n${si}-${ni}`]" class="expr-tip" :class="{ err: !exprTip[`n${si}-${ni}`].ok }">
              {{ exprTip[`n${si}-${ni}`].text }}
            </div>

            <!-- 审批人规则 -->
            <div class="rules">
              <div v-for="(r, ri) in nd.approvers" :key="ri" class="rule-row">
                <a-select v-model:value="r.type" size="small" style="width: 132px" @change="onRuleType(r)">
                  <a-select-option value="ORG_LEADER">组织负责人</a-select-option>
                  <a-select-option value="ORG_LEADER_BY_NAME">指定组织负责人</a-select-option>
                  <a-select-option value="ROLE">角色</a-select-option>
                  <a-select-option value="USER">指定账号</a-select-option>
                  <a-select-option value="APPLICANT">发起人本人</a-select-option>
                </a-select>
                <template v-if="r.type === 'ORG_LEADER'">
                  <a-select
                    v-model:value="r.source"
                    size="small"
                    style="width: 210px"
                    :options="orgLeaderSourceOptions"
                    placeholder="取谁的组织"
                  />
                  <a-checkbox v-model:checked="r.toRoot" :disabled="!r.source">审批到集团负责人</a-checkbox>
                  <a-input-number
                    v-if="!r.toRoot"
                    v-model:value="r.levelOffset"
                    :min="0"
                    :max="10"
                    size="small"
                    style="width: 130px"
                    :placeholder="`上溯 ${r.levelOffset ?? 0} 级`"
                  />
                  <span class="muted small">{{ sourceHint(r) }}</span>
                </template>
                <template v-if="r.type === 'ORG_LEADER_BY_NAME'">
                  <a-button size="small" @click="openOrgPicker(r)">
                    {{ r.code ? '更换组织' : '选择组织' }}
                  </a-button>
                  <a-tooltip :title="r.code || ''">
                    <span class="small org-val" :class="{ muted: !r.code }">
                      {{ r.code || '未选择' }}
                    </span>
                  </a-tooltip>
                  <a v-if="r.code" class="danger small" @click="clearOrg(r)">清除</a>
                </template>
                <a-select
                  v-if="r.type === 'ROLE'"
                  v-model:value="r.code"
                  size="small"
                  style="width: 280px"
                  show-search
                  option-filter-prop="label"
                  :options="roleOptions"
                  placeholder="选择角色"
                />
                <template v-if="r.type === 'USER'">
                  <a-button size="small" @click="openUserPicker(r)">
                    {{ r.userId ? '更换人员' : '选择人员' }}
                  </a-button>
                  <span class="small" :class="{ muted: !r.userName }">
                    {{ r.userName || (r.userId ? `账号 ${r.userId}` : '未选择') }}
                  </span>
                  <a v-if="r.userId" class="danger small" @click="clearUser(r)">清除</a>
                </template>
                <span v-if="r.type === 'APPLICANT'" class="muted small">审批单由发起人自己确认</span>
                <a class="danger small" @click="nd.approvers.splice(ri, 1)">移除</a>
              </div>
              <a-button size="small" type="dashed" block @click="addRule(nd)">+ 添加审批人规则（多条取并集）</a-button>
            </div>
          </div>

          <a-button size="small" type="dashed" block @click="addNode(item.step)">
            + {{ item.step.kind === 'gateway' ? '添加条件分支' : '添加并行分支' }}
          </a-button>
        </section>

        <a-button type="dashed" block @click="addStep">+ 添加主干节点</a-button>
        </template>
      </div>

      <template #footer>
        <a-space>
          <a-button @click="editorOpen = false">取消</a-button>
          <a-button v-if="store.can('approval:manage')" type="primary" :loading="saving" @click="saveTemplate">保存模板</a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- ==================== 页面配置抽屉 ==================== -->
    <a-drawer
      v-model:open="pageOpen"
      :title="`审批页面配置 · ${pageTarget?.name || ''}`"
      :width="'min(1120px, 94vw)'"
      :body-style="{ padding: '16px' }"
      destroy-on-close
    >
      <a-alert
        v-if="pageForm.renderMode !== 'ROUTE'"
        class="page-alert"
        type="info"
        show-icon
        message="审批弹窗的信息区由这里配置：左侧字段池 → 中间分组 → 右侧改属性。字段来源 FORM=冻结快照 / ENTITY=实时业务方 / DERIVED=派生 / SYSTEM=系统字段 / TABLE=业务库里真绑定的表（绑定关系在「业务场景」页配置）。"
      />
      <a-form layout="vertical" class="compact">
        <div class="grid-2">
          <a-form-item label="视图">
            <a-select v-model:value="pageForm.view">
              <a-select-option value="APPROVAL">APPROVAL（审批弹窗）</a-select-option>
              <a-select-option value="DETAIL">DETAIL（详情查看）</a-select-option>
              <a-select-option value="AUDIT">AUDIT（审计留痕）</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="渲染模式">
            <a-select v-model:value="pageForm.renderMode">
              <a-select-option value="SECTIONS">分组卡片（推荐）</a-select-option>
              <a-select-option value="TEMPLATE">受限 HTML 模板</a-select-option>
              <a-select-option value="COMPONENT">前端注册组件</a-select-option>
              <a-select-option value="ROUTE">自定义页面路由（iframe 嵌入）</a-select-option>
            </a-select>
          </a-form-item>
        </div>
      </a-form>

      <!-- ROUTE 模式信息区整体交给自定义页面，无需配置字段，设计器与字段说明一并隐藏 -->
      <ApprovalPageDesigner
        v-if="pageForm.renderMode !== 'ROUTE'"
        v-model="pageForm.config"
        :field-pool="pageFieldPool"
        :biz-name="pageTarget?.bizName || ''"
      />

      <a-form v-if="pageForm.renderMode !== 'SECTIONS'" layout="vertical" class="compact">
        <a-form-item v-if="pageForm.renderMode === 'TEMPLATE'" label="HTML 模板（受限白名单编译，非原生 innerHTML）">
          <a-textarea v-model:value="pageForm.htmlTpl" :rows="6" class="mono" />
        </a-form-item>
        <a-form-item v-if="pageForm.renderMode === 'COMPONENT'" label="前端注册的组件 key">
          <a-input v-model:value="pageForm.componentKey" placeholder="如 ehr-onboard-panel" />
        </a-form-item>
        <a-form-item
          v-if="pageForm.renderMode === 'ROUTE'"
          label="自定义页面地址（审批抽屉信息区 iframe 嵌入，自动拼 instanceId 参数；流程与操作区保持平台渲染）"
        >
          <a-input v-model:value="pageForm.routePath" placeholder="应用内路由如 /approval/onboard-panel，或完整 URL" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="pageOpen = false">取消</a-button>
          <a-button v-if="store.can('approval:manage')" type="primary" :loading="savingPage" @click="savePageCfg">保存页面配置</a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- ==================== 选人弹窗：组织树 + 成员列表 ==================== -->
    <a-modal
      v-model:open="userPickOpen"
      title="选择审批人（按组织）"
      width="720px"
      :footer="null"
      destroy-on-close
    >
      <div class="picker">
        <div class="picker-left">
          <a-spin :spinning="orgTreeLoading">
            <a-input-search
              v-model:value="orgKeyword"
              size="small"
              placeholder="搜索组织"
              class="picker-search"
              @change="onOrgSearch"
            />
            <a-tree
              v-if="orgTreeData.length"
              :tree-data="orgTreeData"
              :field-names="{ children: 'children', title: 'name', key: 'id' }"
              :expanded-keys="orgExpanded"
              :selected-keys="selectedOrgId ? [selectedOrgId] : []"
              block-node
              @expand="(k: Key[]) => (orgExpanded = k)"
              @select="onOrgSelect"
            />
            <a-empty v-else-if="!orgTreeLoading" :image-style="{ height: '40px' }" description="无组织数据" />
          </a-spin>
        </div>
        <div class="picker-right">
          <a-spin :spinning="orgUsersLoading">
            <div class="picker-head">
              <span class="small muted">{{ selectedOrgName || '先选左侧组织' }}</span>
              <a-input-search
                v-model:value="userKeyword"
                size="small"
                placeholder="搜姓名 / 工号"
                style="width: 160px"
              />
            </div>
            <div class="user-list">
              <div
                v-for="u in filteredOrgUsers"
                :key="u.id"
                class="user-row"
                :class="{ active: pickedUser?.id === u.id }"
                @click="pickedUser = u"
              >
                <span class="user-name">{{ u.name }}</span>
                <span class="small muted">{{ u.empNo }}</span>
              </div>
              <a-empty
                v-if="selectedOrgId && !filteredOrgUsers.length && !orgUsersLoading"
                description="该组织下没有可派单的成员（需已开户且在职）"
                :image-style="{ height: '40px' }"
              />
              <div v-if="!selectedOrgId" class="picker-tip muted small">组织下仅显示已开户、未离职的成员——没开户的账号派不了审批任务</div>
            </div>
          </a-spin>
        </div>
      </div>
    <div class="picker-footer">
      <a-button size="small" @click="userPickOpen = false">取消</a-button>
      <a-button type="primary" size="small" :disabled="!pickedUser" @click="confirmUser">
        确定{{ pickedUser ? `：${pickedUser.name}` : '' }}
      </a-button>
    </div>
    </a-modal>

    <!-- ==================== 选组织弹窗（指定组织负责人） ==================== -->
    <OrgPickerModal
      v-model:open="orgPickOpen"
      :current="orgPickCurrent"
      @confirm="confirmOrg"
    />
  </a-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { Key } from 'ant-design-vue/es/_util/type'
import { message, Modal } from 'ant-design-vue'
import {
  type AppBrief,
  type ApprovalTemplate,
  type ApproverRule,
  type BizScene,
  type BusinessPoint,
  type FlowBranch,
  type FlowStep,
  type NodeEdit,
  type OrgNodeLite,
  type OrgUser,
  type RoleBrief,
  type TableBinding,
  type TemplateSaveBody,
  columnFormat,
  fetchEntityColumns,
  flatFlow,
  fromWireSteps,
  orgLeaderSources,
  parseOrgLeaderSource,
  toSaveSteps,
  createTemplate,
  deleteTemplate,
  fetchApps,
  fetchOrgTree,
  fetchOrgUsers,
  fetchRoles,
  getTemplate,
  listScenes,
  listTemplates,
  savePage,
  toggleTemplate,
  updateTemplate,
  validateCondition
} from '@/api/approval'
import ApprovalFlowEditor from '@/components/ApprovalFlowEditor.vue'
import ApprovalPageDesigner from '@/components/ApprovalPageDesigner.vue'
import OrgPickerModal from '@/components/OrgPickerModal.vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'

const store = useUserStore()
const theme = useThemeStore()

/* ---------------- 列表 ---------------- */

const loading = ref(false)
const templates = ref<ApprovalTemplate[]>([])
const scenes = ref<BizScene[]>([])
const sceneLoading = ref(false)
/**
 * 应用列表同时供左侧树 treeData 使用，必须声明在 treeData 之前：
 * 左树的 watch(treeData, …, { immediate: true }) 会在 setup 阶段立即求值，
 * 变量若声明在后面会触发 TDZ，导致整个组件 setup 抛错、页面白屏。
 */
const apps = ref<AppBrief[]>([])

const tplColumns = [
  { title: '编码', key: 'code', width: 170, ellipsis: true },
  { title: '名称', dataIndex: 'name', width: 150 },
  { title: 'bizType', key: 'bizType', width: 150, ellipsis: true },
  { title: '流程形状', key: 'shape', width: 130 },
  { title: '版本', dataIndex: 'version', width: 64 },
  { title: '在途', key: 'running', width: 64 },
  { title: '启用', key: 'enabled', width: 70 },
  { title: '操作', key: 'action', width: 170 }
]

async function loadAll() {
  loading.value = true
  try {
    templates.value = (await listTemplates()) || []
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
  loadScenes()
}

async function loadScenes() {
  sceneLoading.value = true
  try {
    scenes.value = (await listScenes()) || []
  } catch {
    /* 场景拉不到不挡模板页 */
  } finally {
    sceneLoading.value = false
  }
}

/* ---------------- 左树：应用维度 ---------------- */

const selectedApp = ref('')
const selectedAppName = ref('')

/**
 * 左树按应用维度，扁平一级；以启用应用为基准，兜底模板里出现的应用。
 * 标题显示应用名 + 模板数（不展示编码）。
 */
const treeData = computed(() => {
  const known = new Map<string, string>()
  for (const a of apps.value) known.set(a.code, a.name)
  for (const t of templates.value) if (t.appCode && !known.has(t.appCode)) known.set(t.appCode, t.appCode)
  const counts = new Map<string, number>()
  for (const t of templates.value) if (t.appCode) counts.set(t.appCode, (counts.get(t.appCode) || 0) + 1)
  const arr = [...known.entries()].map(([code, name]) => ({
    key: `app:${code}`,
    title: name,
    count: counts.get(code) || 0,
    isLeaf: true
  }))
  arr.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  return arr
})

/* ---------------- 左树统一样式与展开（三个审批菜单共用同一套 class） ---------------- */

/** 本页只有一级应用节点，字重按「应用」这一层走，与另外两页同层一致 */
const navTitleClass = (_key: string) => 'approval-nav-title-app'

/** 树节点右侧数量（节点数据里带 count；根节点不展示） */
const navCount = (node: any) => (typeof node?.count === 'number' ? node.count : 0)

/**
 * 默认全展开：这棵树目前是扁平一级、本来就全部可见，仍与另外两页保持同一套受控写法，
 * 后续若给应用加子节点，会自动展开且不会覆盖用户手动折叠。
 */
const expandedKeys = ref<string[]>([])
watch(
  treeData,
  (nodes) => {
    const parents: string[] = []
    const walk = (list: { key: string; children?: any[] }[]) =>
      list.forEach((n) => {
        if (n.children?.length) {
          parents.push(n.key)
          walk(n.children)
        }
      })
    walk(nodes)
    const known = new Set(expandedKeys.value)
    const added = parents.filter((k) => !known.has(k))
    if (added.length) expandedKeys.value = [...expandedKeys.value, ...added]
  },
  { immediate: true }
)
function onExpand(keys: (string | number)[]) {
  expandedKeys.value = keys.map(String)
}

const filteredTemplates = computed(() =>
  selectedApp.value ? templates.value.filter((t) => t.appCode === selectedApp.value) : templates.value
)

function onSelectApp(keys: string[]) {
  const key = keys[0]
  if (!key || !key.startsWith('app:')) return
  selectedApp.value = key.slice(4)
  selectedAppName.value = apps.value.find((a) => a.code === selectedApp.value)?.name || selectedApp.value
}

/** 取消应用筛选，回到默认的全量视图 */
function clearSelect() {
  selectedApp.value = ''
  selectedAppName.value = ''
}

async function onToggle(record: ApprovalTemplate, v: boolean) {
  try {
    await toggleTemplate(record.id, v ? 1 : 0)
    record.enabled = v ? 1 : 0
    message.success(v ? '已启用' : '已停用')
  } catch (e) {
    message.error((e as Error).message)
  }
}

function removeTpl(record: ApprovalTemplate) {
  Modal.confirm({
    title: `删除模板「${record.name}」？`,
    content: '步骤、分支与页面配置一并删除，不可恢复。',
    okText: '删除',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await deleteTemplate(record.id)
        message.success('已删除')
        loadAll()
      } catch (e) {
        message.error((e as Error).message)
      }
    }
  })
}

/* ---------------- 条件校验 ---------------- */

const checking = ref('')
const exprTip = reactive<Record<string, { ok: boolean; text: string }>>({})

async function checkExpr(expr: string, key: string) {
  checking.value = key
  try {
    const r = await validateCondition(expr || '')
    if (!expr || !expr.trim()) {
      exprTip[key] = { ok: true, text: '空条件 = 总是生效' }
    } else if (r.ok) {
      exprTip[key] = { ok: true, text: `编译通过，空变量试算结果：${r.result}` }
    } else {
      exprTip[key] = { ok: false, text: r.error || '表达式不合法' }
    }
  } catch (e) {
    exprTip[key] = { ok: false, text: (e as Error).message }
  } finally {
    checking.value = ''
  }
}

/* ---------------- 模板编辑 ---------------- */

const editorOpen = ref(false)
const editingId = ref<string | null>(null)
/** 编辑器视图：流程图（默认，钉钉式） / 表单（传统逐项填写），两者编辑同一份数据 */
const editorMode = ref<'flow' | 'form'>('flow')
const saving = ref(false)
const editForm = reactive({ code: '', name: '', appCode: '', bizType: '', bizName: '', remark: '' })
/** v5：编辑器持有流程树；保存时按 DFS 展平，加载时按 parentNodeId 还原 */
const editSteps = ref<FlowStep[]>([])
const flatEditSteps = computed(() => flatFlow(editSteps.value))

/** 条件构建器的业务点池：只取当前模板所属业务场景配置的业务点，跨场景的业务点不允许选 */
const bizPoints = computed<BusinessPoint[]>(() => {
  const bt = (editForm.bizType || '').trim()
  if (!bt) return []
  const hit = scenes.value.find((s) => s.bizType === bt)
  if (!hit) return []
  let arr: BusinessPoint[] = []
  try { arr = JSON.parse(hit.formSchema || '[]') } catch { arr = [] }
  const map = new Map<string, BusinessPoint>()
  for (const p of arr) if (p?.code && !map.has(p.code)) map.set(p.code, p)
  return [...map.values()]
})

/** 当前业务场景名：给条件构建器做提示用 */
const bizSceneName = computed(() => {
  const bt = (editForm.bizType || '').trim()
  const hit = scenes.value.find((s) => s.bizType === bt)
  return hit?.bizName || bt
})

/** ORG_LEADER「取谁的组织」下拉：申请人本人 + 当前业务场景的 USER/ORG 业务点 */
const orgLeaderSourceOptions = computed(() => orgLeaderSources(bizPoints.value))

/** ORG_LEADER 来源提示文案 */
function sourceHint(r: ApproverRule): string {
  if (!r.source) return '取申请人本人所在组织的负责人'
  const p = parseOrgLeaderSource(r.source)
  const key = p?.key || ''
  if (r.toRoot) return `从「${key}」当前节点审批到集团（根）负责人这一人`
  return `取「${key}」${r.levelOffset ? `上溯 ${r.levelOffset} 级` : '直属'}组织的负责人`
}

let flowSeq = 0
function newCid() { return `v${Date.now().toString(36)}${(++flowSeq).toString(36)}` }

function emptyNode(name = '审批人'): NodeEdit {
  return {
    cid: newCid(), name, conditionExpr: '', approveMode: 'ANY',
    allowSelf: false, skipSame: true, onEmpty: 'SKIP', approvers: []
  }
}
function emptyBranch(i: number): FlowBranch {
  return { cid: newCid(), nodeCid: newCid(), name: `条件${i}`, conditionExpr: '', isFallback: false, card: emptyNode(), chain: [] }
}
function emptyStep(): FlowStep {
  return { cid: newCid(), kind: 'approver', name: '', conditionExpr: '', nodes: [emptyNode()] }
}
function addStep() { editSteps.value.push(emptyStep()) }
function addNode(st: FlowStep) {
  if (st.kind === 'gateway') {
    st.branches = st.branches || []
    st.branches.push(emptyBranch(st.branches.length + 1))
  } else {
    st.nodes.push(emptyNode(`审批人${st.nodes.length + 1}`))
  }
}
function formNodes(st: FlowStep): NodeEdit[] {
  return st.kind === 'gateway' ? (st.branches || []).map((b) => b.card) : st.nodes
}
function removeFormNode(st: FlowStep, nd: NodeEdit) {
  if (st.kind === 'gateway') {
    st.branches = (st.branches || []).filter((b) => b.card.cid !== nd.cid)
  } else {
    st.nodes = st.nodes.filter((n) => n.cid !== nd.cid)
  }
}
function removeFlowStep(st: FlowStep) {
  const i = editSteps.value.findIndex((s) => s.cid === st.cid)
  if (i >= 0) editSteps.value.splice(i, 1)
}
function kindText(k: string) {
  return ({ approver: '审批人', parallel: '并行会签', gateway: '条件分流' } as Record<string, string>)[k] || k
}
function onFormFallback(st: FlowStep, b: FlowBranch) {
  if (!b.isFallback || st.kind !== 'gateway') return
  b.conditionExpr = ''
  for (const x of st.branches || []) if (x.cid !== b.cid) x.isFallback = false
}
function addRule(nd: NodeEdit) {
  nd.approvers.push({ type: 'ORG_LEADER', levelOffset: 0 })
}

/** 保存前的结构校验：递归覆盖所有分支子链，深度上限 3 层 */
function validateFlow(list: FlowStep[], depth: number): string | null {
  if (depth > 3) return '条件分支最多嵌套 3 层'
  for (const s of list) {
    if (!s.name.trim()) return '有节点缺少名称'
    const nodes = formNodes(s)
    if (!nodes.length) return `步骤「${s.name}」至少要有一个审批分支`
    for (const nd of nodes) {
      if (!nd.approvers.length) return `步骤「${s.name}」有分支没有配置审批人`
      for (const r of nd.approvers) {
        if ((r.type === 'ROLE' || r.type === 'ORG_LEADER_BY_NAME') && !r.code?.trim()) {
          return `步骤「${s.name}」：${r.type === 'ROLE' ? '请选择角色' : '请选择组织'}`
        }
        if (r.type === 'USER' && !r.userId) return `步骤「${s.name}」：指定账号需要选择人员`
      }
    }
    if (s.kind === 'gateway') {
      let fallbacks = 0
      for (const b of s.branches || []) {
        if (b.isFallback) fallbacks++
        else if (!b.conditionExpr?.trim()) return `分支「${b.name}」缺少生效条件`
      }
      if (fallbacks > 1) return `步骤「${s.name}」最多只能有 1 个兜底分支`
      for (const b of s.branches || []) {
        const err = validateFlow(b.chain || [], depth + 1)
        if (err) return err
      }
    }
  }
  return null
}

/** 收集整棵树里的所有 SpEL 表达式（步骤 / 分支 / 普通节点） */
function allExprs(list: FlowStep[]): { label: string; expr: string }[] {
  const out: { label: string; expr: string }[] = []
  const walk = (arr: FlowStep[]) => {
    for (const s of arr) {
      if (s.conditionExpr?.trim()) out.push({ label: `步骤「${s.name || '未命名'}」`, expr: s.conditionExpr.trim() })
      if (s.kind === 'gateway') {
        for (const b of s.branches || []) {
          if (!b.isFallback && b.conditionExpr?.trim()) {
            out.push({ label: `分支「${b.name || '未命名'}」`, expr: b.conditionExpr.trim() })
          }
          walk(b.chain || [])
        }
      } else {
        for (const n of s.nodes) {
          if (n.conditionExpr?.trim()) out.push({ label: `节点「${n.name || '未命名'}」`, expr: n.conditionExpr.trim() })
        }
      }
    }
  }
  walk(list)
  return out
}

/** SpEL 关键字：这些不是业务点，别当成未配置的变量报错 */
const SPEL_KEYWORDS = new Set([
  'and', 'or', 'not', 'true', 'false', 'null', 'eq', 'ne', 'gt', 'lt', 'ge', 'le',
  'div', 'mod', 'instanceof', 'between', 'matches'
])

/** 从表达式里提取引用的变量名（先剔除字符串字面量，避免把 'annual' 当变量） */
function exprVars(expr: string): string[] {
  const cleaned = expr.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
  const found = new Set<string>()
  const re = /[A-Za-z_][A-Za-z0-9_]*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned))) {
    const name = m[0]
    // 点后面的是属性/方法名（mobile.contains 里的 contains），不算业务点
    if (cleaned[m.index - 1] === '.') continue
    // 紧跟左括号的是方法调用，也不算业务点
    if (/^\s*\(/.test(cleaned.slice(m.index + name.length))) continue
    if (!SPEL_KEYWORDS.has(name.toLowerCase())) found.add(name)
  }
  return [...found]
}

function onRuleType(r: { type: string; userId?: unknown; code?: string; levelOffset?: number; source?: string; toRoot?: boolean }) {
  delete r.userId
  delete (r as { userName?: string }).userName
  delete r.code
  if (r.type === 'ORG_LEADER') {
    r.levelOffset = r.levelOffset ?? 0
    if (r.source === undefined) r.source = ''
    if (r.toRoot === undefined) r.toRoot = false
  } else {
    delete r.source
    delete r.toRoot
  }
}

/* ---------------- 选人弹窗：组织树 + 成员 ---------------- */

/** 扁平组织 → antd 树；禁用组织置灰但保留可选（里面可能还有在职人员） */
interface OrgTreeNode extends OrgNodeLite {
  children?: OrgTreeNode[]
  disabled?: boolean
}

const userPickOpen = ref(false)
const userPickTarget = ref<{ userId?: number | string | null; userName?: string } | null>(null)

const orgTreeLoading = ref(false)
const orgRaw = ref<OrgNodeLite[]>([])
const orgTreeData = ref<OrgTreeNode[]>([])
const orgExpanded = ref<Key[]>([])
const orgKeyword = ref('')
const selectedOrgId = ref<string>('')
const selectedOrgName = ref('')

const orgUsersLoading = ref(false)
const orgUsers = ref<OrgUser[]>([])
const userKeyword = ref('')
const pickedUser = ref<OrgUser | null>(null)

function buildOrgTree(list: OrgNodeLite[], kw: string): OrgTreeNode[] {
  const map = new Map<string, OrgTreeNode>()
  for (const n of list) {
    map.set(n.id, { ...n, children: [] })
  }
  const roots: OrgTreeNode[] = []
  for (const n of map.values()) {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children!.push(n)
    } else {
      roots.push(n)
    }
  }
  // 命中关键字时把不匹配的枝叶剪掉，但保留命中节点的祖先链
  if (kw.trim()) {
    const k = kw.trim().toLowerCase()
    const keep = (n: OrgTreeNode): boolean => {
      const self = n.name.toLowerCase().includes(k)
      n.children = (n.children || []).filter(keep)
      return self || n.children.length > 0
    }
    return roots.filter(keep)
  }
  return roots
}

function collectIds(nodes: OrgTreeNode[], acc: Key[] = []): Key[] {
  for (const n of nodes) {
    acc.push(n.id)
    if (n.children?.length) collectIds(n.children, acc)
  }
  return acc
}

async function loadOrgTree() {
  orgTreeLoading.value = true
  try {
    orgRaw.value = (await fetchOrgTree()) || []
    orgTreeData.value = buildOrgTree(orgRaw.value, orgKeyword.value)
    // 首次加载全展开，关键字过滤后也全展开方便看命中
    orgExpanded.value = collectIds(orgTreeData.value)
  } catch (e) {
    message.error((e as Error).message || '组织树加载失败')
  } finally {
    orgTreeLoading.value = false
  }
}

function onOrgSearch() {
  orgTreeData.value = buildOrgTree(orgRaw.value, orgKeyword.value)
  orgExpanded.value = collectIds(orgTreeData.value)
}

async function onOrgSelect(keys: Key[]) {
  const id = keys.length ? String(keys[0]) : ''
  if (!id || id === selectedOrgId.value) return
  selectedOrgId.value = id
  const node = orgRaw.value.find((n) => n.id === id)
  selectedOrgName.value = node?.name || ''
  pickedUser.value = null
  orgUsersLoading.value = true
  orgUsers.value = []
  try {
    orgUsers.value = (await fetchOrgUsers(id)) || []
  } catch (e) {
    message.error((e as Error).message || '成员加载失败')
  } finally {
    orgUsersLoading.value = false
  }
}

const filteredOrgUsers = computed(() => {
  const k = userKeyword.value.trim().toLowerCase()
  if (!k) return orgUsers.value
  return orgUsers.value.filter(
    (u) => u.name.toLowerCase().includes(k) || (u.empNo || '').toLowerCase().includes(k)
  )
})

function openUserPicker(r: { userId?: number | string | null; userName?: string }) {
  userPickTarget.value = r
  pickedUser.value = null
  selectedOrgId.value = ''
  selectedOrgName.value = ''
  orgUsers.value = []
  userKeyword.value = ''
  orgKeyword.value = ''
  userPickOpen.value = true
  loadOrgTree()
}

function confirmUser() {
  if (!pickedUser.value || !userPickTarget.value) return
  userPickTarget.value.userId = pickedUser.value.id
  userPickTarget.value.userName = pickedUser.value.name
  userPickOpen.value = false
}

function clearUser(r: { userId?: number | string | null; userName?: string }) {
  r.userId = null
  delete r.userName
}

async function openEditor(record?: ApprovalTemplate) {
  editingId.value = record?.id ?? null
  editorMode.value = 'flow'
  Object.assign(editForm, {
    code: record?.code || '',
    name: record?.name || '',
    appCode: record?.appCode || selectedApp.value,
    bizType: record?.bizType || '',
    bizName: record?.bizName || '',
    remark: record?.remark || ''
  })
  editSteps.value = [emptyStep()]
  if (record) {
    try {
      const d = await getTemplate(record.id)
      const tree = fromWireSteps(d.steps || [])
      editSteps.value = tree.length ? tree : [emptyStep()]
    } catch (e) {
      message.error((e as Error).message)
      return
    }
  }
  // 清掉上一次的校验提示
  Object.keys(exprTip).forEach((k) => delete exprTip[k])
  editorOpen.value = true
}

async function saveTemplate() {
  if (!editForm.code.trim() || !editForm.name.trim() || !editForm.bizType.trim()) {
    message.warning('编码、名称、bizType 都是必填')
    return
  }
  const vErr = validateFlow(editSteps.value, 0)
  if (vErr) {
    message.warning(vErr)
    return
  }
  // 条件只允许引用当前业务场景的业务点，再交给后端编译校验
  const allowed = new Set(bizPoints.value.map((p) => p.code))
  for (const { label, expr } of allExprs(editSteps.value)) {
    const bad = exprVars(expr).filter((v) => !allowed.has(v))
    if (bad.length) {
      message.error(
        `${label}的条件引用了当前业务场景未配置的业务点：${bad.join('、')}。` +
        (allowed.size ? `可选：${[...allowed].join('、')}` : '该业务场景还没有配置业务点，请先到「业务场景」里添加。')
      )
      return
    }
    const r = await validateCondition(expr)
    if (!r.ok) {
      message.error(`条件不合法：${r.error}（${expr}）`)
      return
    }
  }

  const body: TemplateSaveBody = {
    code: editForm.code.trim(),
    name: editForm.name.trim(),
    appCode: editForm.appCode.trim(),
    bizType: editForm.bizType.trim(),
    bizName: editForm.bizName.trim(),
    enabled: 1,
    remark: editForm.remark,
    // DFS 前序展平；clientId / parentNodeRef 由后端换成真实雪花 ID 并重算路径
    steps: toSaveSteps(editSteps.value)
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateTemplate(editingId.value, body)
      message.success('模板已更新（新发起的单按新版本流程走）')
    } else {
      await createTemplate(body)
      message.success('模板已创建')
    }
    editorOpen.value = false
    loadAll()
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

/* ---------------- 页面配置 ---------------- */

const pageOpen = ref(false)
const pageTarget = ref<ApprovalTemplate | null>(null)
const savingPage = ref(false)
const pageForm = reactive({ view: 'APPROVAL', renderMode: 'SECTIONS', config: '', htmlTpl: '', componentKey: '', routePath: '' })

/**
 * 页面配置器字段池条目。
 * <p>
 * 所有绑定的表（主表 / 子表）都<b>按列逐项展开</b>，code 统一为「表名.列名」，
 * 每一列都能单独点 ＋ 加入表单；也能被加进画布里的「表格」控件作为一列（见 ApprovalPageDesigner）。
 * tableKind 只区分主体表与子表：子表在运行时 values[表名] 是行数组，可作为表格的数据源；
 * 主表是单行，不能当表格数据源。列怎么摆全由页面配置决定，绑定里不再存关联方式。
 * 池项本身只存在于内存，不会写进页面配置 JSON（写进去的是用户实际选中的字段 / 表格列）。
 */
interface PagePoolItem {
  code: string
  name: string
  source?: string
  format?: string
  table?: string
  tableLabel?: string
  /** MAIN=主体表（单行）/ SUB=子表（按外键反查多行，可作表格数据源） */
  tableKind?: 'MAIN' | 'SUB'
}

/** 页面配置器的字段池：取当前模板所属业务场景的 fieldSchema（与 formSchema 同源镜像） + 数据表真绑定的列 */
const pageFieldPool = computed<PagePoolItem[]>(() => {
  const bt = pageTarget.value?.bizType || ''
  const base: { code: string; name: string; source?: string; format?: string }[] = []
  if (bt) {
    const hit = scenes.value.find((s) => s.bizType === bt)
    if (hit?.fieldSchema) {
      let arr: { code: string; name?: string; source?: string; format?: string }[] = []
      try {
        arr = JSON.parse(hit.fieldSchema || '[]')
      } catch {
        arr = []
      }
      for (const p of arr || []) {
        if (p && p.code) base.push({ code: p.code, name: p.name || p.code, source: p.source, format: p.format })
      }
    }
  }
  // 数据表真绑定：主表 / 一对一子表 / 一对多子表一律按列逐项展开（key=表名.列名）
  // 一对多子表的列加到普通表单时运行时取首行，加到「表格」控件时按物理列名逐行渲染。
  return [...base, ...tableFieldPool.value]
})

/* ---------------- 数据表真绑定（配置入口在「业务场景」页，这里只消费） ---------------- */

/** 绑定依赖的所属应用：以<b>场景</b>的 appCode 为准（绑定就存在场景上），模板的作为兜底 */
const bindingAppCode = computed(() => {
  const bizType = pageTarget.value?.bizType || ''
  const sc = scenes.value.find((s) => s.bizType === bizType)
  return sc?.appCode || pageTarget.value?.appCode || ''
})

/** 真绑定列注入字段池：所有绑定表都逐列展开（主表 / 一对一 / 一对多同款），每列可单独加入表单或表格 */
const tableFieldPool = ref<PagePoolItem[]>([])

/** 从场景已存 tableBindings 解析出绑定结构（没有则返回 null） */
function parseSceneBindings(bizType: string): TableBinding | null {
  const scene = scenes.value.find((s) => s.bizType === bizType)
  if (!scene?.tableBindings) return null
  try {
    const o = JSON.parse(scene.tableBindings)
    if (o && Array.isArray(o.tables)) return o as TableBinding
  } catch {
    /* 解析失败视作无绑定 */
  }
  return null
}

/**
 * 拉一张表的列元数据并<b>逐列展开</b>成字段池项。
 * <p>
 * 主表 / 子表走同一套：code 统一「表名.列名」，name 用列注释。
 * 这样左侧字段池里每张表都是「一个字段一个字段」带 ＋，与用户的配置直觉一致；
 * tableKind 只用于让设计器识别哪些表能当表格数据源，不影响字段本身。
 */
async function expandTableColumns(
  app: string,
  t: { table: string; label?: string | null },
  tableKind: PagePoolItem['tableKind']
): Promise<PagePoolItem[]> {
  const tlabel = t.label || t.table
  const out: PagePoolItem[] = []
  try {
    const cols = (await fetchEntityColumns(app, t.table)) || []
    for (const c of cols) {
      out.push({
        code: `${t.table}.${c.name}`,
        name: c.comment || c.name,
        source: 'TABLE',
        format: columnFormat(c.type),
        table: t.table,
        tableLabel: tlabel,
        tableKind
      })
    }
  } catch {
    /* 单表列元数据取不到不阻断：跳过该表，其余表照常可用 */
  }
  return out
}

/** 根据场景当前绑定，把各表列逐项注入「数据表字段 TABLE」字段池 */
async function refreshTableFieldPool() {
  const bizType = pageTarget.value?.bizType || ''
  const app = bindingAppCode.value
  const existing = parseSceneBindings(bizType)
  const items: PagePoolItem[] = []
  if (existing?.tables?.length && app) {
    for (const t of existing.tables) {
      // 只区分主体表 / 子表：BIZ_ROW（本次单据一行）与 FK_LIST（档案多行）运行时
      // values[表名] 都是行数组，均可作表格数据源；MAIN_ROW 是单行对象，不能当表格。
      const mode = t.mode || (t.main ? 'MAIN_ROW' : 'FK_LIST')
      const kind: PagePoolItem['tableKind'] = mode === 'MAIN_ROW' ? 'MAIN' : 'SUB'
      items.push(...(await expandTableColumns(app, t, kind)))
    }
  }
  tableFieldPool.value = items
}

async function openPage(record: ApprovalTemplate) {
  pageTarget.value = record
  pageForm.view = 'APPROVAL'
  pageForm.renderMode = 'SECTIONS'
  pageForm.config = ''
  pageForm.htmlTpl = ''
  pageForm.componentKey = ''
  pageForm.routePath = ''
  try {
    const p = await requestPage(record.id)
    if (p) {
      pageForm.view = p.view || 'APPROVAL'
      pageForm.renderMode = p.renderMode || 'SECTIONS'
      pageForm.config = pretty(p.config)
      pageForm.htmlTpl = p.htmlTpl || ''
      pageForm.componentKey = p.componentKey || ''
      pageForm.routePath = p.routePath || ''
    }
  } catch (e) {
    message.error((e as Error).message)
  }
  // 数据表字段池：绑定的配置入口在「业务场景」页，这里按场景最新绑定注入候选列
  try {
    await loadScenes() // 场景绑定可能刚在别处改过，先刷一次
    await refreshTableFieldPool()
  } catch {
    /* 绑定依赖 EHR 元数据，取不到不阻断页面配置 */
  }
  pageOpen.value = true
}

async function requestPage(id: string) {
  // 复用 detail 接口拿页面配置，避免再加一个单查端点
  const d = await getTemplate(id)
  return d.page
}

function pretty(raw?: string) {
  if (!raw?.trim()) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

async function savePageCfg() {
  if (pageForm.config.trim()) {
    try {
      JSON.parse(pageForm.config)
    } catch (e) {
      message.error('版式 JSON 不合法：' + (e as Error).message)
      return
    }
  }
  if (pageForm.renderMode === 'ROUTE' && !pageForm.routePath.trim()) {
    message.warning('自定义页面路由模式需要填写页面地址')
    return
  }
  if (!pageTarget.value) return
  savingPage.value = true
  try {
    await savePage(pageTarget.value.id, {
      view: pageForm.view,
      renderMode: pageForm.renderMode,
      config: pageForm.config,
      htmlTpl: pageForm.htmlTpl,
      componentKey: pageForm.componentKey,
      routePath: pageForm.routePath.trim()
    })
    message.success('页面配置已保存')
    pageOpen.value = false
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    savingPage.value = false
  }
}

/* ---------------- 下拉数据源：业务场景 / 应用 ---------------- */

/** 业务场景下拉（bizType 从库里取；label 带业务名好认） */
const sceneOptions = computed(() =>
  scenes.value.map((s) => ({ value: s.bizType, label: `${s.bizName || s.bizType}（${s.bizType}）` }))
)

/** 应用下拉（启用中的应用，转自统一账号中心）；apps 的声明已提前到「列表」区 */
const appOptions = computed(() => apps.value.map((a) => ({ value: a.code, label: `${a.name}（${a.code}）` })))

async function loadApps() {
  try {
    apps.value = (await fetchApps()) || []
  } catch (e) {
    message.error((e as Error).message || '应用列表加载失败')
  }
}

/** 角色下拉（全量角色、不按应用过滤；label 带应用归属方便辨认） */
const roles = ref<RoleBrief[]>([])
const roleOptions = computed(() =>
  roles.value.map((r) => ({
    value: r.code,
    label: r.appCode ? `${r.name}（${r.code} · ${r.appCode}）` : `${r.name}（${r.code}）`
  }))
)

async function loadRoles() {
  try {
    roles.value = (await fetchRoles()) || []
  } catch (e) {
    message.error((e as Error).message || '角色列表加载失败')
  }
}

/* ---------------- 选组织弹窗（指定组织负责人） ---------------- */

/**
 * 组织完整层级路径太长，下拉里放不下，改成弹窗按组织树选择。
 * 只回传组织名称，保持后端 leader-by-name 契约、存量模板与在途单兼容；
 * 存量模板引用的旧组织名直接显示在这里，关闭弹窗即保留，不会被冲掉。
 */
const orgPickOpen = ref(false)
const orgPickTarget = ref<{ code?: string } | null>(null)
const orgPickCurrent = computed(() => orgPickTarget.value?.code || '')

function openOrgPicker(r: { code?: string }) {
  orgPickTarget.value = r
  orgPickOpen.value = true
}
function confirmOrg(name: string) {
  if (orgPickTarget.value) orgPickTarget.value.code = name
}
function clearOrg(r: { code?: string }) {
  delete r.code
}

/** 选了业务类型：业务名称 / 所属应用自动带出（可手改） */
function onScenePick(bizType: string) {
  const s = scenes.value.find((x) => x.bizType === bizType)
  if (s) {
    editForm.bizName = s.bizName || ''
    editForm.appCode = s.appCode || editForm.appCode
  }
}

onMounted(async () => {
  // 默认不选中任何应用：右侧展示全部模板，点左侧树才按应用过滤
  await Promise.all([loadAll(), loadApps(), loadRoles()])
})
</script>

<style scoped>
.at-root {
  height: 100%;
  background: var(--color-background-primary, #fff);
}

.at-clear {
  margin-left: 10px;
  font-size: 12px;
  font-weight: 400;
}

.at-content {
  padding: 16px;
  overflow: auto;
}

.muted {
  color: var(--muted);
}

.small {
  font-size: 12px;
}

.danger {
  color: #ff4d4f;
}

/* ---------- 编辑抽屉 ---------- */

.editor-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 12px 14px;
}

.card-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.compact :deep(.ant-form-item) {
  margin-bottom: 10px;
}

.compact :deep(.ant-form-item-label) {
  padding-bottom: 2px;
}

.compact :deep(.ant-form-item-label > label) {
  font-size: 12px;
  color: var(--muted);
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0 12px;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 12px;
}

.step-card .step-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.expr-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.expr-tip {
  font-size: 12px;
  color: #52c41a;
  margin-bottom: 6px;
}

.expr-tip.err {
  color: #ff4d4f;
}

.node-card {
  border: 1px dashed var(--panel-border);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 8px 0;
  background: rgba(127, 127, 127, 0.04);
}

.node-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.node-badge {
  font-size: 12px;
  font-weight: 600;
  color: #7c5cff;
  white-space: nowrap;
}

.branch-form {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin: 6px 0;
  border: 1px dashed var(--panel-border);
  border-radius: 6px;
  background: rgba(127, 127, 127, 0.04);
}

.rules {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.org-val {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-alert {
  margin-bottom: 12px;
}
</style>

<style scoped>
/* ---------- 选人弹窗 ---------- */
.picker {
  display: flex;
  gap: 12px;
  height: 420px;
}

.picker-left {
  width: 46%;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 8px;
  overflow: auto;
}

.picker-right {
  flex: 1;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-search {
  margin-bottom: 8px;
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.user-list {
  flex: 1;
  overflow: auto;
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.user-row:hover {
  background: rgba(124, 92, 255, 0.08);
}

.user-row.active {
  background: rgba(124, 92, 255, 0.16);
  color: #7c5cff;
}

.user-name {
  font-size: 13px;
}

.picker-tip {
  padding: 10px;
  line-height: 1.6;
}

.picker-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
