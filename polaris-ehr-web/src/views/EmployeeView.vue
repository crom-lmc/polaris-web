<template>
  <div class="page-root">
    <div class="split">
      <!-- 左：组织树（点节点筛人，角标是在职人数，含下级）。
           组织树要 org:view 权限，普通员工只有 employee:view，看不到树就整栏收起，
           右侧列表占满宽度。 -->
      <section v-if="canSeeOrgTree" class="panel org-panel">
        <div class="panel-head">
          <span>组织架构</span>
          <span class="muted">{{ orgNodeCount }} 个节点</span>
        </div>
        <div class="org-search">
          <a-input-search v-model:value="orgKeyword" placeholder="搜索组织" allow-clear size="small" />
        </div>
        <div class="panel-body tree-body">
          <a-spin :spinning="orgLoading">
            <div class="tree-all" :class="{ active: !selectedOrgId }" @click="selectOrg(null)">
              <ApartmentOutlined class="all-icon" />
              <span class="all-name">全部人员</span>
              <span class="node-count">{{ totalActive }}人</span>
            </div>
            <a-empty
              v-if="!visibleTree.length && !orgLoading"
              :description="canSeeOrgTree ? '还没有组织节点' : '无组织架构查看权限'"
              class="tree-empty"
            />
            <a-tree
              v-else
              v-model:expanded-keys="expandedKeys"
              :selected-keys="selectedKeys"
              :tree-data="visibleTree"
              block-node
              @select="onSelectOrg"
            >
              <template #title="data">
                <span class="node-title">
                  <a-tag :color="typeColor(data.raw.type)" class="node-tag">{{ data.raw.typeName }}</a-tag>
                  <span class="node-name">{{ data.raw.name }}</span>
                  <span v-if="data.count" class="node-count">{{ data.count }}人</span>
                </span>
              </template>
            </a-tree>
          </a-spin>
        </div>
      </section>

      <!-- 右：人员列表 -->
      <section class="panel list-panel">
        <div class="panel-head">
          <span class="head-left">
            <span>人员名录</span>
            <template v-if="selectedOrg">
              <a-tag color="blue" class="cur-tag">{{ selectedOrg.name }}</a-tag>
              <span class="muted">含下级</span>
            </template>
            <a v-else-if="query.orgId" class="muted reset-link" @click="selectOrg(null)">清除筛选</a>
          </span>
          <span class="muted">共 {{ total }} 人 · 新增人员时同步开通账号</span>
        </div>

        <div class="list-toolbar">
          <a-input-search
            v-model:value="query.keyword"
            placeholder="姓名 / 工号 / 职位 / 手机"
            allow-clear
            style="width: 220px"
            @search="reload"
          />
          <a-select
            v-model:value="query.status"
            :options="statusOptions"
            placeholder="状态"
            allow-clear
            style="width: 110px"
            @change="reload"
          />
          <a-button @click="refreshAll">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
          <span class="spacer" />
          <a-button v-if="canCreate" type="primary" @click="openCreate">
            <template #icon><user-add-outlined /></template>
            新增人员
          </a-button>
        </div>

        <div class="panel-body table-body">
          <a-table
            class="emp-table"
            :columns="columns"
            :data-source="rows"
            :loading="loading"
            row-key="id"
            size="middle"
            :pagination="pagination"
            @change="onTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="emp-name">
                  <a-tooltip :title="record.name">
                    <span class="emp-name-text">{{ record.name }}</span>
                  </a-tooltip>
                </div>
                <div class="muted cell-sub">{{ record.empNo }}</div>
              </template>
              <template v-else-if="column.key === 'gender'">
                {{ genderText(record.gender) }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="statusColor(record.status)">
                  {{ statusLabel(record.status, record.statusName) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'birthday'">
                {{ record.birthday || '—' }}
                <span v-if="record.age != null" class="muted">（{{ record.age }} 岁）</span>
              </template>
              <template v-else-if="column.key === 'position'">
                <span v-if="record.position" class="position">{{ record.position }}</span>
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'org'">
                <a-tooltip :title="record.orgPathName">
                  <span class="ellipsis">{{ record.orgName || '—' }}</span>
                </a-tooltip>
              </template>
              <template v-else-if="column.key === 'account'">
                <span v-if="record.accountUsername" class="account-cell">
                  <a-tag color="green">已开户</a-tag>
                  <span class="muted">{{ record.accountUsername }}</span>
                </span>
                <a-tag v-else color="orange">未开户</a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small" wrap>
                  <a @click="openProfile(record)">查看</a>
                  <!-- 只有「待入职」是编辑档案；试用期/在职走「变更」，只能改个人信息 -->
                  <a v-if="canEdit && canEditRecord(record)" @click="openEdit(record)">
                    {{ record.status === 10 ? '编辑' : '变更' }}
                  </a>
                  <a-popconfirm
                    v-if="canEdit && record.status === 10"
                    title="提交后交由审批中心按「入职审批流程」审批，终审通过时自动开通统一账号。确定提交？"
                    ok-text="提交"
                    cancel-text="取消"
                    @confirm="doSubmitDraft(record)"
                  >
                    <a>提交入职</a>
                  </a-popconfirm>
                  <a-popconfirm
                    v-if="canEdit && record.status === 25"
                    :title="record.exemptProbation ? '该员工免试用期，办理入职后直接成为正式员工，确定办理入职？' : '办理入职后该员工进入试用期，确定办理入职？'"
                    ok-text="办理入职"
                    cancel-text="取消"
                    @confirm="doOnboard(record)"
                  >
                    <a>入职</a>
                  </a-popconfirm>
                  <a v-if="canApplyRegularize(record)" @click="openRegularizeForm(record)">
                    申请转正
                  </a>
                  <!-- 通过/驳回/转办/加签统一在审批中心；审批完成后不再展示详情入口 -->
                  <a
                    v-if="runningBriefForRow(record)"
                    @click="openApprovalDetail(runningBriefForRow(record)!.id)"
                  >
                    审批详情
                  </a>
                  <a
                    v-else-if="rejectedBriefForRow(record)"
                    @click="openApprovalDetail(rejectedBriefForRow(record)!.id)"
                  >
                    审批信息
                  </a>
                  <a v-if="canResign && isWorking(record.status)" @click="openResign(record)">减员</a>
                  <a-popconfirm
                    v-if="canResign && record.status === 55"
                    title="关闭后档案置为「已离职」并停用统一账号，操作不可撤销，确定关闭账号？"
                    ok-text="关闭账号"
                    cancel-text="取消"
                    @confirm="doCloseAccount(record)"
                  >
                    <a class="danger">关闭账号</a>
                  </a-popconfirm>
                  <a v-if="canResign && record.status === 60" @click="openReinstate(record)">复职</a>
                  <a-popconfirm
                    v-if="canDelete && record.status === 10"
                    title="仅「待入职」草稿可删除；提交入职后请走减员流程。删除后档案不可恢复，确定删除？"
                    ok-text="删除"
                    cancel-text="取消"
                    @confirm="doDelete(record)"
                  >
                    <a class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </div>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :confirm-loading="saving"
      :ok-text="modalOkText"
      cancel-text="取消"
      width="880px"
      centered
      destroy-on-close
      @ok="submit"
    >
      <a-tabs v-model:active-key="formTab" class="emp-form-tabs">
        <a-tab-pane key="base" tab="基本信息">
      <a-alert
        v-if="personalOnly"
        type="info"
        show-icon
        class="mb12"
        message="变更员工信息：提交后统一进审批，通过后生效"
        description="可改：手机号、婚姻状况、政治面貌、最高学历、现居住址、紧急联系人及电话，以及银行卡、教育背景、工作经历、家庭成员（子表修改先暂存本页，随「提交变更」一并进审批）。姓名、所属组织、职位、入职日期、身份证如需调整，请走人事异动。"
      />
      <a-form layout="vertical">
        <div v-if="!personalOnly" class="form-hint">
          标 <span class="req-star">*</span> 的项为「提交入职」的前置条件（工号、邮箱由系统生成，备注选填）；提交入职还要求
          银行卡、教育背景、工作经历、家庭成员各至少 1 条。
        </div>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="工号">
              <a-input v-model:value="form.empNo" disabled placeholder="系统自动生成" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="姓名" required>
              <a-input v-model:value="form.name" :maxlength="64" :disabled="personalOnly" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="所属组织" required>
              <a-input
                :value="formOrgLabel"
                readonly
                :disabled="personalOnly"
                placeholder="点击选择组织节点"
                class="org-pick-input"
                @click="!personalOnly && openOrgPicker()"
              >
                <template #suffix>
                  <CloseCircleFilled v-if="form.orgId && !personalOnly" class="org-clear" @click.stop="clearOrgPick" />
                  <ApartmentOutlined v-else />
                </template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="职位" required>
              <a-select
                v-model:value="form.position"
                :options="positionGroups"
                placeholder="选择职位（按职务族分组，等级即晋升路线）"
                show-search
                option-filter-prop="label"
                allow-clear
                :disabled="personalOnly"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item
              label="手机号"
              required
              :validate-status="mobileStatus.status"
              :help="mobileStatus.help"
            >
              <a-input v-model:value="form.mobile" :maxlength="11" placeholder="11 位手机号" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="邮箱">
              <a-input v-model:value="form.email" disabled placeholder="系统自动生成" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="性别" required>
              <a-select v-model:value="form.gender" :options="genderOptions" placeholder="选择性别" allow-clear :disabled="personalOnly" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="入职日期" required>
              <a-date-picker
                v-model:value="form.hireDate"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                :disabled="personalOnly"
                :disabled-date="(d: any) => !!d && d < dayjs().startOf('day')"
                placeholder="不能早于今天"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="试用期时长（月）" :required="!form.exemptProbation">
              <a-input-number
                v-model:value="form.probationMonths"
                :min="1"
                :max="12"
                :precision="0"
                style="width: 100%"
                :disabled="personalOnly || form.exemptProbation"
                :placeholder="form.exemptProbation ? '免试用期，无需填写' : '1-12 个月'"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="免试用期">
              <a-checkbox v-model:checked="form.exemptProbation" :disabled="personalOnly">
                免试用期（入职后直接为正式员工）
              </a-checkbox>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="预计转正时间">
              <a-input :value="expectedRegularizeText" disabled placeholder="按入职日期自动计算" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label=" ">
              <span class="probation-hint">转正时间 = 入职日期 + 试用期时长</span>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item
              label="身份证号"
              required
              :validate-status="idCardStatus.status"
              :help="idCardStatus.help"
            >
              <a-input v-model:value="form.idCard" :maxlength="18" placeholder="身份证号" :disabled="personalOnly" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="出生日期" required>
              <a-date-picker
                v-model:value="form.birthday"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                :disabled="personalOnly"
                :disabled-date="(d: any) => d && d > new Date()"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="民族" required>
              <a-select
                v-model:value="form.nation"
                :options="dicts.nation"
                placeholder="选择民族"
                show-search
                option-filter-prop="label"
                allow-clear
                :disabled="personalOnly"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="婚姻状况" required>
              <a-select v-model:value="form.maritalStatus" :options="dicts.marital" placeholder="选择" allow-clear />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="籍贯-省">
              <a-select
                v-model:value="form.nativeProvince"
                :options="provinceOptions"
                placeholder="自动带出"
                :disabled="true"
                show-search
                option-filter-prop="label"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="籍贯-市">
              <a-input v-model:value="form.nativeCity" :disabled="true" placeholder="自动带出" :maxlength="32" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="籍贯-区（县）">
              <a-input v-model:value="form.nativeDistrict" :disabled="true" placeholder="自动带出" :maxlength="32" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="籍贯-详细地址" required>
              <a-input v-model:value="form.nativeDetail" :maxlength="128" placeholder="乡镇/街道/门牌" :disabled="personalOnly" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="政治面貌" required>
              <a-select v-model:value="form.politicalStatus" :options="dicts.political" placeholder="选择" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="最高学历" required>
              <a-select v-model:value="form.education" :options="dicts.education" placeholder="选择" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="紧急联系人" required>
              <a-input v-model:value="form.emergencyContact" :maxlength="64" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item
              label="紧急联系电话"
              required
              :validate-status="emergencyPhoneStatus.status"
              :help="emergencyPhoneStatus.help"
            >
              <a-input v-model:value="form.emergencyPhone" :maxlength="11" placeholder="11 位手机号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="现居住址" required>
          <a-input v-model:value="form.currentAddress" :maxlength="255" />
        </a-form-item>

        <template v-if="!editing">
          <a-form-item class="mt12">
            <a-alert
              type="info"
              show-icon
              message="保存后为「待入职」草稿，此时不开通账号"
              description="在列表里点「提交入职」，由审批中心按「入职审批流程」模板审批；终审通过后状态为「入职审批通过」并自动开通统一账号（默认授权 统一账号中心 / 内容门户 / 人力中心，初始密码由系统生成），再由 HR 点「入职」转入试用期（免试用期则直接成为正式员工）。"
            />
          </a-form-item>
        </template>

        <a-form-item label="备注" class="mt12">
          <a-textarea v-model:value="form.remark" :rows="2" :maxlength="255" :disabled="personalOnly" />
        </a-form-item>
      </a-form>
        </a-tab-pane>

        <!-- 银行卡 -->
        <a-tab-pane key="banks" :tab="`银行卡（${bankRows.length}）`">
          <div class="sub-toolbar">
            <span class="muted">「工资卡」用于发薪，每人至多一张{{ editing ? '' : '，保存人员时一并提交' }}</span>
            <a-button size="small" type="primary" @click="openBankModal()">新增银行卡</a-button>
          </div>
          <a-table :columns="bankCols" :data-source="bankRows" row-key="_key" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'bank'">{{ optLabel(dicts.bank, record.bank) }}</template>
              <template v-else-if="column.key === 'accountNo'">
                <span class="mono">{{ record.accountNo }}</span>
              </template>
              <template v-else-if="column.key === 'isPrimary'">
                <a-tag v-if="record.isPrimary === 1" color="gold">工资卡</a-tag>
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a @click="openBankModal(record)">编辑</a>
                  <a-popconfirm title="确定删除这张卡？" ok-text="删除" cancel-text="取消" @confirm="removeSub('bank', record)">
                    <a class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 教育背景 -->
        <a-tab-pane key="educations" :tab="`教育背景（${eduRows.length}）`">
          <div class="sub-toolbar">
            <span class="muted">从高中/中专起可逐段录入{{ editing ? '' : '，保存人员时一并提交' }}</span>
            <a-button size="small" type="primary" @click="openEduModal()">新增教育经历</a-button>
          </div>
          <a-table :columns="eduCols" :data-source="eduRows" row-key="_key" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'school'">
                <b>{{ record.school }}</b>
                <div v-if="record.major" class="muted">{{ record.major }}</div>
              </template>
              <template v-else-if="column.key === 'degree'">{{ optLabel(dicts.education, record.degree) }}</template>
              <template v-else-if="column.key === 'range'">
                {{ record.startDate || '—' }} ~ {{ record.endDate || '至今' }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a @click="openEduModal(record)">编辑</a>
                  <a-popconfirm title="确定删除这段教育经历？" ok-text="删除" cancel-text="取消" @confirm="removeSub('edu', record)">
                    <a class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 工作经历 -->
        <a-tab-pane key="works" :tab="`工作经历（${workRows.length}）`">
          <div class="sub-toolbar">
            <span class="muted">入职本公司前的工作记录{{ editing ? '' : '，保存人员时一并提交' }}</span>
            <a-button size="small" type="primary" @click="openWorkModal()">新增工作经历</a-button>
          </div>
          <a-table :columns="workCols" :data-source="workRows" row-key="_key" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'company'">
                <b>{{ record.company }}</b>
                <div v-if="record.position" class="muted">{{ record.position }}</div>
              </template>
              <template v-else-if="column.key === 'range'">
                {{ record.startDate || '—' }} ~ {{ record.endDate || '至今' }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a @click="openWorkModal(record)">编辑</a>
                  <a-popconfirm title="确定删除这段工作经历？" ok-text="删除" cancel-text="取消" @confirm="removeSub('work', record)">
                    <a class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 家庭成员 -->
        <a-tab-pane key="families" :tab="`家庭成员（${familyRows.length}）`">
          <div class="sub-toolbar">
            <span class="muted">用于紧急联系与福利场景{{ editing ? '' : '，保存人员时一并提交' }}</span>
            <a-button size="small" type="primary" @click="openFamilyModal()">新增家庭成员</a-button>
          </div>
          <a-table :columns="familyCols" :data-source="familyRows" row-key="_key" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'relation'">{{ optLabel(dicts.familyRelation, record.relation) }}</template>
              <template v-else-if="column.key === 'name'"><b>{{ record.name }}</b></template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a @click="openFamilyModal(record)">编辑</a>
                  <a-popconfirm title="确定删除该成员？" ok-text="删除" cancel-text="取消" @confirm="removeSub('family', record)">
                    <a class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-modal>

    <!-- 银行卡编辑（弹窗内） -->
    <a-modal
      v-model:open="bankModalOpen"
      :title="bankEditKey ? '编辑银行卡' : '新增银行卡'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="bankSaving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitBankModal"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="银行" required>
              <a-select v-model:value="bankForm.bank" :options="dicts.bank" placeholder="选择银行" show-search option-filter-prop="label" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="是否工资卡">
              <a-switch v-model:checked="bankForm.isPrimary" checked-children="工资卡" un-checked-children="普通" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="卡号" required>
              <a-input v-model:value="bankForm.accountNo" :maxlength="32" placeholder="8-32 位数字" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="持卡人" required>
              <a-input v-model:value="bankForm.holderName" :maxlength="64" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="开户行/支行">
          <a-input v-model:value="bankForm.branch" :maxlength="128" placeholder="如 工行西安高新支行" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="bankForm.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 教育背景编辑（弹窗内） -->
    <a-modal
      v-model:open="eduModalOpen"
      :title="eduEditKey ? '编辑教育经历' : '新增教育经历'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="eduSaving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitEduModal"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="学校" required>
              <a-input v-model:value="eduForm.school" :maxlength="128" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="专业">
              <a-input v-model:value="eduForm.major" :maxlength="128" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="学历" required>
              <a-select v-model:value="eduForm.degree" :options="dicts.education" placeholder="选择学历" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="起止时间">
              <a-range-picker v-model:value="eduForm.range" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-input v-model:value="eduForm.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 工作经历编辑（弹窗内） -->
    <a-modal
      v-model:open="workModalOpen"
      :title="workEditKey ? '编辑工作经历' : '新增工作经历'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="workSaving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitWorkModal"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="工作单位" required>
              <a-input v-model:value="workForm.company" :maxlength="128" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="职位">
              <a-input v-model:value="workForm.position" :maxlength="64" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="起止时间">
          <a-range-picker v-model:value="workForm.range" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item label="离职原因">
          <a-input v-model:value="workForm.leaveReason" :maxlength="255" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="workForm.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 家庭成员编辑（弹窗内） -->
    <a-modal
      v-model:open="familyModalOpen"
      :title="familyEditKey ? '编辑家庭成员' : '新增家庭成员'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="familySaving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitFamilyModal"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="关系" required>
              <a-select v-model:value="familyForm.relation" :options="dicts.familyRelation" placeholder="选择关系" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="姓名" required>
              <a-input v-model:value="familyForm.name" :maxlength="64" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="工作单位">
              <a-input v-model:value="familyForm.company" :maxlength="128" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系电话" :validate-status="familyPhoneStatus.status" :help="familyPhoneStatus.help">
              <a-input v-model:value="familyForm.phone" :maxlength="11" placeholder="11 位手机号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-input v-model:value="familyForm.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 组织选择弹窗：点节点即回填并关闭 -->
    <a-modal
      v-model:open="orgPickerOpen"
      title="选择所属组织"
      :width="440"
      :footer="null"
      centered
    >
      <div class="org-picker-tree">
        <a-tree
          :tree-data="orgSelectData"
          :selected-keys="pendingPickId ? [pendingPickId] : []"
          :expanded-keys="pickerExpanded"
          block-node
          @expand="(keys: any) => (pickerExpanded = keys)"
          @select="onPickOrg"
        />
      </div>
    </a-modal>

    <a-modal
      v-model:open="resultOpen"
      title="账号已开通"
      :footer="null"
      width="520px"
      centered
    >
      <a-result
        v-if="accountResult"
        status="success"
        :title="accountResult.created ? '人员已创建，账号已开通' : '人员已创建，已复用已有账号'"
        :sub-title="accountResult.created
          ? '初始密码只显示这一次，请立即转交给员工'
          : '该邮箱/登录名已存在账号，本次只补齐了应用与角色授权'"
      >
        <template #extra>
          <a-descriptions :column="1" size="small" bordered class="result-desc">
            <a-descriptions-item label="登录名">
              <b>{{ accountResult.username }}</b>
            </a-descriptions-item>
            <a-descriptions-item v-if="accountResult.initialPassword" label="初始密码">
              <span class="pwd">{{ accountResult.initialPassword }}</span>
              <a class="ml8" @click="copyPwd">复制</a>
            </a-descriptions-item>
            <a-descriptions-item label="已开通应用">
              <a-tag v-for="a in accountResult.apps" :key="a" color="blue">{{ appName(a) }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="已授予角色">
              <a-tag v-for="r in accountResult.roles" :key="r" color="green">{{ roleName(r) }}</a-tag>
            </a-descriptions-item>
          </a-descriptions>
          <a-button type="primary" class="mt12" @click="resultOpen = false">知道了</a-button>
        </template>
      </a-result>
    </a-modal>

    <!-- 减员申请（走审批） -->
    <a-modal
      v-model:open="resignOpen"
      title="提交减员申请"
      ok-text="提交申请"
      cancel-text="取消"
      :confirm-loading="resignSaving"
      width="640px"
      centered
      destroy-on-close
      @ok="submitResign"
    >
      <a-alert
        type="warning"
        show-icon
        class="mb12"
        message="减员需要审批，提交后不会立即生效"
        description="流程：交接人逐项确认交接 → 该员工所在部门负责人审批 → 集团人力资源中心负责人终审；两级都通过后档案才置为离职并停用统一账号。"
      />
      <a-form layout="vertical">
        <div class="target-bar">
          <span class="tb-name">{{ resignTarget?.name }}</span>
          <span class="tb-meta">{{ resignTarget?.empNo }} · {{ resignTarget?.orgPathName }}</span>
        </div>
        <a-form-item label="拟离职日期" required>
          <a-date-picker v-model:value="resignForm.resignDate" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item label="减员原因" required>
          <a-select
            v-model:value="resignForm.reason"
            :options="resignReasonOptions"
            placeholder="选择减员原因"
            show-search
            option-filter-prop="label"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="交接说明（可选）">
          <a-input v-model:value="resignForm.handover" :maxlength="255" placeholder="整体交代，例如交接周期、注意事项" />
        </a-form-item>
        <handover-editor
          v-model:confirmer="resignForm.handoverEmployeeId"
          v-model:items="resignForm.items"
          v-model:no-handover="resignForm.noHandover"
          :employees="handoverCandidates"
          :exclude-id="resignTarget?.id"
        />
      </a-form>
    </a-modal>

    <!-- 转正申请（走审批） -->
    <a-modal
      v-model:open="regularizeOpen"
      title="提交转正申请"
      ok-text="提交申请"
      cancel-text="取消"
      :confirm-loading="regularizeSaving"
      width="640px"
      centered
      destroy-on-close
      wrap-class-name="regularize-modal-wrap"
      :body-style="{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }"
      @ok="submitRegularize"
    >
      <a-alert
        type="warning"
        show-icon
        class="mb12"
        message="转正需要审批，提交后不会立即生效"
        description="流程：本部门负责人审批 → 人事主管审批；两级都通过后档案才转为正式在职。"
      />
      <a-form layout="vertical">
        <div class="target-bar">
          <span class="tb-name">{{ regularizeTarget?.name }}</span>
          <span class="tb-meta">{{ regularizeTarget?.empNo }} · {{ regularizeTarget?.orgPathName }}</span>
        </div>
        <a-form-item label="申请转正日期">
          <a-date-picker v-model:value="regularizeForm.regularizeDate" value-format="YYYY-MM-DD" style="width: 100%" />
          <div class="probation-hint" v-if="regularizeTarget?.expectedRegularizeDate">
            预计转正时间：{{ regularizeTarget.expectedRegularizeDate }}（入职日期 + 试用期时长）
          </div>
        </a-form-item>
        <a-form-item label="试用期工作自评">
          <a-textarea
            v-model:value="regularizeForm.selfReview"
            :maxlength="500"
            :rows="2"
            show-count
            placeholder="试用期内承担了哪些工作、熟悉程度如何"
          />
        </a-form-item>
        <a-form-item label="试用期工作业绩与成果">
          <a-textarea
            v-model:value="regularizeForm.workSummary"
            :maxlength="1000"
            :rows="3"
            show-count
            placeholder="完成的主要任务、达成的指标、可量化的成果"
          />
        </a-form-item>
        <a-form-item label="转正申请理由">
          <a-textarea
            v-model:value="regularizeForm.reason"
            :maxlength="500"
            :rows="2"
            show-count
            placeholder="为什么认为自己已经具备转正条件"
          />
        </a-form-item>
        <a-form-item label="转正后的工作目标与计划（可选）">
          <a-textarea
            v-model:value="regularizeForm.nextPlan"
            :maxlength="1000"
            :rows="2"
            show-count
            placeholder="转正后想承担什么、下一阶段的目标"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 复职申请（走审批） -->
    <a-modal
      v-model:open="reinstateOpen"
      title="提交复职申请"
      ok-text="提交申请"
      cancel-text="取消"
      :confirm-loading="reinstateSaving"
      width="560px"
      centered
      destroy-on-close
      @ok="submitReinstate"
    >
      <a-alert
        type="warning"
        show-icon
        class="mb12"
        message="复职需要审批，提交后不会立即生效"
        description="流程：用人部门负责人审批 → 集团人力资源中心终审；两级都通过后档案恢复在职，并按需启用统一账号。"
      />
      <a-form layout="vertical">
        <div class="target-bar">
          <span class="tb-name">{{ reinstateTarget?.name }}</span>
          <span class="tb-meta">
            {{ reinstateTarget?.empNo }} · {{ reinstateTarget?.resignDate }} 离职
          </span>
        </div>
        <a-form-item label="拟复职日期" required>
          <a-date-picker v-model:value="reinstateForm.rehireDate" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item label="复职原因">
          <a-textarea v-model:value="reinstateForm.reason" :rows="2" :maxlength="120" placeholder="选填，例如：业务需要返聘、原岗位空缺" />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="reinstateForm.enableAccount" :disabled="!reinstateTarget?.accountId">
            复职后同时启用统一账号（{{ reinstateTarget?.accountUsername || '未开户' }}）
          </a-checkbox>
          <div class="muted hint-line">启用后员工可重新登录各系统，原有角色与权限沿用。</div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 人员档案查看抽屉（基本信息 + 银行卡/教育/工作/家庭成员） -->
    <employee-profile-drawer
      v-model:open="profileOpen"
      :employee-id="profileId"
      :can-edit="false"
    />

    <!-- 在途审批详情：流程进度 / 审批人 / 意见 / 我的处理，全部来自审批中心 -->
    <approval-detail-drawer
      v-model:open="approvalDrawerOpen"
      :instance-id="approvalInstanceId"
      @done="refreshAll"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { ApartmentOutlined, CloseCircleFilled, ReloadOutlined, UserAddOutlined } from '@ant-design/icons-vue'
import HandoverEditor from '@/components/HandoverEditor.vue'
import EmployeeProfileDrawer from '@/components/EmployeeProfileDrawer.vue'
import {
  addBank,
  addEducation,
  addFamily,
  addWork,
  createEmployee,
  deleteBank,
  deleteEducation,
  deleteEmployee,
  deleteFamily,
  deleteWork,
  bizOptions,
  closeAccountEmployee,
  dictOptions,
  employeeProfile,
  onboardEmployee,
  orgTree,
  pageEmployees,
  reduceEmployee,
  regularizeApply,
  submitDraft,
  submitEmpChange,
  submitRehireApply,
  updateBank,
  updateEducation,
  updateEmployee,
  updateFamily,
  updateWork,
  type AccountBrief,
  type BankBody,
  type DictOption,
  type EducationBody,
  type EmpChangeBody,
  type EmployeeItem,
  type FamilyBody,
  type OrgNode,
  type WorkBody
} from '@/api/ehr'
import { useUserStore } from '@/stores/user'
import { provinces, regionFromIdCard } from '@/utils/region-data'
import {
  STATUS_OPTIONS,
  isWorking,
  statusColor,
  statusLabel
} from '@/constants/employeeStatus'
import ApprovalDetailDrawer from '@/components/ApprovalDetailDrawer.vue'
import {
  briefsForRow,
  buildBizRefs,
  buildSubjectBizRefs,
  fetchLatestApprovals,
  runningBriefOf,
  rejectedBriefOf,
  type ApprovalBrief
} from '@/api/approvals'
import dayjs from 'dayjs'

const store = useUserStore()
const canCreate = computed(() => store.can('employee:create'))
const canEdit = computed(() => store.can('employee:edit'))
const canDelete = computed(() => store.can('employee:delete'))
const canResign = computed(() => store.can('employee:resign'))
/** 组织树要 org:view；普通员工没有，左侧只能空着 */
const canSeeOrgTree = computed(() => store.can('org:view'))

/** 可编辑的状态：待入职(10) 全量编辑；试用期(30)/在职(40) 只改个人信息；20/50/60 禁止编辑 */
function canEditRecord(r: EmployeeItem) {
  return r.status === 10 || isWorking(r.status)
}

/** 编辑中的档案是否处于「仅个人信息」模式 */
const personalOnly = computed(() => !!editing.value && isWorking(editing.value.status))

interface OrgSelectItem {
  key: string
  value: string
  title: string
  children?: OrgSelectItem[]
}

/** 左侧树节点：count = 本节点在职人数 + 所有下级在职人数 */
interface OrgTreeItem {
  key: string
  raw: OrgNode
  count: number
  children?: OrgTreeItem[]
}

const orgSelectData = ref<OrgSelectItem[]>([])
const treeItems = ref<OrgTreeItem[]>([])
const flatOrgs = ref<OrgNode[]>([])
const orgLoading = ref(false)
const orgKeyword = ref('')
const selectedOrgId = ref('')
const expandedKeys = ref<string[]>([])

const selectedKeys = computed(() => (selectedOrgId.value ? [selectedOrgId.value] : []))
const selectedOrg = computed(() => flatOrgs.value.find((n) => n.id === selectedOrgId.value) || null)
const orgNodeCount = computed(() => flatOrgs.value.length)
/** 全公司在职人数（根节点累计值相加，与树上角标同一口径） */
const totalActive = computed(() => treeItems.value.reduce((s, i) => s + i.count, 0))

function toSelect(list: OrgNode[]): OrgSelectItem[] {
  return list.map((n) => ({
    key: n.id,
    value: n.id,
    title: `${n.name}（${n.typeName}）`,
    children: n.children && n.children.length ? toSelect(n.children) : undefined
  }))
}

/* ---------- 所属组织：弹窗选择，点节点即回填 ---------- */
const orgPickerOpen = ref(false)
const pickerExpanded = ref<string[]>([])
const pendingPickId = ref('')

/** 回填到输入框的展示文案：节点名（类型），找不到时兜底显示 id */
const formOrgLabel = computed(() => {
  if (!form.orgId) return ''
  const n = flatOrgs.value.find((x) => x.id === form.orgId)
  return n ? `${n.name}（${n.typeName}）` : String(form.orgId)
})

function openOrgPicker() {
  pendingPickId.value = form.orgId || ''
  // 打开弹窗时展开全部组织节点，方便直接浏览与定位（与组织管理页一致）
  pickerExpanded.value = flatOrgs.value.map((n) => n.id)
  orgPickerOpen.value = true
}

function onPickOrg(_keys: (string | number)[], e: { selected: boolean; node: { value?: string; key?: string | number } }) {
  if (!e.selected) return
  const id = String(e.node.value ?? e.node.key)
  pendingPickId.value = id
  form.orgId = id
  orgPickerOpen.value = false
}

function clearOrgPick() {
  form.orgId = undefined
  pendingPickId.value = ''
}

function toTree(list: OrgNode[]): OrgTreeItem[] {
  return list.map((n) => {
    const children = n.children && n.children.length ? toTree(n.children) : undefined
    const childSum = children ? children.reduce((s, c) => s + c.count, 0) : 0
    return { key: n.id, raw: n, count: (n.employeeCount || 0) + childSum, children }
  })
}

function walkOrgs(list: OrgNode[], out: OrgNode[]) {
  for (const n of list) {
    out.push(n)
    if (n.children && n.children.length) walkOrgs(n.children, out)
  }
}

/** 名称/编码/负责人命中即保留，并保留命中节点的祖先链 */
function filterTree(items: OrgTreeItem[], kw: string): OrgTreeItem[] {
  const key = kw.trim().toLowerCase()
  if (!key) return items
  const out: OrgTreeItem[] = []
  for (const it of items) {
    const self =
      (it.raw.name || '').toLowerCase().includes(key) ||
      (it.raw.code || '').toLowerCase().includes(key) ||
      (it.raw.leader || '').toLowerCase().includes(key)
    const kids = it.children ? filterTree(it.children, key) : []
    if (self || kids.length) out.push({ ...it, children: kids.length ? kids : it.children })
  }
  return out
}

const visibleTree = computed(() => filterTree(treeItems.value, orgKeyword.value))

watch(orgKeyword, () => {
  const ids: string[] = []
  const walk = (list: OrgTreeItem[]) => {
    for (const n of list) {
      ids.push(n.key)
      if (n.children) walk(n.children)
    }
  }
  walk(visibleTree.value)
  expandedKeys.value = ids
})

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

const rows = ref<EmployeeItem[]>([])

/**
 * 当前页各业务最新的审批单：业务表单值实例号已退役，「审批中 / 被驳回」
 * 一律按审批中心的真实状态反查，取最近终审的一张展示。
 *
 * 两类反查口径（appr_instance 有 subject_id + biz_id_kind 双键）：
 *  - SUBJECT：入职 / 信息变更，bizId 就是员工 ID，按 (bizType, bizId) 精确匹配；
 *  - DOC：转正 / 请假 / 减员 / 离职 / 复职，一个员工会发多张申请单，
 *    列表只有员工 ID，必须按 subject_id 反查（后端把 bizId 改写回员工 ID 供按行归类）。
 */
const approvalBriefs = ref<ApprovalBrief[]>([])
/** bizId 就是员工 ID 的业务 */
const SUBJECT_BIZ_TYPES = ['ehr.onboard', 'ehr.emp_update']
/** bizId 是申请单 ID、需按员工主体反查的业务（含转正，修复「人员列表看不到转正单」） */
const DOC_LINKED_BIZ_TYPES = ['ehr.regularize', 'ehr.reduce', 'ehr.resign', 'ehr.rehire']

async function loadApprovalBriefs(list: EmployeeItem[]) {
  const ids = list.map((r) => r.id)
  const refs = [
    ...buildBizRefs(ids, SUBJECT_BIZ_TYPES),
    ...buildSubjectBizRefs(ids, DOC_LINKED_BIZ_TYPES)
  ]
  // 审批中心偶发不可用时静默降级：不能因为提示查不到就让整个人员列表加载失败
  approvalBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
}

/** 只有审批中心里确实在途的单才算「审批中」 */
function runningBriefForRow(r: EmployeeItem) {
  return runningBriefOf(briefsForRow(approvalBriefs.value, r.id))
}

/** 审批完成后不再给详情入口，只有被驳回时需要查看驳回意见 */
function rejectedBriefForRow(r: EmployeeItem) {
  return rejectedBriefOf(briefsForRow(approvalBriefs.value, r.id))
}
const total = ref(0)
const loading = ref(false)
const query = reactive<{ keyword: string; orgId?: string; status?: number; page: number; size: number }>({
  keyword: '',
  orgId: undefined,
  status: undefined,
  page: 1,
  size: 10
})

const pagination = computed(() => ({
  current: query.page,
  pageSize: query.size,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

const columns = computed(() => {
  const cols: any[] = [
    { title: '姓名 / 工号', key: 'name', width: 150 },
    { title: '性别', key: 'gender', width: 64 },
    { title: '状态', key: 'status', width: 116 },
    { title: '职位', key: 'position', width: 160 },
    { title: '手机号', dataIndex: 'mobile', key: 'mobile', width: 120 },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
    { title: '身份证号', dataIndex: 'idCard', key: 'idCard', width: 180 },
    { title: '出生日期', key: 'birthday', width: 140 },
    { title: '民族', dataIndex: 'nationName', key: 'nationName', width: 80 },
    { title: '籍贯', dataIndex: 'nativePlace', key: 'nativePlace', width: 160, ellipsis: true },
    { title: '婚姻状况', dataIndex: 'maritalStatusName', key: 'maritalStatusName', width: 90 },
    { title: '政治面貌', dataIndex: 'politicalStatusName', key: 'politicalStatusName', width: 110 },
    { title: '最高学历', dataIndex: 'educationName', key: 'educationName', width: 90 },
    { title: '入职日期', dataIndex: 'hireDate', key: 'hireDate', width: 104 },
    { title: '现居住址', dataIndex: 'currentAddress', key: 'currentAddress', width: 200, ellipsis: true },
    { title: '紧急联系人', dataIndex: 'emergencyContact', key: 'emergencyContact', width: 100 },
    { title: '紧急电话', dataIndex: 'emergencyPhone', key: 'emergencyPhone', width: 120 },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 160, ellipsis: true }
  ]
  // 已经按组织筛选时，右侧每一行都是同一个组织，这一列没有信息量
  if (!selectedOrgId.value) cols.splice(4, 0, { title: '所属组织', key: 'org', width: 200, ellipsis: true })
  cols.push(
    { title: '登录账号', key: 'account', width: 130 },
    { title: '离职日期', dataIndex: 'resignDate', key: 'resignDate', width: 110 },
    // 操作列：横向滚动时始终贴住右边（改用 CSS sticky，见 .emp-table 样式）
    { title: '操作', key: 'action', width: 240 }
  )
  return cols
})

async function loadOrgs(keepSelection = true) {
  orgLoading.value = true
  try {
    const tree = await orgTree() || []
    treeItems.value = toTree(tree)
    orgSelectData.value = toSelect(tree)
    flatOrgs.value = []
    walkOrgs(tree, flatOrgs.value)
    expandedKeys.value = flatOrgs.value.map((n) => n.id)
    if (!keepSelection || !flatOrgs.value.some((n) => n.id === selectedOrgId.value)) {
      // 选中的节点被删掉了（或首次加载）：退回「全部人员」
      if (selectedOrgId.value) selectOrg(null)
    }
  } catch {
    // 组织树要 org:view 权限，普通员工只有 employee:view。
    // 拉不到树不该连带把右侧人员列表也拖垮——左侧空树、右侧照常列全部人员。
    treeItems.value = []
    orgSelectData.value = []
    flatOrgs.value = []
    expandedKeys.value = []
    if (selectedOrgId.value) {
      selectedOrgId.value = ''
      query.orgId = undefined
    }
  } finally {
    orgLoading.value = false
  }
}

/** 点组织树节点 → 右侧按该节点（含下级）筛人 */
function selectOrg(id: string | null) {
  selectedOrgId.value = id || ''
  query.orgId = id || undefined
  query.page = 1
  loadEmployees()
}

function onSelectOrg(keys: (string | number)[]) {
  // 再次点击已选节点时 antd 会传空数组，这里不当作「清除」
  if (!keys.length) return
  selectOrg(String(keys[0]))
}

async function refreshAll() {
  await loadOrgs()
  await loadEmployees()
}

async function loadEmployees() {
  loading.value = true
  try {
    const data = await pageEmployees({
      page: query.page,
      size: query.size,
      keyword: query.keyword || undefined,
      orgId: query.orgId || undefined,
      status: query.status
    })
    rows.value = data.list || []
    total.value = data.total || 0
    void loadApprovalBriefs(rows.value)
  } finally {
    loading.value = false
  }
}

function reload() {
  query.page = 1
  loadEmployees()
}

function onTableChange(p: any) {
  query.page = p.current
  query.size = p.pageSize
  loadEmployees()
}

/* ---------- 表单 ---------- */
const modalOpen = ref(false)
const editing = ref<EmployeeItem | null>(null)
/** 待入职 = 编辑档案；试用期/在职 = 变更个人信息 */
const modalTitle = computed(() => {
  if (!editing.value) return '新增人员'
  return personalOnly.value ? '变更员工信息' : '编辑人员'
})
/** 试用期/在职的「变更」是提交审批单，不是直接落库，按钮文案要与实际动作一致 */
const modalOkText = computed(() => (personalOnly.value ? '提交变更' : '保存'))
const saving = ref(false)
const form = reactive<{
  empNo: string
  name: string
  orgId?: string
  position: string
  mobile: string
  email: string
  gender?: number
  nativeProvince?: string
  nativeCity: string
  nativeDistrict: string
  nativeDetail: string
  idCard: string
  birthday?: string
  nation?: string
  maritalStatus?: string
  politicalStatus?: string
  education?: string
  emergencyContact: string
  emergencyPhone: string
  currentAddress: string
  hireDate?: string
  probationMonths?: number
  exemptProbation: boolean
  remark: string
}>({
  empNo: '',
  name: '',
  orgId: undefined,
  position: '',
  mobile: '',
  email: '',
  gender: undefined,
  nativeProvince: undefined,
  nativeCity: '',
  nativeDistrict: '',
  nativeDetail: '',
  idCard: '',
  birthday: undefined,
  nation: undefined,
  maritalStatus: undefined,
  politicalStatus: undefined,
  education: undefined,
  emergencyContact: '',
  emergencyPhone: '',
  currentAddress: '',
  hireDate: undefined,
  probationMonths: 3,
  exemptProbation: false,
  remark: ''
})

/** 预计转正时间：免试用期不计算；否则 = 入职日期 + 试用期月数 */
const expectedRegularizeText = computed(() => {
  if (form.exemptProbation) return '免试用期'
  if (!form.hireDate || !form.probationMonths) return ''
  return dayjs(form.hireDate).add(form.probationMonths, 'month').format('YYYY-MM-DD')
})

// 勾选免试用期即清空试用期时长，避免提交「既免试用又填了月数」的矛盾数据
watch(
  () => form.exemptProbation,
  (v) => {
    if (v) form.probationMonths = undefined
    else if (!form.probationMonths) form.probationMonths = 3
  }
)

/* 字典下拉（配置中心经后端代理；打开弹窗时懒加载一次） */
const dicts = reactive<{
  nation: DictOption[]
  marital: DictOption[]
  political: DictOption[]
  education: DictOption[]
  bank: DictOption[]
  familyRelation: DictOption[]
  gender: DictOption[]
  position: DictOption[]
  resignReason: DictOption[]
}>({ nation: [], marital: [], political: [], education: [], bank: [], familyRelation: [], gender: [], position: [], resignReason: [] })
let dictsLoaded = false
async function loadDicts() {
  if (dictsLoaded) return
  dictsLoaded = true
  const [nation, marital, political, education, bank, familyRelation, gender, position, resignReason] = await Promise.all([
    dictOptions('general.nation').catch(() => []),
    dictOptions('ehr.marital_status').catch(() => []),
    dictOptions('ehr.political_status').catch(() => []),
    bizOptions('education').catch(() => []),
    bizOptions('bank').catch(() => []),
    bizOptions('family_relation').catch(() => []),
    dictOptions('ehr.gender').catch(() => []),
    bizOptions('position').catch(() => []),
    bizOptions('resign_reason').catch(() => [])
  ])
  dicts.nation = nation
  dicts.marital = marital
  dicts.political = political
  dicts.education = education
  dicts.bank = bank
  dicts.familyRelation = familyRelation
  dicts.gender = gender
  dicts.position = position
  dicts.resignReason = resignReason
}

function optLabel(list: DictOption[], v?: string) {
  if (!v) return '—'
  return list.find((o) => o.value === v)?.label || v
}

/** 职位下拉：从后端主数据（biz_position）派生。
 *  职级体系下一条通道 = 一个职务族（开发工程师 / 会计 / 招聘专员 …），
 *  所以按 jobFamilyName 分组、组内按 levelNo 升序，下拉里直接看出晋升路线；
 *  管理序列单独成组并倒序（高管 → 总监 → 经理）。
 *  存储展示名以兼容历史自由文本；后台停用即前端消失 */
const positionGroups = computed(() => {
  const groups: Record<string, { value: string; label: string; lv: number }[]> = {}
  const order: string[] = []
  for (const o of dicts.position) {
    const key = o.series === 'M' ? '管理序列' : o.jobFamilyName || o.category || '其他'
    if (!groups[key]) {
      groups[key] = []
      order.push(key)
    }
    groups[key].push({ value: o.label, label: o.label, lv: o.levelNo ?? 0 })
  }
  return order.map((label) => ({
    label,
    options: groups[label]
      .sort((a, b) => (label === '管理序列' ? b.lv - a.lv : a.lv - b.lv))
      .map(({ value, label: l }) => ({ value, label: l }))
  }))
})

/** 离职原因下拉：从后端主数据（biz_resign_reason）派生 */
const resignReasonOptions = computed(() => dicts.resignReason.map((o) => ({ value: o.label, label: o.label })))

/** 性别下拉：从后端字典（ehr.gender）派生；字典 value 为字符串，这里转成数字以匹配后端 Integer 字段，
 *  否则 a-select 因数字/字符串类型不匹配无法命中选项，会回退显示原始值（如 "1"） */
const genderOptions = computed(() => dicts.gender.map((o) => ({ value: Number(o.value), label: o.label })))

/** 籍贯-省下拉（行政区划码表内置，value 直接存省名） */
const provinceOptions = provinces.map(([, name]) => ({ value: name, label: name }))

const empStatusOptions = STATUS_OPTIONS

const statusOptions = empStatusOptions

/* ---------- 前端即时校验（与后端 ValidateUtil 同一口径） ---------- */
const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const ID_CHECK = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

/** 18 位身份证校验码验证（GB 11643-1999） */
function isIdCard(raw: string): boolean {
  const id = (raw || '').trim().toUpperCase()
  if (!/^\d{17}[0-9X]$/.test(id)) return false
  const province = Number(id.slice(0, 2))
  if (province < 11 || province > 82) return false
  const birth = new Date(`${id.slice(6, 10)}-${id.slice(10, 12)}-${id.slice(12, 14)}`)
  if (Number.isNaN(birth.getTime()) || birth > new Date()) return false
  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * ID_WEIGHTS[i]
  return ID_CHECK[sum % 11] === id[17]
}

function fmtStatus(v: string, ok: boolean, tip: string) {
  if (!v.trim()) return { status: undefined as '' | 'error' | undefined, help: '' }
  return ok ? { status: undefined as '' | 'error' | undefined, help: '' } : { status: 'error' as const, help: tip }
}

const mobileStatus = computed(() => fmtStatus(form.mobile, /^1[3-9]\d{9}$/.test(form.mobile.trim()), '手机号格式不正确'))
const idCardStatus = computed(() => fmtStatus(form.idCard, isIdCard(form.idCard), '身份证号不合法（18 位且校验码正确）'))

/* 身份证自动带出：出生日期、性别、籍贯省市区（地址码）——用户仍可手工覆盖性别/生日/省 */
watch(
  () => form.idCard,
  (raw) => {
    const id = raw.trim().toUpperCase()
    if (!isIdCard(id)) return
    form.birthday = `${id.slice(6, 10)}-${id.slice(10, 12)}-${id.slice(12, 14)}`
    form.gender = Number(id[16]) % 2 === 1 ? 1 : 2
    const region = regionFromIdCard(id)
    if (region) {
      form.nativeProvince = region.province || undefined
      form.nativeCity = region.city || ''
      form.nativeDistrict = region.district || ''
    }
  }
)
const emergencyPhoneStatus = computed(() =>
  fmtStatus(form.emergencyPhone, /^1[3-9]\d{9}$/.test(form.emergencyPhone.trim()), '手机号格式不正确')
)

/* ---------- 弹窗内的子档案（卡片切换） ----------
 * 新增：行先暂存本地（_key），点「保存」创建人员成功后统一提交到档案接口
 * 编辑：行带 id，直接读写 /employees/{id}/banks|educations|works|families
 */
const formTab = ref('base')

type BankRow = BankBody & { _key: string; id?: string }
type EduRow = EducationBody & { _key: string; id?: string }
type WorkRow = WorkBody & { _key: string; id?: string }
type FamilyRow = FamilyBody & { _key: string; id?: string }

const bankRows = ref<BankRow[]>([])
const eduRows = ref<EduRow[]>([])
const workRows = ref<WorkRow[]>([])
const familyRows = ref<FamilyRow[]>([])

let localSeq = 0
const newKey = () => `local-${Date.now()}-${localSeq++}`

function clearSubRows() {
  bankRows.value = []
  eduRows.value = []
  workRows.value = []
  familyRows.value = []
}

async function reloadSubs(empId: string) {
  const p = await employeeProfile(empId)
  bankRows.value = (p.banks || []).map((b) => ({ ...b, _key: b.id }))
  eduRows.value = (p.educations || []).map((x) => ({ ...x, _key: x.id }))
  workRows.value = (p.works || []).map((x) => ({ ...x, _key: x.id }))
  familyRows.value = (p.families || []).map((x) => ({ ...x, _key: x.id }))
}

/** 新增成功后把暂存行落库；返回失败条数 */
async function flushSubRows(empId: string): Promise<number> {
  let failed = 0
  for (const r of bankRows.value) {
    const { _key, id, ...body } = r
    try { await addBank(empId, body) } catch { failed++ }
  }
  for (const r of eduRows.value) {
    const { _key, id, ...body } = r
    try { await addEducation(empId, body) } catch { failed++ }
  }
  for (const r of workRows.value) {
    const { _key, id, ...body } = r
    try { await addWork(empId, body) } catch { failed++ }
  }
  for (const r of familyRows.value) {
    const { _key, id, ...body } = r
    try { await addFamily(empId, body) } catch { failed++ }
  }
  return failed
}

/* 子表列定义（弹窗宽 760，紧凑列宽） */
const bankCols = [
  { title: '银行', key: 'bank', width: 120 },
  { title: '卡号', key: 'accountNo', width: 168 },
  { title: '持卡人', dataIndex: 'holderName', key: 'holderName', width: 88 },
  { title: '开户行', dataIndex: 'branch', key: 'branch' },
  { title: '工资卡', key: 'isPrimary', width: 74 },
  { title: '操作', key: 'action', width: 88 }
]
const eduCols = [
  { title: '学校 / 专业', key: 'school', width: 210 },
  { title: '学历', key: 'degree', width: 88 },
  { title: '起止时间', key: 'range', width: 186 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
  { title: '操作', key: 'action', width: 88 }
]
const workCols = [
  { title: '单位 / 职位', key: 'company', width: 210 },
  { title: '起止时间', key: 'range', width: 186 },
  { title: '离职原因', dataIndex: 'leaveReason', key: 'leaveReason' },
  { title: '操作', key: 'action', width: 88 }
]
const familyCols = [
  { title: '关系', key: 'relation', width: 88 },
  { title: '姓名', key: 'name', width: 92 },
  { title: '工作单位', dataIndex: 'company', key: 'company' },
  { title: '电话', dataIndex: 'phone', key: 'phone', width: 118 },
  { title: '操作', key: 'action', width: 88 }
]

/** 删除子档案：编辑模式（非变更）且有 id → 调接口并刷新；否则只删本地暂存行（变更模式随提交统一走审批） */
async function removeSub(kind: 'bank' | 'edu' | 'work' | 'family', row: any) {
  if (editing.value?.id && row.id && !personalOnly.value) {
    try {
      if (kind === 'bank') await deleteBank(editing.value.id, row.id)
      else if (kind === 'edu') await deleteEducation(editing.value.id, row.id)
      else if (kind === 'work') await deleteWork(editing.value.id, row.id)
      else await deleteFamily(editing.value.id, row.id)
      await reloadSubs(editing.value.id)
      message.success('已删除')
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
    return
  }
  if (kind === 'bank') bankRows.value = bankRows.value.filter((r) => r._key !== row._key)
  else if (kind === 'edu') eduRows.value = eduRows.value.filter((r) => r._key !== row._key)
  else if (kind === 'work') workRows.value = workRows.value.filter((r) => r._key !== row._key)
  else familyRows.value = familyRows.value.filter((r) => r._key !== row._key)
}

/* ---------- 子档案编辑弹窗 ---------- */
const bankModalOpen = ref(false)
const bankSaving = ref(false)
const bankEditKey = ref('')
const bankForm = reactive<{ bank?: string; accountNo: string; holderName: string; branch: string; isPrimary: boolean; remark: string }>({
  bank: undefined, accountNo: '', holderName: '', branch: '', isPrimary: false, remark: ''
})

function openBankModal(row?: BankRow) {
  loadDicts()
  bankEditKey.value = row?._key || ''
  bankForm.bank = row?.bank
  bankForm.accountNo = row?.accountNo || ''
  bankForm.holderName = row?.holderName || form.name || ''
  bankForm.branch = row?.branch || ''
  bankForm.isPrimary = row?.isPrimary === 1
  bankForm.remark = row?.remark || ''
  bankModalOpen.value = true
}

async function submitBankModal() {
  const f = bankForm
  if (!f.bank) return message.warning('请选择银行')
  if (!/^\d{8,32}$/.test((f.accountNo || '').trim())) return message.warning('卡号应为 8-32 位数字')
  if (!f.holderName.trim()) return message.warning('持卡人必填')
  const body: BankBody = {
    bank: f.bank,
    accountNo: f.accountNo.trim(),
    holderName: f.holderName.trim(),
    branch: f.branch.trim(),
    isPrimary: f.isPrimary ? 1 : 0,
    remark: f.remark.trim()
  }
  bankSaving.value = true
  try {
    const target = bankRows.value.find((r) => r._key === bankEditKey.value)
    // 变更模式（personalOnly）子表只暂存本地，随「提交变更」统一走审批落库；其余编辑模式仍直改
    if (target && editing.value?.id && target.id && !personalOnly.value) {
      await updateBank(editing.value.id, target.id, body)
      await reloadSubs(editing.value.id)
    } else if (editing.value?.id && !personalOnly.value) {
      await addBank(editing.value.id, body)
      await reloadSubs(editing.value.id)
    } else if (target) {
      Object.assign(target, body)
    } else {
      bankRows.value.push({ ...body, _key: newKey() })
    }
    bankModalOpen.value = false
    message.success('已保存')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    bankSaving.value = false
  }
}

const eduModalOpen = ref(false)
const eduSaving = ref(false)
const eduEditKey = ref('')
const eduForm = reactive<{ school: string; major: string; degree?: string; range: [string, string] | undefined; remark: string }>({
  school: '', major: '', degree: undefined, range: undefined, remark: ''
})

function openEduModal(row?: EduRow) {
  loadDicts()
  eduEditKey.value = row?._key || ''
  eduForm.school = row?.school || ''
  eduForm.major = row?.major || ''
  eduForm.degree = row?.degree
  eduForm.range =
    row?.startDate && row?.endDate ? [row.startDate, row.endDate] : row?.startDate ? [row.startDate, ''] : undefined
  eduForm.remark = row?.remark || ''
  eduModalOpen.value = true
}

async function submitEduModal() {
  const f = eduForm
  if (!f.school.trim()) return message.warning('学校必填')
  if (!f.degree) return message.warning('请选择学历')
  if (!f.range?.[0]) return message.warning('请选择在校时间')
  if (f.range[1] && f.range[1] < f.range[0]) return message.warning('毕业日期不能早于入学日期')
  const body: EducationBody = {
    school: f.school.trim(),
    major: f.major.trim(),
    degree: f.degree,
    startDate: f.range[0],
    endDate: f.range[1] || null,
    remark: f.remark.trim()
  }
  eduSaving.value = true
  try {
    const target = eduRows.value.find((r) => r._key === eduEditKey.value)
    // 变更模式（personalOnly）子表只暂存本地，随「提交变更」统一走审批落库；其余编辑模式仍直改
    if (target && editing.value?.id && target.id && !personalOnly.value) {
      await updateEducation(editing.value.id, target.id, body)
      await reloadSubs(editing.value.id)
    } else if (editing.value?.id && !personalOnly.value) {
      await addEducation(editing.value.id, body)
      await reloadSubs(editing.value.id)
    } else if (target) {
      Object.assign(target, body)
    } else {
      eduRows.value.push({ ...body, _key: newKey() })
    }
    eduModalOpen.value = false
    message.success('已保存')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    eduSaving.value = false
  }
}

const workModalOpen = ref(false)
const workSaving = ref(false)
const workEditKey = ref('')
const workForm = reactive<{ company: string; position: string; range: [string, string] | undefined; leaveReason: string; remark: string }>({
  company: '', position: '', range: undefined, leaveReason: '', remark: ''
})

function openWorkModal(row?: WorkRow) {
  workEditKey.value = row?._key || ''
  workForm.company = row?.company || ''
  workForm.position = row?.position || ''
  workForm.range = row?.startDate ? [row.startDate, row.endDate || ''] : undefined
  workForm.leaveReason = row?.leaveReason || ''
  workForm.remark = row?.remark || ''
  workModalOpen.value = true
}

async function submitWorkModal() {
  const f = workForm
  if (!f.company.trim()) return message.warning('工作单位必填')
  if (!f.range?.[0]) return message.warning('请选择工作时间')
  if (f.range[1] && f.range[1] < f.range[0]) return message.warning('结束日期不能早于开始日期')
  const body: WorkBody = {
    company: f.company.trim(),
    position: f.position.trim(),
    startDate: f.range[0],
    endDate: f.range[1] || null,
    leaveReason: f.leaveReason.trim(),
    remark: f.remark.trim()
  }
  workSaving.value = true
  try {
    const target = workRows.value.find((r) => r._key === workEditKey.value)
    // 变更模式（personalOnly）子表只暂存本地，随「提交变更」统一走审批落库；其余编辑模式仍直改
    if (target && editing.value?.id && target.id && !personalOnly.value) {
      await updateWork(editing.value.id, target.id, body)
      await reloadSubs(editing.value.id)
    } else if (editing.value?.id && !personalOnly.value) {
      await addWork(editing.value.id, body)
      await reloadSubs(editing.value.id)
    } else if (target) {
      Object.assign(target, body)
    } else {
      workRows.value.push({ ...body, _key: newKey() })
    }
    workModalOpen.value = false
    message.success('已保存')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    workSaving.value = false
  }
}

const familyModalOpen = ref(false)
const familySaving = ref(false)
const familyEditKey = ref('')
const familyForm = reactive<{ relation?: string; name: string; company: string; phone: string; remark: string }>({
  relation: undefined, name: '', company: '', phone: '', remark: ''
})

const familyPhoneStatus = computed(() => {
  const p = (familyForm.phone || '').trim()
  if (!p) return { status: undefined as '' | 'error' | undefined, help: '' }
  return /^1[3-9]\d{9}$/.test(p)
    ? { status: undefined as '' | 'error' | undefined, help: '' }
    : { status: 'error' as const, help: '手机号格式不正确' }
})

function openFamilyModal(row?: FamilyRow) {
  loadDicts()
  familyEditKey.value = row?._key || ''
  familyForm.relation = row?.relation
  familyForm.name = row?.name || ''
  familyForm.company = row?.company || ''
  familyForm.phone = row?.phone || ''
  familyForm.remark = row?.remark || ''
  familyModalOpen.value = true
}

async function submitFamilyModal() {
  const f = familyForm
  if (!f.relation) return message.warning('请选择关系')
  if (!f.name.trim()) return message.warning('姓名必填')
  if (f.phone.trim() && !/^1[3-9]\d{9}$/.test(f.phone.trim())) return message.warning('联系电话格式不正确')
  const body: FamilyBody = {
    relation: f.relation,
    name: f.name.trim(),
    company: f.company.trim(),
    phone: f.phone.trim(),
    remark: f.remark.trim()
  }
  familySaving.value = true
  try {
    const target = familyRows.value.find((r) => r._key === familyEditKey.value)
    // 变更模式（personalOnly）子表只暂存本地，随「提交变更」统一走审批落库；其余编辑模式仍直改
    if (target && editing.value?.id && target.id && !personalOnly.value) {
      await updateFamily(editing.value.id, target.id, body)
      await reloadSubs(editing.value.id)
    } else if (editing.value?.id && !personalOnly.value) {
      await addFamily(editing.value.id, body)
      await reloadSubs(editing.value.id)
    } else if (target) {
      Object.assign(target, body)
    } else {
      familyRows.value.push({ ...body, _key: newKey() })
    }
    familyModalOpen.value = false
    message.success('已保存')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    familySaving.value = false
  }
}

function resetForm() {
  form.empNo = ''
  form.name = ''
  form.orgId = undefined
  form.position = ''
  form.mobile = ''
  form.email = ''
  form.gender = undefined
  form.nativeProvince = undefined
  form.nativeCity = ''
  form.nativeDistrict = ''
  form.nativeDetail = ''
  form.idCard = ''
  form.birthday = undefined
  form.nation = undefined
  form.maritalStatus = undefined
  form.politicalStatus = undefined
  form.education = undefined
  form.emergencyContact = ''
  form.emergencyPhone = ''
  form.currentAddress = ''
  form.hireDate = undefined
  form.probationMonths = 3
  form.exemptProbation = false
  form.remark = ''
}

function openCreate() {
  editing.value = null
  resetForm()
  clearSubRows()
  formTab.value = 'base'
  loadDicts()
  // 已经在树里选中某个部门时，默认把新人挂到该部门
  if (selectedOrgId.value) form.orgId = selectedOrgId.value
  modalOpen.value = true
}

function openEdit(row: EmployeeItem) {
  editing.value = row
  resetForm()
  clearSubRows()
  formTab.value = 'base'
  loadDicts()
  form.empNo = row.empNo
  form.name = row.name
  form.orgId = row.orgId
  form.position = row.position || ''
  form.mobile = row.mobile || ''
  form.email = row.email || ''
  form.gender = row.gender === 1 || row.gender === 2 ? row.gender : undefined
  form.nativeProvince = row.nativeProvince || undefined
  form.nativeCity = row.nativeCity || ''
  form.nativeDistrict = row.nativeDistrict || ''
  form.nativeDetail = row.nativeDetail || ''
  form.idCard = row.idCard || ''
  form.birthday = row.birthday || undefined
  form.nation = row.nation || undefined
  form.maritalStatus = row.maritalStatus || undefined
  form.politicalStatus = row.politicalStatus || undefined
  form.education = row.education || undefined
  form.emergencyContact = row.emergencyContact || ''
  form.emergencyPhone = row.emergencyPhone || ''
  form.currentAddress = row.currentAddress || ''
  form.hireDate = row.hireDate || undefined
  form.exemptProbation = !!row.exemptProbation
  form.probationMonths = row.probationMonths ?? (row.exemptProbation ? undefined : 3)
  form.remark = row.remark || ''
  modalOpen.value = true
  // 子档案异步加载，不阻塞表单打开
  reloadSubs(row.id).catch(() => {})
}

async function submit() {
  // 工号由系统自动生成且不可修改，不参与提交
  if (!form.name.trim()) {
    message.warning('姓名必填')
    return
  }
  if (!form.orgId) {
    message.warning('请选择所属组织')
    return
  }
  if (form.mobile.trim() && !/^1[3-9]\d{9}$/.test(form.mobile.trim())) {
    message.warning('手机号格式不正确（11 位大陆手机号）')
    return
  }
  if (form.idCard.trim() && !isIdCard(form.idCard)) {
    message.warning('身份证号不合法（18 位且校验码正确）')
    return
  }
  if (form.emergencyPhone.trim() && !/^1[3-9]\d{9}$/.test(form.emergencyPhone.trim())) {
    message.warning('紧急联系电话格式不正确')
    return
  }
  // 试用期：免试用期可不填；否则必填且限 1-12 个月（「变更」模式下字段锁定，不再校验）
  if (!personalOnly.value && !form.exemptProbation) {
    const pm = Number(form.probationMonths)
    if (!pm || pm < 1 || pm > 12) {
      message.warning('试用期时长必填，范围 1-12 个月；确无试用期请勾选「免试用期」')
      return
    }
  }
  saving.value = true
  // empNo 不提交（后端自动生成且禁改）；邮箱不提交（后端按姓名拼音自动生成）；籍贯由省/市/区县/详细地址结构化传递
  const { empNo: _ignored, email: _ignoredEmail, ...rest } = form
  const body = { ...rest, orgId: form.orgId as string }
  try {
    if (personalOnly.value && editing.value) {
      // 试用期/在职的「变更」：基本信息可变项 + 四类子表目标态整表提交，
      // 服务端比对出字段级/行级差异后进审批，审批通过才落库
      const changeBody: EmpChangeBody = {
        mobile: form.mobile.trim(),
        maritalStatus: form.maritalStatus || '',
        politicalStatus: form.politicalStatus || '',
        education: form.education || '',
        emergencyContact: form.emergencyContact.trim(),
        emergencyPhone: form.emergencyPhone.trim(),
        currentAddress: form.currentAddress.trim(),
        banks: bankRows.value.map(({ _key, ...r }) => r),
        educations: eduRows.value.map(({ _key, ...r }) => r),
        works: workRows.value.map(({ _key, ...r }) => r),
        families: familyRows.value.map(({ _key, ...r }) => r)
      }
      const ret = await submitEmpChange(editing.value.id, changeBody)
      modalOpen.value = false
      await refreshAll()
      if (ret?.pendingApproval) {
        message.success(`变更已提交审批，通过后生效（${ret.changeSummary}）`)
      } else {
        message.success('变更已处理')
      }
    } else if (editing.value) {
      const saved = await updateEmployee(editing.value.id, body)
      // 试用期/在职的个人信息修改走审批：后端不动档案，只发起审批单
      message.success(saved?.pendingApproval ? '变更已提交审批，通过后生效' : '已保存')
      modalOpen.value = false
      await refreshAll()
    } else {
      const created = await createEmployee(body)
      // 新增时填写的子档案统一落库（工资卡唯一约束等由后端把关，失败不回滚主档案）
      const failed = await flushSubRows(created.id)
      modalOpen.value = false
      await refreshAll()
      if (failed > 0) {
        message.warning(`人员已创建，但有 ${failed} 条子档案保存失败，可在「查看」档案中补充`)
      }
      if (created.account) {
        showAccount(created.account)
      } else if (failed === 0) {
        message.success(`已创建「${created.name}」`)
      }
    }
  } catch (e: any) {
    message.error(e?.message || (personalOnly.value ? '提交变更失败' : '保存失败'))
  } finally {
    saving.value = false
  }
}

/* ---------- 入职 / 转正 生命周期 ---------- */
/** 转正申请是否可提交：试用期、且该员工当前没有任何在途审批单 */
function hasPendingRegularize(row: EmployeeItem) {
  // 入职/信息变更/离职在途时同样不能发起转正
  return !!runningBriefForRow(row) || row.regularizeStatus === 1 || row.regularizeStatus === 2
}

/** 当前登录账号对应的员工档案ID（用于「本人」判定） */
const myAccountId = computed(() => {
  const id = store.me?.accountId
  return id == null || id === '' ? '' : String(id)
})

/** 该行员工是否就是当前登录账号本人（员工表 account_id 存的是 SSO 账户 ID） */
function isSelf(row: EmployeeItem) {
  return !!myAccountId.value && !!row.accountId && String(row.accountId) === myAccountId.value
}

/**
 * 转正申请按钮：<b>只有本人能点</b>。
 * <p>
 * 不能用 canEdit（employee:edit）来卡：普通员工只有 employee:view，
 * 拿 canEdit 判定等于把本人也挡在门外，列表里根本找不到入口。
 * HR 也点不了——转正是员工本人的诉求，由本人填自评/业绩后提交。
 */
function canApplyRegularize(row: EmployeeItem) {
  return isSelf(row) && row.status === 30 && !hasPendingRegularize(row)
}

async function doSubmitDraft(row: EmployeeItem) {
  try {
    await submitDraft(row.id)
    message.success('已提交入职，进入审批流程')
    await refreshAll()
  } catch (e: any) {
    // 后端会一次性列出缺失的基本信息字段与空着的档案卡片，弹窗展示避免 message 截断
    Modal.error({
      title: '无法提交入职',
      content: h('div', { style: 'white-space: pre-wrap; line-height: 1.7' }, e?.message || '提交失败'),
      okText: '知道了'
    })
  }
}

/** 办理入职：入职审批通过(25) → 免试用期直接正式(40)，否则进入试用期(30) */
async function doOnboard(row: EmployeeItem) {
  try {
    await onboardEmployee(row.id)
    message.success(
      row.exemptProbation
        ? `「${row.name}」已办理入职，免试用期直接成为正式员工`
        : `「${row.name}」已办理入职，进入试用期`
    )
    await refreshAll()
  } catch (e: any) {
    Modal.error({
      title: '无法办理入职',
      content: h('div', { style: 'white-space: pre-wrap; line-height: 1.7' }, e?.message || '办理入职失败'),
      okText: '知道了'
    })
  }
}

/* ---------- 转正申请表单 ---------- */
const regularizeOpen = ref(false)
const regularizeSaving = ref(false)
const regularizeTarget = ref<EmployeeItem | null>(null)
const regularizeForm = reactive<{
  regularizeDate: string
  selfReview: string
  workSummary: string
  reason: string
  nextPlan: string
}>({
  regularizeDate: '',
  selfReview: '',
  workSummary: '',
  reason: '',
  nextPlan: ''
})

/** 打开转正申请弹窗；默认日期取预计转正日期 */
function openRegularizeForm(row: EmployeeItem) {
  regularizeTarget.value = row
  regularizeForm.regularizeDate = row.expectedRegularizeDate || new Date().toISOString().slice(0, 10)
  regularizeForm.selfReview = ''
  regularizeForm.workSummary = ''
  regularizeForm.reason = ''
  regularizeForm.nextPlan = ''
  regularizeOpen.value = true
}

async function submitRegularize() {
  const row = regularizeTarget.value
  if (!row) return
  regularizeSaving.value = true
  try {
    await regularizeApply(row.id, {
      regularizeDate: regularizeForm.regularizeDate || undefined,
      selfReview: regularizeForm.selfReview || undefined,
      workSummary: regularizeForm.workSummary || undefined,
      reason: regularizeForm.reason || undefined,
      nextPlan: regularizeForm.nextPlan || undefined
    })
    message.success('转正申请已提交审批中心，等待审批')
    regularizeOpen.value = false
    await refreshAll()
  } catch (e: any) {
    Modal.error({
      title: '无法提交转正申请',
      content: h('div', { style: 'white-space: pre-wrap; line-height: 1.7' }, e?.message || '提交失败'),
      okText: '知道了'
    })
  } finally {
    regularizeSaving.value = false
  }
}

/* ---------- 在途审批详情：通过/驳回/转办/加签/撤回统一在审批中心完成 ---------- */
const approvalDrawerOpen = ref(false)
const approvalInstanceId = ref<string | null>(null)

function openApprovalDetail(id: string) {
  approvalInstanceId.value = id
  approvalDrawerOpen.value = true
}

/* ---------- 减员申请 / 复职 ---------- */
const resignOpen = ref(false)
const resignSaving = ref(false)
const resignTarget = ref<EmployeeItem | null>(null)
const resignForm = reactive<{
  resignDate: string
  reason: string
  handover: string
  handoverEmployeeId: string | undefined
  items: string[]
  noHandover: boolean
}>({
  resignDate: '',
  reason: '',
  handover: '',
  handoverEmployeeId: undefined,
  items: [''],
  noHandover: false
})

/** 交接人候选：全量在职员工（一页拉 500，内部系统够用），打开弹窗时懒加载 */
const handoverCandidates = ref<EmployeeItem[]>([])
const candidatesLoaded = ref(false)

async function loadHandoverCandidates() {
  if (candidatesLoaded.value) return
  try {
    const data = await pageEmployees({ page: 1, size: 500 })
    // 交接人必须是正常履职的人（试用期 / 在职）
    handoverCandidates.value = (data.list || []).filter((e) => isWorking(e.status))
    candidatesLoaded.value = true
  } catch {
    handoverCandidates.value = []
  }
}

function openResign(row: EmployeeItem) {
  resignTarget.value = row
  resignForm.resignDate = new Date().toISOString().slice(0, 10)
  resignForm.reason = ''
  resignForm.handover = ''
  loadDicts()
  resignForm.handoverEmployeeId = undefined
  resignForm.items = ['']
  resignForm.noHandover = false
  resignOpen.value = true
  loadHandoverCandidates()
}

async function submitResign() {
  if (!resignTarget.value) return
  if (!resignForm.resignDate) {
    message.warning('请选择拟离职日期')
    return
  }
  if (!resignForm.reason.trim()) {
    message.warning('请填写减员原因')
    return
  }
  const items = resignForm.items.map((s) => (s || '').trim()).filter(Boolean)
  if (!resignForm.noHandover) {
    if (!resignForm.handoverEmployeeId) {
      message.warning('请选择交接人')
      return
    }
    if (items.length === 0) {
      message.warning('请至少填写一项交接内容')
      return
    }
  }
  resignSaving.value = true
  try {
    await reduceEmployee(resignTarget.value.id, {
      resignDate: resignForm.resignDate,
      reason: resignForm.reason.trim(),
      handover: resignForm.handover.trim(),
      handoverEmployeeId: resignForm.noHandover ? undefined : resignForm.handoverEmployeeId,
      items: resignForm.noHandover ? [] : items,
      noHandover: resignForm.noHandover
    })
    message.success(
      resignForm.noHandover
        ? '减员申请已提交，等待部门负责人审批（通过后还需集团人力资源中心终审）'
        : '减员申请已提交，待交接人确认交接后由部门负责人审批（再经集团人力资源中心终审）'
    )
    resignOpen.value = false
    await refreshAll()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    resignSaving.value = false
  }
}

const reinstateOpen = ref(false)
const reinstateSaving = ref(false)
const reinstateTarget = ref<EmployeeItem | null>(null)
const reinstateForm = reactive({ rehireDate: '', reason: '', enableAccount: true })

function openReinstate(row: EmployeeItem) {
  reinstateTarget.value = row
  reinstateForm.rehireDate = dayjs().format('YYYY-MM-DD')
  reinstateForm.reason = ''
  reinstateForm.enableAccount = true
  reinstateOpen.value = true
}

async function submitReinstate() {
  if (!reinstateTarget.value) return
  if (!reinstateForm.rehireDate) {
    message.warning('请选择拟复职日期')
    return
  }
  reinstateSaving.value = true
  try {
    await submitRehireApply(reinstateTarget.value.id, { ...reinstateForm })
    message.success('复职申请已提交，审批通过后档案自动恢复在职')
    reinstateOpen.value = false
    await refreshAll()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    reinstateSaving.value = false
  }
}

async function doCloseAccount(row: EmployeeItem) {
  try {
    await closeAccountEmployee(row.id)
    message.success('账号已关闭，员工状态已更新为已离职')
    await refreshAll()
  } catch (e: any) {
    message.error(e?.message || '关闭账号失败')
  }
}

async function doDelete(row: EmployeeItem) {
  try {
    await deleteEmployee(row.id)
    message.success('已删除档案')
    await refreshAll()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

/* ---------- 查看档案 ---------- */
const profileOpen = ref(false)
const profileId = ref<string | undefined>(undefined)

function openProfile(row: EmployeeItem) {
  profileId.value = row.id
  profileOpen.value = true
}

/* ---------- 开户结果 ---------- */
const resultOpen = ref(false)
const accountResult = ref<AccountBrief | null>(null)

function showAccount(brief: AccountBrief) {
  accountResult.value = brief
  resultOpen.value = true
}

function copyPwd() {
  const pwd = accountResult.value?.initialPassword
  if (!pwd) return
  navigator.clipboard
    ?.writeText(pwd)
    .then(() => message.success('密码已复制'))
    .catch(() => message.warning('复制失败，请手动选中复制'))
}

const APP_NAMES: Record<string, string> = {
  'sso-center': '统一账号中心',
  portal: '内容门户',
  ehr: '人力中心',
  cms: '内容中心',
  blog: '博客后台'
}

function appName(code: string) {
  return APP_NAMES[code] || code
}

const ROLE_NAMES: Record<string, string> = {
  EHR_BASIC: 'EHR 基本功能',
  EHR_LEAVE: 'EHR 请假审批'
}

function roleName(code: string) {
  return ROLE_NAMES[code] || code
}

function genderText(g?: number) {
  return g === 1 ? '男' : g === 2 ? '女' : '—'
}

onMounted(async () => {
  await refreshAll()
  // 从消息中心「关闭账号」待办跳过来：/employees?employeeId=xxx，直接打开该员工档案
  const employeeId = useRoute().query.employeeId
  if (typeof employeeId === 'string' && employeeId) {
    profileId.value = employeeId
    profileOpen.value = true
  }
})
</script>

<style scoped>
/* 表单顶部提示：说明哪些是「提交入职」的前置条件 */
.form-hint {
  margin-bottom: 10px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--muted);
  background: var(--surface-2, #fafafa);
  border-left: 2px solid #d9d9d9;
  border-radius: 2px;
}
.probation-hint {
  display: inline-block;
  padding-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}
.req-star {
  color: #ff4d4f;
}
/* 左树右表：只有两侧面板内部滚动，外壳固定 */
.split {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.org-panel {
  width: 296px;
  flex: 0 0 296px;
}

.list-panel {
  flex: 1;
  min-width: 0;
}

.org-search {
  flex: 0 0 auto;
  padding: 8px 10px;
  border-bottom: 1px solid var(--panel-border);
}

.tree-body {
  padding: 6px 4px;
  overflow-x: hidden;
}

.tree-body :deep(.ant-tree-node-content-wrapper) {
  overflow: hidden;
}

.tree-all {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  margin-bottom: 2px;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
}

.tree-all:hover {
  background: var(--tree-hover-bg);
}

.tree-all.active {
  background: transparent;
  font-weight: 600;
}

.all-icon {
  color: var(--brand);
  font-size: 14px;
}

.all-name {
  flex: 1;
}

.node-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.node-tag {
  margin-inline-end: 0;
  flex: 0 0 auto;
  transform: scale(0.88);
  transform-origin: left center;
}

.node-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-count {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.tree-empty {
  margin-top: 24px;
}

.list-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-bottom: 1px solid var(--panel-border);
}

.head-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cur-tag {
  margin-inline-end: 0;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

.reset-link {
  font-weight: 400;
}

.spacer {
  flex: 1;
}

.position {
  color: var(--text-base);
  /* 职级体系下职位名变长（中级数据运营专员），别让它折成两行 */
  white-space: nowrap;
}

.table-body {
  padding: 0;
}

/* 操作列 sticky 贴右：横向滚动时始终可见。
   替代 antd 的 fixed 列——fixed 列要求表格内部开一层横向滚动，会把横向滚动条压到长表格
   内容最底部（难够到）。现在横向滚动交给外层 .panel-body，这里只让最后一列（操作）粘在右边。 */
.emp-table :deep(.ant-table-thead > tr > th:last-child),
.emp-table :deep(.ant-table-tbody > tr > td:last-child) {
  position: sticky;
  right: 0;
  z-index: 3;
  background: var(--panel-bg);
  border-left: 1px solid var(--panel-border);
}

/* 操作列放不下时按「整条链接」换行，不要按单字折行 */
.table-body :deep(.ant-table-tbody td a) {
  white-space: nowrap;
}

.emp-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.emp-name-text {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 账号列：标签与用户名之间留出间距，避免「已开户」紧贴用户名挤在一起 */
.account-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.st-tag {
  margin-inline-end: 0;
  flex: 0 0 auto;
  transform: scale(0.86);
  transform-origin: left center;
}

.ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.ml4 {
  margin-left: 4px;
}

.ml8 {
  margin-left: 8px;
}

.mt12 {
  margin-top: 12px;
}

/* 弹窗顶部的「办理对象」条：不再用表单标签，姓名加重 + 次要信息跟在后面 */
.target-bar {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: var(--code-bg);
  border: 1px solid var(--border-subtle);
}

.target-bar .tb-name {
  font-weight: 600;
  font-size: 14px;
}

.target-bar .tb-meta {
  font-size: 12px;
  color: var(--muted);
}

.danger {
  color: #ff4d4f;
}

/* 弹窗内卡片切换：去掉顶部多余留白，子表工具条紧凑排列 */
.emp-form-tabs :deep(.ant-tabs-content) {
  padding-top: 4px;
}

/* 三列布局下压缩表单项纵向间距，避免弹窗出滚动条 */
.emp-form-tabs :deep(.ant-form-item) {
  margin-bottom: 14px;
}
.emp-form-tabs :deep(.ant-form-item-extra) {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
}

.sub-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* 所属组织：只读回填框整体可点，清除图标悬停变色 */
.org-pick-input {
  cursor: pointer;
}
.org-pick-input :deep(.ant-input[readonly]) {
  cursor: pointer;
}
.org-clear {
  color: var(--muted);
  cursor: pointer;
}
.org-clear:hover {
  color: #ff4d4f;
}
.org-picker-tree {
  max-height: 480px;
  overflow: auto;
  padding: 4px 2px;
}

.result-desc {
  text-align: left;
}

.pwd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  letter-spacing: 1px;
}

</style>

<!-- 转正申请弹窗的样式必须放在非 scoped 块里：Modal 通过 Teleport 渲染到 body，
     scoped 的 :deep() 依赖祖先携带 scope id，Teleport 出去后祖先关系不可靠。 -->
<style>
/* 字段多、默认高度容易顶出屏幕。
   压缩纵向间距把首屏内容尽量塞下，剩余部分由 body 的 maxHeight 滚动兜底。 */
.regularize-modal-wrap .ant-modal-body {
  padding-top: 12px;
  padding-bottom: 12px;
}

.regularize-modal-wrap .ant-form-item {
  margin-bottom: 12px;
}

.regularize-modal-wrap .ant-form-item:last-child {
  margin-bottom: 0;
}

/* 纵向表单的 label 在上，压缩 label 与控件之间的留白 */
.regularize-modal-wrap .ant-form-item-label {
  padding-bottom: 2px;
}

/* 字数统计条紧贴输入框，避免每项多占一行 */
.regularize-modal-wrap .ant-input-textarea-show-count::after {
  margin-top: 2px;
}

.regularize-modal-wrap .target-bar {
  padding: 6px 10px;
  margin-bottom: 10px;
}
</style>
