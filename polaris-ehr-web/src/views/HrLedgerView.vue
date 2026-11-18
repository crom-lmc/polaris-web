<template>
  <div class="page-root ledger-page">
    <section class="ledger-heading">
      <div>
        <div class="ledger-title"><fund-outlined /> 人力台账</div>
        <div class="muted">人员、招聘、合同与假勤业务的集中分析视图</div>
      </div>
      <a-tag color="green">数据已隔离</a-tag>
    </section>

    <a-alert
      type="info"
      show-icon
      message="汇总、图表和明细均按当前账号的数据权限及筛选条件统计。"
    />

    <section class="panel ledger-workbench">
      <a-tabs v-model:active-key="activeTab" class="ledger-tabs">
        <a-tab-pane v-if="canWorkforce" key="workforce" tab="在职人员结构">
          <div class="filter-bar">
            <a-input
              :value="orgLabel(workforceFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('workforce')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="workforceFilters.status" :options="workforceStatusOptions" style="width: 145px" />
            <a-input v-model:value="workforceFilters.position" allow-clear placeholder="职位" style="width: 150px" />
            <a-input v-model:value="workforceFilters.keyword" allow-clear placeholder="姓名 / 工号" style="width: 170px" />
            <a-button @click="resetWorkforceFilters">重置</a-button>
          </div>

          <div class="metric-grid">
            <div v-for="item in workforceMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card" :class="chartCardClass(workforceData.byOrg.length)">
              <div class="chart-title">各直接组织在职人数</div>
              <div class="bar-chart category-chart">
                <div v-for="item in workforceData.byOrg" :key="item.key" class="bar-item category-item">
                  <div class="bar-value">{{ formatAmount(item.value) }}</div>
                  <div class="bar-track"><div class="bar-fill blue" :style="barStyle(item.value, workforceOrgMax)"></div></div>
                  <div class="bar-label category-label" :title="item.name">{{ item.name }}</div>
                </div>
                <a-empty v-if="!workforceData.byOrg.length" class="category-empty" :image="false" description="暂无数据" />
              </div>
            </div>
            <div class="chart-card" :class="chartCardClass(workforceDistributions.reduce((total, group) => total + group.items.length, 0))">
              <div class="chart-title">人员结构分布</div>
              <div class="distribution-chart-scroll">
                <div class="distribution-chart-groups">
                  <section v-for="group in workforceDistributions" :key="group.title" class="distribution-group">
                    <div class="distribution-title">{{ group.title }}</div>
                    <div class="bar-chart category-chart distribution-chart">
                      <div v-for="item in group.items" :key="item.key" class="bar-item category-item">
                        <div class="bar-value">{{ formatAmount(item.value) }}</div>
                        <div class="bar-track"><div class="bar-fill" :class="group.color" :style="barStyle(item.value, countMax(group.items))"></div></div>
                        <div class="bar-label category-label" :title="item.name">{{ item.name }}</div>
                      </div>
                    </div>
                    <div v-if="!group.items.length" class="muted distribution-empty">暂无数据</div>
                  </section>
                </div>
              </div>
            </div>
          </div>

          <a-table
            :columns="workforceColumns"
            :data-source="workforceData.page.list"
            :loading="loading.workforce"
            :pagination="tablePagination(workforceData.page.total, workforcePage)"
            row-key="id"
            size="small"
            :scroll="{ x: 1050 }"
            @change="onWorkforcePageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
              <template v-else-if="column.key === 'status'"><a-tag :color="employeeStatusColor(record.status)">{{ employeeStatusText(record.status) }}</a-tag></template>
              <template v-else-if="column.key === 'hireDate'">{{ record.hireDate || '—' }}</template>
              <template v-else-if="column.key === 'age'">{{ record.age == null ? '—' : record.age }}</template>
              <template v-else-if="column.key === 'educationName'">{{ record.educationName || '—' }}</template>
              <template v-else-if="column.key === 'seniorityYears'">{{ record.seniorityYears == null ? '—' : `${formatAmount(record.seniorityYears)} 年` }}</template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canRegularization" key="regularization" tab="试用期转正">
          <div class="filter-bar">
            <a-input
              :value="orgLabel(regularizationFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('regularization')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="regularizationFilters.expiry" :options="regularizationExpiryOptions" style="width: 145px" />
            <a-select v-model:value="regularizationFilters.approvalStatus" :options="regularizationStatusOptions" style="width: 145px" />
            <a-input v-model:value="regularizationFilters.keyword" allow-clear placeholder="姓名 / 工号" style="width: 170px" />
            <a-button @click="resetRegularizationFilters">重置</a-button>
          </div>

          <div class="metric-grid">
            <div v-for="item in regularizationMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-title">未来 6 个月预计转正</div>
              <div class="bar-chart">
                <div v-for="item in regularizationData.monthly" :key="item.month" class="bar-item">
                  <div class="bar-value">{{ item.value || '' }}</div>
                  <div class="bar-track"><div class="bar-fill blue" :style="barStyle(item.value, regularizationMonthMax)"></div></div>
                  <div class="bar-label">{{ item.month.slice(5) }}月</div>
                </div>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">审批状态分布</div>
              <div class="donut-layout">
                <div class="donut" :style="{ background: donutBackground(regularizationStatusSlices) }">
                  <div class="donut-center"><b>{{ regularizationApprovalTotal }}</b><span>人</span></div>
                </div>
                <div class="chart-legend">
                  <div v-for="item in regularizationStatusSlices" :key="item.name" class="legend-row">
                    <i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ formatAmount(item.value) }}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <a-table
            :columns="regularizationColumns"
            :data-source="regularizationData.page.list"
            :loading="loading.regularization"
            :pagination="tablePagination(regularizationData.page.total, regularizationPage)"
            row-key="id"
            size="small"
            :scroll="{ x: 1200 }"
            @change="onRegularizationPageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
              <template v-else-if="column.key === 'hireDate'">{{ record.hireDate || '—' }}</template>
              <template v-else-if="column.key === 'probationMonths'">{{ record.probationMonths == null ? '—' : `${formatAmount(record.probationMonths)} 个月` }}</template>
              <template v-else-if="column.key === 'expectedRegularizeDate'">{{ record.expectedRegularizeDate || '—' }}</template>
              <template v-else-if="column.key === 'remainingDays'">
                <span v-if="record.remainingDays != null" :class="record.remainingDays < 0 ? 'text-danger' : record.remainingDays <= 30 ? 'text-warning' : ''">
                  {{ record.remainingDays < 0 ? `已逾期 ${Math.abs(record.remainingDays)} 天` : `剩余 ${record.remainingDays} 天` }}
                </span>
                <span v-else>—</span>
              </template>
              <template v-else-if="column.key === 'lastApplyDate'">{{ record.lastApplyDate || '—' }}</template>
              <template v-else-if="column.key === 'approvalStatus'"><a-tag :color="regularizationStatusColor(record.approvalStatus)">{{ regularizationStatusText(record.approvalStatus) }}</a-tag></template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canRecruitment" key="recruitment" tab="招聘转化台账">
          <div class="filter-bar">
            <a-range-picker v-model:value="recruitmentFilters.dates" value-format="YYYY-MM-DD" style="width: 250px" />
            <a-input
              :value="orgLabel(recruitmentFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('recruitment')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="recruitmentFilters.stage" :options="recruitmentStageOptions" style="width: 135px" />
            <a-select v-model:value="recruitmentFilters.source" :options="recruitmentSourceOptions" style="width: 145px" />
            <a-input v-model:value="recruitmentFilters.keyword" allow-clear placeholder="姓名 / 编号 / 职位" style="width: 180px" />
            <a-button @click="resetRecruitmentFilters">重置</a-button>
          </div>

          <a-alert
            class="ledger-scope-note"
            type="warning"
            show-icon
            message="指标按期间内实际业务事件统计；明细为当前筛选候选人，不代表同一批候选人的严格转化漏斗。"
          />

          <div class="metric-grid">
            <div v-for="item in recruitmentMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card chart-card-wide">
              <div class="chart-title">候选人来源与当前阶段</div>
              <div class="distribution-chart-scroll">
                <div class="distribution-chart-groups">
                  <section v-for="group in recruitmentDistributions" :key="group.title" class="distribution-group">
                    <div class="distribution-title">{{ group.title }}</div>
                    <div class="bar-chart category-chart distribution-chart">
                      <div v-for="item in group.items" :key="item.key" class="bar-item category-item">
                        <div class="bar-value">{{ formatAmount(item.value) }}</div>
                        <div class="bar-track"><div class="bar-fill" :class="group.color" :style="barStyle(item.value, countMax(group.items))"></div></div>
                        <div class="bar-label category-label" :title="item.name">{{ item.name }}</div>
                      </div>
                    </div>
                    <div v-if="!group.items.length" class="muted distribution-empty">暂无数据</div>
                  </section>
                </div>
              </div>
            </div>
            <div class="chart-card" :class="chartCardClass(recruitmentData.positions.length)">
              <div class="chart-title">职位投递与 Offer 确认</div>
              <div class="grouped-chart category-chart position-chart">
                <div v-for="item in recruitmentData.positions" :key="item.position" class="grouped-item category-item">
                  <div class="grouped-bars">
                    <div class="group-bar-wrap"><span>{{ formatAmount(item.candidates) }}</span><div class="group-bar blue" :style="barStyle(item.candidates, recruitmentPositionMax)"></div></div>
                    <div class="group-bar-wrap"><span>{{ formatAmount(item.confirmedOffers) }}</span><div class="group-bar cyan" :style="barStyle(item.confirmedOffers, recruitmentPositionMax)"></div></div>
                  </div>
                  <div class="bar-label category-label" :title="item.position">{{ item.position }}</div>
                </div>
                <a-empty v-if="!recruitmentData.positions.length" class="category-empty" :image="false" description="暂无数据" />
              </div>
              <div class="inline-legend"><span><i class="blue-bg"></i>当前候选人</span><span><i class="cyan-bg"></i>期间确认 Offer</span></div>
            </div>
          </div>

          <a-table
            :columns="recruitmentColumns"
            :data-source="recruitmentData.page.list"
            :loading="loading.recruitment"
            :pagination="tablePagination(recruitmentData.page.total, recruitmentPage)"
            row-key="id"
            size="small"
            :scroll="{ x: 1120 }"
            @change="onRecruitmentPageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'candidate'"><b>{{ record.name }}</b><div class="muted">{{ record.candidateNo }}</div></template>
              <template v-else-if="column.key === 'source'">{{ recruitmentSourceText(record.source) }}</template>
              <template v-else-if="column.key === 'stage'"><a-tag :color="recruitmentStageColor(record.stage)">{{ recruitmentStageText(record.stage) }}</a-tag></template>
              <template v-else-if="column.key === 'ownerName'">{{ record.ownerName || '—' }}</template>
              <template v-else-if="column.key === 'appliedAt'">{{ dateTimeText(record.appliedAt) }}</template>
              <template v-else-if="column.key === 'lastStageAt'">{{ dateTimeText(record.lastStageAt) }}</template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canContract" key="contracts" tab="合同到期台账">
          <div class="filter-bar">
            <a-input
              :value="orgLabel(contractFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('contract')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="contractFilters.expiry" :options="expiryOptions" style="width: 140px" />
            <a-select v-model:value="contractFilters.type" :options="contractTypeOptions" style="width: 130px" />
            <a-input v-model:value="contractFilters.keyword" allow-clear placeholder="员工 / 工号 / 合同编号" style="width: 210px" />
            <a-button @click="resetContractFilters">重置</a-button>
          </div>

          <div class="metric-grid">
            <div v-for="item in contractMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-title">近 6 个月合同到期</div>
              <div class="bar-chart">
                <div v-for="item in contractMonthly" :key="item.month" class="bar-item">
                  <div class="bar-value">{{ item.value || '' }}</div>
                  <div class="bar-track"><div class="bar-fill blue" :style="barStyle(item.value, contractMonthMax)"></div></div>
                  <div class="bar-label">{{ item.month.slice(5) }}月</div>
                </div>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">合同类型占比</div>
              <div class="donut-layout">
                <div class="donut" :style="{ background: donutBackground(contractTypeSlices) }">
                  <div class="donut-center"><b>{{ contractData.page.total }}</b><span>份合同</span></div>
                </div>
                <div class="chart-legend">
                  <div v-for="item in contractTypeSlices" :key="item.name" class="legend-row">
                    <i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ item.value }}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <a-table
            :columns="contractColumns"
            :data-source="filteredContracts"
            :loading="loading.contracts"
            :pagination="tablePagination(contractData.page.total, contractPage)"
            row-key="id"
            size="small"
            :scroll="{ x: 1050 }"
            @change="onContractPageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
              <template v-else-if="column.key === 'type'">{{ contractTypeText(record.type) }}</template>
              <template v-else-if="column.key === 'remaining'">
                <span :class="record.remainingDays < 0 ? 'text-danger' : record.remainingDays <= 30 ? 'text-warning' : ''">
                  {{ record.remainingDays < 0 ? `已过期 ${Math.abs(record.remainingDays)} 天` : `${record.remainingDays} 天` }}
                </span>
              </template>
              <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 'EXPIRED' ? 'red' : 'green'">{{ record.status === 'EXPIRED' ? '已过期' : '生效中' }}</a-tag></template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canMovement" key="movement" tab="人员流动台账">
          <div class="filter-bar">
            <a-range-picker v-model:value="movementFilters.months" picker="month" value-format="YYYY-MM" style="width: 240px" />
            <a-input
              :value="orgLabel(movementFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('movement')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="movementFilters.event" :options="movementEventOptions" style="width: 140px" />
            <a-button @click="resetMovementFilters">重置</a-button>
          </div>

          <div class="metric-grid">
            <div v-for="item in movementMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card chart-card-wide">
              <div class="chart-title">月度入职 / 离职趋势</div>
              <div class="grouped-chart">
                <div v-for="item in movementMonthly" :key="item.month" class="grouped-item">
                  <div class="grouped-bars">
                    <div class="group-bar-wrap"><span>{{ item.hires || '' }}</span><div class="group-bar green" :style="barStyle(item.hires, movementMonthMax)"></div></div>
                    <div class="group-bar-wrap"><span>{{ item.resigns || '' }}</span><div class="group-bar orange" :style="barStyle(item.resigns, movementMonthMax)"></div></div>
                  </div>
                  <div class="bar-label">{{ item.month.slice(5) }}月</div>
                </div>
              </div>
              <div class="inline-legend"><span><i class="green-bg"></i>入职</span><span><i class="orange-bg"></i>离职</span></div>
            </div>
            <div class="chart-card" :class="chartCardClass(movementOrgNet.length)">
              <div class="chart-title">组织净增人数</div>
              <div class="bar-chart category-chart">
                <div v-for="item in movementOrgNet" :key="item.org" class="bar-item category-item">
                  <div class="bar-value" :class="item.value < 0 ? 'text-danger' : 'text-success'">{{ item.value > 0 ? '+' : '' }}{{ item.value }}</div>
                  <div class="bar-track"><div class="bar-fill" :class="item.value < 0 ? 'red' : 'green'" :style="barStyle(Math.abs(item.value), movementOrgMax)"></div></div>
                  <div class="bar-label category-label" :title="item.org">{{ item.org }}</div>
                </div>
                <a-empty v-if="!movementOrgNet.length" class="category-empty" :image="false" description="暂无数据" />
              </div>
            </div>
          </div>

          <a-table
            :columns="movementColumns"
            :data-source="filteredMovement"
            :loading="loading.movement"
            :pagination="tablePagination(movementData.page.total, movementPage)"
            row-key="id"
            size="small"
            :scroll="{ x: 900 }"
            @change="onMovementPageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'event'"><a-tag :color="movementEventColor(record.event)">{{ movementEventText(record.event) }}</a-tag></template>
              <template v-else-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canLeaves" key="leaves" tab="请假统计">
          <a-alert
            class="ledger-scope-note"
            type="warning"
            show-icon
            message="按请假开始日期归属统计，跨月或跨期单据天数全额计入开始月份；已通过和已销假计入有效请假。"
          />
          <div class="filter-bar">
            <a-range-picker v-model:value="leaveFilters.dates" value-format="YYYY-MM-DD" style="width: 250px" />
            <a-input
              :value="orgLabel(leaveFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('leaves')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="leaveFilters.type" :options="leaveTypeOptions" style="width: 140px" />
            <a-select v-model:value="leaveFilters.status" :options="leaveStatusOptions" style="width: 125px" />
            <a-input v-model:value="leaveFilters.keyword" allow-clear placeholder="姓名 / 工号" style="width: 160px" />
            <a-button @click="resetLeaveFilters">重置</a-button>
          </div>

          <div class="metric-grid">
            <div v-for="item in leaveMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card chart-card-wide">
              <div class="chart-title">月度有效请假天数</div>
              <div class="bar-chart">
                <div v-for="item in leaveData.monthly" :key="item.month" class="bar-item">
                  <div class="bar-value">{{ item.value ? formatAmount(item.value) : '' }}</div>
                  <div class="bar-track"><div class="bar-fill blue" :style="barStyle(item.value, leaveMonthMax)"></div></div>
                  <div class="bar-label">{{ item.month.slice(5) }}月</div>
                </div>
              </div>
            </div>
            <div class="chart-card chart-card-wide">
              <div class="chart-title">各组织有效请假天数</div>
              <div class="bar-chart category-chart">
                <div v-for="item in leaveData.byOrg" :key="item.org" class="bar-item category-item">
                  <div class="bar-value">{{ formatAmount(item.value) }}</div>
                  <div class="bar-track"><div class="bar-fill cyan" :style="barStyle(item.value, leaveOrgMax)"></div></div>
                  <div class="bar-label category-label" :title="item.org">{{ item.org }}</div>
                </div>
                <a-empty v-if="!leaveData.byOrg.length" class="category-empty" :image="false" description="暂无数据" />
              </div>
            </div>
          </div>

          <a-table
            :columns="leaveColumns"
            :data-source="leaveData.page.list"
            :loading="loading.leaves"
            :pagination="tablePagination(leaveData.page.total, leavePage)"
            row-key="id"
            size="small"
            :scroll="{ x: 1250 }"
            @change="onLeavePageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
              <template v-else-if="column.key === 'typeName'">{{ record.typeName || record.type }}</template>
              <template v-else-if="column.key === 'range'">{{ record.startDate }} 至 {{ record.endDate }}</template>
              <template v-else-if="column.key === 'days'">{{ formatAmount(record.days) }}</template>
              <template v-else-if="column.key === 'dayMode'">{{ leaveDayModeText(record.dayMode) }}</template>
              <template v-else-if="column.key === 'status'"><a-tag :color="leaveStatusColor(record.status)">{{ leaveStatusText(record.status) }}</a-tag></template>
              <template v-else-if="column.key === 'returnDate'">{{ record.returnDate || '—' }}</template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canOvertimes" key="overtimes" tab="加班调休">
          <div class="filter-bar">
            <a-range-picker v-model:value="overtimeFilters.dates" value-format="YYYY-MM-DD" style="width: 250px" />
            <a-input
              :value="orgLabel(overtimeFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('overtimes')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="overtimeFilters.type" :options="overtimeTypeOptions" style="width: 125px" />
            <a-select v-model:value="overtimeFilters.status" :options="overtimeStatusOptions" style="width: 125px" />
            <a-select v-model:value="overtimeFilters.settleStatus" :options="overtimeSettleOptions" style="width: 125px" />
            <a-input v-model:value="overtimeFilters.keyword" allow-clear placeholder="姓名 / 工号" style="width: 160px" />
            <a-button @click="resetOvertimeFilters">重置</a-button>
          </div>

          <div class="metric-grid">
            <div v-for="item in overtimeMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-title">月度已审批加班小时</div>
              <div class="bar-chart">
                <div v-for="item in overtimeData.monthly" :key="item.month" class="bar-item">
                  <div class="bar-value">{{ item.value ? formatAmount(item.value) : '' }}</div>
                  <div class="bar-track"><div class="bar-fill purple" :style="barStyle(item.value, overtimeMonthMax)"></div></div>
                  <div class="bar-label">{{ item.month.slice(5) }}月</div>
                </div>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">加班类型小时分布</div>
              <div class="horizontal-chart">
                <div v-for="item in overtimeData.types" :key="item.key" class="horizontal-row amount-row">
                  <span class="horizontal-label" :title="item.name">{{ item.name }}</span>
                  <div class="horizontal-track"><div class="horizontal-bar purple-bar" :style="horizontalStyle(item.value, overtimeTypeMax)"></div></div>
                  <b>{{ formatAmount(item.value) }}</b>
                </div>
                <a-empty v-if="!overtimeData.types.length" :image="false" description="暂无数据" />
              </div>
            </div>
            <div class="chart-card" :class="chartCardClass(overtimeData.byOrg.length)">
              <div class="chart-title">各组织已审批及未结算小时</div>
              <div class="grouped-chart category-chart">
                <div v-for="item in overtimeData.byOrg" :key="item.org" class="grouped-item category-item">
                  <div class="grouped-bars">
                    <div class="group-bar-wrap"><span>{{ formatAmount(item.hours) }}</span><div class="group-bar blue" :style="barStyle(item.hours, overtimeOrgMax)"></div></div>
                    <div class="group-bar-wrap"><span>{{ formatAmount(item.unsettledHours) }}</span><div class="group-bar orange" :style="barStyle(item.unsettledHours, overtimeOrgMax)"></div></div>
                  </div>
                  <div class="bar-label category-label" :title="item.org">{{ item.org }}</div>
                </div>
                <a-empty v-if="!overtimeData.byOrg.length" class="category-empty" :image="false" description="暂无数据" />
              </div>
              <div class="inline-legend"><span><i class="blue-bg"></i>已审批</span><span><i class="orange-bg"></i>未结算</span></div>
            </div>
          </div>

          <a-table
            :columns="overtimeColumns"
            :data-source="overtimeData.page.list"
            :loading="loading.overtimes"
            :pagination="tablePagination(overtimeData.page.total, overtimePage)"
            row-key="id"
            size="small"
            :scroll="{ x: 1400 }"
            @change="onOvertimePageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
              <template v-else-if="column.key === 'startTime'">{{ shortTime(record.startTime) }}</template>
              <template v-else-if="column.key === 'endTime'">{{ shortTime(record.endTime) }}</template>
              <template v-else-if="column.key === 'type'"><a-tag :color="overtimeTypeColor(record.type)">{{ overtimeTypeText(record.type) }}</a-tag></template>
              <template v-else-if="column.key === 'hours'">{{ formatAmount(record.hours) }}</template>
              <template v-else-if="column.key === 'effectiveHours'">{{ record.effectiveHours == null ? '—' : formatAmount(record.effectiveHours) }}</template>
              <template v-else-if="column.key === 'status'"><a-tag :color="leaveStatusColor(record.status)">{{ overtimeStatusText(record.status) }}</a-tag></template>
              <template v-else-if="column.key === 'settleStatus'"><a-tag :color="record.settleStatus === 1 ? 'green' : 'orange'">{{ overtimeSettleText(record.settleStatus) }}</a-tag></template>
              <template v-else-if="column.key === 'settledAt'">{{ dateTimeText(record.settledAt) }}</template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canAttendance" key="attendance" tab="考勤异常台账">
          <div class="filter-bar">
            <a-select v-model:value="attendanceFilters.month" :options="attendanceMonthOptions" style="width: 125px" />
            <a-input
              :value="orgLabel(attendanceFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('attendance')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="attendanceFilters.type" :options="attendanceTypeOptions" style="width: 130px" />
            <a-select v-model:value="attendanceFilters.status" :options="attendanceStatusOptions" style="width: 130px" />
            <a-input v-model:value="attendanceFilters.keyword" allow-clear placeholder="员工 / 工号" style="width: 170px" />
            <a-button @click="resetAttendanceFilters">重置</a-button>
          </div>

          <div class="metric-grid five-columns">
            <div v-for="item in attendanceMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-title">每日异常记录</div>
              <div class="bar-chart compact">
                <div v-for="item in attendanceDaily" :key="item.date" class="bar-item">
                  <div class="bar-value">{{ item.value || '' }}</div>
                  <div class="bar-track"><div class="bar-fill purple" :style="barStyle(item.value, attendanceDayMax)"></div></div>
                  <div class="bar-label">{{ item.date.slice(5) }}</div>
                </div>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">异常类型分布</div>
              <div class="donut-layout">
                <div class="donut" :style="{ background: donutBackground(attendanceTypeSlices) }">
                  <div class="donut-center"><b>{{ attendanceData.total }}</b><span>条异常</span></div>
                </div>
                <div class="chart-legend">
                  <div v-for="item in attendanceTypeSlices" :key="item.name" class="legend-row">
                    <i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ item.value }}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <a-table
            :columns="attendanceColumns"
            :data-source="filteredAttendance"
            :loading="loading.attendance"
            :pagination="tablePagination(attendanceData.page.total, attendancePage)"
            row-key="id"
            size="small"
            :scroll="{ x: 950 }"
            @change="onAttendancePageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
              <template v-else-if="column.key === 'type'"><a-tag :color="attendanceTypeColor(record.type)">{{ attendanceTypeText(record.type) }}</a-tag></template>
              <template v-else-if="column.key === 'value'">{{ record.type === 'ABSENT' ? `${formatAmount(record.value)} 小时` : `${formatAmount(record.value)} 分钟` }}</template>
              <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 'PENDING' ? 'orange' : record.status === 'NONE' ? 'default' : 'green'">{{ attendanceStatusText(record.status) }}</a-tag></template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </section>

    <a-modal
      v-model:open="orgPickerOpen"
      title="选择组织"
      :width="440"
      :footer="null"
      centered
    >
      <a-input
        v-model:value="orgKeyword"
        allow-clear
        placeholder="搜索组织名称"
        class="org-search"
      />
      <div class="org-picker-tree">
        <a-tree
          :tree-data="orgPickerTreeData"
          :selected-keys="[selectedOrgValue]"
          :expanded-keys="orgPickerExpanded"
          block-node
          @expand="(keys: (string | number)[]) => (orgPickerExpanded = keys.map(String))"
          @select="onSelectOrg"
        />
      </div>
      <a-empty v-if="!orgPickerTreeData.length" description="未找到匹配组织" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ApartmentOutlined, FundOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import {
  getAttendanceLedger,
  getContractLedger,
  getLeaveLedger,
  getMovementLedger,
  getOvertimeLedger,
  getRecruitmentLedger,
  getRegularizationLedger,
  getWorkforceLedger,
  type AttendanceLedgerData,
  type ContractLedgerData,
  type LedgerCountItem,
  type LedgerOrgOption,
  type LeaveLedgerData,
  type MovementLedgerData,
  type OvertimeLedgerData,
  type RecruitmentLedgerData,
  type RegularizationLedgerData,
  type WorkforceLedgerData
} from '@/api/ehr'

