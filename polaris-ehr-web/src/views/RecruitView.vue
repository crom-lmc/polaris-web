<template>
  <div class="page-root">
    <div class="toolbar">
      <div class="toolbar-left">
        <a-radio-group v-model:value="mode" button-style="solid" @change="onModeChange">
          <template v-if="canView">
            <a-radio-button value="board">候选人看板</a-radio-button>
            <a-radio-button value="offers">Offer 列表</a-radio-button>
            <a-radio-button value="jobs">职位管理</a-radio-button>
          </template>
          <a-radio-button value="interviews">我的面试</a-radio-button>
        </a-radio-group>
        <a-input-search
          v-if="canView"
          v-model:value="keyword"
          placeholder="姓名 / 手机号 / 职位"
          allow-clear
          style="width: 240px"
          @search="onSearch"
        />
      </div>
      <div class="toolbar-right">
        <template v-if="mode === 'offers'">
          <a-select
            v-model:value="offerStatus"
            allow-clear
            placeholder="全部状态"
            style="width: 130px"
            :options="offerStatusOptions"
            @change="loadOffers"
          />
        </template>
        <template v-if="mode === 'jobs'">
          <a-select
            v-model:value="jobStatus"
            allow-clear
            placeholder="全部状态"
            style="width: 120px"
            :options="jobStatusOptions"
            @change="loadJobs"
          />
        </template>
        <template v-if="canManage">
          <a-button v-if="mode === 'jobs'" type="primary" @click="openJobModal()">
            <plus-outlined />新建职位
          </a-button>
          <template v-else>
            <a-button @click="openOfferModal()">发起 Offer</a-button>
            <a-button type="primary" @click="openCandidateModal()">
              <plus-outlined />新建候选人
            </a-button>
          </template>
        </template>
      </div>
    </div>

    <div class="panel ft-grow">
      <div class="panel-head">
        <span>{{ modeTitle }}</span>
        <span class="muted">
          {{ mode === 'board' ? `共 ${candidateTotal} 位候选人` : mode === 'offers' ? `共 ${offerTotal} 条 Offer` : mode === 'interviews' ? `待反馈 ${pendingInterviewCount} 场` : `共 ${jobTotal} 个职位` }}
        </span>
      </div>

      <div v-if="mode === 'board'" class="panel-body board-body">
        <a-spin :spinning="candidateLoading">
          <div class="board">
            <div v-for="col in stages" :key="col.key" class="kb-col">
              <div class="kb-col-head">
                <span class="dot" :class="col.dot"></span>
                <span>{{ col.label }}</span>
                <span class="cnt">{{ grouped[col.key]?.length || 0 }}</span>
              </div>
              <div class="kb-list">
                <div v-for="c in grouped[col.key] || []" :key="c.id" class="kb-card">
                  <div class="kb-card-top">
                    <span class="kb-name">{{ c.name }}</span>
                    <a-tag :color="sourceColor(c.source)">{{ sourceText(c.source) }}</a-tag>
                  </div>
                  <div class="kb-line">{{ c.position }}<span v-if="c.orgPath" class="muted"> · {{ c.orgPath }}</span></div>
                  <div class="muted kb-line">
                    {{ c.mobile || '未填手机号' }}<span v-if="c.ownerName"> · {{ c.ownerName }}</span>
                  </div>
                  <div v-if="c.education || c.workYears" class="muted kb-line">
                    {{ c.education || '学历未填' }}<span v-if="c.workYears"> · {{ c.workYears }} 年</span>
                  </div>
                  <div v-if="c.jobTitle" class="muted kb-line" :title="c.jobTitle">投递职位：{{ c.jobTitle }}</div>
                  <div v-if="c.resumeFileId" class="muted kb-line">
                    <a @click="downloadResume(c)">简历：{{ c.resumeFileName || '下载' }}</a>
                  </div>
                  <div v-if="c.remark" class="muted kb-remark" :title="c.remark">{{ c.remark }}</div>
                  <div v-if="c.interviewRoundNo || c.interviewPendingCount" class="muted kb-line">
                    <span v-if="c.interviewRoundNo">已通过 {{ c.interviewRoundNo }} 轮面试</span>
                    <span v-if="c.interviewPendingCount">{{ c.interviewRoundNo ? ' · ' : '' }}待反馈 {{ c.interviewPendingCount }} 人</span>
                    <span v-if="c.interviewNextAt"> · {{ fmtShort(c.interviewNextAt) }}</span>
                  </div>
                  <div v-if="c.lastCommContent" class="muted kb-remark" :title="c.lastCommContent">
                    沟通：{{ c.lastCommContent }}
                  </div>
                  <div v-if="c.activeApplyCount" class="kb-offer">
                    <a-tag color="orange">同手机号另有 {{ c.activeApplyCount }} 个在途投递</a-tag>
                  </div>
                  <div v-if="c.hasActiveOffer" class="kb-offer">
                    <a-tag
                      :color="offerStatusColor(c.offerStatus)"
                      :class="{ 'kb-offer-tag': !!briefIdForCandidate(c) }"
                      :title="briefIdForCandidate(c) ? '点击查看审批详情，发起人可撤回' : undefined"
                      @click="openCandidateApproval(c)"
                    >{{ offerStatusText(c.offerStatus) }}</a-tag>
                  </div>
                  <div v-if="hasRejectReason(c)" class="kb-offer">
                    <a-tag color="red">Offer 已驳回</a-tag>
                    <a-button
                      type="link"
                      size="small"
                      style="padding: 0 0 0 4px"
                      @click="openCandidateApproval(c)"
                    >查看驳回原因</a-button>
                  </div>
                  <div v-if="c.employeeId" class="kb-offer">
                    <a-tag color="green">{{ c.employeeStatusLabel || '已建档' }}</a-tag>
                    <span v-if="!c.accountOpened" class="muted">未开户</span>
                  </div>
                  <div v-if="canManage" class="kb-actions">
                    <a v-if="c.hasActiveOffer" class="act" @click="openCandidateModal(c, true)">查看</a>
                    <a v-else class="act" @click="openCandidateModal(c)">编辑</a>
                    <div class="kb-actions-main">
                      <a class="act" @click="openDetail(c)">详情</a>
                      <a
                        v-if="c.stage !== 'REJECTED' && !c.hasActiveOffer && !c.interviewPendingCount"
                        class="act primary"
                        @click="openInterviewModal(c)"
                      >{{ c.interviewRoundNo ? '约下一轮' : '约面试' }}</a>
                      <a v-if="c.interviewPendingCount" class="act primary" @click="openDetail(c)">查看面试</a>
                      <a
                        v-if="c.stage !== 'REJECTED' && !c.hasActiveOffer && c.interviewRoundNo && !c.interviewPendingCount"
                        class="act primary"
                        @click="openOfferModal(c)"
                      >发起 Offer</a>
                      <a-popconfirm
                        v-if="c.stage === 'REJECTED'"
                        title="恢复该候选人到面试中？"
                        ok-text="恢复"
                        cancel-text="取消"
                        @confirm="restoreCandidate(c)"
                      >
                        <a class="act">恢复</a>
                      </a-popconfirm>
                      <span
                        v-else-if="isOfferApproving(c)"
                        class="act act-disabled"
                        title="Offer 审批中，暂不可淘汰"
                      >淘汰</span>
                      <a-popconfirm
                        v-else-if="!c.hasActiveOffer"
                        title="淘汰后不可再发起 Offer，确定淘汰？"
                        ok-text="淘汰"
                        cancel-text="取消"
                        @confirm="eliminateCandidate(c)"
                      >
                        <a class="act danger">淘汰</a>
                      </a-popconfirm>
                    </div>
                  </div>
                  <div v-else class="kb-actions">
                    <span></span>
                    <div class="kb-actions-main">
                      <a class="act" @click="openDetail(c)">详情</a>
                    </div>
                  </div>
                </div>
                <div v-if="!(grouped[col.key] || []).length" class="kb-empty">暂无候选人</div>
              </div>
            </div>
          </div>
        </a-spin>
      </div>

      <div v-else-if="mode === 'offers'" class="panel-body table-body">
        <a-table
          size="middle"
          row-key="id"
          :columns="offerColumns"
          :data-source="offers"
          :loading="offerLoading"
          :pagination="offerPagination"
          @change="onOfferTableChange"
        >
          <template #emptyText>
            <div class="tab-empty">
              <a-empty description="暂无 Offer 数据" />
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'candidate'">
              <div>{{ record.candidateName }}</div>
              <div class="muted cell-sub">{{ record.candidateMobile || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'salary'">
              <span>¥{{ money(record.salary) }}</span>
            </template>
            <template v-else-if="column.key === 'org'">
              <span class="muted">{{ record.orgPath || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="offerStatusColor(record.status)">{{ offerStatusText(record.status) }}</a-tag>
              <div v-if="record.remark" class="muted cell-sub" :title="record.remark">{{ record.remark }}</div>
            </template>
            <template v-else-if="column.key === 'archive'">
              <template v-if="record.employeeId">
                <a-tag color="green">已建档</a-tag>
                <div class="muted cell-sub">{{ record.employeeName }} · 待入职</div>
              </template>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="row-actions">
                <a v-if="briefIdForOffer(record)" class="act" @click="openApprovalDetail(briefIdForOffer(record)!)">
                  审批详情
                </a>
                <a-popconfirm
                  v-if="record.status === 'APPROVING' && canManage"
                  title="撤销后审批流程立即终止，确定撤销？"
                  ok-text="撤销"
                  cancel-text="取消"
                  @confirm="doCancelOffer(record)"
                >
                  <a class="act danger">撤销</a>
                </a-popconfirm>
                <a
                  v-if="record.status === 'APPROVED' && canManage"
                  class="act"
                  @click="doConfirmOffer(record)"
                >确认 Offer</a>
                <a-popconfirm
                  v-if="(record.status === 'APPROVED' || record.status === 'CONFIRMED') && !record.employeeId && canManage"
                  title="确认候选人已放弃该 Offer？"
                  ok-text="确认放弃"
                  cancel-text="取消"
                  @confirm="doDeclineOffer(record)"
                >
                  <a class="act danger">候选人放弃</a>
                </a-popconfirm>
                <a
                  v-if="record.status === 'CONFIRMED' && !record.employeeId && canManage"
                  class="act"
                  @click="doOnboard(record)"
                >办理入职</a>
                <span v-if="record.status === 'REJECTED' && canManage" class="muted" style="padding: 0 8px">已结束</span>
              </div>
            </template>
          </template>
        </a-table>
      </div>

      <div v-else-if="mode === 'interviews'" class="panel-body table-body">
        <a-table
          size="middle"
          row-key="id"
          :columns="interviewTodoColumns"
          :data-source="interviewTodos"
          :loading="interviewTodoLoading"
          :pagination="false"
        >
          <template #emptyText>
            <div class="tab-empty">
              <a-empty description="暂无面试数据" />
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'candidate'">
              <div>{{ record.candidateName }}</div>
              <div class="muted cell-sub">第 {{ record.roundNo }} 轮面试<template v-if="record.interviewNo"> · {{ record.interviewNo }}</template></div>
            </template>
            <template v-else-if="column.key === 'position'">
              {{ record.position || '—' }}
            </template>
            <template v-else-if="column.key === 'method'">
              <span>{{ methodText(record.method) }}</span>
              <div v-if="record.location" class="muted cell-sub">{{ record.location }}</div>
            </template>
            <template v-else-if="column.key === 'result'">
              <a-tag v-if="record.result === 'PASS'" color="green">通过</a-tag>
              <a-tag v-else-if="record.result === 'FAIL'" color="red">不通过</a-tag>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'feedback'">
              <span :title="record.feedback">{{ record.feedback || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag v-if="record.status === 'DONE'" color="green">已完成</a-tag>
              <a-tag v-else color="orange">待反馈</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a v-if="record.status !== 'DONE'" class="act" @click="openFeedback(record)">填写反馈</a>
            </template>
          </template>
        </a-table>
      </div>

      <div v-else class="panel-body table-body">
        <a-table
          size="middle"
          row-key="id"
          :columns="jobColumns"
          :data-source="jobs"
          :loading="jobLoading"
          :pagination="jobPagination"
          @change="onJobTableChange"
        >
          <template #emptyText>
            <div class="tab-empty">
              <a-empty description="暂无职位数据" />
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <div>{{ record.title }}</div>
              <div v-if="record.orgPath" class="muted cell-sub">{{ record.orgPath }}</div>
            </template>
            <template v-else-if="column.key === 'jobType'">
              <span>{{ jobTypeText(record.jobType) }}</span>
            </template>
            <template v-else-if="column.key === 'salary'">
              <span>{{ record.salaryRange || '面议' }}</span>
            </template>
            <template v-else-if="column.key === 'apply'">
              <span>{{ record.applyCount || 0 }} 人</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="jobStatusColor(record.status)">{{ jobStatusText(record.status) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="row-actions">
                <a v-if="canManage" class="act" @click="openJobModal(record)">编辑</a>
                <a v-if="canManage && record.status !== 'PUBLISHED'" class="act" @click="doPublishJob(record)">发布</a>
                <a-popconfirm
                  v-if="canManage && record.status === 'PUBLISHED'"
                  title="关闭后门户不再展示该职位，确定关闭？"
                  ok-text="关闭"
                  cancel-text="取消"
                  @confirm="doCloseJob(record)"
                >
                  <a class="act">关闭</a>
                </a-popconfirm>
                <a-popconfirm
                  v-if="canManage && !record.applyCount"
                  title="删除后不可恢复，确定删除？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="doDeleteJob(record)"
                >
                  <a class="act danger">删除</a>
                </a-popconfirm>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <!-- 候选人新增/编辑：右侧抽屉，表单区滚动、底部按钮固定 -->
    <a-drawer
      v-model:open="candidateModalOpen"
      :title="candidateReadOnly ? '查看候选人' : candidateForm.id ? '编辑候选人' : '新建候选人'"
      :width="760"
      placement="right"
      :styles="{ body: { padding: '16px 24px 0' } }"
    >
      <a-form
        ref="candidateFormRef"
        :model="candidateForm"
        :rules="candidateRules"
        :disabled="candidateReadOnly"
        :label-col="{ flex: '88px' }"
        :wrapper-col="{ flex: 'auto' }"
        label-align="left"
      >
        <div class="form-section-title">基本信息</div>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="姓名" name="name">
              <a-input v-model:value="candidateForm.name" placeholder="候选人姓名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="手机号" name="mobile">
              <a-input v-model:value="candidateForm.mobile" placeholder="手机号" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="性别" name="gender">
              <a-select
                v-model:value="candidateForm.gender"
                :options="genderOptions"
                placeholder="请选择性别"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="出生日期" name="birthday">
              <a-date-picker
                v-model:value="candidateForm.birthday"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="邮箱" name="email">
              <a-input v-model:value="candidateForm.email" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="证件号" name="idCard">
              <a-input v-model:value="candidateForm.idCard" placeholder="仅 HR 可见，列表掩码展示" />
            </a-form-item>
          </a-col>
        </a-row>

        <div class="form-section-title">应聘信息</div>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="应聘职位" name="position">
              <a-select
                v-model:value="candidateForm.position"
                :options="positionOptions"
                show-search
                placeholder="选择职位（来自职位主数据）"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="来源" name="source">
              <a-select v-model:value="candidateForm.source" :options="sourceOptions" placeholder="请选择来源" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="用人部门" name="orgId">
              <a-tree-select
                v-model:value="candidateForm.orgId"
                :tree-data="orgOptions"
                show-search
                tree-node-filter-prop="title"
                placeholder="选择用人部门"
                style="width: 100%"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="工作年限" name="workYears">
              <a-input-number
                v-model:value="candidateForm.workYears"
                :min="0"
                :step="0.5"
                addon-after="年"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="期望月薪" name="expectedSalary">
              <a-input-number
                v-model:value="candidateForm.expectedSalary"
                :min="0"
                :step="500"
                addon-after="元"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="当前公司" name="currentCompany">
              <a-input v-model:value="candidateForm.currentCompany" placeholder="选填" />
            </a-form-item>
          </a-col>
        </a-row>

        <div class="form-section-title">教育背景</div>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="学历" name="education">
              <a-select
                v-model:value="candidateForm.education"
                :options="educationOptions"
                placeholder="请选择学历"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="毕业院校" name="school">
              <a-input v-model:value="candidateForm.school" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="专业" name="major">
              <a-input v-model:value="candidateForm.major" placeholder="选填" />
            </a-form-item>
          </a-col>
        </a-row>

        <div class="form-section-title">附件与备注</div>
        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="简历附件">
              <a-upload
                :show-upload-list="false"
                :disabled="candidateReadOnly"
                :before-upload="onResumeSelected"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              >
                <a-button :loading="resumeUploading" :disabled="candidateReadOnly">上传简历</a-button>
              </a-upload>
              <span v-if="candidateForm.resumeFileId" class="muted" style="margin-left: 8px">
                {{ candidateForm.resumeFileName || '已上传' }}
              </span>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" name="remark">
              <a-textarea
                v-model:value="candidateForm.remark"
                :rows="3"
                placeholder="面试评价、期望薪资等补充说明"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <template #footer>
        <div class="drawer-footer">
          <a-button @click="candidateModalOpen = false">{{ candidateReadOnly ? '关闭' : '取消' }}</a-button>
          <a-button v-if="!candidateReadOnly" type="primary" :loading="candidateSaving" @click="saveCandidate">保存</a-button>
        </div>
      </template>
    </a-drawer>

    <!-- 发起录用 Offer -->
    <a-modal
      v-model:open="offerModalOpen"
      title="发起录用 Offer"
      :width="640"
      :confirm-loading="offerSaving"
      ok-text="提交审批"
      cancel-text="取消"
      @ok="saveOffer"
    >
      <a-alert
        type="info"
        show-icon
        banner
        style="margin-bottom: 14px"
        message="提交后进入审批中心：用人部门 → 人力资源中心；月薪超过档位线时增加总经理终审。审批通过自动生成待入职档案。"
      />
      <a-form ref="offerFormRef" :model="offerForm" :rules="offerRules" :label-col="{ span: 5 }">
        <a-form-item label="候选人" name="candidateId">
          <a-select
            v-model:value="offerForm.candidateId"
            show-search
            option-filter-prop="label"
            placeholder="选择候选人"
            :options="offerCandidateOptions"
            :disabled="!!offerForm.lockedCandidate"
            @change="onOfferCandidateChange"
          />
        </a-form-item>
        <a-form-item label="录用职位" name="position">
          <a-input v-model:value="offerForm.position" placeholder="录用职位" />
        </a-form-item>
        <a-form-item label="月薪(元)" name="salary">
          <a-input-number v-model:value="offerForm.salary" :min="1" :step="500" style="width: 100%" />
        </a-form-item>
        <a-form-item label="预计入职" name="expectedOnboardDate">
          <a-date-picker
            v-model:value="offerForm.expectedOnboardDate"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="录用部门" name="orgId">
          <a-tree-select
            v-model:value="offerForm.orgId"
            :tree-data="orgOptions"
            show-search
            tree-node-filter-prop="title"
            placeholder="选择录用部门"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="offerForm.remark" :rows="2" placeholder="选填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 约面试 -->
    <a-modal
      v-model:open="interviewModalOpen"
      title="约面试"
      :width="580"
      :confirm-loading="interviewSaving"
      ok-text="确定约面"
      cancel-text="取消"
      @ok="saveInterview"
    >
      <a-form :model="interviewForm" layout="vertical">
        <div class="interview-head">
          <span>{{ interviewForm.candidateName }}（{{ interviewForm.position || '—' }}）</span>
          <span>
            <span class="round-now">第 {{ interviewForm.roundNo }} 轮面试</span>
            <span class="muted" style="font-size: 12px; margin-left: 6px">轮次自动递增</span>
          </span>
        </div>
        <a-form-item label="面试官" required>
          <a-select
            v-model:value="interviewForm.interviewerIds"
            mode="multiple"
            show-search
            :filter-option="false"
            :options="interviewerSelectOptions"
            :loading="interviewerLoading"
            placeholder="输入姓名搜索员工，可多选"
            @search="onInterviewerSearch"
          />
        </a-form-item>
        <a-form-item label="面试时间" required>
          <a-date-picker
            v-model:value="interviewForm.scheduledAt"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择时间"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="面试方式">
          <a-select v-model:value="interviewForm.method" :options="interviewMethodOptions" />
        </a-form-item>
        <a-form-item label="地点 / 会议链接">
          <a-input v-model:value="interviewForm.location" placeholder="现场地址或会议链接" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="interviewForm.remark" :rows="2" placeholder="选填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 面试官填写反馈 -->
    <a-modal
      v-model:open="feedbackOpen"
      title="填写面试反馈"
      :width="520"
      :confirm-loading="feedbackSaving"
      ok-text="提交反馈"
      cancel-text="取消"
      @ok="saveFeedback"
    >
      <a-form layout="vertical">
        <a-form-item label="候选人">
          <span>{{ feedbackForm.candidateName }} · 第 {{ feedbackForm.roundNo }} 轮面试</span>
        </a-form-item>
        <a-form-item label="本轮结果" required>
          <a-radio-group v-model:value="feedbackForm.result">
            <a-radio value="PASS">通过</a-radio>
            <a-radio value="FAIL">不通过</a-radio>
          </a-radio-group>
          <div v-if="feedbackForm.result === 'FAIL'" class="feedback-warn">
            不通过将直接淘汰候选人，且其半年内不可网投。
          </div>
          <div v-else class="muted feedback-tip">
            通过后由 HR 决定直接发 Offer 或安排下一轮。
          </div>
        </a-form-item>
        <a-form-item label="评分">
          <a-rate v-model:value="feedbackForm.score" />
        </a-form-item>
        <a-form-item label="面试反馈" required>
          <a-textarea
            v-model:value="feedbackForm.feedback"
            :rows="4"
            placeholder="请填写候选人的能力、匹配度与建议"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 候选人详情：面试记录 + 沟通留痕 -->
    <a-drawer
      v-model:open="detailOpen"
      :title="detailCandidate ? `${detailCandidate.name} · 候选人详情` : '候选人详情'"
      :width="760"
      placement="right"
      :body-style="{ padding: '16px 20px 32px' }"
    >
      <template v-if="detailCandidate">
        <div class="form-section-title">基本信息</div>
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="应聘职位">{{ detailCandidate.position || '—' }}</a-descriptions-item>
          <a-descriptions-item label="当前阶段">{{ stageText(detailCandidate.stage) }}</a-descriptions-item>
          <a-descriptions-item label="手机号">{{ detailCandidate.mobile || '—' }}</a-descriptions-item>
          <a-descriptions-item label="邮箱">{{ detailCandidate.email || '—' }}</a-descriptions-item>
          <a-descriptions-item label="用人部门">{{ detailCandidate.orgPath || '—' }}</a-descriptions-item>
          <a-descriptions-item label="备注">{{ detailCandidate.remark || '—' }}</a-descriptions-item>
        </a-descriptions>

        <div class="form-section-title">
          面试记录
          <a
            v-if="canManage && detailCandidate.stage !== 'REJECTED' && !detailCandidate.interviewPendingCount"
            class="act"
            :class="{ 'act-disabled': detailLocked }"
            :title="detailLocked ? 'Offer 审批中/已通过，暂不可约面试' : undefined"
            style="margin-left: 12px"
            @click="openInterviewModal(detailCandidate)"
          >+ 约面试</a>
          <span v-else-if="canManage && detailCandidate.interviewPendingCount" class="muted" style="margin-left: 12px">
            当前面试进行中，出结果后才能约下一轮
          </span>
        </div>
        <a-spin :spinning="detailLoading">
          <div v-if="!interviewRounds.length" class="muted">暂无面试安排</div>
          <div v-for="r in interviewRounds" :key="r.roundNo" class="round-block">
            <div class="round-head">
              <span class="round-title">第 {{ r.roundNo }} 轮面试</span>
              <a-tag :color="roundTagColor(r)">{{ roundTagText(r) }}</a-tag>
            </div>
            <div v-for="iv in r.items" :key="iv.id" class="iv-row">
              <div class="iv-main">
                <span class="iv-name">{{ iv.interviewerName }}</span>
                <span v-if="iv.interviewNo" class="muted">{{ iv.interviewNo }}</span>
                <span class="muted">{{ iv.scheduledAt || '待定' }} · {{ methodText(iv.method) }}</span>
                <span v-if="iv.location" class="muted"> · {{ iv.location }}</span>
                <a-tag v-if="iv.status === 'CANCELED'" color="default">已取消</a-tag>
                <a-tag v-else-if="iv.status === 'SCHEDULED'" color="processing">待面试</a-tag>
                <a-tag v-else color="green">已反馈</a-tag>
                <a-popconfirm
                  v-if="canManage && iv.status === 'SCHEDULED' && !r.result && !detailLocked"
                  title="取消这场面试？面试官待办将同步关闭。"
                  ok-text="取消面试"
                  cancel-text="返回"
                  @confirm="cancelInterview(iv)"
                >
                  <a class="act danger" style="margin-left: auto">取消</a>
                </a-popconfirm>
              </div>
              <div v-if="iv.feedback" class="iv-feedback">
                <span v-if="iv.score" class="muted">评分 {{ iv.score }} · </span>{{ iv.feedback }}
              </div>
            </div>
            <div v-if="canManage && r.result === 'PASS' && r.roundNo === interviewRounds[interviewRounds.length - 1].roundNo" class="round-actions">
              <a-button size="small" type="primary" :disabled="detailLocked" @click="openInterviewModal(detailCandidate)">
                约下一轮
              </a-button>
              <span class="muted">{{ detailLocked ? 'Offer 审批中/已通过，暂不可约下一轮' : '或直接在该候选人卡片上发起 Offer' }}</span>
            </div>
            <div v-else-if="canManage && !r.result" class="round-actions">
              <span class="muted">等待面试官填写反馈，不通过将自动淘汰</span>
            </div>
          </div>
        </a-spin>

        <div class="form-section-title">沟通记录</div>
        <div v-if="canManage && detailCandidate.stage === 'REJECTED'" class="muted" style="margin-bottom: 8px">
          候选人已淘汰，不可编辑沟通记录
        </div>
        <div v-else-if="canManage && detailLocked" class="muted" style="margin-bottom: 8px">
          Offer 审批中/已通过，暂不可新增沟通记录
        </div>
        <div v-if="canManage" class="comm-form">
          <a-input v-model:value="commForm.content" :disabled="commLocked" placeholder="沟通内容（期望薪资、到岗时间等）" />
          <div class="comm-form-actions">
            <a-select v-model:value="commForm.type" :options="commTypeOptions" :disabled="commLocked" style="width: 140px" />
            <a-input-number
              v-model:value="commForm.expectedSalary"
              :min="0"
              :step="500"
              :disabled="commLocked"
              placeholder="期望月薪"
              style="width: 150px"
            />
            <a-button type="primary" :loading="commSaving" :disabled="commLocked" @click="saveComm">记录</a-button>
          </div>
        </div>
        <div v-if="!detailComms.length" class="muted">暂无沟通记录</div>
        <div v-for="cm in detailComms" :key="cm.id" class="comm-row">
          <div class="muted">
            {{ commTypeText(cm.type) }} · {{ cm.operatorName || 'HR' }} · {{ cm.occurredAt || '' }}
          </div>
          <div>
            {{ cm.content }}
            <span v-if="cm.expectedSalary" class="muted">（期望 {{ money(cm.expectedSalary) }} 元/月）</span>
          </div>
        </div>
      </template>
    </a-drawer>

    <!-- 招聘职位新增/编辑 -->
    <a-modal
      v-model:open="jobModalOpen"
      :title="jobForm.id ? '编辑职位' : '新建职位'"
      width="720px"
      :confirm-loading="jobSaving"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitJob"
    >
      <a-form ref="jobFormRef" :model="jobForm" :rules="jobRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="职位名称" name="title">
              <a-select
                v-model:value="jobForm.title"
                :options="positionOptions"
                show-search
                placeholder="选择职位（来自职位主数据）"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="用人部门" name="orgId">
              <a-tree-select
                v-model:value="jobForm.orgId"
                :tree-data="orgOptions"
                show-search
                tree-node-filter-prop="title"
                placeholder="选择用人部门"
                style="width: 100%"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="工作性质" name="jobType">
              <a-select v-model:value="jobForm.jobType" :options="jobTypeOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="工作城市" name="workCity">
              <a-select
                v-model:value="jobForm.workCity"
                :options="jobCityOptions"
                placeholder="请选择工作城市"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="招聘人数" name="headcount">
              <a-input-number v-model:value="jobForm.headcount" :min="1" :max="999" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="月薪下限" name="salaryMin">
              <a-input-number v-model:value="jobForm.salaryMin" :min="0" :step="1000" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="月薪上限" name="salaryMax">
              <a-input-number v-model:value="jobForm.salaryMax" :min="0" :step="1000" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="投递截止" name="closeAt">
              <a-date-picker v-model:value="jobForm.closeAt" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="学历要求" name="educationReq">
              <a-select
                v-model:value="jobForm.educationReq"
                :options="educationOptions"
                placeholder="选择学历要求"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="经验要求" name="experienceReq">
              <a-select
                v-model:value="jobForm.experienceReq"
                :options="experienceOptions"
                placeholder="选择经验要求"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="标签" name="tags">
              <a-select
                v-model:value="jobForm.tags"
                mode="multiple"
                :options="jobTagOptions"
                placeholder="选择职位标签，可多选"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="职位描述" name="description">
              <a-textarea v-model:value="jobForm.description" :rows="4" placeholder="岗位职责，纯文本；门户按换行展示" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="任职要求" name="requirement">
              <a-textarea v-model:value="jobForm.requirement" :rows="4" placeholder="任职要求，纯文本" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <approval-detail-drawer
      v-model:open="approvalDrawerOpen"
      :instance-id="approvalInstanceId"
      @done="onApprovalChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import {
  addCandidateComm,
  bizOptions,
  cancelRecruitInterview,
  cancelRecruitOffer,
  closeJobPost,
  confirmRecruitOffer,
  createJobPost,
  createRecruitCandidate,
  createRecruitInterview,
  createRecruitOffer,
  declineRecruitOffer,
  deleteJobPost,
  dictOptions,
  downloadEhrAttachment,
  eliminateRecruitCandidate,
  listCandidateComms,
  listJobPosts,
  listMyInterviews,
  listRecruitCandidates,
  listRecruitInterviews,
  listRecruitOffers,
  onboardRecruitOffer,
  orgTree,
  publishJobPost,
  restoreRecruitCandidate,
  searchEmployees,
  submitInterviewFeedback,
  updateJobPost,
  updateRecruitCandidate,
  uploadEhrAttachment,
  type CandidateComm,
  type InterviewTodo,
  type JobPost,
  type JobPostBody,
  type DictOption,
  type OrgNode,
  type RecruitCandidate,
  type RecruitInterview,
  type RecruitOffer
} from '@/api/ehr'
import { useUserStore } from '@/stores/user'
import ApprovalDetailDrawer from '@/components/ApprovalDetailDrawer.vue'
import {
  briefsForRow,
  buildBizRefs,
  fetchLatestApprovals,
  type ApprovalBrief
} from '@/api/approvals'

const store = useUserStore()
const route = useRoute()
const canManage = computed(() => store.can('recruit:manage'))
const canView = computed(() => store.can('recruit:view'))

type Mode = 'board' | 'offers' | 'jobs' | 'interviews'
const mode = ref<Mode>(canView.value ? 'board' : 'interviews')
const modeTitle = computed(() =>
  mode.value === 'board'
    ? '候选人看板'
    : mode.value === 'offers'
      ? '录用 Offer'
      : mode.value === 'jobs'
        ? '招聘职位'
        : '我的面试')
const keyword = ref('')
const candidateLoading = ref(false)
const offerLoading = ref(false)
const candidateRows = ref<RecruitCandidate[]>([])
const candidateTotal = ref(0)
const offers = ref<RecruitOffer[]>([])
const offerTotal = ref(0)
const offerPage = ref(1)
const offerPageSize = ref(10)
const offerStatus = ref<string | undefined>(undefined)

const stages = [
  { key: 'RESUME', label: '简历筛选', dot: 'dot-resume' },
  { key: 'INTERVIEW', label: '面试中', dot: 'dot-interview' },
  { key: 'OFFER', label: 'Offer 中', dot: 'dot-offer' },
  { key: 'REJECTED', label: '已淘汰', dot: 'dot-rejected' }
]

const grouped = computed<Record<string, RecruitCandidate[]>>(() => {
  const m: Record<string, RecruitCandidate[]> = {}
  for (const s of stages) m[s.key] = []
  for (const c of candidateRows.value) {
    if (!m[c.stage]) m[c.stage] = []
    m[c.stage].push(c)
  }
  return m
})

// 候选人来源取配置中心字典（config 不可用时用内置默认值兜底）
const sourceOptions = ref<DictOption[]>([
  { value: 'PORTAL', label: '门户网站' },
  { value: 'REFERRAL', label: '内推' },
  { value: 'HEADHUNTER', label: '猎头' },
  { value: 'WEBSITE', label: '官网' },
  { value: 'JOB_BOARD', label: '招聘网站' },
  { value: 'OTHER', label: '其他' }
])

const offerStatusOptions = [
  { value: 'APPROVING', label: '审批中' },
  { value: 'APPROVED', label: '待确认' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'DECLINED', label: '候选人放弃' },
  { value: 'REJECTED', label: '已驳回/撤销' }
]

const offerColumns = [
  { title: '单号', dataIndex: 'offerNo', key: 'offerNo', width: 150, ellipsis: true },
  { title: '候选人', key: 'candidate', width: 160 },
  { title: '录用职位', dataIndex: 'position', key: 'position', width: 160 },
  { title: '月薪', key: 'salary', width: 120 },
  { title: '预计入职', dataIndex: 'expectedOnboardDate', key: 'date', width: 120 },
  { title: '录用部门', key: 'org', width: 220 },
  { title: '状态', key: 'status', width: 180 },
  { title: '档案', key: 'archive', width: 150 },
  { title: '操作', key: 'action', width: 190 }
]

const offerPagination = computed(() => ({
  current: offerPage.value,
  pageSize: offerPageSize.value,
  total: offerTotal.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

/* ---------- 组织树 ---------- */
interface OrgOption {
  value: string
  title: string
  children?: OrgOption[]
}
const orgOptions = ref<OrgOption[]>([])

function toOrgOptions(nodes: OrgNode[]): OrgOption[] {
  return nodes.map((n) => ({
    value: n.id,
    title: n.name,
    children: n.children?.length ? toOrgOptions(n.children) : undefined
  }))
}

async function loadOrgs() {
  try {
    orgOptions.value = toOrgOptions((await orgTree()) || [])
  } catch {
    orgOptions.value = []
  }
}

/* ---------- 列表 ---------- */
async function loadCandidates() {
  candidateLoading.value = true
  try {
    const data = await listRecruitCandidates({
      keyword: keyword.value || undefined,
      page: 1,
      size: 500
    })
    candidateRows.value = data.list || []
    candidateTotal.value = data.total || 0
    await loadBoardBriefs()
  } finally {
    candidateLoading.value = false
  }
}

/** 看板卡片「审批中」标签要能点开审批详情：按 Offer ID 批量查一次在途审批单 */
const boardBriefs = ref<ApprovalBrief[]>([])

async function loadBoardBriefs() {
  // 审批中要能点开详情撤回；已驳回要能点开看驳回原因
  const ids = candidateRows.value
    .filter((c) => (c.offerStatus === 'APPROVING' || c.offerStatus === 'REJECTED') && c.offerId)
    .map((c) => String(c.offerId))
  const refs = buildBizRefs(ids, ['ehr.recruit.offer', 'ehr.recruit.offer.senior'])
  boardBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
}

const approvalBriefs = ref<ApprovalBrief[]>([])

async function loadOffers() {
  offerLoading.value = true
  try {
    const data = await listRecruitOffers({
      status: offerStatus.value,
      keyword: keyword.value || undefined,
      page: offerPage.value,
      size: offerPageSize.value
    })
    offers.value = data.list || []
    offerTotal.value = data.total || 0
    const refs = buildBizRefs(offers.value.map((o) => o.id), [
      'ehr.recruit.offer',
      'ehr.recruit.offer.senior'
    ])
    approvalBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
  } finally {
    offerLoading.value = false
  }
}

function onModeChange() {
  if (mode.value === 'offers') loadOffers()
  else if (mode.value === 'jobs') loadJobs()
  else if (mode.value === 'interviews') loadMyInterviews()
  else loadCandidates()
}

function onSearch() {
  if (mode.value === 'board') loadCandidates()
  else if (mode.value === 'jobs') {
    jobPage.value = 1
    loadJobs()
  } else if (mode.value === 'interviews') {
    loadMyInterviews()
  } else {
    offerPage.value = 1
    loadOffers()
  }
}

function onOfferTableChange(p: { current?: number; pageSize?: number }) {
  offerPage.value = p.current || 1
  offerPageSize.value = p.pageSize || 10
  loadOffers()
}

function briefIdForOffer(o: RecruitOffer) {
  const list = briefsForRow(approvalBriefs.value, o.id)
  return list.length ? list[0].id : null
}

/** 卡片上能点开的审批单：审批中取在途单（status=0）；已驳回取最后一张驳回单（status=2），用来查看驳回原因 */
function candidateApprovalBrief(c: RecruitCandidate) {
  if (!c.offerId) return null
  const list = briefsForRow(boardBriefs.value, c.offerId)
  if (c.offerStatus === 'APPROVING') return list.find((b) => b.status === 0) || null
  if (c.offerStatus === 'REJECTED') return list.find((b) => b.status === 2) || null
  return null
}

/** 看板卡片的在途 Offer 审批单 ID：只有在途单才可点开详情，否则标签保持不可点 */
function briefIdForCandidate(c: RecruitCandidate) {
  return candidateApprovalBrief(c)?.id ?? null
}

/** Offer 被驳回且能查到那张审批单时，卡片上给「查看驳回原因」入口 */
function hasRejectReason(c: RecruitCandidate) {
  return c.offerStatus === 'REJECTED' && !!candidateApprovalBrief(c)
}

function openCandidateApproval(c: RecruitCandidate) {
  const id = briefIdForCandidate(c)
  if (id) openApprovalDetail(id)
}

/* ---------- 展示辅助 ---------- */
function sourceText(source?: string) {
  return sourceOptions.value.find((o) => o.value === source)?.label || source || '其他'
}
function sourceColor(source?: string) {
  if (source === 'REFERRAL') return 'blue'
  if (source === 'HEADHUNTER') return 'purple'
  return 'default'
}
function offerStatusText(status?: string) {
  if (status === 'APPROVING') return '审批中'
  if (status === 'APPROVED') return '待确认'
  if (status === 'CONFIRMED') return '已确认'
  if (status === 'DECLINED') return '候选人放弃'
  if (status === 'REJECTED') return '已驳回/撤销'
  return '草稿'
}
function offerStatusColor(status?: string) {
  if (status === 'APPROVING') return 'processing'
  if (status === 'APPROVED') return 'orange'
  if (status === 'CONFIRMED') return 'green'
  if (status === 'REJECTED' || status === 'DECLINED') return 'default'
  return 'default'
}
/** Offer 审批中：候选人资料与淘汰都不允许再动，避免审批单和人事数据对不上（撤回到草稿后自动恢复可点） */
function isOfferApproving(c: RecruitCandidate) {
  return c.hasActiveOffer && c.offerStatus === 'APPROVING'
}
function money(v?: string) {
  if (!v) return '0'
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/* ---------- 候选人表单 ---------- */
const candidateModalOpen = ref(false)
/** 只读查看：Offer 审批中不再给「编辑」，改为「查看」进同一个抽屉，表单禁用且不渲染保存 */
const candidateReadOnly = ref(false)
const candidateSaving = ref(false)
const candidateFormRef = ref<any>()
const candidateForm = reactive({
  id: '',
  name: '',
  mobile: '',
  email: '',
  source: 'OTHER',
  position: '',
  orgId: undefined as string | undefined,
  remark: '',
  gender: undefined as number | undefined,
  birthday: undefined as string | undefined,
  education: undefined as string | undefined,
  school: '',
  major: '',
  workYears: undefined as number | undefined,
  currentCompany: '',
  expectedSalary: undefined as number | undefined,
  idCard: '',
  resumeFileId: undefined as string | undefined,
  resumeFileName: ''
})
const genderOptions = [
  { value: 0, label: '未知' },
  { value: 1, label: '男' },
  { value: 2, label: '女' }
]
const educationOptions = ref<DictOption[]>(
  ['高中', '中专', '大专', '本科', '硕士', '博士', '其他'].map((v) => ({ value: v, label: v }))
)
/** 职位名称取配置中心职位主数据，学历取学历主数据，经验/标签取字典 */
const positionOptions = ref<DictOption[]>([])
const experienceOptions = ref<DictOption[]>([])
const jobTagOptions = ref<DictOption[]>([])
const jobCityOptions = ref<DictOption[]>([])
const candidateRules = {
  name: [{ required: true, message: '请输入候选人姓名', trigger: 'blur' }],
  position: [{ required: true, message: '请选择应聘职位', trigger: 'change' }],
  orgId: [{ required: true, message: '请选择用人部门', trigger: 'change' }]
}

function openCandidateModal(c?: RecruitCandidate, readOnly = false) {
  candidateReadOnly.value = readOnly
  candidateForm.id = c?.id || ''
  candidateForm.name = c?.name || ''
  candidateForm.mobile = c?.mobile || ''
  candidateForm.email = c?.email || ''
  candidateForm.source = c?.source || 'OTHER'
  candidateForm.position = c?.position || ''
  candidateForm.orgId = c?.orgId
  candidateForm.remark = c?.remark || ''
  candidateForm.gender = c?.gender
  candidateForm.birthday = c?.birthday || undefined
  candidateForm.education = c?.education || undefined
  candidateForm.school = c?.school || ''
  candidateForm.major = c?.major || ''
  candidateForm.workYears = c?.workYears ? Number(c.workYears) : undefined
  candidateForm.currentCompany = c?.currentCompany || ''
  candidateForm.expectedSalary = c?.expectedSalary ? Number(c.expectedSalary) : undefined
  candidateForm.idCard = c?.idCard || ''
  candidateForm.resumeFileId = c?.resumeFileId
  candidateForm.resumeFileName = c?.resumeFileName || ''
  candidateModalOpen.value = true
}

/** 简历只走 CANDIDATE 业务类型；上传成功后才回填表单字段 */
const resumeUploading = ref(false)
async function onResumeSelected(file: File) {
  if (file.size > 10 * 1024 * 1024) {
    message.error('简历不能超过 10MB')
    return false
  }
  resumeUploading.value = true
  try {
    const att = await uploadEhrAttachment(file, 'CANDIDATE')
    candidateForm.resumeFileId = att.id
    candidateForm.resumeFileName = att.fileName
    message.success('简历已上传')
  } catch (e: any) {
    message.error(e?.message || '简历上传失败')
  } finally {
    resumeUploading.value = false
  }
  return false
}

function candidateBody(c: RecruitCandidate | null, stage?: string) {
  return {
    name: c?.name || candidateForm.name.trim(),
    mobile: c?.mobile || candidateForm.mobile.trim() || undefined,
    email: c?.email || candidateForm.email.trim() || undefined,
    source: c?.source || candidateForm.source,
    position: c?.position || candidateForm.position.trim(),
    orgId: c?.orgId || candidateForm.orgId,
    remark: c?.remark || candidateForm.remark.trim() || undefined,
    jobId: c?.jobId,
    gender: c?.gender ?? candidateForm.gender,
    birthday: c?.birthday || candidateForm.birthday,
    education: c?.education || candidateForm.education,
    school: c?.school || candidateForm.school.trim(),
    major: c?.major || candidateForm.major.trim(),
    workYears: c?.workYears ? Number(c.workYears) : candidateForm.workYears,
    currentCompany: c?.currentCompany || candidateForm.currentCompany.trim(),
    expectedSalary: c?.expectedSalary ? Number(c.expectedSalary) : candidateForm.expectedSalary,
    idCard: c?.idCard || candidateForm.idCard.trim(),
    resumeFileId: c?.resumeFileId || candidateForm.resumeFileId,
    stage
  }
}

async function saveCandidate() {
  try {
    await candidateFormRef.value?.validate()
  } catch {
    return
  }
  candidateSaving.value = true
  try {
    const body = candidateBody(null)
    if (candidateForm.id) {
      await updateRecruitCandidate(candidateForm.id, body)
      message.success('候选人已更新')
    } else {
      await createRecruitCandidate(body)
      message.success('候选人已创建')
    }
    candidateModalOpen.value = false
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    candidateSaving.value = false
  }
}

/* ---------- 多轮面试 ---------- */
// 面试方式 / 沟通方式取配置中心字典（config 不可用时用内置默认值兜底）
const interviewMethodOptions = ref<DictOption[]>([
  { value: 'ONSITE', label: '现场面试' },
  { value: 'VIDEO', label: '视频面试' },
  { value: 'PHONE', label: '电话面试' }
])
const commTypeOptions = ref<DictOption[]>([
  { value: 'OFFER_TALK', label: '薪资沟通' },
  { value: 'PHONE', label: '电话沟通' },
  { value: 'OTHER', label: '其他' }
])

async function loadRecruitDicts() {
  const [methods, commTypes, sources] = await Promise.allSettled([
    dictOptions('ehr.interview_method'),
    dictOptions('ehr.candidate_comm_type'),
    dictOptions('ehr.recruit_source')
  ])
  if (methods.status === 'fulfilled' && methods.value.length) {
    interviewMethodOptions.value = methods.value
  }
  if (commTypes.status === 'fulfilled' && commTypes.value.length) {
    commTypeOptions.value = commTypes.value
  }
  if (sources.status === 'fulfilled' && sources.value.length) {
    sourceOptions.value = sources.value
  }
}

function methodText(method?: string) {
  return interviewMethodOptions.value.find((o) => o.value === method)?.label || '现场面试'
}
function commTypeText(type?: string) {
  return commTypeOptions.value.find((o) => o.value === type)?.label || '沟通'
}
function stageText(stage?: string) {
  return stages.find((s) => s.key === stage)?.label || stage || '—'
}
function fmtShort(v?: string) {
  return v ? v.replace('T', ' ').slice(5, 16) : ''
}

interface InterviewRound {
  roundNo: number
  result?: string
  items: RecruitInterview[]
}
const detailOpen = ref(false)
const detailCandidate = ref<RecruitCandidate | null>(null)
const detailInterviews = ref<RecruitInterview[]>([])
const detailComms = ref<CandidateComm[]>([])
const detailLoading = ref(false)
/** Offer 审批中/已通过：详情抽屉只读（约面试、约下一轮、沟通记录都不可操作） */
const detailLocked = computed(() => !!detailCandidate.value && detailCandidate.value.hasActiveOffer)
/** 沟通记录锁定：Offer 审批中/已通过，或候选人已淘汰（淘汰后不允许再补记录） */
const commLocked = computed(() => detailLocked.value || detailCandidate.value?.stage === 'REJECTED')

const interviewRounds = computed<InterviewRound[]>(() => {
  const map = new Map<number, RecruitInterview[]>()
  for (const iv of detailInterviews.value) {
    const list = map.get(iv.roundNo) || []
    list.push(iv)
    map.set(iv.roundNo, list)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([roundNo, items]) => ({
      roundNo,
      result: items.find((x) => x.roundResult)?.roundResult,
      items
    }))
})

function roundTagText(r: InterviewRound) {
  if (r.result === 'PASS') return '已通过'
  if (r.result === 'FAIL') return '未通过'
  if (r.items.every((x) => x.status === 'CANCELED')) return '已取消'
  return '待面试 / 待反馈'
}
function roundTagColor(r: InterviewRound) {
  if (r.result === 'PASS') return 'green'
  if (r.result === 'FAIL') return 'red'
  if (r.items.every((x) => x.status === 'CANCELED')) return 'default'
  return 'processing'
}

function syncDetailCandidate() {
  if (!detailCandidate.value) return
  const fresh = candidateRows.value.find((x) => x.id === detailCandidate.value?.id)
  if (fresh) detailCandidate.value = fresh
}

async function openDetail(c: RecruitCandidate) {
  detailCandidate.value = c
  detailOpen.value = true
  await reloadDetail()
}

async function reloadDetail() {
  if (!detailCandidate.value) return
  syncDetailCandidate()
  detailLoading.value = true
  try {
    const id = detailCandidate.value.id
    const [interviews, comms] = await Promise.all([
      listRecruitInterviews(id),
      listCandidateComms(id)
    ])
    detailInterviews.value = interviews || []
    detailComms.value = comms || []
  } catch (e: any) {
    message.error(e?.message || '加载候选人详情失败')
  } finally {
    detailLoading.value = false
  }
}

/* 约面试 */
const interviewModalOpen = ref(false)
const interviewSaving = ref(false)
const interviewForm = reactive({
  candidateId: '',
  candidateName: '',
  position: '',
  roundNo: 1,
  interviewerIds: [] as string[],
  scheduledAt: undefined as string | undefined,
  method: 'ONSITE',
  location: '',
  remark: ''
})
const interviewerOptions = ref<{ value: string; label: string }[]>([])
const interviewerCache = reactive<Record<string, string>>({})
const interviewerLoading = ref(false)
let interviewerTimer: number | undefined

const interviewerSelectOptions = computed(() => {
  const map = new Map<string, string>()
  for (const id of interviewForm.interviewerIds) {
    const label = interviewerCache[id]
    if (label) map.set(id, label)
  }
  for (const o of interviewerOptions.value) map.set(o.value, o.label)
  return [...map.entries()].map(([value, label]) => ({ value, label }))
})

function onInterviewerSearch(kw: string) {
  if (interviewerTimer) window.clearTimeout(interviewerTimer)
  interviewerTimer = window.setTimeout(() => loadInterviewerOptions(kw || ''), 300)
}

async function loadInterviewerOptions(keyword: string) {
  interviewerLoading.value = true
  try {
    const list = await searchEmployees(keyword.trim())
    interviewerOptions.value = (list || []).map((e) => ({
      value: e.employeeId,
      label: `${e.name}${e.department ? ' · ' + e.department : ''}${e.position ? ' · ' + e.position : ''}`
    }))
    for (const o of interviewerOptions.value) interviewerCache[o.value] = o.label
  } catch (e: any) {
    interviewerOptions.value = []
    message.error(e?.message || '加载面试官失败')
  } finally {
    interviewerLoading.value = false
  }
}

async function openInterviewModal(c: RecruitCandidate, roundNo?: number) {
  // 轮次只增不减：第一次第 1 轮、第二次第 2 轮，HR 不可自行修改
  let nextRound = roundNo
  if (!nextRound) {
    try {
      const list = await listRecruitInterviews(c.id)
      nextRound = (list || []).reduce((max, x) => Math.max(max, x.roundNo || 0), 0) + 1
    } catch {
      nextRound = (c.interviewRoundNo || 0) + 1
    }
  }
  interviewForm.candidateId = c.id
  interviewForm.candidateName = c.name
  interviewForm.position = c.position
  interviewForm.roundNo = nextRound
  interviewForm.interviewerIds = []
  interviewForm.scheduledAt = undefined
  interviewForm.method = 'ONSITE'
  interviewForm.location = ''
  interviewForm.remark = ''
  interviewerOptions.value = []
  interviewModalOpen.value = true
  loadInterviewerOptions('')
}

async function saveInterview() {
  if (!interviewForm.interviewerIds.length) {
    message.warning('请选择面试官')
    return
  }
  if (!interviewForm.scheduledAt) {
    message.warning('请选择面试时间')
    return
  }
  interviewSaving.value = true
  try {
    await createRecruitInterview(interviewForm.candidateId, {
      interviewerIds: interviewForm.interviewerIds,
      scheduledAt: interviewForm.scheduledAt,
      method: interviewForm.method,
      location: interviewForm.location.trim() || undefined,
      remark: interviewForm.remark.trim() || undefined
    })
    message.success('已约面试，面试官将收到待办')
    interviewModalOpen.value = false
    await loadCandidates()
    if (detailOpen.value) await reloadDetail()
  } catch (e: any) {
    message.error(e?.message || '约面试失败')
  } finally {
    interviewSaving.value = false
  }
}

async function cancelInterview(iv: RecruitInterview) {
  try {
    await cancelRecruitInterview(iv.id, 'HR 取消面试')
    message.success('已取消该场面试')
    await loadCandidates()
    await reloadDetail()
  } catch (e: any) {
    message.error(e?.message || '取消失败')
  }
}

/* 沟通记录 */
const commForm = reactive({
  type: 'OFFER_TALK',
  content: '',
  expectedSalary: undefined as number | undefined
})
const commSaving = ref(false)

async function saveComm() {
  const c = detailCandidate.value
  if (!c) return
  if (!commForm.content.trim()) {
    message.warning('请填写沟通内容')
    return
  }
  commSaving.value = true
  try {
    await addCandidateComm(c.id, {
      type: commForm.type,
      content: commForm.content.trim(),
      expectedSalary: commForm.expectedSalary
    })
    commForm.content = ''
    commForm.expectedSalary = undefined
    await reloadDetail()
    await loadCandidates()
    message.success('已记录')
  } catch (e: any) {
    message.error(e?.message || '记录失败')
  } finally {
    commSaving.value = false
  }
}

/* 我的面试（面试官视角） */
const interviewTodos = ref<InterviewTodo[]>([])
const pendingInterviewCount = computed(
  () => interviewTodos.value.filter((t) => t.status !== 'DONE').length
)
const interviewTodoLoading = ref(false)
const interviewTodoColumns = [
  { title: '单号', dataIndex: 'interviewNo', key: 'interviewNo', width: 190, ellipsis: true },
  { title: '候选人', key: 'candidate', width: 160 },
  { title: '应聘职位', key: 'position', width: 180 },
  { title: '面试时间', dataIndex: 'scheduledAt', key: 'scheduledAt', width: 170 },
  { title: '方式 / 地点', key: 'method', width: 220 },
  { title: '面试结果', key: 'result', width: 100 },
  { title: '面试反馈', key: 'feedback', ellipsis: true },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 100 }
]

async function loadMyInterviews() {
  interviewTodoLoading.value = true
  try {
    interviewTodos.value = (await listMyInterviews()) || []
  } catch (e: any) {
    message.error(e?.message || '加载面试待办失败')
  } finally {
    interviewTodoLoading.value = false
  }
}

const feedbackOpen = ref(false)
const feedbackSaving = ref(false)
const feedbackForm = reactive({
  id: '',
  candidateName: '',
  roundNo: 1,
  score: 4 as number | undefined,
  feedback: '',
  result: 'PASS' as 'PASS' | 'FAIL'
})

function openFeedback(t: InterviewTodo) {
  feedbackForm.id = t.id
  feedbackForm.candidateName = t.candidateName || ''
  feedbackForm.roundNo = t.roundNo
  feedbackForm.score = 4
  feedbackForm.feedback = ''
  feedbackForm.result = 'PASS'
  feedbackOpen.value = true
}

async function saveFeedback() {
  if (!feedbackForm.feedback.trim()) {
    message.warning('请填写面试反馈')
    return
  }
  if (!feedbackForm.result) {
    message.warning('请选择本轮面试结果')
    return
  }
  feedbackSaving.value = true
  try {
    await submitInterviewFeedback(feedbackForm.id, {
      score: feedbackForm.score,
      feedback: feedbackForm.feedback.trim(),
      result: feedbackForm.result
    })
    if (feedbackForm.result === 'FAIL') {
      message.warning('反馈已提交，候选人已淘汰')
    } else {
      message.success('反馈已提交，等待该轮其他面试官反馈后由 HR 决定发 Offer 或下一轮')
    }
    feedbackOpen.value = false
    await loadMyInterviews()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    feedbackSaving.value = false
  }
}

async function downloadResume(c: RecruitCandidate) {
  if (!c.resumeFileId) return
  try {
    const res: any = await downloadEhrAttachment(c.resumeFileId)
    const blob = new Blob([res.data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = c.resumeFileName || 'resume'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    message.error(e?.message || '下载失败')
  }
}

async function eliminateCandidate(c: RecruitCandidate) {
  try {
    await eliminateRecruitCandidate(c.id)
    message.success('已淘汰')
    loadCandidates()
    if (mode.value === 'offers') loadOffers()
  } catch (e: any) {
    message.error(e?.message || '淘汰失败')
  }
}

async function restoreCandidate(c: RecruitCandidate) {
  try {
    await restoreRecruitCandidate(c.id)
    message.success('已恢复到面试中')
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '恢复失败')
  }
}

/* ---------- Offer 表单 ---------- */
const offerModalOpen = ref(false)
const offerSaving = ref(false)
const offerFormRef = ref<any>()
const offerForm = reactive({
  candidateId: undefined as string | undefined,
  lockedCandidate: false,
  position: '',
  salary: 0 as number | null,
  expectedOnboardDate: '' as string | undefined,
  orgId: undefined as string | undefined,
  remark: ''
})
const offerRules = {
  candidateId: [{ required: true, message: '请选择候选人', trigger: 'change' }],
  position: [{ required: true, message: '请输入录用职位', trigger: 'blur' }],
  salary: [{ required: true, message: '请输入月薪', trigger: 'change' }],
  expectedOnboardDate: [{ required: true, message: '请选择预计入职日期', trigger: 'change' }],
  orgId: [{ required: true, message: '请选择录用部门', trigger: 'change' }]
}

const offerCandidateOptions = computed(() =>
  candidateRows.value
    .filter((c) => c.stage !== 'REJECTED' && !c.hasActiveOffer && c.interviewRoundNo && !c.interviewPendingCount)
    .map((c) => ({
      value: c.id,
      label: `${c.name}（${c.position}）`,
      candidate: c
    }))
)

function openOfferModal(c?: RecruitCandidate) {
  offerForm.candidateId = c?.id
  offerForm.lockedCandidate = !!c
  offerForm.position = c?.position || ''
  offerForm.salary = 0
  offerForm.expectedOnboardDate = undefined
  offerForm.orgId = c?.orgId
  offerForm.remark = ''
  offerModalOpen.value = true
}

function onOfferCandidateChange(value: string) {
  const c = candidateRows.value.find((x) => x.id === value)
  if (!c) return
  offerForm.position = c.position
  offerForm.orgId = c.orgId
}

async function saveOffer() {
  try {
    await offerFormRef.value?.validate()
  } catch {
    return
  }
  if (!offerForm.candidateId || !offerForm.orgId || !offerForm.expectedOnboardDate) return
  offerSaving.value = true
  try {
    const candidate = candidateRows.value.find((c) => c.id === offerForm.candidateId)
    await createRecruitOffer({
      candidateId: offerForm.candidateId,
      jobId: candidate?.jobId,
      position: offerForm.position.trim(),
      salary: Number(offerForm.salary || 0),
      expectedOnboardDate: offerForm.expectedOnboardDate,
      orgId: offerForm.orgId,
      remark: offerForm.remark.trim() || undefined
    })
    message.success('已提交录用审批')
    offerModalOpen.value = false
    loadCandidates()
    await loadOffers()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    offerSaving.value = false
  }
}

async function doCancelOffer(o: RecruitOffer) {
  try {
    await cancelRecruitOffer(o.id)
    message.success('已撤销')
    loadOffers()
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
  }
}

async function doConfirmOffer(o: RecruitOffer) {
  try {
    await confirmRecruitOffer(o.id)
    message.success('Offer 已确认，可办理入职')
    loadOffers()
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '确认失败')
  }
}

async function doDeclineOffer(o: RecruitOffer) {
  try {
    await declineRecruitOffer(o.id, 'HR 线下确认候选人放弃')
    message.success('已标记候选人放弃')
    loadOffers()
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function doOnboard(o: RecruitOffer) {
  try {
    await onboardRecruitOffer(o.id)
    message.success('已生成待入职档案，请到人员管理继续办理入职')
    loadOffers()
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '办理入职失败')
  }
}

/* ---------- 招聘职位 ---------- */
const jobLoading = ref(false)
const jobSaving = ref(false)
const jobs = ref<JobPost[]>([])
const jobTotal = ref(0)
const jobPage = ref(1)
const jobPageSize = ref(10)
const jobStatus = ref<string | undefined>(undefined)
const jobModalOpen = ref(false)
const jobFormRef = ref<any>()
const jobForm = reactive({
  id: '',
  title: '',
  orgId: undefined as string | undefined,
  jobType: 'FULL_TIME',
  workCity: '',
  headcount: 1 as number | null,
  salaryMin: undefined as number | undefined,
  salaryMax: undefined as number | undefined,
  educationReq: '',
  experienceReq: '',
  tags: [] as string[],
  closeAt: undefined as string | undefined,
  description: '',
  requirement: ''
})
const jobRules = {
  title: [{ required: true, message: '请选择职位名称', trigger: 'change' }]
}
const jobTypeOptions = [
  { value: 'FULL_TIME', label: '全职' },
  { value: 'INTERN', label: '实习' },
  { value: 'PART_TIME', label: '兼职' }
]
const jobStatusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'CLOSED', label: '已关闭' }
]
const jobColumns = [
  { title: '单号', dataIndex: 'jobNo', key: 'jobNo', width: 150, ellipsis: true },
  { title: '职位', key: 'title', width: 280 },
  { title: '工作性质', key: 'jobType', width: 100 },
  { title: '城市', dataIndex: 'workCity', key: 'workCity', width: 100 },
  { title: '薪资', key: 'salary', width: 130 },
  { title: '招聘人数', dataIndex: 'headcount', key: 'headcount', width: 90 },
  { title: '投递', key: 'apply', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 180 }
]
const jobPagination = computed(() => ({
  current: jobPage.value,
  pageSize: jobPageSize.value,
  total: jobTotal.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

async function loadJobs() {
  jobLoading.value = true
  try {
    const data = await listJobPosts({
      status: jobStatus.value,
      keyword: keyword.value || undefined,
      page: jobPage.value,
      size: jobPageSize.value
    })
    jobs.value = data.list || []
    jobTotal.value = data.total || 0
  } finally {
    jobLoading.value = false
  }
}

function onJobTableChange(p: { current?: number; pageSize?: number }) {
  jobPage.value = p.current || 1
  jobPageSize.value = p.pageSize || 10
  loadJobs()
}

function jobStatusText(status?: string) {
  return jobStatusOptions.find((o) => o.value === status)?.label || '草稿'
}
/** 工作性质：列表「类型」列取 jobType，历史数据为空按全职展示 */
function jobTypeText(jobType?: string) {
  return jobTypeOptions.find((o) => o.value === jobType)?.label || '全职'
}
function jobStatusColor(status?: string) {
  if (status === 'PUBLISHED') return 'green'
  if (status === 'CLOSED') return 'default'
  return 'orange'
}

function openJobModal(j?: JobPost) {
  jobForm.id = j?.id || ''
  jobForm.title = j?.title || ''
  jobForm.orgId = j?.orgId
  jobForm.jobType = j?.jobType || 'FULL_TIME'
  jobForm.workCity = j?.workCity || ''
  jobForm.headcount = j?.headcount || 1
  jobForm.salaryMin = j?.salaryMin ? Number(j.salaryMin) : undefined
  jobForm.salaryMax = j?.salaryMax ? Number(j.salaryMax) : undefined
  jobForm.educationReq = j?.educationReq || ''
  jobForm.experienceReq = j?.experienceReq || ''
  jobForm.tags = j?.tags ? j.tags.split(',').filter(Boolean) : []
  jobForm.closeAt = j?.closeAt || undefined
  jobForm.description = j?.description || ''
  jobForm.requirement = j?.requirement || ''
  jobModalOpen.value = true
}

async function submitJob() {
  try {
    await jobFormRef.value?.validate()
  } catch {
    return
  }
  if (jobForm.salaryMin != null && jobForm.salaryMax != null && jobForm.salaryMin > jobForm.salaryMax) {
    message.error('薪资下限不能大于上限')
    return
  }
  jobSaving.value = true
  try {
    const body: JobPostBody = {
      title: jobForm.title.trim(),
      orgId: jobForm.orgId,
      jobType: jobForm.jobType,
      workCity: jobForm.workCity.trim(),
      headcount: jobForm.headcount || 1,
      salaryMin: jobForm.salaryMin,
      salaryMax: jobForm.salaryMax,
      educationReq: jobForm.educationReq.trim(),
      experienceReq: jobForm.experienceReq.trim(),
      tags: jobForm.tags.join(','),
      closeAt: jobForm.closeAt,
      description: jobForm.description,
      requirement: jobForm.requirement
    }
    if (jobForm.id) {
      await updateJobPost(jobForm.id, body)
      message.success('职位已更新')
    } else {
      await createJobPost(body)
      message.success('职位已创建，发布后门户可见')
    }
    jobModalOpen.value = false
    loadJobs()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    jobSaving.value = false
  }
}

async function doPublishJob(j: JobPost) {
  try {
    await publishJobPost(j.id)
    message.success('已发布到门户')
    loadJobs()
  } catch (e: any) {
    message.error(e?.message || '发布失败')
  }
}

async function doCloseJob(j: JobPost) {
  try {
    await closeJobPost(j.id)
    message.success('已关闭')
    loadJobs()
  } catch (e: any) {
    message.error(e?.message || '关闭失败')
  }
}

async function doDeleteJob(j: JobPost) {
  try {
    await deleteJobPost(j.id)
    message.success('已删除')
    loadJobs()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

/* ---------- 审批详情 ---------- */
const approvalDrawerOpen = ref(false)
const approvalInstanceId = ref<string | null>(null)

function openApprovalDetail(id: string) {
  approvalInstanceId.value = id
  approvalDrawerOpen.value = true
}

/** 审批抽屉里通过/驳回/撤回后：撤回会改变 Offer 状态，看板与 Offer 列表都要重拉 */
function onApprovalChanged() {
  loadCandidates()
  if (mode.value === 'offers') loadOffers()
}

/** 职位表单参考数据：职位/学历主数据 + 经验/标签/城市字典（配置中心不可用时保持空选项，不阻塞页面） */
async function loadJobReferenceOptions() {
  const [edu, pos, exp, tags, cities] = await Promise.allSettled([
    bizOptions('education'),
    bizOptions('position'),
    dictOptions('ehr.job_experience'),
    dictOptions('ehr.job_tag'),
    dictOptions('ehr.job_city')
  ])
  if (edu.status === 'fulfilled' && edu.value.length) {
    educationOptions.value = edu.value.map((o) => ({ value: o.label, label: o.label }))
  }
  if (pos.status === 'fulfilled') {
    positionOptions.value = pos.value.map((o) => ({ value: o.label, label: o.label }))
  }
  if (exp.status === 'fulfilled') {
    experienceOptions.value = exp.value.map((o) => ({ value: o.label, label: o.label }))
  }
  if (tags.status === 'fulfilled') {
    jobTagOptions.value = tags.value.map((o) => ({ value: o.label, label: o.label }))
  }
  if (cities.status === 'fulfilled') {
    jobCityOptions.value = cities.value.map((o) => ({ value: o.label, label: o.label }))
  }
}

onMounted(async () => {
  loadJobReferenceOptions().catch(() => {})
  loadRecruitDicts().catch(() => {})
  await loadOrgs()
  // 待办链接带 tab=mine / interviewId：直接进入「我的面试」并打开反馈弹窗
  if (!canView.value || route.query.tab === 'mine') {
    mode.value = 'interviews'
    await loadMyInterviews()
    const id = String(route.query.interviewId || '')
    const todo = id ? interviewTodos.value.find((t) => t.id === id) : undefined
    if (todo) openFeedback(todo)
    return
  }
  await Promise.all([loadCandidates().catch(() => {}), loadOffers().catch(() => {})])
})
</script>

<style scoped>
.page-root {
  --ft-min-width: 1100px;
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
  flex-wrap: wrap;
}
.panel-body.table-body {
  padding: 0;
}
.board-body {
  padding: 12px;
}
.board {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 12px;
  min-height: 100%;
}
.kb-col {
  display: flex;
  flex-direction: column;
  min-height: 220px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--toolbar-bg);
  min-width: 0;
}
.kb-col-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--panel-border);
}
.kb-col-head .cnt {
  margin-left: auto;
  font-weight: 400;
  color: var(--muted);
  font-size: 12px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.dot-resume {
  background: #8c8c8c;
}
.dot-interview {
  background: #1677ff;
}
.dot-offer {
  background: #52c41a;
}
.dot-rejected {
  background: #bfbfbf;
}
.kb-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  overflow: auto;
}
.kb-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
  background: var(--panel-bg);
}
.kb-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kb-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-line {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-remark {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-offer {
  margin-top: 2px;
}
/* 在途 Offer 的「审批中」标签可点开审批详情 */
.kb-offer-tag {
  cursor: pointer;
}
.kb-offer-tag:hover {
  opacity: 0.75;
}
.cell-sub {
  font-size: 12px;
}
.round-now {
  font-weight: 600;
}
.interview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 14px;
}
.round-block {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.round-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.round-title {
  font-weight: 600;
}
.iv-row {
  padding: 6px 0;
  border-top: 1px dashed #f0f0f0;
}
.iv-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.iv-name {
  font-weight: 500;
}
.feedback-warn {
  margin-top: 6px;
  font-size: 12px;
  color: #cf1322;
}
.feedback-tip {
  margin-top: 6px;
  font-size: 12px;
}
.iv-feedback {
  margin-top: 4px;
  font-size: 13px;
  color: #595959;
}
.round-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.comm-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.comm-form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.comm-row {
  padding: 6px 0;
  border-bottom: 1px dashed #f0f0f0;
  font-size: 13px;
}
.kb-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--panel-border);
}
.kb-actions-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}
.kb-actions .act {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--panel-border);
  border-radius: 5px;
  background: var(--code-bg);
  font-size: 12px;
  line-height: 1;
  transition: background-color 0.15s, border-color 0.15s;
}
.kb-actions .act.primary {
  color: var(--brand);
  border: 1px solid rgba(47, 84, 235, 0.35);
  background: rgba(47, 84, 235, 0.06);
}
.kb-actions .act.primary:hover {
  background: rgba(47, 84, 235, 0.14);
  border-color: rgba(47, 84, 235, 0.55);
}
.kb-actions .act.danger {
  color: #ff4d4f;
  border-color: rgba(255, 77, 79, 0.3);
  background: rgba(255, 77, 79, 0.06);
}
.kb-actions .act:hover {
  border-color: var(--brand);
}
.kb-actions .act.danger:hover {
  background: rgba(255, 77, 79, 0.12);
  border-color: rgba(255, 77, 79, 0.55);
}
/* Offer 审批中：编辑/淘汰置灰不可点 */
.kb-actions .act.act-disabled,
.kb-actions .act.act-disabled:hover {
  color: var(--muted);
  background: transparent;
  border-color: var(--panel-border);
  cursor: not-allowed;
  opacity: 0.65;
}
/* 详情抽屉里「+ 约面试」这类纯链接同样置灰（pointer-events 关掉点击） */
.act.act-disabled {
  color: var(--muted);
  cursor: not-allowed;
  opacity: 0.65;
  pointer-events: none;
}
.kb-empty {
  padding: 16px 8px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
}
/* 页签无数据时空状态铺满页面剩余高度并居中 */
.tab-empty {
  min-height: calc(100vh - 320px);
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.ant-table-tbody > tr > td:last-child) {
  white-space: nowrap;
}
.row-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  white-space: nowrap;
  /* 链接自带 8px 横向内边距，整列左移同样的距离：首项文字才能和表头、以及「已结束」这类纯文本对齐 */
  margin-left: -8px;
}
.row-actions .act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 13px;
  line-height: 1;
  transition: background-color 0.15s;
}
.row-actions .act:hover {
  background: var(--code-bg);
}
.row-actions .act.danger:hover {
  background: rgba(255, 77, 79, 0.1);
}
/* 弹窗表单分组标题：统一两列表单的标签宽度与字段间距 */
.form-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f2f5;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.form-section-title::before {
  content: '';
  width: 3px;
  height: 13px;
  border-radius: 2px;
  background: #1677ff;
}

.form-section-title:not(:first-child) {
  margin-top: 22px;
}

@media (max-width: 1200px) {
  .board {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}
</style>
