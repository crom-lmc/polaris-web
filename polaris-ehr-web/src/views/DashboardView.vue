<template>
  <div class="page-root dash">
    <section class="hero">
      <div>
        <div class="hello">你好，{{ store.username || '同事' }}</div>
        <div class="sub">这里是人力中心：组织架构、人员档案与请假都在这一处维护。</div>
      </div>
      <div class="hero-actions">
        <a-button v-if="store.can('org:view')" @click="$router.push('/orgs')">组织架构</a-button>
        <a-button v-if="store.can('employee:view')" @click="$router.push('/employees')">人员名录</a-button>
        <a-button v-if="store.can('leave:apply')" type="primary" @click="$router.push('/leaves')">请假</a-button>
      </div>
    </section>

    <div class="stat-grid">
      <div class="stat-card clickable" @click="store.can('org:view') && $router.push('/orgs')">
        <div class="stat-label">组织节点</div>
        <div class="stat-value">{{ stats.orgNodes }}</div>
        <div class="muted">集团 / 子公司 / 部门 / 项目 / 子项目</div>
      </div>
      <div class="stat-card clickable" @click="store.can('employee:view') && $router.push('/employees')">
        <div class="stat-label">在职员工</div>
        <div class="stat-value">{{ stats.employees }}</div>
        <div class="muted">已建档人员（含未开户）</div>
      </div>
      <div class="stat-card clickable" @click="$router.push(store.can('approval:todo') ? '/approvals' : '/leaves')">
        <div class="stat-label">{{ canApprove ? '待我审批' : '我的待审批' }}</div>
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="muted">{{ canApprove ? '其他人提交、等待你处理' : '你提交、等待审批的请假' }}</div>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head">
        <span>最近请假</span>
        <a v-if="store.can('leave:view')" @click="$router.push('/leaves')">查看全部</a>
      </div>
      <div class="panel-body">
        <a-empty v-if="!recent.length" description="暂无请假记录" />
        <a-list v-else :data-source="recent" size="small">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <span>{{ item.applicantName }} · {{ item.leaveTypeName }}</span>
                  <a-tag :color="statusColor(item.status)" class="ml8">{{ item.statusName }}</a-tag>
                </template>
                <template #description>
                  {{ item.startDate }} ~ {{ item.endDate }}（{{ item.days }} 天）· {{ item.reason }}
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { orgFlatten, pageEmployees, pageLeaves, type LeaveItem } from '@/api/ehr'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const canApprove = computed(() => store.can('leave:approve'))

const stats = reactive({ orgNodes: 0, employees: 0, pending: 0 })
const recent = ref<LeaveItem[]>([])

function statusColor(status: number) {
  return status === 0 ? 'orange' : status === 1 ? 'green' : status === 2 ? 'red' : 'default'
}

onMounted(async () => {
  try {
    if (store.can('org:view')) {
      const flat = await orgFlatten()
      stats.orgNodes = flat?.length || 0
    }
  } catch {
    /* 统计失败不影响页面 */
  }
  try {
    if (store.can('employee:view')) {
      // 在职人数 = 试用期(30) + 在职(40)，两个精确状态各查一次再相加
      const [probation, active] = await Promise.all([
        pageEmployees({ page: 1, size: 1, status: 30 }),
        pageEmployees({ page: 1, size: 1, status: 40 })
      ])
      stats.employees = (probation.total || 0) + (active.total || 0)
    }
  } catch {
    /* ignore */
  }
  try {
    if (store.can('leave:view')) {
      const mine = await pageLeaves({ scope: 'mine', page: 1, size: 5 })
      recent.value = mine.list || []
      stats.pending = (mine.list || []).filter((x) => x.status === 0).length
    }
    if (canApprove.value) {
      const todo = await pageLeaves({ scope: 'all', status: 0, page: 1, size: 1 })
      stats.pending = todo.total || 0
    }
  } catch {
    /* ignore */
  }
})
</script>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 4px 2px 0;
}

.hello {
  font-size: 20px;
  font-weight: 600;
}

.sub {
  margin-top: 4px;
  color: var(--muted);
  font-size: 13px;
}

.hero-actions {
  display: flex;
  gap: 8px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 14px 16px;
}

/* 概览数字卡片可点击跳转：给出手型光标与轻微悬浮反馈 */
.stat-card.clickable {
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s;
}

.stat-card.clickable:hover {
  border-color: var(--primary-color, #1677ff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, .08);
}

.stat-label {
  color: var(--muted);
  font-size: 12px;
}

.stat-value {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.4;
}

.ml8 {
  margin-left: 8px;
}

@media (max-width: 800px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