const store = useUserStore()
const canWorkforce = computed(() => store.can('ledger:workforce'))
const canRegularization = computed(() => store.can('ledger:regularization'))
const canRecruitment = computed(() => store.can('ledger:recruitment'))
const canContract = computed(() => store.can('ledger:contract'))
const canMovement = computed(() => store.can('ledger:movement'))
const canLeaves = computed(() => store.can('ledger:leaves'))
const canOvertimes = computed(() => store.can('ledger:overtimes'))
const canAttendance = computed(() => store.can('ledger:attendance'))
const activeTab = ref(
  canWorkforce.value ? 'workforce'
    : canRegularization.value ? 'regularization'
      : canRecruitment.value ? 'recruitment'
        : canContract.value ? 'contracts'
          : canMovement.value ? 'movement'
            : canLeaves.value ? 'leaves'
              : canOvertimes.value ? 'overtimes'
                : canAttendance.value ? 'attendance' : ''
)
const pageSize = 10
const workforcePage = ref(1)
const regularizationPage = ref(1)
const recruitmentPage = ref(1)
const contractPage = ref(1)
const movementPage = ref(1)
const leavePage = ref(1)
const overtimePage = ref(1)
const attendancePage = ref(1)
const loading = reactive({
  workforce: false, regularization: false, recruitment: false,
  contracts: false, movement: false, leaves: false, overtimes: false, attendance: false
})
const orgs = ref<LedgerOrgOption[]>([])

