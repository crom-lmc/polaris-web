<template>
  <div class="page-root">
    <div class="att-head">
      <a-tabs v-model:active-key="tab" class="tabs" @change="onTabChange">
        <a-tab-pane v-if="canOvertime" key="overtime" tab="加班 / 月度考勤" />
        <a-tab-pane key="my" tab="我的考勤" />
        <a-tab-pane v-if="canAttendanceView" key="daily" tab="日结果" />
        <a-tab-pane v-if="canAttendanceView" key="punches" tab="打卡记录" />
        <a-tab-pane v-if="canAttendanceManage" key="corrections" tab="补卡审批" />
        <a-tab-pane v-if="canAttendanceView" key="rules" tab="考勤规则" />
        <a-tab-pane v-if="canAttendanceView" key="calendar" tab="工作日历" />
        <a-tab-pane v-if="canQuotaAdjust" key="annual" tab="年假策略" />
      </a-tabs>
      <a-button v-if="canAttendanceManage" :loading="mockLoading" class="mock-btn" @click="doMock">
        模拟数据
      </a-button>
    </div>

    <!-- ================= 原有：加班 / 月度考勤 ================= -->
    <template v-if="tab === 'overtime'">
      <div class="toolbar">
        <div class="toolbar-left">
          <a-radio-group v-model:value="scope" button-style="solid" @change="reload">
            <a-radio-button value="mine">我的加班</a-radio-button>
            <a-radio-button v-if="canTeam" value="team">团队加班</a-radio-button>
            <a-radio-button v-if="canTeam" value="all">全部加班</a-radio-button>
          </a-radio-group>
          <a-date-picker
            v-model:value="month"
            picker="month"
            value-format="YYYY-MM"
            placeholder="全部月份"
            allow-clear
            style="width: 140px"
            @change="reload"
          />
          <a-button @click="reload">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
        </div>
        <div class="toolbar-right">
          <a-button v-if="canExportAttendance" :loading="attendanceExporting" @click="doExportAttendance">
            <template #icon><download-outlined /></template>
            导出月度考勤
          </a-button>
          <a-button type="primary" @click="openApply">
            <template #icon><plus-outlined /></template>
            提交加班
          </a-button>
        </div>
      </div>

      <section class="panel ft-grow">
        <div class="panel-head">
          <span>{{ scope === 'mine' ? '我的加班记录' : '加班记录' }}</span>
          <span class="muted">加班审批通过后按 1 小时 = 1 小时折算调休额度；审批动作在「审批中心」处理</span>
        </div>
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !loading && !rows.length }"
            table-layout="fixed"
            :columns="columns"
            :data-source="rows"
            :loading="loading"
            row-key="id"
            size="middle"
            :pagination="pagination"
            @change="onTableChange"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!loading" description="暂无加班记录" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'">
                <div>{{ record.employeeName || '—' }}</div>
                <div class="muted cell-sub">{{ record.createdAt }}</div>
              </template>
              <template v-else-if="column.key === 'workDate'">
                <div>{{ record.workDate }}</div>
                <div class="muted cell-sub">{{ record.typeName }}</div>
              </template>
              <template v-else-if="column.key === 'hours'">
                <b>{{ record.hours }}</b> 小时
              </template>
              <template v-else-if="column.key === 'reason'">
                <span class="reason-text">{{ record.reason || '—' }}</span>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="statusColor(record.status)">{{ record.statusName }}</a-tag>
                <div v-if="record.approveNote" class="muted cell-sub">{{ record.approveNote }}</div>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-popconfirm
                  v-if="record.status === 0 && record.mine"
                  title="撤销后需要重新提交，确定撤销？"
                  ok-text="撤销"
                  cancel-text="取消"
                  @confirm="doCancel(record)"
                >
                  <a class="danger">撤销</a>
                </a-popconfirm>
                <span v-else class="muted">—</span>
              </template>
            </template>
          </a-table>
        </div>
      </section>

      <section class="panel month-panel">
        <div class="panel-head">
          <span>月度考勤汇总</span>
          <span class="muted">
            {{ canConfirm ? '按工作日历与已通过的请假/加班计算，确认后锁定' : '数据由系统按工作日历与已通过的请假/加班计算' }}
          </span>
        </div>
        <div class="panel-body table-body ft-scroll ft-bottom month-body">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !monthLoading && !monthRows.length }"
            :columns="monthColumns"
            :data-source="monthRows"
            :loading="monthLoading"
            row-key="employeeId"
            size="middle"
            :pagination="false"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!monthLoading" description="暂无汇总数据" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'">{{ record.employeeName || '—' }}</template>
              <template v-else-if="column.key === 'confirmed'">
                <a-tag :color="record.confirmed === 1 ? 'green' : 'default'">
                  {{ record.confirmed === 1 ? '已确认' : '未确认' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button
                  v-if="canConfirm && record.confirmed !== 1"
                  size="small"
                  type="link"
                  @click="doConfirm(record)"
                >确认</a-button>
                <a-button
                  v-else-if="canUnlock && record.confirmed === 1"
                  size="small"
                  type="link"
                  danger
                  @click="openUnlock(record)"
                >解锁</a-button>
                <span v-else class="muted">—</span>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </template>

    <!-- ================= 我的考勤 ================= -->
    <template v-else-if="tab === 'my'">
      <div class="toolbar">
        <div class="toolbar-left">
          <a-date-picker
            v-model:value="myMonth"
            picker="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            style="width: 140px"
            @change="loadMy"
          />
          <a-button @click="loadMy">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
        </div>
        <span class="muted">本人每日考勤结果；缺卡可发起补卡申请</span>
      </div>
      <section class="panel ft-grow">
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !myLoading && !myRows.length }"
            :columns="myColumns"
            :data-source="myRows"
            :loading="myLoading"
            row-key="id"
            size="middle"
            :pagination="false"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!myLoading" description="暂无考勤数据" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'weekday'">{{ weekdayText(record.workDate) }}</template>
              <template v-else-if="column.key === 'dayType'">{{ dayTypeText(record.dayType) }}</template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="dailyStatusColor(record.status)">{{ record.statusName || record.status }}</a-tag>
              </template>
              <template v-else-if="column.key === 'firstIn'">{{ fmtTime(record.firstIn) }}</template>
              <template v-else-if="column.key === 'lastOut'">{{ fmtTime(record.lastOut) }}</template>
              <template v-else-if="column.key === 'lateMinutes'">{{ record.lateMinutes || '—' }}</template>
              <template v-else-if="column.key === 'earlyMinutes'">{{ record.earlyMinutes || '—' }}</template>
              <template v-else-if="column.key === 'absentHours'">{{ record.absentHours ?? '—' }}</template>
              <template v-else-if="column.key === 'overtimeMinutes'">{{ record.overtimeMinutes || '—' }}</template>
              <template v-else-if="column.key === 'action'">
                <a v-if="record.status === 'MISSING_PUNCH'" @click="openCorrection(record)">申请补卡</a>
                <span v-else class="muted">—</span>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </template>

    <!-- ================= 日结果 ================= -->
    <template v-else-if="tab === 'daily' && canAttendanceView">
      <div class="toolbar">
        <div class="toolbar-left">
          <a-date-picker
            v-model:value="dailyFilters.month"
            picker="month"
            value-format="YYYY-MM"
            placeholder="月份"
            style="width: 130px"
            @change="reloadDaily"
          />
          <a-select
            v-model:value="dailyFilters.employeeId"
            show-search
            allow-clear
            :filter-option="false"
            :options="empOptions"
            :loading="empLoading"
            placeholder="全部员工"
            style="width: 190px"
            @search="loadEmployeeOptions"
            @change="reloadDaily"
          />
          <a-select
            v-model:value="dailyFilters.status"
            allow-clear
            :options="dailyStatusOptions"
            placeholder="全部状态"
            style="width: 130px"
            @change="reloadDaily"
          />
          <a-button @click="reloadDaily">
            <template #icon><reload-outlined /></template>
            查询
          </a-button>
        </div>
        <div v-if="canAttendanceManage" class="toolbar-right">
          <a-date-picker
            v-model:value="generateDate"
            value-format="YYYY-MM-DD"
            style="width: 130px"
          />
          <a-button type="primary" :loading="generating" @click="doGenerate">生成考勤</a-button>
        </div>
      </div>
      <section class="panel ft-grow">
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !dailyLoading && !dailyRows.length }"
            :columns="dailyColumns"
            :data-source="dailyRows"
            :loading="dailyLoading"
            row-key="id"
            size="middle"
            :pagination="dailyPagination"
            @change="onDailyTableChange"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!dailyLoading" description="暂无日结果，可先点击生成考勤" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="dailyStatusColor(record.status)">{{ record.statusName || record.status }}</a-tag>
              </template>
              <template v-else-if="column.key === 'shift'">
                {{ fmtTime(record.shiftStart) }} ~ {{ fmtTime(record.shiftEnd) }}
              </template>
              <template v-else-if="column.key === 'firstIn'">{{ fmtTime(record.firstIn) }}</template>
              <template v-else-if="column.key === 'lastOut'">{{ fmtTime(record.lastOut) }}</template>
            </template>
          </a-table>
        </div>
      </section>
    </template>

    <!-- ================= 打卡记录 ================= -->
    <template v-else-if="tab === 'punches' && canAttendanceView">
      <div class="toolbar">
        <div class="toolbar-left">
          <a-select
            v-model:value="punchFilters.employeeId"
            show-search
            allow-clear
            :filter-option="false"
            :options="empOptions"
            :loading="empLoading"
            placeholder="全部员工"
            style="width: 190px"
            @search="loadEmployeeOptions"
            @change="reloadPunches"
          />
          <a-date-picker
            v-model:value="punchFilters.date"
            value-format="YYYY-MM-DD"
            placeholder="打卡日期"
            allow-clear
            style="width: 140px"
            @change="reloadPunches"
          />
          <a-button @click="reloadPunches">
            <template #icon><reload-outlined /></template>
            查询
          </a-button>
        </div>
        <div v-if="canAttendanceManage" class="toolbar-right">
          <a-button type="primary" @click="openPunch">手工补录</a-button>
        </div>
      </div>
      <section class="panel ft-grow">
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !punchLoading && !punchRows.length }"
            :columns="punchColumns"
            :data-source="punchRows"
            :loading="punchLoading"
            row-key="id"
            size="middle"
            :pagination="punchPagination"
            @change="onPunchTableChange"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!punchLoading" description="暂无打卡记录" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'">{{ empName(record.employeeId) }}</template>
              <template v-else-if="column.key === 'punchTime'">{{ fmtTime(record.punchTime) }}</template>
              <template v-else-if="column.key === 'punchType'">{{ record.punchType || '自动' }}</template>
              <template v-else-if="column.key === 'source'">{{ punchSourceText(record.source) }}</template>
            </template>
          </a-table>
        </div>
      </section>
    </template>

    <!-- ================= 补卡审批 ================= -->
    <template v-else-if="tab === 'corrections' && canAttendanceManage">
      <div class="toolbar">
        <div class="toolbar-left">
          <a-select
            v-model:value="corrFilters.status"
            allow-clear
            :options="correctionStatusOptions"
            placeholder="全部状态"
            style="width: 130px"
            @change="reloadCorrections"
          />
          <a-date-picker
            v-model:value="corrFilters.month"
            picker="month"
            value-format="YYYY-MM"
            placeholder="全部月份"
            allow-clear
            style="width: 130px"
            @change="reloadCorrections"
          />
          <a-button @click="reloadCorrections">
            <template #icon><reload-outlined /></template>
            查询
          </a-button>
        </div>
      </div>
      <section class="panel ft-grow">
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !corrLoading && !corrRows.length }"
            :columns="corrColumns"
            :data-source="corrRows"
            :loading="corrLoading"
            row-key="id"
            size="middle"
            :pagination="corrPagination"
            @change="onCorrTableChange"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!corrLoading" description="暂无补卡申请" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'type'">{{ correctionTypeText(record.type) }}</template>
              <template v-else-if="column.key === 'punchTime'">{{ fmtTime(record.punchTime) }}</template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="correctionStatusColor(record.status)">{{ record.statusName }}</a-tag>
                <div v-if="record.approveNote" class="muted cell-sub">{{ record.approveNote }}</div>
              </template>
              <template v-else-if="column.key === 'createdAt'">{{ fmtTime(record.createdAt) }}</template>
              <template v-else-if="column.key === 'action'">
                <a-space v-if="record.status === 0" size="small">
                  <a @click="openReview(record, 'approve')">通过</a>
                  <a class="danger" @click="openReview(record, 'reject')">驳回</a>
                </a-space>
                <span v-else class="muted">—</span>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </template>

    <!-- ================= 考勤规则 ================= -->
    <template v-else-if="tab === 'rules' && canAttendanceView">
      <div class="toolbar">
        <div class="toolbar-left">
          <a-input-search
            v-model:value="ruleFilters.keyword"
            placeholder="规则名称 / 编码"
            allow-clear
            style="width: 220px"
            @search="reloadRules"
          />
          <a-button @click="reloadRules">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
        </div>
        <div v-if="canAttendanceManage" class="toolbar-right">
          <a-button type="primary" @click="openRule()">新增规则</a-button>
        </div>
      </div>
      <section class="panel ft-grow">
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !ruleLoading && !ruleRows.length }"
            :columns="ruleColumns"
            :data-source="ruleRows"
            :loading="ruleLoading"
            row-key="id"
            size="middle"
            :pagination="rulePagination"
            @change="onRuleTableChange"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!ruleLoading" description="暂无考勤规则" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'shift'">
                <span class="color-dot" :style="{ background: record.color || '#1677ff' }" />
                {{ fmtTime(record.workStart) }} ~ {{ fmtTime(record.workEnd) }}
              </template>
              <template v-else-if="column.key === 'rest'">
                {{ record.restStart ? fmtTime(record.restStart) + ' ~ ' + fmtTime(record.restEnd) : '—' }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.status === 1 ? 'green' : 'default'">
                  {{ record.status === 1 ? '启用' : '停用' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'scopes'">
                <span class="ellipsis">{{ scopeSummary(record) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space v-if="canAttendanceManage" size="small">
                  <a @click="openRule(record)">编辑</a>
                  <a @click="doToggleRule(record)">{{ record.status === 1 ? '停用' : '启用' }}</a>
                  <a-popconfirm title="删除后不可恢复，确定删除该规则？" ok-text="删除" cancel-text="取消" @confirm="doDeleteRule(record)">
                    <a class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
                <span v-else class="muted">—</span>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </template>

    <!-- ================= 工作日历 ================= -->
    <template v-else-if="tab === 'calendar' && canAttendanceView">
      <div class="toolbar">
        <div class="toolbar-left">
          <a-button @click="shiftCalendar(-1)">上月</a-button>
          <a-date-picker
            v-model:value="calMonth"
            picker="month"
            value-format="YYYY-MM"
            style="width: 130px"
            @change="loadCalendar"
          />
          <a-button @click="shiftCalendar(1)">下月</a-button>
          <a-button @click="loadCalendar">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
        </div>
        <div class="toolbar-right">
          <a-popconfirm
            v-if="calNextYear?.showButton"
            :title="`将写入 ${calNextYear.nextYear} 年法定节假日 ${calNextYear.holidayCount} 天、调休上班日 ${calNextYear.makeupCount} 天；已手工配置的日期不会被覆盖。确认更新？`"
            ok-text="更新"
            cancel-text="取消"
            @confirm="applyNextYear"
          >
            <a-button type="primary" :loading="calApplyLoading">
              更新 {{ calNextYear.nextYear }} 年工作日历
            </a-button>
          </a-popconfirm>
          <a-tooltip
            v-else-if="calNextYear?.applied && calMonth.startsWith(String(calNextYear.nextYear))"
            :title="`已于 ${(calNextYear.appliedAt || '').slice(0, 10)} 由 ${calNextYear.appliedBy || 'HR'} 更新`"
          >
            <span class="cal-applied">✓ {{ calNextYear.nextYear }} 年日历已更新</span>
          </a-tooltip>
          <template v-if="canAttendanceManage">
            <a-upload
              accept=".csv"
              :show-upload-list="false"
              :before-upload="onCalendarCsv"
            >
              <a-button :loading="calImporting" style="margin-right: 8px">导入 CSV</a-button>
            </a-upload>
            <a-button type="primary" :loading="calSaving" @click="saveCalendar">保存本月</a-button>
          </template>
        </div>
      </div>
      <section class="panel ft-grow">
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !calLoading && !calRows.length }"
            :columns="calColumns"
            :data-source="calRows"
            :loading="calLoading"
            row-key="workDate"
            size="middle"
            :pagination="false"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!calLoading" description="暂无日历数据" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'weekday'">{{ weekdayText(record.workDate) }}</template>
              <template v-else-if="column.key === 'isWorkday'">
                <a-switch
                  v-model:checked="record.isWorkday"
                  :checked-value="1"
                  :un-checked-value="0"
                  :disabled="!canAttendanceManage || isPastDate(record.workDate)"
                />
              </template>
              <template v-else-if="column.key === 'holidayName'">
                <a-input
                  v-model:value="record.holidayName"
                  :disabled="!canAttendanceManage || isPastDate(record.workDate)"
                  placeholder="节假日名称（选填）"
                  size="small"
                />
              </template>
              <template v-else-if="column.key === 'configured'">
                <a-tag v-if="record.source === 'MANUAL'" color="blue">已配置</a-tag>
                <a-tag v-else-if="record.source === 'PRESET'" color="orange">
                  {{ record.isWorkday ? '调休上班' : '法定节假日' }}
                </a-tag>
                <a-tag v-else>默认推算</a-tag>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </template>

    <!-- ================= 年假策略 ================= -->
    <template v-else-if="tab === 'annual' && canQuotaAdjust">
      <div class="toolbar">
        <div class="toolbar-left">
          <a-button @click="loadPolicies">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
          <span class="muted">同时只有一条策略启用，启用后作为全员年假档位依据</span>
        </div>
        <div class="toolbar-right">
          <a-input-number v-model:value="generateYear" :min="2000" :max="2100" style="width: 100px" />
          <a-button :loading="annualGenerating" @click="doGenerateAnnual">生成年度额度</a-button>
          <a-button type="primary" @click="openPolicy()">新增策略</a-button>
        </div>
      </div>
      <section class="panel ft-grow">
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table
            class="ft-table"
            :class="{ 'tbl-empty-mode': !policyLoading && !policyRows.length }"
            :columns="policyColumns"
            :data-source="policyRows"
            :loading="policyLoading"
            row-key="id"
            size="middle"
            :pagination="false"
          >
            <template #emptyText>
              <div class="tbl-empty"><a-empty v-if="!policyLoading" description="暂无年假策略" /></div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'tiers'">{{ policyTierText(record) }}</template>
              <template v-else-if="column.key === 'carryover'">{{ policyCarryText(record) }}</template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.enabled === 1 ? 'green' : 'default'">
                  {{ record.enabled === 1 ? '启用中' : '停用' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a @click="openPolicy(record)">编辑</a>
                  <a v-if="record.enabled !== 1" @click="doEnablePolicy(record)">启用</a>
                  <span v-else class="muted">—</span>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </template>

    <!-- ================= 原有：提交加班 ================= -->
    <a-modal
      v-model:open="applyOpen"
      title="提交加班"
      :confirm-loading="saving"
      ok-text="提交审批"
      cancel-text="取消"
      width="520px"
      centered
      destroy-on-close
      @ok="submitApply"
    >
      <a-form layout="vertical">
        <a-form-item label="加班日期" required>
          <a-date-picker
            v-model:value="form.workDate"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            :disabled-date="disabledFuture"
          />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="加班时长（小时）" required>
              <a-input-number v-model:value="form.hours" :min="0.5" :max="24" :step="0.5" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="加班类型" required>
              <a-select v-model:value="form.type" :options="typeOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="加班事由">
          <a-textarea v-model:value="form.reason" :rows="3" :maxlength="200" show-count />
        </a-form-item>
        <a-alert
          v-if="overLimitHint"
          type="info"
          show-icon
          message="当月累计加班将超过 8 小时，需直属主管通过后再由人力资源中心终审"
        />
      </a-form>
    </a-modal>

    <!-- 补卡申请 -->
    <a-modal
      v-model:open="correctionOpen"
      title="申请补卡"
      :confirm-loading="correctionSaving"
      ok-text="提交申请"
      cancel-text="取消"
      width="480px"
      centered
      destroy-on-close
      @ok="submitCorrection"
    >
      <a-form layout="vertical">
        <a-form-item label="补卡日期">
          <a-input :value="correctionForm.workDate" disabled />
        </a-form-item>
        <a-form-item label="打卡类型" required>
          <a-radio-group v-model:value="correctionForm.punchType">
            <a-radio value="IN">上班卡</a-radio>
            <a-radio value="OUT">下班卡</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="补卡时间" required>
          <a-date-picker
            v-model:value="correctionForm.punchTime"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="补卡事由" required>
          <a-textarea v-model:value="correctionForm.reason" :rows="3" :maxlength="200" show-count />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 手工补录打卡 -->
    <a-modal
      v-model:open="punchOpen"
      title="手工补录打卡"
      :confirm-loading="punchSaving"
      ok-text="保存"
      cancel-text="取消"
      width="460px"
      centered
      destroy-on-close
      @ok="submitPunch"
    >
      <a-form layout="vertical">
        <a-form-item label="员工" required>
          <a-select
            v-model:value="punchForm.employeeId"
            show-search
            :filter-option="false"
            :options="empOptions"
            :loading="empLoading"
            placeholder="选择员工"
            @search="loadEmployeeOptions"
          />
        </a-form-item>
        <a-form-item label="打卡类型">
          <a-select v-model:value="punchForm.punchType" :options="punchTypeOptions" placeholder="自动判定" allow-clear />
        </a-form-item>
        <a-form-item label="打卡时间" required>
          <a-date-picker
            v-model:value="punchForm.punchTime"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="punchForm.remark" :maxlength="100" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 补卡审批 -->
    <a-modal
      v-model:open="reviewOpen"
      :title="reviewMode === 'approve' ? '通过补卡申请' : '驳回补卡申请'"
      :confirm-loading="reviewSaving"
      :ok-text="reviewMode === 'approve' ? '通过' : '驳回'"
      cancel-text="取消"
      width="440px"
      centered
      destroy-on-close
      @ok="submitReview"
    >
      <a-form layout="vertical">
        <a-form-item label="审批意见">
          <a-textarea v-model:value="reviewNote" :rows="3" :maxlength="200" show-count placeholder="选填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 考勤规则编辑 -->
    <a-modal
      v-model:open="ruleModalOpen"
      :title="ruleEditingId ? '编辑考勤规则' : '新增考勤规则'"
      :confirm-loading="ruleSaving"
      ok-text="保存"
      cancel-text="取消"
      width="920px"
      centered
      destroy-on-close
      :body-style="{ maxHeight: '66vh', overflowY: 'auto' }"
      @ok="submitRule"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="规则名称" required>
              <a-input v-model:value="ruleForm.name" :maxlength="50" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="规则编码" required>
              <a-input v-model:value="ruleForm.code" :maxlength="50" placeholder="如 STD_9_18" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="颜色">
              <a-input v-model:value="ruleForm.color" placeholder="#1677ff" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="上班时间" required>
              <a-time-picker v-model:value="ruleForm.workStart" value-format="HH:mm:ss" format="HH:mm" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="下班时间" required>
              <a-time-picker v-model:value="ruleForm.workEnd" value-format="HH:mm:ss" format="HH:mm" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="午休开始">
              <a-time-picker v-model:value="ruleForm.restStart" value-format="HH:mm:ss" format="HH:mm" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="午休结束">
              <a-time-picker v-model:value="ruleForm.restEnd" value-format="HH:mm:ss" format="HH:mm" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="工作时长（小时）">
              <a-input-number v-model:value="ruleForm.workHours" :min="0" :max="24" :step="0.5" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="迟到宽容（分钟）">
              <a-input-number v-model:value="ruleForm.lateGrace" :min="0" :max="240" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="早退宽容（分钟）">
              <a-input-number v-model:value="ruleForm.earlyGrace" :min="0" :max="240" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="缺勤起算（分钟）">
              <a-input-number v-model:value="ruleForm.absentMinMinutes" :min="0" :max="480" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item label="弹性打卡">
              <a-switch v-model:checked="ruleForm.flexible" :checked-value="1" :un-checked-value="0" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="跨天班次">
              <a-switch v-model:checked="ruleForm.crossDay" :checked-value="1" :un-checked-value="0" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="需要打卡">
              <a-switch v-model:checked="ruleForm.requirePunch" :checked-value="1" :un-checked-value="0" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="启用状态">
              <a-switch v-model:checked="ruleForm.status" :checked-value="1" :un-checked-value="0" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">时间段</a-divider>
        <div class="sub-toolbar">
          <a-button size="small" @click="addSegment">添加时间段</a-button>
        </div>
        <a-table
          :columns="segmentColumns"
          :data-source="ruleSegments"
          :pagination="false"
          size="small"
          row-key="_key"
          class="sub-table"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'name'">
              <a-input v-model:value="record.name" size="small" placeholder="如 上午" />
            </template>
            <template v-else-if="column.key === 'startTime'">
              <a-time-picker v-model:value="record.startTime" value-format="HH:mm:ss" format="HH:mm" size="small" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'endTime'">
              <a-time-picker v-model:value="record.endTime" value-format="HH:mm:ss" format="HH:mm" size="small" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'workMinutes'">
              <a-input-number v-model:value="record.workMinutes" :min="0" :max="1440" size="small" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'needPunch'">
              <a-switch v-model:checked="record.needPunch" :checked-value="1" :un-checked-value="0" size="small" />
            </template>
            <template v-else-if="column.key === 'crossDay'">
              <a-switch v-model:checked="record.crossDay" :checked-value="1" :un-checked-value="0" size="small" />
            </template>
            <template v-else-if="column.key === 'action'">
              <a class="danger" @click="removeSegment(index)">删除</a>
            </template>
          </template>
        </a-table>

        <a-divider orientation="left">适用范围</a-divider>
        <div class="sub-toolbar">
          <a-button size="small" @click="addScope">添加范围</a-button>
          <span class="muted">员工 &gt; 部门 &gt; 全员；同一层级 priority 越大越优先</span>
        </div>
        <a-table
          :columns="scopeColumns"
          :data-source="ruleScopes"
          :pagination="false"
          size="small"
          row-key="_key"
          class="sub-table"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'scopeType'">
              <a-select
                v-model:value="record.scopeType"
                :options="scopeTypeOptions"
                size="small"
                style="width: 100%"
                @change="onScopeTypeChange(record)"
              />
            </template>
            <template v-else-if="column.key === 'scopeId'">
              <a-tree-select
                v-if="record.scopeType === 'ORG' && orgTreeAvailable"
                v-model:value="record.scopeId"
                :tree-data="orgTreeData"
                tree-default-expand-all
                allow-clear
                placeholder="选择组织"
                size="small"
                style="width: 100%"
              />
              <a-input
                v-else-if="record.scopeType === 'ORG'"
                v-model:value="record.scopeId"
                size="small"
                placeholder="组织ID"
              />
              <a-input
                v-else-if="record.scopeType === 'EMPLOYEE'"
                v-model:value="record.scopeId"
                size="small"
                placeholder="员工ID（留空则忽略）"
              />
              <span v-else class="muted">全部员工</span>
            </template>
            <template v-else-if="column.key === 'priority'">
              <a-input-number v-model:value="record.priority" :min="0" :max="999" size="small" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'action'">
              <a class="danger" @click="removeScope(index)">删除</a>
            </template>
          </template>
        </a-table>

        <a-form-item label="备注" class="mt12">
          <a-textarea v-model:value="ruleForm.remark" :rows="2" :maxlength="200" show-count />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 年假策略编辑 -->
    <a-modal
      v-model:open="policyModalOpen"
      :title="policyEditingId ? '编辑年假策略' : '新增年假策略'"
      :confirm-loading="policySaving"
      ok-text="保存"
      cancel-text="取消"
      width="640px"
      centered
      destroy-on-close
      @ok="submitPolicy"
    >
      <a-form layout="vertical">
        <a-form-item label="策略名称" required>
          <a-input v-model:value="policyForm.name" :maxlength="50" />
        </a-form-item>
        <div class="form-hint">累计工龄档位（年 → 天数），未达到下一档时沿用上一档</div>
        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="第一档工龄">
              <a-input-number v-model:value="policyForm.tier1Years" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="第一档天数">
              <a-input-number v-model:value="policyForm.tier1Days" :min="0" :step="0.5" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="生效日期">
              <a-date-picker v-model:value="policyForm.effectiveFrom" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="第二档工龄">
              <a-input-number v-model:value="policyForm.tier2Years" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="第二档天数">
              <a-input-number v-model:value="policyForm.tier2Days" :min="0" :step="0.5" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态">
              <a-switch v-model:checked="policyForm.enabled" :checked-value="1" :un-checked-value="0" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="第三档工龄">
              <a-input-number v-model:value="policyForm.tier3Years" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="第三档天数">
              <a-input-number v-model:value="policyForm.tier3Days" :min="0" :step="0.5" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="允许结转">
              <a-switch v-model:checked="policyForm.carryoverEnabled" :checked-value="1" :un-checked-value="0" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="最多结转天数">
              <a-input-number v-model:value="policyForm.carryoverMaxDays" :min="0" :step="0.5" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="结转失效月份">
              <a-input-number v-model:value="policyForm.carryoverExpireMonth" :min="1" :max="12" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-textarea v-model:value="policyForm.remark" :rows="2" :maxlength="200" show-count />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="unlockOpen"
      title="解锁月度考勤"
      :confirm-loading="unlockSaving"
      @ok="doUnlock"
    >
      <p class="muted">解锁后该月日结果与汇总可重新计算，请填写原因留痕。</p>
      <a-textarea
        v-model:value="unlockReason"
        :rows="3"
        :maxlength="255"
        show-count
        placeholder="如：补录漏打卡 / 请假单补审"
      />
    </a-modal>

  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { DownloadOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import dayjs, { type Dayjs } from 'dayjs'
import {
  addAttendancePunch,
  applyAttendanceCorrection,
  approveAttendanceCorrection,
  cancelOvertime,
  confirmAttendanceMonthly,
  createAnnualLeavePolicy,
  createAttendanceRule,
  deleteAttendanceRule,
  applyNextYearCalendar,
  calendarNextYearStatus,
  enableAnnualLeavePolicy,
  exportAttendanceXlsx,
  generateAnnualLeave,
  generateAttendanceDaily,
  getAttendanceRule,
  importWorkCalendarCsv,
  listAnnualLeavePolicies,
  listAttendanceMonthly,
  listOvertimes,
  listWorkCalendar,
  myAttendance,
  orgTree,
  pageAttendanceCorrections,
  pageAttendanceDaily,
  pageAttendancePunches,
  pageAttendanceRules,
  pageEmployees,
  rejectAttendanceCorrection,
  runAttendanceMock,
  saveWorkCalendar,
  submitOvertime,
  toggleAttendanceRule,
  unlockAttendanceMonthly,
  updateAnnualLeavePolicy,
  updateAttendanceRule,
  type AnnualLeavePolicyBody,
  type AnnualLeavePolicyItem,
  type AttendanceCorrectionItem,
  type AttendanceDailyItem,
  type AttendanceMonthItem,
  type AttendancePunchItem,
  type AttendanceRuleBody,
  type AttendanceRuleItem,
  type CalendarNextYearStatus,
  type OvertimeItem,
  type OrgNode,
  type WorkCalendarDay
} from '@/api/ehr'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const canOvertime = computed(() => store.can('overtime:view'))
const canTeam = computed(() => store.can('overtime:approve'))
const canConfirm = computed(() => store.can('overtime:approve'))
const canAttendanceView = computed(() => store.can('attendance:view'))
const canAttendanceManage = computed(() => store.can('attendance:manage'))
const canUnlock = computed(() => store.can('attendance:month:unlock'))
const canQuotaAdjust = computed(() => store.can('leave:quota:adjust'))

/* 支持通过 ?tab=calendar 等路由参数直达指定页签（如工作日历维护待办跳转） */
const route = useRoute()
const initTab = typeof route.query.tab === 'string' ? route.query.tab : ''
const tab = ref(initTab || 'overtime')
const mockLoading = ref(false)

function onTabChange() {
  /* 数据加载由下方 watch(tab) 统一处理 */
}

async function doMock() {
  mockLoading.value = true
  try {
    const n = await runAttendanceMock(generateDate.value || dayjs().format('YYYY-MM-DD'))
    message.success(n > 0 ? `已生成 ${n} 条模拟考勤数据` : '模拟考勤未生成新数据（可能非工作日或已生成）')
    reloadDaily()
  } catch (e: any) {
    message.error(e?.message || '模拟数据生成失败')
  } finally {
    mockLoading.value = false
  }
}

/* ---------- 员工下拉（远程搜索） ---------- */
interface EmpOption {
  value: string
  label: string
}

const empOptions = ref<EmpOption[]>([])
const empNameMap = ref<Record<string, string>>({})
const empLoading = ref(false)

async function loadEmployeeOptions(keyword?: string) {
  if (!canAttendanceView.value) return
  empLoading.value = true
  try {
    const data = await pageEmployees({ keyword: keyword || undefined, page: 1, size: 50 })
    const m = { ...empNameMap.value }
    const merged = new Map(empOptions.value.map((o) => [o.value, o.label]))
    for (const e of data.list || []) {
      const label = `${e.name}${e.empNo ? `（${e.empNo}）` : ''}`
      m[e.id] = label
      merged.set(e.id, label)
    }
    empNameMap.value = m
    empOptions.value = Array.from(merged, ([value, label]) => ({ value, label }))
  } catch {
    /* 无 employee:view 权限时静默降级为手输/仅展示ID */
  } finally {
    empLoading.value = false
  }
}

function empName(id: string) {
  return empNameMap.value[id] || id
}

/* ---------- 通用格式化 ---------- */
function fmtTime(v?: string | null) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}

function weekdayText(date?: string | null) {
  if (!date) return '—'
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(date).day()]
}

function dayTypeText(t?: string | null) {
  if (t === 'WORKDAY') return '工作日'
  if (t === 'REST') return '休息日'
  if (t === 'LEGAL_HOLIDAY') return '法定节假日'
  return t || '—'
}

function dailyStatusColor(status: string) {
  switch (status) {
    case 'NORMAL':
      return 'green'
    case 'LATE':
    case 'EARLY':
    case 'LATE_EARLY':
      return 'orange'
    case 'ABSENT':
    case 'MISSING_PUNCH':
      return 'red'
    case 'LEAVE':
      return 'purple'
    default:
      return 'default'
  }
}

/* ================= 原有：加班 ================= */
const scope = ref<'mine' | 'team' | 'all'>('mine')
const month = ref<string>('')
const loading = ref(false)
const rows = ref<OvertimeItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(20)

const columns = [
  { title: '员工', key: 'employee', width: 150 },
  { title: '加班日期', key: 'workDate', width: 160 },
  { title: '时长', key: 'hours', width: 110 },
  { title: '事由', key: 'reason' },
  { title: '状态', key: 'status', width: 150 },
  { title: '操作', key: 'action', width: 90 }
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

function onTableChange(p: any) {
  page.value = p.current || 1
  size.value = p.pageSize || 20
  reload()
}

async function reload() {
  if (!canOvertime.value) return
  loading.value = true
  try {
    const res = await listOvertimes({
      scope: scope.value,
      month: month.value || undefined,
      page: page.value,
      size: size.value
    })
    rows.value = res.list || []
    total.value = res.total || 0
  } catch (e: any) {
    message.error(e?.message || '加载加班记录失败')
  } finally {
    loading.value = false
  }
}

watch(scope, () => {
  page.value = 1
  reload()
})

/* ---------- 提交加班 ---------- */
const applyOpen = ref(false)
const saving = ref(false)
const form = reactive({
  workDate: dayjs().format('YYYY-MM-DD'),
  hours: 2,
  type: 'NORMAL',
  reason: ''
})

const typeOptions = [
  { value: 'NORMAL', label: '工作日加班' },
  { value: 'HOLIDAY', label: '节假日加班' },
  { value: 'RESTDAY', label: '休息日加班' }
]

const overLimitHint = computed(() => {
  if (form.type === 'HOLIDAY') return true
  const sameMonth = rows.value
    .filter((r) => r.status === 1 && r.mine && r.workDate?.slice(0, 7) === form.workDate?.slice(0, 7))
    .reduce((s, r) => s + Number(r.hours || 0), 0)
  return sameMonth + Number(form.hours || 0) > 8
})

function disabledFuture(d: Dayjs) {
  return d.isAfter(dayjs(), 'day')
}

function openApply() {
  Object.assign(form, {
    workDate: dayjs().format('YYYY-MM-DD'),
    hours: 2,
    type: 'NORMAL',
    reason: ''
  })
  applyOpen.value = true
}

async function submitApply() {
  if (!form.workDate) {
    message.warning('请选择加班日期')
    return
  }
  if (!form.hours || form.hours <= 0) {
    message.warning('请填写加班时长')
    return
  }
  saving.value = true
  try {
    await submitOvertime({
      workDate: form.workDate,
      hours: Number(form.hours),
      type: form.type,
      reason: form.reason
    })
    message.success('加班审批已提交，请在审批中心跟进')
    applyOpen.value = false
    scope.value = 'mine'
    page.value = 1
    await reload()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    saving.value = false
  }
}

async function doCancel(record: OvertimeItem) {
  try {
    await cancelOvertime(record.id)
    message.success('已撤销')
    await reload()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
  }
}

function statusColor(status: number) {
  switch (status) {
    case 0:
      return 'blue'
    case 1:
      return 'green'
    case 2:
      return 'red'
    default:
      return 'default'
  }
}

/* ---------- 月度汇总 ---------- */
const monthRows = ref<AttendanceMonthItem[]>([])
const monthLoading = ref(false)
const summaryMonth = ref(dayjs().format('YYYY-MM'))

const monthColumns = [
  { title: '员工', key: 'employee', width: 160 },
  { title: '应出勤', dataIndex: 'shouldDays', width: 100 },
  { title: '实际出勤', dataIndex: 'actualDays', width: 100 },
  { title: '请假天数', dataIndex: 'leaveDays', width: 100 },
  { title: '加班小时', dataIndex: 'overtimeHours', width: 110 },
  { title: '缺勤天数', dataIndex: 'absentDays', width: 100 },
  { title: '状态', key: 'confirmed', width: 100 },
  { title: '操作', key: 'action', width: 90 }
]

async function loadMonthly() {
  if (!canOvertime.value) return
  monthLoading.value = true
  try {
    monthRows.value = await listAttendanceMonthly(summaryMonth.value)
  } catch (e: any) {
    message.error(e?.message || '加载月度汇总失败')
  } finally {
    monthLoading.value = false
  }
}

async function doConfirm(record: AttendanceMonthItem) {
  try {
    await confirmAttendanceMonthly(summaryMonth.value, record.employeeId)
    message.success('已确认并锁定')
    await loadMonthly()
  } catch (e: any) {
    message.error(e?.message || '确认失败')
  }
}

/* 解锁已确认月份：必须填写原因 */
const unlockOpen = ref(false)
const unlockSaving = ref(false)
const unlockTarget = ref<AttendanceMonthItem | null>(null)
const unlockReason = ref('')

function openUnlock(record: AttendanceMonthItem) {
  unlockTarget.value = record
  unlockReason.value = ''
  unlockOpen.value = true
}

async function doUnlock() {
  if (!unlockTarget.value) return
  const reason = unlockReason.value.trim()
  if (!reason) {
    message.warning('请填写解锁原因')
    return
  }
  unlockSaving.value = true
  try {
    await unlockAttendanceMonthly(summaryMonth.value, unlockTarget.value.employeeId, reason)
    message.success('已解锁，可重新生成考勤')
    unlockOpen.value = false
    await loadMonthly()
  } catch (e: any) {
    message.error(e?.message || '解锁失败')
  } finally {
    unlockSaving.value = false
  }
}

/* ---------- 导出月度考勤 ---------- */
const canExportAttendance = computed(() => store.can('overtime:view'))
const attendanceExporting = ref(false)

async function doExportAttendance() {
  attendanceExporting.value = true
  try {
    const res: any = await exportAttendanceXlsx(summaryMonth.value)
    const blob = new Blob([res.data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `月度考勤-${summaryMonth.value}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    message.success('考勤导出已开始')
  } catch (e: any) {
    message.error(e?.message || '导出失败')
  } finally {
    attendanceExporting.value = false
  }
}

watch([summaryMonth, canConfirm], () => loadMonthly(), { immediate: true })

/* ================= 我的考勤 ================= */
const myMonth = ref(dayjs().format('YYYY-MM'))
const myRows = ref<AttendanceDailyItem[]>([])
const myLoading = ref(false)

const myColumns = [
  { title: '日期', dataIndex: 'workDate', key: 'workDate', width: 110 },
  { title: '星期', key: 'weekday', width: 70 },
  { title: '日类型', key: 'dayType', width: 100 },
  { title: '状态', key: 'status', width: 110 },
  { title: '首次上班', key: 'firstIn', width: 140 },
  { title: '末次下班', key: 'lastOut', width: 140 },
  { title: '迟到(分)', key: 'lateMinutes', width: 90 },
  { title: '早退(分)', key: 'earlyMinutes', width: 90 },
  { title: '缺勤(小时)', key: 'absentHours', width: 100 },
  { title: '加班(分钟)', key: 'overtimeMinutes', width: 100 },
  { title: '操作', key: 'action', width: 100 }
]

async function loadMy() {
  if (!myMonth.value) return
  myLoading.value = true
  try {
    myRows.value = await myAttendance(myMonth.value)
  } catch (e: any) {
    message.error(e?.message || '加载我的考勤失败')
  } finally {
    myLoading.value = false
  }
}

/* ---------- 补卡申请 ---------- */
const correctionOpen = ref(false)
const correctionSaving = ref(false)
const correctionForm = reactive({
  workDate: '',
  punchType: 'IN',
  punchTime: '',
  reason: ''
})

function openCorrection(record: AttendanceDailyItem) {
  correctionForm.workDate = record.workDate
  correctionForm.punchType = 'IN'
  correctionForm.punchTime = `${record.workDate}T09:00:00`
  correctionForm.reason = ''
  correctionOpen.value = true
}

async function submitCorrection() {
  if (!correctionForm.punchTime) {
    message.warning('请选择补卡时间')
    return
  }
  if (!correctionForm.reason.trim()) {
    message.warning('请填写补卡事由')
    return
  }
  correctionSaving.value = true
  try {
    await applyAttendanceCorrection({
      workDate: correctionForm.punchTime.slice(0, 10) || correctionForm.workDate,
      punchType: correctionForm.punchType,
      punchTime: correctionForm.punchTime,
      reason: correctionForm.reason.trim(),
      type: 'MISSING_PUNCH'
    })
    message.success('补卡申请已提交，请等待 HR 审批')
    correctionOpen.value = false
    loadMy()
  } catch (e: any) {
    message.error(e?.message || '补卡申请提交失败')
  } finally {
    correctionSaving.value = false
  }
}

/* ================= 日结果 ================= */
const dailyFilters = reactive<{ month: string; employeeId?: string; status?: string }>({
  month: dayjs().format('YYYY-MM'),
  employeeId: undefined,
  status: undefined
})
const dailyRows = ref<AttendanceDailyItem[]>([])
const dailyLoading = ref(false)
const dailyTotal = ref(0)
const dailyPage = ref(1)
const dailySize = ref(20)
const generateDate = ref(dayjs().format('YYYY-MM-DD'))
const generating = ref(false)

const dailyStatusOptions = [
  { value: 'NORMAL', label: '正常' },
  { value: 'LATE', label: '迟到' },
  { value: 'EARLY', label: '早退' },
  { value: 'LATE_EARLY', label: '迟到+早退' },
  { value: 'ABSENT', label: '缺勤' },
  { value: 'MISSING_PUNCH', label: '缺卡' },
  { value: 'LEAVE', label: '请假' },
  { value: 'REST', label: '休息' },
  { value: 'HOLIDAY', label: '节假日' }
]

const dailyColumns = [
  { title: '员工', dataIndex: 'employeeName', key: 'employeeName', width: 140 },
  { title: '日期', dataIndex: 'workDate', key: 'workDate', width: 110 },
  { title: '日类型', key: 'dayType', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '班次', key: 'shift', width: 130 },
  { title: '首次上班', key: 'firstIn', width: 140 },
  { title: '末次下班', key: 'lastOut', width: 140 },
  { title: '迟到(分)', dataIndex: 'lateMinutes', width: 90 },
  { title: '早退(分)', dataIndex: 'earlyMinutes', width: 90 },
  { title: '缺勤(小时)', dataIndex: 'absentHours', width: 100 },
  { title: '加班(分钟)', dataIndex: 'overtimeMinutes', width: 100 }
]

const dailyPagination = computed(() => ({
  current: dailyPage.value,
  pageSize: dailySize.value,
  total: dailyTotal.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

async function loadDaily() {
  if (!canAttendanceView.value) return
  dailyLoading.value = true
  try {
    const res = await pageAttendanceDaily({
      month: dailyFilters.month,
      employeeId: dailyFilters.employeeId || undefined,
      status: dailyFilters.status || undefined,
      page: dailyPage.value,
      size: dailySize.value
    })
    dailyRows.value = res.list || []
    dailyTotal.value = res.total || 0
  } catch (e: any) {
    message.error(e?.message || '加载考勤日结果失败')
  } finally {
    dailyLoading.value = false
  }
}

function reloadDaily() {
  dailyPage.value = 1
  loadDaily()
}

function onDailyTableChange(p: any) {
  dailyPage.value = p.current || 1
  dailySize.value = p.pageSize || 20
  loadDaily()
}

async function doGenerate() {
  if (!generateDate.value) {
    message.warning('请选择生成日期')
    return
  }
  generating.value = true
  try {
    const n = await generateAttendanceDaily(generateDate.value)
    message.success(`已生成 ${n} 条考勤日结果`)
    reloadDaily()
  } catch (e: any) {
    message.error(e?.message || '生成考勤失败')
  } finally {
    generating.value = false
  }
}

/* ================= 打卡记录 / 手工补录 ================= */
const punchFilters = reactive<{ employeeId?: string; date?: string }>({
  employeeId: undefined,
  date: dayjs().format('YYYY-MM-DD')
})
const punchRows = ref<AttendancePunchItem[]>([])
const punchLoading = ref(false)
const punchTotal = ref(0)
const punchPage = ref(1)
const punchSize = ref(50)

const punchColumns = [
  { title: '员工', key: 'employee', width: 160 },
  { title: '打卡时间', key: 'punchTime', width: 160 },
  { title: '类型', key: 'punchType', width: 90 },
  { title: '来源', key: 'source', width: 100 },
  { title: '设备', dataIndex: 'deviceNo', width: 120 },
  { title: '地点', dataIndex: 'location', width: 150 },
  { title: '备注', dataIndex: 'remark' }
]

const punchPagination = computed(() => ({
  current: punchPage.value,
  pageSize: punchSize.value,
  total: punchTotal.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

async function loadPunches() {
  if (!canAttendanceView.value) return
  punchLoading.value = true
  try {
    const res = await pageAttendancePunches({
      employeeId: punchFilters.employeeId || undefined,
      date: punchFilters.date || undefined,
      page: punchPage.value,
      size: punchSize.value
    })
    punchRows.value = res.list || []
    punchTotal.value = res.total || 0
  } catch (e: any) {
    message.error(e?.message || '加载打卡记录失败')
  } finally {
    punchLoading.value = false
  }
}

function reloadPunches() {
  punchPage.value = 1
  loadPunches()
}

function onPunchTableChange(p: any) {
  punchPage.value = p.current || 1
  punchSize.value = p.pageSize || 50
  loadPunches()
}

function punchSourceText(source?: string) {
  switch (source) {
    case 'DEVICE':
      return '考勤设备'
    case 'MOCK':
      return '模拟'
    case 'MANUAL':
      return '手工补录'
    case 'CORRECTION':
      return '补卡'
    default:
      return source || '—'
  }
}

const punchOpen = ref(false)
const punchSaving = ref(false)
const punchForm = reactive<{ employeeId?: string; punchType?: string; punchTime: string; remark: string }>({
  employeeId: undefined,
  punchType: undefined,
  punchTime: `${dayjs().format('YYYY-MM-DD')}T09:00:00`,
  remark: ''
})

const punchTypeOptions = [
  { value: 'IN', label: '上班卡' },
  { value: 'OUT', label: '下班卡' }
]

function openPunch() {
  punchForm.employeeId = punchFilters.employeeId
  punchForm.punchType = undefined
  punchForm.punchTime = `${punchFilters.date || dayjs().format('YYYY-MM-DD')}T09:00:00`
  punchForm.remark = ''
  punchOpen.value = true
}

async function submitPunch() {
  if (!punchForm.employeeId) {
    message.warning('请选择员工')
    return
  }
  if (!punchForm.punchTime) {
    message.warning('请选择打卡时间')
    return
  }
  punchSaving.value = true
  try {
    await addAttendancePunch({
      employeeId: punchForm.employeeId,
      punchTime: punchForm.punchTime,
      punchType: punchForm.punchType || undefined,
      remark: punchForm.remark.trim() || undefined
    })
    message.success('打卡已补录')
    punchOpen.value = false
    loadPunches()
  } catch (e: any) {
    message.error(e?.message || '补录失败')
  } finally {
    punchSaving.value = false
  }
}

/* ================= 补卡审批 ================= */
const corrFilters = reactive<{ status?: number; month?: string }>({
  status: 0,
  month: undefined
})
const corrRows = ref<AttendanceCorrectionItem[]>([])
const corrLoading = ref(false)
const corrTotal = ref(0)
const corrPage = ref(1)
const corrSize = ref(20)

const correctionStatusOptions = [
  { value: 0, label: '待审批' },
  { value: 1, label: '已通过' },
  { value: 2, label: '已驳回' }
]

const corrColumns = [
  { title: '员工', dataIndex: 'employeeName', key: 'employeeName', width: 140 },
  { title: '日期', dataIndex: 'workDate', key: 'workDate', width: 110 },
  { title: '类型', key: 'type', width: 110 },
  { title: '补卡', dataIndex: 'punchType', width: 80 },
  { title: '补卡时间', key: 'punchTime', width: 150 },
  { title: '事由', dataIndex: 'reason', ellipsis: true },
  { title: '状态', key: 'status', width: 130 },
  { title: '申请时间', key: 'createdAt', width: 150 },
  { title: '操作', key: 'action', width: 100 }
]

const corrPagination = computed(() => ({
  current: corrPage.value,
  pageSize: corrSize.value,
  total: corrTotal.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

function correctionTypeText(type?: string) {
  if (type === 'MISSING_PUNCH') return '缺卡补卡'
  if (type === 'OVERTIME_PUNCH') return '加班补卡'
  return type || '—'
}

function correctionStatusColor(status: number) {
  return status === 0 ? 'orange' : status === 1 ? 'green' : status === 2 ? 'red' : 'default'
}

async function loadCorrections() {
  if (!canAttendanceManage.value) return
  corrLoading.value = true
  try {
    const res = await pageAttendanceCorrections({
      status: corrFilters.status,
      month: corrFilters.month || undefined,
      page: corrPage.value,
      size: corrSize.value
    })
    corrRows.value = res.list || []
    corrTotal.value = res.total || 0
  } catch (e: any) {
    message.error(e?.message || '加载补卡申请失败')
  } finally {
    corrLoading.value = false
  }
}

function reloadCorrections() {
  corrPage.value = 1
  loadCorrections()
}

function onCorrTableChange(p: any) {
  corrPage.value = p.current || 1
  corrSize.value = p.pageSize || 20
  loadCorrections()
}

const reviewOpen = ref(false)
const reviewSaving = ref(false)
const reviewMode = ref<'approve' | 'reject'>('approve')
const reviewTarget = ref<AttendanceCorrectionItem | null>(null)
const reviewNote = ref('')

function openReview(record: AttendanceCorrectionItem, mode: 'approve' | 'reject') {
  reviewTarget.value = record
  reviewMode.value = mode
  reviewNote.value = ''
  reviewOpen.value = true
}

async function submitReview() {
  if (!reviewTarget.value) return
  reviewSaving.value = true
  try {
    if (reviewMode.value === 'approve') {
      await approveAttendanceCorrection(reviewTarget.value.id, reviewNote.value.trim() || undefined)
      message.success('已通过')
    } else {
      await rejectAttendanceCorrection(reviewTarget.value.id, reviewNote.value.trim() || undefined)
      message.success('已驳回')
    }
    reviewOpen.value = false
    loadCorrections()
  } catch (e: any) {
    message.error(e?.message || '审批失败')
  } finally {
    reviewSaving.value = false
  }
}

/* ================= 考勤规则 ================= */
const ruleFilters = reactive({ keyword: '' })
const ruleRows = ref<AttendanceRuleItem[]>([])
const ruleLoading = ref(false)
const ruleTotal = ref(0)
const rulePage = ref(1)
const ruleSize = ref(20)

const ruleColumns = [
  { title: '编码', dataIndex: 'code', width: 140 },
  { title: '名称', dataIndex: 'name', width: 160 },
  { title: '班次', key: 'shift', width: 150 },
  { title: '午休', key: 'rest', width: 150 },
  { title: '工时(小时)', dataIndex: 'workHours', width: 100 },
  { title: '状态', key: 'status', width: 90 },
  { title: '适用范围', key: 'scopes', width: 220 },
  { title: '操作', key: 'action', width: 170 }
]

const rulePagination = computed(() => ({
  current: rulePage.value,
  pageSize: ruleSize.value,
  total: ruleTotal.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

function scopeSummary(r: AttendanceRuleItem) {
  if (!r.scopes || !r.scopes.length) return '—'
  return r.scopes
    .map((s) =>
      s.scopeType === 'ALL'
        ? '全员'
        : s.scopeType === 'ORG'
          ? `组织#${s.scopeId ?? ''}`
          : `员工#${s.scopeId ?? ''}`
    )
    .join('、')
}

async function loadRules() {
  if (!canAttendanceView.value) return
  ruleLoading.value = true
  try {
    const res = await pageAttendanceRules({
      keyword: ruleFilters.keyword || undefined,
      page: rulePage.value,
      size: ruleSize.value
    })
    ruleRows.value = res.list || []
    ruleTotal.value = res.total || 0
  } catch (e: any) {
    message.error(e?.message || '加载考勤规则失败')
  } finally {
    ruleLoading.value = false
  }
}

function reloadRules() {
  rulePage.value = 1
  loadRules()
}

function onRuleTableChange(p: any) {
  rulePage.value = p.current || 1
  ruleSize.value = p.pageSize || 20
  loadRules()
}

/* ---------- 规则编辑 ---------- */
interface SegmentRow {
  _key: string
  name: string
  startTime: string
  endTime: string
  workMinutes: number
  needPunch: number
  crossDay: number
}

interface ScopeRow {
  _key: string
  scopeType: string
  scopeId?: string
  priority: number
}

const ruleModalOpen = ref(false)
const ruleSaving = ref(false)
const ruleEditingId = ref<string | null>(null)
const ruleForm = reactive({
  code: '',
  name: '',
  status: 1,
  workStart: '09:00:00',
  workEnd: '18:00:00',
  restStart: '12:00:00',
  restEnd: '13:00:00',
  workHours: 8,
  lateGrace: 0,
  earlyGrace: 0,
  absentMinMinutes: 0,
  flexible: 0,
  crossDay: 0,
  requirePunch: 1,
  color: '#1677ff',
  remark: ''
})
const ruleSegments = ref<SegmentRow[]>([])
const ruleScopes = ref<ScopeRow[]>([])

const segmentColumns = [
  { title: '名称', key: 'name', width: 130 },
  { title: '开始', key: 'startTime', width: 120 },
  { title: '结束', key: 'endTime', width: 120 },
  { title: '计工时(分)', key: 'workMinutes', width: 110 },
  { title: '需打卡', key: 'needPunch', width: 80 },
  { title: '跨天', key: 'crossDay', width: 80 },
  { title: '操作', key: 'action', width: 70 }
]

const scopeColumns = [
  { title: '范围类型', key: 'scopeType', width: 140 },
  { title: '范围值', key: 'scopeId' },
  { title: '优先级', key: 'priority', width: 110 },
  { title: '操作', key: 'action', width: 70 }
]

const scopeTypeOptions = [
  { value: 'ALL', label: '全员' },
  { value: 'ORG', label: '组织' },
  { value: 'EMPLOYEE', label: '员工' }
]

interface OrgTreeSelect {
  value: string
  title: string
  children?: OrgTreeSelect[]
}

const orgTreeData = ref<OrgTreeSelect[]>([])
const orgTreeAvailable = ref(true)

function toOrgTreeSelect(list: OrgNode[]): OrgTreeSelect[] {
  return (list || []).map((n) => ({
    value: n.id,
    title: n.name,
    children: n.children?.length ? toOrgTreeSelect(n.children) : undefined
  }))
}

async function loadOrgTree() {
  try {
    orgTreeData.value = toOrgTreeSelect((await orgTree()) || [])
    orgTreeAvailable.value = true
  } catch {
    orgTreeData.value = []
    orgTreeAvailable.value = false
  }
}

let rowSeed = 0
function keyOf(prefix: string) {
  rowSeed += 1
  return `${prefix}-${rowSeed}`
}

function addSegment() {
  ruleSegments.value.push({
    _key: keyOf('seg'),
    name: '',
    startTime: '09:00:00',
    endTime: '18:00:00',
    workMinutes: 0,
    needPunch: 1,
    crossDay: 0
  })
}

function removeSegment(index: number) {
  ruleSegments.value.splice(index, 1)
}

function addScope() {
  ruleScopes.value.push({ _key: keyOf('scope'), scopeType: 'ALL', scopeId: undefined, priority: 0 })
}

function removeScope(index: number) {
  ruleScopes.value.splice(index, 1)
}

function onScopeTypeChange(record: ScopeRow) {
  record.scopeId = undefined
}

async function openRule(record?: AttendanceRuleItem) {
  ruleEditingId.value = record?.id || null
  Object.assign(ruleForm, {
    code: '',
    name: '',
    status: 1,
    workStart: '09:00:00',
    workEnd: '18:00:00',
    restStart: '12:00:00',
    restEnd: '13:00:00',
    workHours: 8,
    lateGrace: 0,
    earlyGrace: 0,
    absentMinMinutes: 0,
    flexible: 0,
    crossDay: 0,
    requirePunch: 1,
    color: '#1677ff',
    remark: ''
  })
  ruleSegments.value = []
  ruleScopes.value = [{ _key: keyOf('scope'), scopeType: 'ALL', scopeId: undefined, priority: 0 }]
  ruleModalOpen.value = true
  if (canAttendanceManage.value) void loadOrgTree()
  if (record) {
    try {
      const detail = await getAttendanceRule(record.id)
      Object.assign(ruleForm, {
        code: detail.code || '',
        name: detail.name || '',
        status: detail.status ?? 1,
        workStart: detail.workStart || '09:00:00',
        workEnd: detail.workEnd || '18:00:00',
        restStart: detail.restStart || '',
        restEnd: detail.restEnd || '',
        workHours: detail.workHours == null ? 8 : Number(detail.workHours),
        lateGrace: detail.lateGrace ?? 0,
        earlyGrace: detail.earlyGrace ?? 0,
        absentMinMinutes: detail.absentMinMinutes ?? 0,
        flexible: detail.flexible ?? 0,
        crossDay: detail.crossDay ?? 0,
        requirePunch: detail.requirePunch ?? 1,
        color: detail.color || '#1677ff',
        remark: detail.remark || ''
      })
      ruleSegments.value = (detail.segments || []).map((s, i) => ({
        _key: keyOf('seg'),
        name: s.name || `第${(s.seq ?? i + 1)}段`,
        startTime: s.startTime || '',
        endTime: s.endTime || '',
        workMinutes: s.workMinutes ?? 0,
        needPunch: s.needPunch ?? 1,
        crossDay: s.crossDay ?? 0
      }))
      ruleScopes.value = (detail.scopes || []).map((s) => ({
        _key: keyOf('scope'),
        scopeType: s.scopeType || 'ALL',
        scopeId: s.scopeId == null ? undefined : String(s.scopeId),
        priority: s.priority ?? 0
      }))
      if (!ruleScopes.value.length) addScope()
    } catch (e: any) {
      message.error(e?.message || '加载规则详情失败')
    }
  }
}

async function submitRule() {
  if (!ruleForm.name.trim()) {
    message.warning('请填写规则名称')
    return
  }
  if (!ruleForm.code.trim()) {
    message.warning('请填写规则编码')
    return
  }
  if (!ruleForm.workStart || !ruleForm.workEnd) {
    message.warning('请填写上下班时间')
    return
  }
  const body: AttendanceRuleBody = {
    code: ruleForm.code.trim(),
    name: ruleForm.name.trim(),
    status: ruleForm.status,
    workStart: ruleForm.workStart,
    workEnd: ruleForm.workEnd,
    restStart: ruleForm.restStart || null,
    restEnd: ruleForm.restEnd || null,
    workHours: ruleForm.workHours,
    lateGrace: ruleForm.lateGrace,
    earlyGrace: ruleForm.earlyGrace,
    absentMinMinutes: ruleForm.absentMinMinutes,
    flexible: ruleForm.flexible,
    crossDay: ruleForm.crossDay,
    requirePunch: ruleForm.requirePunch,
    color: ruleForm.color || null,
    remark: ruleForm.remark || null,
    segments: ruleSegments.value.map((s, i) => ({
      seq: i + 1,
      name: s.name || `第${i + 1}段`,
      startTime: s.startTime || null,
      endTime: s.endTime || null,
      workMinutes: s.workMinutes ?? 0,
      needPunch: s.needPunch ?? 0,
      crossDay: s.crossDay ?? 0
    })),
    scopes: ruleScopes.value.map((s) => ({
      scopeType: s.scopeType,
      scopeId: s.scopeType === 'ALL' ? 0 : s.scopeId || null,
      priority: s.priority ?? 0
    }))
  }
  ruleSaving.value = true
  try {
    if (ruleEditingId.value) {
      await updateAttendanceRule(ruleEditingId.value, body)
    } else {
      await createAttendanceRule(body)
    }
    message.success('规则已保存')
    ruleModalOpen.value = false
    loadRules()
  } catch (e: any) {
    message.error(e?.message || '保存规则失败')
  } finally {
    ruleSaving.value = false
  }
}

async function doToggleRule(record: AttendanceRuleItem) {
  try {
    await toggleAttendanceRule(record.id)
    message.success(record.status === 1 ? '规则已停用' : '规则已启用')
    loadRules()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function doDeleteRule(record: AttendanceRuleItem) {
  try {
    await deleteAttendanceRule(record.id)
    message.success('规则已删除')
    loadRules()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

/* ================= 工作日历 ================= */
const calMonth = ref(dayjs().format('YYYY-MM'))
const calRows = ref<WorkCalendarDay[]>([])
const calLoading = ref(false)
const calSaving = ref(false)

const calColumns = [
  { title: '日期', dataIndex: 'workDate', key: 'workDate', width: 140 },
  { title: '星期', key: 'weekday', width: 80 },
  { title: '是否工作日', key: 'isWorkday', width: 120 },
  { title: '节假日名称', key: 'holidayName' },
  { title: '来源', key: 'configured', width: 110 }
]

async function loadCalendar() {
  if (!calMonth.value) return
  calLoading.value = true
  try {
    const list = await listWorkCalendar(calMonth.value)
    calRows.value = (list || []).map((r) => ({
      ...r,
      isWorkday: r.isWorkday ?? 0,
      holidayName: r.holidayName || ''
    }))
  } catch (e: any) {
    message.error(e?.message || '加载工作日历失败')
  } finally {
    calLoading.value = false
  }
}

function shiftCalendar(delta: number) {
  calMonth.value = dayjs(calMonth.value).add(delta, 'month').format('YYYY-MM')
  loadCalendar()
}

/** 已过去的日期不允许调整工作日历（与后端校验一致，编辑控件禁用、保存时过滤） */
const todayStr = new Date().toLocaleDateString('sv')
const isPastDate = (d: string) => d < todayStr

async function saveCalendar() {
  if (!calRows.value.length) return
  calSaving.value = true
  try {
    await saveWorkCalendar(
      calRows.value
        .filter((r) => !isPastDate(r.workDate))
        .map((r) => ({
          workDate: r.workDate,
          isWorkday: Number(r.isWorkday) === 1 ? 1 : 0,
          holidayName: r.holidayName || undefined
        }))
    )
    message.success('工作日历已保存')
    loadCalendar()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    calSaving.value = false
  }
}

/* ---------- 下一年工作日历一键更新（每年 11 月起开放） ---------- */
const calNextYear = ref<CalendarNextYearStatus | null>(null)
const calApplyLoading = ref(false)

async function loadCalendarStatus() {
  try {
    calNextYear.value = await calendarNextYearStatus()
  } catch {
    calNextYear.value = null
  }
}

async function applyNextYear() {
  calApplyLoading.value = true
  try {
    const res = await applyNextYearCalendar()
    message.success(
      `${res.nextYear} 年工作日历已更新：写入 ${res.inserted} 天` +
        (res.skipped > 0 ? `，保留已手工配置的 ${res.skipped} 天` : ''),
    )
    await loadCalendarStatus()
    loadCalendar()
  } catch (e: any) {
    message.error(e?.message || '更新失败')
  } finally {
    calApplyLoading.value = false
  }
}

/* CSV 导入：日期,是否工作日,节假日名称 */
const calImporting = ref(false)

async function onCalendarCsv(file: File) {
  calImporting.value = true
  try {
    const count = await importWorkCalendarCsv(file)
    message.success(`已导入 ${count} 天`)
    await loadCalendar()
  } catch (e: any) {
    message.error(e?.message || '导入失败')
  } finally {
    calImporting.value = false
  }
  return false
}

/* ================= 年假策略 ================= */
const policyRows = ref<AnnualLeavePolicyItem[]>([])
const policyLoading = ref(false)
const policyModalOpen = ref(false)
const policySaving = ref(false)
const policyEditingId = ref<string | null>(null)
const generateYear = ref(dayjs().year())
const annualGenerating = ref(false)

const policyColumns = [
  { title: '策略名称', dataIndex: 'name', width: 200 },
  { title: '工龄档位', key: 'tiers' },
  { title: '结转规则', key: 'carryover', width: 220 },
  { title: '生效日期', dataIndex: 'effectiveFrom', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 120 }
]

const policyForm = reactive({
  name: '',
  enabled: 0,
  tier1Years: 1,
  tier1Days: 5,
  tier2Years: 10,
  tier2Days: 10,
  tier3Years: 20,
  tier3Days: 15,
  carryoverEnabled: 0,
  carryoverMaxDays: 5,
  carryoverExpireMonth: 3,
  effectiveFrom: dayjs().format('YYYY-MM-DD'),
  remark: ''
})

function policyTierText(p: AnnualLeavePolicyItem) {
  const parts: string[] = []
  if (p.tier1Years != null) parts.push(`${p.tier1Years}年→${p.tier1Days ?? 0}天`)
  if (p.tier2Years != null) parts.push(`${p.tier2Years}年→${p.tier2Days ?? 0}天`)
  if (p.tier3Years != null) parts.push(`${p.tier3Years}年→${p.tier3Days ?? 0}天`)
  return parts.join('；') || '—'
}

function policyCarryText(p: AnnualLeavePolicyItem) {
  if (p.carryoverEnabled !== 1) return '不结转'
  return `最多 ${p.carryoverMaxDays ?? 0} 天，次年 ${p.carryoverExpireMonth ?? '—'} 月失效`
}

async function loadPolicies() {
  if (!canQuotaAdjust.value) return
  policyLoading.value = true
  try {
    policyRows.value = (await listAnnualLeavePolicies()) || []
  } catch (e: any) {
    message.error(e?.message || '加载年假策略失败')
  } finally {
    policyLoading.value = false
  }
}

function openPolicy(record?: AnnualLeavePolicyItem) {
  policyEditingId.value = record?.id || null
  Object.assign(policyForm, {
    name: record?.name || '',
    enabled: record?.enabled ?? 0,
    tier1Years: record?.tier1Years ?? 1,
    tier1Days: record?.tier1Days == null ? 5 : Number(record.tier1Days),
    tier2Years: record?.tier2Years ?? 10,
    tier2Days: record?.tier2Days == null ? 10 : Number(record.tier2Days),
    tier3Years: record?.tier3Years ?? 20,
    tier3Days: record?.tier3Days == null ? 15 : Number(record.tier3Days),
    carryoverEnabled: record?.carryoverEnabled ?? 0,
    carryoverMaxDays: record?.carryoverMaxDays == null ? 5 : Number(record.carryoverMaxDays),
    carryoverExpireMonth: record?.carryoverExpireMonth ?? 3,
    effectiveFrom: record?.effectiveFrom || dayjs().format('YYYY-MM-DD'),
    remark: record?.remark || ''
  })
  policyModalOpen.value = true
}

async function submitPolicy() {
  if (!policyForm.name.trim()) {
    message.warning('请填写策略名称')
    return
  }
  const body: AnnualLeavePolicyBody = {
    name: policyForm.name.trim(),
    enabled: policyForm.enabled,
    tier1Years: policyForm.tier1Years,
    tier1Days: policyForm.tier1Days,
    tier2Years: policyForm.tier2Years,
    tier2Days: policyForm.tier2Days,
    tier3Years: policyForm.tier3Years,
    tier3Days: policyForm.tier3Days,
    carryoverEnabled: policyForm.carryoverEnabled,
    carryoverMaxDays: policyForm.carryoverMaxDays,
    carryoverExpireMonth: policyForm.carryoverExpireMonth,
    effectiveFrom: policyForm.effectiveFrom || null,
    remark: policyForm.remark || null
  }
  policySaving.value = true
  try {
    if (policyEditingId.value) {
      await updateAnnualLeavePolicy(policyEditingId.value, body)
    } else {
      await createAnnualLeavePolicy(body)
    }
    message.success('年假策略已保存')
    policyModalOpen.value = false
    loadPolicies()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    policySaving.value = false
  }
}

async function doEnablePolicy(record: AnnualLeavePolicyItem) {
  try {
    await enableAnnualLeavePolicy(record.id)
    message.success('已启用该策略')
    loadPolicies()
  } catch (e: any) {
    message.error(e?.message || '启用失败')
  }
}

async function doGenerateAnnual() {
  annualGenerating.value = true
  try {
    const n = await generateAnnualLeave(generateYear.value)
    message.success(`已为 ${n} 名员工生成 ${generateYear.value} 年度年假额度`)
  } catch (e: any) {
    message.error(e?.message || '生成年度额度失败')
  } finally {
    annualGenerating.value = false
  }
}

/* ================= tab 切换加载 ================= */
watch(
  tab,
  (key) => {
    if (key === 'overtime') reload()
    else if (key === 'my') loadMy()
    else if (key === 'daily') {
      loadEmployeeOptions()
      loadDaily()
    } else if (key === 'punches') {
      loadEmployeeOptions()
      loadPunches()
    } else if (key === 'corrections') loadCorrections()
    else if (key === 'rules') loadRules()
    else if (key === 'calendar') {
      loadCalendar()
      loadCalendarStatus()
    } else if (key === 'annual') loadPolicies()
  },
  { immediate: true }
)

/* 未指定页签且无加班权限时默认「我的考勤」；显式 ?tab= 跳转优先 */
if (!initTab && !canOvertime.value) tab.value = 'my'
</script>

<style scoped>
/* 下一年日历已更新的状态标记 */
.cal-applied {
  color: #52c41a;
  font-size: 13px;
  margin-right: 8px;
  cursor: default;
}
.att-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tabs {
  flex: 1;
  min-width: 0;
}
.tabs :deep(.ant-tabs-nav) {
  margin: 0;
}
.mock-btn {
  flex: 0 0 auto;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
}
.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  white-space: nowrap;
}
/* 加班记录与月度汇总各占剩余高度的一半 */
.month-panel {
  flex: 1 1 0;
  min-height: 0;
}
.month-body {
  overflow: auto;
}
.cell-sub {
  font-size: 12px;
}
.reason-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.color-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}
.ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.sub-table {
  margin-bottom: 8px;
}
.form-hint {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 10px;
}
.mt12 {
  margin-top: 12px;
}
.mb12 {
  margin-bottom: 12px;
}
.danger {
  color: #ff4d4f;
}
</style>