const workforceStatusOptions = [
  { value: 'ALL', label: '全部人员状态' }, { value: '10', label: '待入职' },
  { value: '20', label: '入职审批中' }, { value: '25', label: '入职审批通过' },
  { value: '30', label: '试用期' }, { value: '40', label: '在职' },
  { value: '50', label: '离职中' }, { value: '60', label: '已离职' }
]
const regularizationExpiryOptions = [
  { value: 'ALL', label: '全部转正区间' }, { value: 'OVERDUE', label: '已逾期' },
  { value: '30', label: '三十天内' }, { value: '60', label: '31–60 天' }, { value: 'LATER', label: '六十天以上' }
]
const regularizationStatusOptions = [
  { value: 'ALL', label: '全部审批状态' }, { value: '0', label: '未申请' },
  { value: '1', label: '部门审批中' }, { value: '2', label: '人事审批中' }, { value: '-1', label: '已驳回' }
]
const leaveStatusOptions = [
  { value: 'ALL', label: '全部状态' }, { value: '0', label: '待审批' },
  { value: '1', label: '已通过' }, { value: '2', label: '已驳回' },
  { value: '3', label: '已撤销' }, { value: '4', label: '已销假' }
]
const overtimeTypeOptions = [
  { value: 'ALL', label: '全部类型' }, { value: 'NORMAL', label: '工作日加班' },
  { value: 'RESTDAY', label: '休息日加班' }, { value: 'HOLIDAY', label: '节假日加班' }
]
const overtimeStatusOptions = [
  { value: 'ALL', label: '全部审批状态' }, { value: '0', label: '待审批' },
  { value: '1', label: '已通过' }, { value: '2', label: '已驳回' }, { value: '3', label: '已撤销' }
]
const overtimeSettleOptions = [
  { value: 'ALL', label: '全部结算状态' }, { value: '0', label: '未结算' }, { value: '1', label: '已结算' }
]
const contractTypeOptions = [
  { value: 'ALL', label: '全部类型' }, { value: 'FIXED', label: '固定期限' },
  { value: 'UNFIXED', label: '无固定期限' }, { value: 'INTERN', label: '实习协议' }, { value: 'LABOR', label: '劳务协议' }
]
const expiryOptions = [
  { value: 'ALL', label: '全部到期区间' }, { value: '30', label: '30 天内到期' },
  { value: '60', label: '31–60 天到期' }, { value: '90', label: '61–90 天到期' }, { value: 'EXPIRED', label: '已过期' }
]
const movementEventOptions = [
  { value: 'ALL', label: '全部流动类型' }, { value: 'ONBOARD', label: '入职' },
  { value: 'REGULAR', label: '转正' }, { value: 'RESIGN', label: '离职' }
]
const attendanceTypeOptions = [
  { value: 'ALL', label: '全部异常' }, { value: 'LATE', label: '迟到' }, { value: 'EARLY', label: '早退' },
  { value: 'MISSING', label: '缺卡' }, { value: 'ABSENT', label: '缺勤' }
]
const attendanceStatusOptions = [
  { value: 'ALL', label: '全部状态' }, { value: 'PENDING', label: '待处理' },
  { value: 'DONE', label: '已处理' }, { value: 'NONE', label: '无需处理' }
]
const recruitmentStageOptions = [
  { value: 'ALL', label: '全部候选人阶段' }, { value: 'RESUME', label: '简历筛选' },
  { value: 'INTERVIEW', label: '面试中' }, { value: 'OFFER', label: 'Offer 阶段' },
  { value: 'REJECTED', label: '已淘汰' }
]
const attendanceMonthOptions = Array.from({ length: 12 }, (_, index) => {
  const value = monthOffset(-index)
  return { value, label: `${value.slice(0, 4)} 年 ${Number(value.slice(5))} 月` }
})

const workforceFilters = reactive({ org: 'ALL', status: 'ALL', position: '', keyword: '' })
const regularizationFilters = reactive({ org: 'ALL', expiry: 'ALL', approvalStatus: 'ALL', keyword: '' })
const recruitmentFilters = reactive({ dates: defaultDateRange(), org: 'ALL', stage: 'ALL', source: '', keyword: '' })
const contractFilters = reactive({ org: 'ALL', expiry: 'ALL', type: 'ALL', keyword: '' })
const movementFilters = reactive({ months: [monthOffset(-11), monthOffset(0)] as string[], org: 'ALL', event: 'ALL' })
const leaveFilters = reactive({ dates: defaultDateRange(), org: 'ALL', type: 'ALL', status: 'ALL', keyword: '' })
const overtimeFilters = reactive({ dates: defaultDateRange(), org: 'ALL', type: 'ALL', status: 'ALL', settleStatus: 'ALL', keyword: '' })
const attendanceFilters = reactive({ month: monthOffset(0), org: 'ALL', type: 'ALL', status: 'ALL', keyword: '' })

type OrgPickerTarget = 'workforce' | 'regularization' | 'recruitment' | 'contract' | 'movement' | 'leaves' | 'overtimes' | 'attendance'
interface OrgTreeNode { key: string; title: string; children?: OrgTreeNode[] }
const orgPickerOpen = ref(false)
const orgKeyword = ref('')
const orgPickerExpanded = ref<string[]>([])
const orgPickerTarget = ref<OrgPickerTarget>('workforce')
const selectedOrgValue = computed(() => {
  if (orgPickerTarget.value === 'workforce') return workforceFilters.org
  if (orgPickerTarget.value === 'regularization') return regularizationFilters.org
  if (orgPickerTarget.value === 'recruitment') return recruitmentFilters.org
  if (orgPickerTarget.value === 'contract') return contractFilters.org
  if (orgPickerTarget.value === 'movement') return movementFilters.org
  if (orgPickerTarget.value === 'leaves') return leaveFilters.org
  if (orgPickerTarget.value === 'overtimes') return overtimeFilters.org
  return attendanceFilters.org
})
const orgPickerTreeData = computed<OrgTreeNode[]>(() => {
  const nodes = new Map<string, OrgTreeNode>()
  const roots: OrgTreeNode[] = []
  orgs.value.forEach(org => nodes.set(String(org.id), { key: String(org.id), title: org.name, children: [] }))
  orgs.value.forEach(org => {
    const node = nodes.get(String(org.id))!
    const parent = org.parentId ? nodes.get(String(org.parentId)) : undefined
    if (parent) parent.children!.push(node)
    else roots.push(node)
  })
  const keyword = orgKeyword.value.trim().toLowerCase()
  const filterNodes = (items: OrgTreeNode[]): OrgTreeNode[] => items.reduce<OrgTreeNode[]>((result, node) => {
    const children = filterNodes(node.children || [])
    if (!keyword || node.title.toLowerCase().includes(keyword) || children.length) {
      result.push({ ...node, children: children.length ? children : undefined })
    }
    return result
  }, [])
  const tree = filterNodes(roots)
  if (!keyword || '全部组织'.includes(keyword)) tree.unshift({ key: 'ALL', title: '全部组织' })
  return tree
})
function orgLabel(value: string) {
  if (value === 'ALL') return '全部组织'
  return orgs.value.find(org => String(org.id) === value)?.name || '全部组织'
}
function openOrgPicker(target: OrgPickerTarget) {
  orgPickerTarget.value = target
  orgKeyword.value = ''
  orgPickerExpanded.value = orgs.value.map(org => String(org.id))
  orgPickerOpen.value = true
}
function onSelectOrg(keys: (string | number)[]) {
  if (keys.length) selectOrg(String(keys[0]))
}
function selectOrg(value: string) {
  if (orgPickerTarget.value === 'workforce') workforceFilters.org = value
  else if (orgPickerTarget.value === 'regularization') regularizationFilters.org = value
  else if (orgPickerTarget.value === 'recruitment') recruitmentFilters.org = value
  else if (orgPickerTarget.value === 'contract') contractFilters.org = value
  else if (orgPickerTarget.value === 'movement') movementFilters.org = value
  else if (orgPickerTarget.value === 'leaves') leaveFilters.org = value
  else if (orgPickerTarget.value === 'overtimes') overtimeFilters.org = value
  else attendanceFilters.org = value
  orgPickerOpen.value = false
}

const workforceData = ref<WorkforceLedgerData>({
  page: { list: [], total: 0 }, active: 0, probation: 0, pending: 0, offboarding: 0,
  orgs: [], byOrg: [], educations: [], ageGroups: [], seniorityGroups: []
})
const regularizationData = ref<RegularizationLedgerData>({
  page: { list: [], total: 0 }, current: 0, overdue: 0, due30: 0, approving: 0,
  orgs: [], monthly: [], byOrg: [], approvalStatuses: []
})
const recruitmentData = ref<RecruitmentLedgerData>({
  page: { list: [], total: 0 }, newCandidates: 0, interviewedCandidates: 0, confirmedOffers: 0, recruitedEmployees: 0,
  orgs: [], sources: [], stages: [], positions: []
})
const contractData = ref<ContractLedgerData>({
  page: { list: [], total: 0 }, within30: 0, within60: 0, within90: 0, expired: 0, orgs: [], monthly: [], types: []
})
const movementData = ref<MovementLedgerData>({
  page: { list: [], total: 0 }, hires: 0, resigns: 0, net: 0, turnoverRate: 0, orgs: [], monthly: [], orgNet: []
})
const leaveData = ref<LeaveLedgerData>({
  page: { list: [], total: 0 }, effectivePeople: 0, effectiveDays: 0, pendingCount: 0, pendingDays: 0,
  orgs: [], monthly: [], types: [], byOrg: []
})
const overtimeData = ref<OvertimeLedgerData>({
  page: { list: [], total: 0 }, approvedHours: 0, effectiveHours: 0, pendingCount: 0, unsettledHours: 0,
  orgs: [], monthly: [], types: [], byOrg: []
})
const attendanceData = ref<AttendanceLedgerData>({
  page: { list: [], total: 0 }, total: 0, late: 0, early: 0, missing: 0, absent: 0,
  lateMinutes: 0, earlyMinutes: 0, orgs: [], daily: [], types: []
})

const workforceMetrics = computed(() => [
  { label: '当前在职', value: formatAmount(workforceData.value.active), hint: '试用期与正式在职', tone: 'text-success' },
  { label: '试用期', value: formatAmount(workforceData.value.probation), hint: '关注转正进度', tone: 'text-warning' },
  { label: '待入职', value: formatAmount(workforceData.value.pending), hint: '待办理及审批中', tone: 'text-primary' },
  { label: '离职中', value: formatAmount(workforceData.value.offboarding), hint: '交接处理中', tone: 'text-danger' }
])
const workforceOrgMax = computed(() => Math.max(1, ...workforceData.value.byOrg.map(x => x.value)))
const workforceDistributions = computed(() => [
  { title: '学历分布', items: workforceData.value.educations, color: 'blue' },
  { title: '年龄分布', items: workforceData.value.ageGroups, color: 'cyan' },
  { title: '司龄分布', items: workforceData.value.seniorityGroups, color: 'purple' }
])
const workforceColumns = [
  { title: '员工', key: 'employee', width: 130 }, { title: '组织', dataIndex: 'org', width: 120 },
  { title: '职位', dataIndex: 'position', width: 130 }, { title: '状态', key: 'status', width: 110 },
  { title: '入职日期', key: 'hireDate', width: 110 }, { title: '年龄', key: 'age', width: 75 },
  { title: '学历', key: 'educationName', width: 100 }, { title: '本单位司龄', key: 'seniorityYears', width: 110 }
]
function resetWorkforceFilters() { Object.assign(workforceFilters, { org: 'ALL', status: 'ALL', position: '', keyword: '' }) }
function employeeStatusText(status: number) {
  return workforceStatusOptions.find(item => item.value === String(status))?.label || '未知'
}
function employeeStatusColor(status: number) {
  return ({ 10: 'default', 20: 'processing', 25: 'cyan', 30: 'gold', 40: 'green', 50: 'orange', 60: 'default' } as Record<number, string>)[status] || 'default'
}
function countMax(items: LedgerCountItem[]) { return Math.max(1, ...items.map(item => item.value)) }

const regularizationMetrics = computed(() => [
  { label: '当前试用期', value: formatAmount(regularizationData.value.current), hint: '当前筛选范围', tone: 'text-primary' },
  { label: '已逾期', value: formatAmount(regularizationData.value.overdue), hint: '需尽快处理', tone: 'text-danger' },
  { label: '三十天内', value: formatAmount(regularizationData.value.due30), hint: '即将到期转正', tone: 'text-warning' },
  { label: '审批中', value: formatAmount(regularizationData.value.approving), hint: '部门或人事审批', tone: 'text-success' }
])
const regularizationMonthMax = computed(() => Math.max(1, ...regularizationData.value.monthly.map(x => x.value)))
const regularizationStatusSlices = computed(() => regularizationData.value.approvalStatuses.filter(x => x.value > 0)
  .map((x, index) => ({ name: x.name, value: x.value, color: ['#bfbfbf', '#1677ff', '#722ed1', '#f5222d'][index % 4] })))
const regularizationApprovalTotal = computed(() => formatAmount(regularizationData.value.approvalStatuses.reduce((sum, item) => sum + item.value, 0)))
const regularizationColumns = [
  { title: '员工', key: 'employee', width: 125 }, { title: '组织', dataIndex: 'org', width: 115 },
  { title: '职位', dataIndex: 'position', width: 120 }, { title: '入职日期', key: 'hireDate', width: 110 },
  { title: '试用期', key: 'probationMonths', width: 95 }, { title: '预计转正', key: 'expectedRegularizeDate', width: 110 },
  { title: '剩余 / 逾期', key: 'remainingDays', width: 120 }, { title: '最近申请', key: 'lastApplyDate', width: 110 },
  { title: '审批状态', key: 'approvalStatus', width: 110 }
]
function resetRegularizationFilters() { Object.assign(regularizationFilters, { org: 'ALL', expiry: 'ALL', approvalStatus: 'ALL', keyword: '' }) }
function regularizationStatusText(status: number) {
  return regularizationStatusOptions.find(item => item.value === String(status))?.label || '未知'
}
function regularizationStatusColor(status: number) {
  return status === 1 ? 'processing' : status === 2 ? 'purple' : status === -1 ? 'red' : 'default'
}

const recruitmentSourceOptions = computed(() => [
  { value: '', label: '全部来源' },
  ...recruitmentData.value.sources.map(item => ({ value: item.key, label: recruitmentSourceText(item.key) }))
])
const recruitmentMetrics = computed(() => [
  { label: '期间新增候选人', value: formatAmount(recruitmentData.value.newCandidates), hint: '按候选人创建时间', tone: 'text-primary' },
  { label: '期间完成面试判定', value: formatAmount(recruitmentData.value.interviewedCandidates), hint: '按候选人去重', tone: 'text-warning' },
  { label: '期间确认 Offer', value: formatAmount(recruitmentData.value.confirmedOffers), hint: '按 Offer 确认时间', tone: 'text-success' },
  { label: '期间招聘入职', value: formatAmount(recruitmentData.value.recruitedEmployees), hint: '仅计来源 Offer 的入职', tone: 'text-success' }
])
const recruitmentDistributions = computed(() => [
  { title: '来源分布', items: recruitmentData.value.sources.map(item => ({ ...item, name: recruitmentSourceText(item.key) })), color: 'cyan' },
  { title: '当前阶段', items: recruitmentData.value.stages, color: 'blue' }
])
const recruitmentPositionMax = computed(() => Math.max(1, ...recruitmentData.value.positions.flatMap(x => [x.candidates, x.confirmedOffers])))
const recruitmentColumns = [
  { title: '候选人', key: 'candidate', width: 140 }, { title: '组织', dataIndex: 'org', width: 120 },
  { title: '职位', dataIndex: 'position', width: 140 }, { title: '来源', key: 'source', width: 110 },
  { title: '当前阶段', key: 'stage', width: 105 }, { title: '负责人', key: 'ownerName', width: 100 },
  { title: '投递时间', key: 'appliedAt', width: 145 }, { title: '最近阶段时间', key: 'lastStageAt', width: 145 }
]
function resetRecruitmentFilters() { Object.assign(recruitmentFilters, { dates: defaultDateRange(), org: 'ALL', stage: 'ALL', source: '', keyword: '' }) }
function recruitmentStageText(stage: string) { return recruitmentStageOptions.find(item => item.value === stage)?.label || stage || '未知' }
function recruitmentStageColor(stage: string) { return ({ RESUME: 'blue', INTERVIEW: 'purple', OFFER: 'green', REJECTED: 'default' } as Record<string, string>)[stage] || 'default' }
function recruitmentSourceText(source: string) {
  return ({ PORTAL: '门户网站', REFERRAL: '内推', HEADHUNTER: '猎头', WEBSITE: '官网', JOB_BOARD: '招聘网站', OTHER: '其他', UNKNOWN: '未知来源' } as Record<string, string>)[source] || source || '未知来源'
}

const filteredContracts = computed(() => contractData.value.page.list)
const contractMetrics = computed(() => [
  { label: '30 天内到期', value: contractData.value.within30, hint: '优先安排续签', tone: 'text-danger' },
  { label: '31–60 天到期', value: contractData.value.within60, hint: '提前确认意向', tone: 'text-warning' },
  { label: '61–90 天到期', value: contractData.value.within90, hint: '纳入续签计划', tone: 'text-primary' },
  { label: '已过期', value: contractData.value.expired, hint: '需要立即核查', tone: 'text-danger' }
])
const contractMonthly = computed(() => contractData.value.monthly)
const contractMonthMax = computed(() => Math.max(1, ...contractMonthly.value.map(x => x.value)))
const contractTypeSlices = computed(() => contractData.value.types.filter(x => x.value > 0)
  .map((x, index) => ({ name: x.name, value: x.value, color: ['#1677ff', '#13c2c2', '#722ed1', '#faad14'][index % 4] })))
const contractColumns = [
  { title: '员工', key: 'employee', width: 120 }, { title: '组织', dataIndex: 'org', width: 110 },
  { title: '合同编号', dataIndex: 'contractNo', width: 140 }, { title: '类型', key: 'type', width: 100 },
  { title: '开始日期', dataIndex: 'startDate', width: 110 }, { title: '结束日期', dataIndex: 'endDate', width: 110 },
  { title: '剩余天数', key: 'remaining', width: 125 }, { title: '状态', key: 'status', width: 90 }
]
function resetContractFilters() { Object.assign(contractFilters, { org: 'ALL', expiry: 'ALL', type: 'ALL', keyword: '' }) }
function contractTypeText(type: string) { return ({ FIXED: '固定期限', UNFIXED: '无固定期限', INTERN: '实习协议', LABOR: '劳务协议' } as Record<string, string>)[type] || type }

const filteredMovement = computed(() => movementData.value.page.list)
const movementMetrics = computed(() => [
  { label: '期间入职', value: movementData.value.hires, hint: '新入职员工', tone: 'text-success' },
  { label: '期间离职', value: movementData.value.resigns, hint: '已办理离职', tone: 'text-warning' },
  { label: '净增人数', value: movementData.value.net, hint: '入职减离职', tone: 'text-primary' },
  { label: '离职率', value: `${formatAmount(movementData.value.turnoverRate)}%`, hint: '按期初与期末平均在职人数', tone: 'text-danger' }
])
const movementMonthly = computed(() => movementData.value.monthly)
const movementMonthMax = computed(() => Math.max(1, ...movementMonthly.value.flatMap(x => [x.hires, x.resigns])))
const movementOrgNet = computed(() => movementData.value.orgNet)
const movementOrgMax = computed(() => Math.max(1, ...movementOrgNet.value.map(x => Math.abs(x.value))))
const movementColumns = [
  { title: '日期', dataIndex: 'date', width: '14%' }, { title: '员工', key: 'employee', width: '20%' },
  { title: '组织', dataIndex: 'org', width: '24%' }, { title: '流动类型', key: 'event', width: '14%' }, { title: '说明', dataIndex: 'detail', width: '28%' }
]
function resetMovementFilters() { Object.assign(movementFilters, { months: [monthOffset(-11), monthOffset(0)], org: 'ALL', event: 'ALL' }) }
function movementEventText(event: string) { return ({ ONBOARD: '入职', REGULAR: '转正', RESIGN: '离职' } as Record<string, string>)[event] || event }
function movementEventColor(event: string) { return event === 'ONBOARD' ? 'green' : event === 'RESIGN' ? 'orange' : 'blue' }

const leaveTypeOptions = computed(() => [
  { value: 'ALL', label: '全部类型' },
  ...leaveData.value.types.map(item => ({ value: item.key, label: item.name }))
])
const leaveMetrics = computed(() => [
  { label: '有效请假人数', value: formatAmount(leaveData.value.effectivePeople), hint: '已通过及已销假', tone: 'text-primary' },
  { label: '有效请假天数', value: formatAmount(leaveData.value.effectiveDays), hint: '按开始日期归属', tone: 'text-success' },
  { label: '待审批单数', value: formatAmount(leaveData.value.pendingCount), hint: '等待审批处理', tone: 'text-warning' },
  { label: '待审批天数', value: formatAmount(leaveData.value.pendingDays), hint: '待审批申请合计', tone: 'text-danger' }
])
const leaveMonthMax = computed(() => Math.max(1, ...leaveData.value.monthly.map(x => x.value)))
const leaveOrgMax = computed(() => Math.max(1, ...leaveData.value.byOrg.map(x => x.value)))
const leaveColumns = [
  { title: '单号', dataIndex: 'leaveNo', width: 145 }, { title: '员工', key: 'employee', width: 125 },
  { title: '组织', dataIndex: 'org', width: 115 }, { title: '类型', key: 'typeName', width: 100 },
  { title: '起止日期', key: 'range', width: 205 }, { title: '天数', key: 'days', width: 80 },
  { title: '计时方式', key: 'dayMode', width: 95 }, { title: '状态', key: 'status', width: 90 },
  { title: '销假日期', key: 'returnDate', width: 110 }
]
function resetLeaveFilters() { Object.assign(leaveFilters, { dates: defaultDateRange(), org: 'ALL', type: 'ALL', status: 'ALL', keyword: '' }) }
function leaveDayModeText(mode: string) { return ({ NATURAL: '自然日', WORKDAY: '工作日' } as Record<string, string>)[mode] || mode || '—' }
function leaveStatusText(status: number) { return leaveStatusOptions.find(item => item.value === String(status))?.label || '未知' }
function leaveStatusColor(status: number) { return status === 0 ? 'orange' : status === 1 || status === 4 ? 'green' : status === 2 ? 'red' : 'default' }

const overtimeMetrics = computed(() => [
  { label: '已审批加班小时', value: formatAmount(overtimeData.value.approvedHours), hint: '当前筛选范围', tone: 'text-primary' },
  { label: '已计调休有效小时', value: formatAmount(overtimeData.value.effectiveHours), hint: '有效加班时长', tone: 'text-success' },
  { label: '待审批单数', value: formatAmount(overtimeData.value.pendingCount), hint: '等待审批处理', tone: 'text-warning' },
  { label: '未结算加班小时', value: formatAmount(overtimeData.value.unsettledHours), hint: '尚未转为调休', tone: 'text-danger' }
])
const overtimeMonthMax = computed(() => Math.max(1, ...overtimeData.value.monthly.map(x => x.value)))
const overtimeTypeMax = computed(() => Math.max(1, ...overtimeData.value.types.map(x => x.value)))
const overtimeOrgMax = computed(() => Math.max(1, ...overtimeData.value.byOrg.flatMap(x => [x.hours, x.unsettledHours])))
const overtimeColumns = [
  { title: '单号', dataIndex: 'overtimeNo', width: 145 }, { title: '员工', key: 'employee', width: 125 },
  { title: '组织', dataIndex: 'org', width: 110 }, { title: '加班日期', dataIndex: 'workDate', width: 105 },
  { title: '开始时间', key: 'startTime', width: 90 }, { title: '结束时间', key: 'endTime', width: 90 },
  { title: '类型', key: 'type', width: 110 }, { title: '加班小时', key: 'hours', width: 90 },
  { title: '有效小时', key: 'effectiveHours', width: 90 }, { title: '审批状态', key: 'status', width: 95 },
  { title: '结算状态', key: 'settleStatus', width: 95 }, { title: '结算时间', key: 'settledAt', width: 145 }
]
function resetOvertimeFilters() { Object.assign(overtimeFilters, { dates: defaultDateRange(), org: 'ALL', type: 'ALL', status: 'ALL', settleStatus: 'ALL', keyword: '' }) }
function overtimeTypeText(type: string) { return ({ NORMAL: '工作日加班', RESTDAY: '休息日加班', HOLIDAY: '节假日加班' } as Record<string, string>)[type] || type }
function overtimeTypeColor(type: string) { return type === 'NORMAL' ? 'blue' : type === 'RESTDAY' ? 'purple' : type === 'HOLIDAY' ? 'orange' : 'default' }
function overtimeStatusText(status: number) { return overtimeStatusOptions.find(item => item.value === String(status))?.label || '未知' }
function overtimeSettleText(status?: number | null) { return status === 1 ? '已结算' : status === 0 ? '未结算' : '—' }
function shortTime(value?: string | null) { return value ? value.slice(0, 5) : '—' }
function dateTimeText(value?: string | null) { return value ? value.replace('T', ' ').slice(0, 16) : '—' }

const filteredAttendance = computed(() => attendanceData.value.page.list)
const attendanceMetrics = computed(() => [
  { label: '异常记录', value: attendanceData.value.total, hint: '当前筛选范围', tone: 'text-primary' },
  { label: '迟到', value: attendanceData.value.late, hint: `${attendanceData.value.lateMinutes} 分钟`, tone: 'text-warning' },
  { label: '早退', value: attendanceData.value.early, hint: `${attendanceData.value.earlyMinutes} 分钟`, tone: 'text-warning' },
  { label: '缺卡', value: attendanceData.value.missing, hint: '等待补卡核查', tone: 'text-primary' },
  { label: '缺勤', value: attendanceData.value.absent, hint: '按实际缺勤统计', tone: 'text-danger' }
])
const attendanceDaily = computed(() => attendanceData.value.daily)
const attendanceDayMax = computed(() => Math.max(1, ...attendanceDaily.value.map(x => x.value)))
const attendanceTypeSlices = computed(() => attendanceData.value.types.filter(x => x.value > 0)
  .map((x, index) => ({ name: x.name, value: x.value, color: ['#faad14', '#fa8c16', '#1677ff', '#f5222d'][index % 4] })))
const attendanceColumns = [
  { title: '日期', dataIndex: 'date', width: 115 }, { title: '员工', key: 'employee', width: 125 },
  { title: '组织', dataIndex: 'org', width: 115 }, { title: '异常类型', key: 'type', width: 100 },
  { title: '异常时长', key: 'value', width: 110 }, { title: '处理状态', key: 'status', width: 100 }
]
function attendanceTypeText(type: string) { return ({ LATE: '迟到', EARLY: '早退', MISSING: '缺卡', ABSENT: '缺勤' } as Record<string, string>)[type] || type }
function attendanceTypeColor(type: string) { return ({ LATE: 'gold', EARLY: 'orange', MISSING: 'blue', ABSENT: 'red' } as Record<string, string>)[type] || 'default' }
function attendanceStatusText(status: string) { return ({ PENDING: '待处理', DONE: '已处理', NONE: '无需处理' } as Record<string, string>)[status] || status }
function resetAttendanceFilters() { Object.assign(attendanceFilters, { month: monthOffset(0), org: 'ALL', type: 'ALL', status: 'ALL', keyword: '' }) }

async function loadWorkforce() {
  loading.workforce = true
  try {
    const data = await getWorkforceLedger({
      orgId: workforceFilters.org === 'ALL' ? undefined : workforceFilters.org,
      status: workforceFilters.status, position: workforceFilters.position || undefined,
      keyword: workforceFilters.keyword || undefined, page: workforcePage.value, size: pageSize
    })
    workforceData.value = data
    orgs.value = data.orgs
  } finally {
    loading.workforce = false
  }
}
async function loadRegularization() {
  loading.regularization = true
  try {
    const data = await getRegularizationLedger({
      orgId: regularizationFilters.org === 'ALL' ? undefined : regularizationFilters.org,
      expiry: regularizationFilters.expiry, approvalStatus: regularizationFilters.approvalStatus,
      keyword: regularizationFilters.keyword || undefined, page: regularizationPage.value, size: pageSize
    })
    regularizationData.value = data
    orgs.value = data.orgs
  } finally {
    loading.regularization = false
  }
}
async function loadRecruitment() {
  loading.recruitment = true
  try {
    const data = await getRecruitmentLedger({
      from: recruitmentFilters.dates?.[0], to: recruitmentFilters.dates?.[1],
      orgId: recruitmentFilters.org === 'ALL' ? undefined : recruitmentFilters.org,
      stage: recruitmentFilters.stage, source: recruitmentFilters.source || undefined,
      keyword: recruitmentFilters.keyword || undefined, page: recruitmentPage.value, size: pageSize
    })
    recruitmentData.value = data
    orgs.value = data.orgs
  } finally {
    loading.recruitment = false
  }
}
async function loadContracts() {
  loading.contracts = true
  try {
    const data = await getContractLedger({
      orgId: contractFilters.org === 'ALL' ? undefined : contractFilters.org,
      expiry: contractFilters.expiry, type: contractFilters.type, keyword: contractFilters.keyword || undefined,
      page: contractPage.value, size: pageSize
    })
    contractData.value = data
    orgs.value = data.orgs
  } finally {
    loading.contracts = false
  }
}
async function loadMovement() {
  loading.movement = true
  try {
    const data = await getMovementLedger({
      fromMonth: movementFilters.months?.[0], toMonth: movementFilters.months?.[1],
      orgId: movementFilters.org === 'ALL' ? undefined : movementFilters.org,
      event: movementFilters.event, page: movementPage.value, size: pageSize
    })
    movementData.value = data
    orgs.value = data.orgs
  } finally {
    loading.movement = false
  }
}
async function loadLeaves() {
  loading.leaves = true
  try {
    const data = await getLeaveLedger({
      from: leaveFilters.dates?.[0], to: leaveFilters.dates?.[1],
      orgId: leaveFilters.org === 'ALL' ? undefined : leaveFilters.org,
      type: leaveFilters.type, status: leaveFilters.status, keyword: leaveFilters.keyword || undefined,
      page: leavePage.value, size: pageSize
    })
    leaveData.value = data
    orgs.value = data.orgs
  } finally {
    loading.leaves = false
  }
}
async function loadOvertimes() {
  loading.overtimes = true
  try {
    const data = await getOvertimeLedger({
      from: overtimeFilters.dates?.[0], to: overtimeFilters.dates?.[1],
      orgId: overtimeFilters.org === 'ALL' ? undefined : overtimeFilters.org,
      type: overtimeFilters.type, status: overtimeFilters.status, settleStatus: overtimeFilters.settleStatus,
      keyword: overtimeFilters.keyword || undefined, page: overtimePage.value, size: pageSize
    })
    overtimeData.value = data
    orgs.value = data.orgs
  } finally {
    loading.overtimes = false
  }
}
async function loadAttendance() {
  loading.attendance = true
  try {
    const data = await getAttendanceLedger({
      month: attendanceFilters.month,
      orgId: attendanceFilters.org === 'ALL' ? undefined : attendanceFilters.org,
      type: attendanceFilters.type, status: attendanceFilters.status, keyword: attendanceFilters.keyword || undefined,
      page: attendancePage.value, size: pageSize
    })
    attendanceData.value = data
    orgs.value = data.orgs
  } finally {
    loading.attendance = false
  }
}
function loadActiveTab() {
  if (activeTab.value === 'workforce' && canWorkforce.value) void loadWorkforce()
  else if (activeTab.value === 'regularization' && canRegularization.value) void loadRegularization()
  else if (activeTab.value === 'recruitment' && canRecruitment.value) void loadRecruitment()
  else if (activeTab.value === 'contracts' && canContract.value) void loadContracts()
  else if (activeTab.value === 'movement' && canMovement.value) void loadMovement()
  else if (activeTab.value === 'leaves' && canLeaves.value) void loadLeaves()
  else if (activeTab.value === 'overtimes' && canOvertimes.value) void loadOvertimes()
  else if (activeTab.value === 'attendance' && canAttendance.value) void loadAttendance()
}
function onWorkforcePageChange(pagination: { current?: number }) { workforcePage.value = pagination.current || 1; void loadWorkforce() }
function onRegularizationPageChange(pagination: { current?: number }) { regularizationPage.value = pagination.current || 1; void loadRegularization() }
function onRecruitmentPageChange(pagination: { current?: number }) { recruitmentPage.value = pagination.current || 1; void loadRecruitment() }
function onContractPageChange(pagination: { current?: number }) { contractPage.value = pagination.current || 1; void loadContracts() }
function onMovementPageChange(pagination: { current?: number }) { movementPage.value = pagination.current || 1; void loadMovement() }
function onLeavePageChange(pagination: { current?: number }) { leavePage.value = pagination.current || 1; void loadLeaves() }
function onOvertimePageChange(pagination: { current?: number }) { overtimePage.value = pagination.current || 1; void loadOvertimes() }
function onAttendancePageChange(pagination: { current?: number }) { attendancePage.value = pagination.current || 1; void loadAttendance() }
function tablePagination(total: number, current: number) {
  return { current, pageSize, total, showSizeChanger: false, showTotal: (count: number) => `共 ${count} 条` }
}
function monthOffset(offset: number) {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function defaultDateRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [formatDate(start), formatDate(end)]
}
function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function formatAmount(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '0'
  return String(Number(value.toFixed(2)))
}

watch(activeTab, loadActiveTab, { immediate: true })
watch(workforceFilters, () => { workforcePage.value = 1; if (activeTab.value === 'workforce') void loadWorkforce() }, { deep: true })
watch(regularizationFilters, () => { regularizationPage.value = 1; if (activeTab.value === 'regularization') void loadRegularization() }, { deep: true })
watch(recruitmentFilters, () => { recruitmentPage.value = 1; if (activeTab.value === 'recruitment') void loadRecruitment() }, { deep: true })
watch(contractFilters, () => { contractPage.value = 1; if (activeTab.value === 'contracts') void loadContracts() }, { deep: true })
watch(movementFilters, () => { movementPage.value = 1; if (activeTab.value === 'movement') void loadMovement() }, { deep: true })
watch(leaveFilters, () => { leavePage.value = 1; if (activeTab.value === 'leaves') void loadLeaves() }, { deep: true })
watch(overtimeFilters, () => { overtimePage.value = 1; if (activeTab.value === 'overtimes') void loadOvertimes() }, { deep: true })
watch(attendanceFilters, () => { attendancePage.value = 1; if (activeTab.value === 'attendance') void loadAttendance() }, { deep: true })

interface Slice { name: string; value: number; color: string }
function donutBackground(slices: Slice[]) {
  const total = slices.reduce((sum, item) => sum + item.value, 0)
  if (!total) return 'var(--panel-border)'
  let start = 0
  const parts = slices.map(item => {
    const end = start + item.value / total * 360
    const part = `${item.color} ${start}deg ${end}deg`
    start = end
    return part
  })
  return `conic-gradient(${parts.join(',')})`
}
function barStyle(value: number, max: number) { return { height: `${Math.max(value > 0 ? 8 : 0, value / Math.max(max, 1) * 100)}%` } }
function chartCardClass(columnCount: number) { return { 'chart-card-wide': columnCount > 4 } }
function horizontalStyle(value: number, max: number) {
  return { width: `${Math.max(value > 0 ? 2 : 0, value / Math.max(max, 1) * 100)}%` }
}
</script>

<style scoped>
.ledger-page { flex: none; min-height: 100%; }
.ledger-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ledger-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 20px; font-weight: 600; }
.ledger-workbench { flex: none; }
.ledger-tabs { padding: 0 14px 14px; }
.ledger-scope-note { margin: 0 0 12px; }
.org-picker-input, .org-picker-input :deep(input) { cursor: pointer; }
.org-search { margin-bottom: 12px; }
.org-picker-tree { max-height: min(480px, 55vh); overflow: auto; padding: 4px 2px; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; padding: 12px; border-radius: 8px; background: var(--code-bg, #fafafa); }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.metric-grid.five-columns { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.metric-card { padding: 14px 16px; border: 1px solid var(--panel-border); border-radius: 8px; background: var(--panel-bg); }
.metric-label { color: var(--muted); font-size: 12px; }
.metric-value { margin: 3px 0; font-size: 26px; font-weight: 600; line-height: 1.4; }
.chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-flow: dense; gap: 12px; margin-bottom: 14px; }
.chart-card { min-width: 0; min-height: 250px; padding: 16px; border: 1px solid var(--panel-border); border-radius: 8px; }
.chart-card-wide { grid-column: 1 / -1; }
.chart-title { margin-bottom: 18px; font-weight: 600; }
.bar-chart { display: flex; align-items: flex-end; gap: 14px; height: 205px; padding: 0 8px; overflow-x: auto; overflow-y: hidden; }
.bar-item { display: flex; flex: 1 0 36px; flex-direction: column; align-items: center; height: 100%; min-width: 36px; }
.bar-value { min-height: 18px; color: var(--muted); font-size: 11px; }
.bar-track { display: flex; align-items: flex-end; width: 28px; height: 140px; border-radius: 4px 4px 0 0; overflow: hidden; }
.bar-fill { width: 100%; border-radius: 4px 4px 0 0; transition: height .25s; }
.bar-fill.blue { background: #1677ff; }
.bar-fill.cyan { background: #13c2c2; }
.bar-fill.purple { background: #722ed1; }
.bar-fill.green { background: #52c41a; }
.bar-fill.orange { background: #fa8c16; }
.bar-fill.red { background: #ff4d4f; }
.bar-label { margin-top: 8px; color: var(--muted); font-size: 12px; white-space: nowrap; }
.donut-layout { display: flex; align-items: center; justify-content: center; gap: 32px; min-height: 180px; }
.donut { display: flex; align-items: center; justify-content: center; width: 136px; height: 136px; flex: none; border-radius: 50%; }
.donut-center { display: flex; align-items: center; justify-content: center; flex-direction: column; width: 82px; height: 82px; border-radius: 50%; background: var(--panel-bg); }
.donut-center b { font-size: 22px; }
.donut-center span { color: var(--muted); font-size: 11px; }
.chart-legend { min-width: 130px; max-height: 190px; }
.legend-row { display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 8px; margin: 10px 0; font-size: 12px; }
.legend-row i, .inline-legend i { width: 8px; height: 8px; border-radius: 50%; }
.grouped-chart { display: flex; align-items: flex-end; gap: 12px; height: 188px; overflow-x: auto; overflow-y: hidden; }
.grouped-item { display: flex; flex: 1 0 44px; flex-direction: column; align-items: center; height: 100%; }
.grouped-bars { display: flex; align-items: flex-end; justify-content: center; gap: 5px; height: 140px; }
.group-bar-wrap { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 22px; height: 100%; }
.group-bar-wrap span { color: var(--muted); font-size: 10px; }
.group-bar { width: 16px; min-height: 0; border-radius: 3px 3px 0 0; }
.group-bar.green { background: #52c41a; }
.group-bar.orange { background: #fa8c16; }
.group-bar.blue { background: #1677ff; }
.group-bar.cyan { background: #13c2c2; }
.group-bar.red { background: #ff4d4f; }
.inline-legend { display: flex; justify-content: center; gap: 18px; color: var(--muted); font-size: 12px; }
.inline-legend span { display: flex; align-items: center; gap: 6px; }
.green-bg { background: #52c41a; }
.orange-bg { background: #fa8c16; }
.red-bg { background: #ff4d4f; }
.blue-bg { background: #1677ff; }
.cyan-bg { background: #13c2c2; }
.category-chart { gap: 10px; padding: 0 4px 6px; }
.category-chart .category-item { flex: 0 0 92px; min-width: 92px; }
.category-chart .category-label { display: -webkit-box; width: 100%; min-height: 32px; margin-top: 6px; overflow: hidden; line-height: 16px; text-align: center; white-space: normal; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.category-empty { flex: 1 0 100%; align-self: center; width: 100%; margin: 0; }
.position-chart .category-item { flex-basis: 112px; min-width: 112px; }
.horizontal-chart { padding-top: 8px; }
.horizontal-row { display: grid; grid-template-columns: 72px 1fr 34px; align-items: center; gap: 10px; margin: 20px 0; font-size: 12px; }
.horizontal-row.amount-row { grid-template-columns: 92px 1fr 50px; margin: 16px 0; }
.horizontal-row.amount-row b { text-align: right; }
.horizontal-label { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.horizontal-track { height: 10px; border-radius: 5px; background: var(--code-bg, #f5f5f5); overflow: hidden; }
.horizontal-bar { height: 100%; min-width: 0; border-radius: 5px; background: #52c41a; transition: width .25s; }
.horizontal-bar.negative { background: #ff4d4f; }
.horizontal-bar.blue-bar { background: #1677ff; }
.horizontal-bar.cyan-bar { background: #13c2c2; }
.horizontal-bar.purple-bar { background: #722ed1; }
.horizontal-bar.orange-bar { background: #fa8c16; }
.horizontal-bar.red-bar { background: #ff4d4f; }
.distribution-chart-scroll { overflow-x: auto; overflow-y: hidden; padding-bottom: 6px; }
.distribution-chart-groups { display: flex; align-items: flex-start; gap: 24px; width: max-content; min-width: 100%; }
.distribution-group { flex: 1 0 auto; }
.distribution-title { margin-bottom: 4px; color: var(--muted); font-size: 12px; font-weight: 600; }
.distribution-chart { height: 180px; padding: 0; overflow: visible; }
.distribution-chart .category-item { flex: 1 0 72px; min-width: 72px; }
.distribution-empty { padding: 8px 0; font-size: 12px; }
.text-primary { color: #1677ff; }
.text-success { color: #389e0d; }
.text-warning { color: #d48806; }
.text-danger { color: #cf1322; }
html[data-theme='dark'] .text-primary { color: #91caff; }
html[data-theme='dark'] .text-success { color: #95de64; }
html[data-theme='dark'] .text-warning { color: #ffd666; }
html[data-theme='dark'] .text-danger { color: #ff7875; }
@media (max-width: 1200px) {
  .metric-grid, .metric-grid.five-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .chart-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .metric-grid, .metric-grid.five-columns { grid-template-columns: 1fr; }
  .donut-layout { gap: 18px; }
  .bar-chart { gap: 6px; padding: 0; }
  .ledger-tabs { padding: 0 10px 10px; }
}
</style>
