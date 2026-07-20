<script setup>
import { computed, onMounted, ref } from 'vue'

import { getAdminMetrics } from '@/api/platform'

const metrics = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')

const metricCards = computed(() => {
  const data = metrics.value
  if (!data) return []

  return [
    {
      label: '平台用户',
      value: data.users?.total || 0,
      detail: `${data.users?.students || 0} 学生 · ${data.users?.teachers || 0} 教师`,
      tone: 'blue'
    },
    {
      label: '全部课程',
      value: data.courses?.total || 0,
      detail: `${data.courses?.published || 0} 门已发布`,
      tone: 'teal'
    },
    {
      label: '待审核课程',
      value: data.courses?.pending || 0,
      detail: `${data.reviews?.total || 0} 条历史审核记录`,
      tone: 'amber'
    },
    {
      label: '活跃预约',
      value: data.learning?.activeAppointments || 0,
      detail: `累计 ${data.learning?.appointments || 0} 次预约`,
      tone: 'cyan'
    },
    {
      label: '待批改作业',
      value: data.learning?.pendingGrading || 0,
      detail: `${data.learning?.submissions || 0} 份作业提交`,
      tone: 'coral'
    }
  ]
})

const courseStatusRows = computed(() => {
  const courses = metrics.value?.courses
  if (!courses) return []

  const total = Number(courses.total || 0)
  const rows = [
    { label: '已发布', value: courses.published || 0, color: '#1f9d73' },
    { label: '待审核', value: courses.pending || 0, color: '#e5a528' },
    { label: '草稿', value: courses.draft || 0, color: '#57889c' },
    { label: '已驳回', value: courses.rejected || 0, color: '#cb5962' },
    { label: '已归档', value: courses.archived || 0, color: '#8a8792' }
  ]

  return rows.map((item) => ({
    ...item,
    percentage: total > 0 ? Math.round((Number(item.value) / total) * 100) : 0
  }))
})

const reviewApprovalRate = computed(() => {
  const reviews = metrics.value?.reviews
  const reviewed =
    Number(reviews?.approved || 0) + Number(reviews?.rejected || 0)
  return reviewed > 0
    ? Math.round((Number(reviews.approved || 0) / reviewed) * 100)
    : 0
})

const loadMetrics = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    metrics.value = await getAdminMetrics()
  } catch (error) {
    metrics.value = null
    errorMessage.value =
      error?.response?.data?.msg || '运营数据加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const actionLabels = {
  'course.created': '创建课程',
  'course.updated': '更新课程',
  'course.submitted': '提交课程审核',
  'course.approved': '审核通过课程',
  'course.rejected': '驳回课程',
  'appointment.created': '创建课程预约',
  'appointment.accepted': '接受课程预约',
  'appointment.rejected': '拒绝课程预约',
  'appointment.cancelled': '取消课程预约',
  'profile.updated': '更新个人资料',
  'password.updated': '修改登录密码'
}

const roleLabels = {
  student: '学生',
  teacher: '教师',
  administrator: '管理员'
}

const getActionLabel = (action) => actionLabels[action] || action || '系统操作'
const getRoleLabel = (role) => roleLabels[role] || '系统'

const getActivityDetail = (activity) => {
  const details = activity.details || {}

  if (details.previousStatus && details.nextStatus) {
    return `${details.previousStatus} → ${details.nextStatus}`
  }
  if (details.decision) return `审核结果：${details.decision}`
  if (activity.entityType && activity.entityId) {
    return `${activity.entityType} · ${String(activity.entityId).slice(0, 8)}`
  }
  return '平台操作记录'
}

onMounted(loadMetrics)
</script>

<template>
  <main class="data-center">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">OPERATIONS PULSE · 数据中心</p>
        <h1>让平台的每一次增长，都有迹可循。</h1>
        <p>用户、课程、预约、作业与审核数据来自同一套业务服务。</p>
      </div>
      <div class="header-actions">
        <div v-if="metrics?.generatedAt" class="generated-time">
          <span>数据生成时间</span>
          <strong>{{ formatDate(metrics.generatedAt) }}</strong>
        </div>
        <el-button :loading="isLoading" @click="loadMetrics"
          >刷新数据</el-button
        >
      </div>
    </header>

    <section
      v-if="isLoading && !metrics"
      class="loading-grid"
      aria-live="polite"
    >
      <div v-for="index in 5" :key="index" class="metric-skeleton">
        <el-skeleton animated :rows="2" />
      </div>
    </section>

    <section v-else-if="errorMessage" class="error-panel" role="alert">
      <span aria-hidden="true">!</span>
      <h2>暂时无法读取运营数据</h2>
      <p>{{ errorMessage }}</p>
      <el-button type="primary" @click="loadMetrics">重新加载</el-button>
    </section>

    <template v-else-if="metrics">
      <section class="metric-grid" aria-label="关键运营指标">
        <article
          v-for="(item, index) in metricCards"
          :key="item.label"
          class="metric-card"
          :class="`tone-${item.tone}`"
        >
          <span class="metric-index">0{{ index + 1 }}</span>
          <p>{{ item.label }}</p>
          <strong>{{ item.value }}</strong>
          <small>{{ item.detail }}</small>
        </article>
      </section>

      <section class="insight-grid">
        <article class="course-health panel">
          <div class="panel-heading">
            <div>
              <p class="section-label">COURSE PIPELINE</p>
              <h2>课程内容管线</h2>
            </div>
            <span>{{ metrics.courses?.total || 0 }} 门课程</span>
          </div>

          <div class="status-chart">
            <div
              v-for="item in courseStatusRows"
              :key="item.label"
              class="status-row"
            >
              <div class="status-row-head">
                <span
                  ><i :style="{ background: item.color }"></i
                  >{{ item.label }}</span
                >
                <strong
                  >{{ item.value }}
                  <small>/ {{ item.percentage }}%</small></strong
                >
              </div>
              <div
                class="bar-track"
                :aria-label="`${item.label}占比 ${item.percentage}%`"
              >
                <span
                  :style="{
                    width: `${item.percentage}%`,
                    background: item.color
                  }"
                ></span>
              </div>
            </div>
          </div>
        </article>

        <article class="quality-card panel">
          <p class="section-label">QUALITY SIGNAL</p>
          <h2>审核质量信号</h2>
          <div
            class="approval-ring"
            :style="{ '--rate': `${reviewApprovalRate * 3.6}deg` }"
          >
            <div>
              <strong>{{ reviewApprovalRate }}%</strong>
              <span>通过率</span>
            </div>
          </div>
          <div class="review-summary">
            <div>
              <span>已通过</span>
              <strong>{{ metrics.reviews?.approved || 0 }}</strong>
            </div>
            <div>
              <span>已驳回</span>
              <strong>{{ metrics.reviews?.rejected || 0 }}</strong>
            </div>
          </div>
        </article>

        <article class="learning-card panel">
          <p class="section-label">LEARNING LOOP</p>
          <h2>学习闭环</h2>
          <div class="learning-flow">
            <div>
              <span>预约</span>
              <strong>{{ metrics.learning?.appointments || 0 }}</strong>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <span>作业</span>
              <strong>{{ metrics.learning?.assignments || 0 }}</strong>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <span>提交</span>
              <strong>{{ metrics.learning?.submissions || 0 }}</strong>
            </div>
          </div>
          <p class="learning-note">
            当前有
            <strong>{{ metrics.learning?.activeAppointments || 0 }}</strong>
            个进行中的预约，<strong>{{
              metrics.learning?.pendingGrading || 0
            }}</strong>
            份作业等待批改。
          </p>
        </article>
      </section>

      <section class="activity-panel panel">
        <div class="panel-heading">
          <div>
            <p class="section-label">AUDIT TRAIL</p>
            <h2>最近平台动态</h2>
          </div>
          <span>最新 {{ metrics.recentActivity?.length || 0 }} 条</span>
        </div>

        <div v-if="metrics.recentActivity?.length" class="activity-list">
          <article
            v-for="activity in metrics.recentActivity"
            :key="activity.id"
            class="activity-row"
          >
            <span class="activity-dot" aria-hidden="true"></span>
            <div class="activity-main">
              <div>
                <strong>{{ activity.actorName }}</strong>
                <span class="role-chip">{{
                  getRoleLabel(activity.actorRole)
                }}</span>
              </div>
              <p>{{ getActionLabel(activity.action) }}</p>
            </div>
            <span class="activity-detail">{{
              getActivityDetail(activity)
            }}</span>
            <time :datetime="activity.createdAt">{{
              formatDate(activity.createdAt)
            }}</time>
          </article>
        </div>

        <div v-else class="empty-activity">
          <span aria-hidden="true">记</span>
          <p>暂时没有平台操作记录。</p>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.data-center {
  --ink: #173247;
  --muted: #6b7f8d;
  min-height: 100%;
  padding: 38px clamp(24px, 4vw, 72px) 64px;
  color: var(--ink);
  background:
    radial-gradient(
      circle at 93% 4%,
      rgba(122, 210, 225, 0.3),
      transparent 25%
    ),
    linear-gradient(180deg, #edf8fb, #f7fbfc 58%);
}

.dashboard-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  max-width: 1720px;
  margin: 0 auto 28px;
  padding-bottom: 28px;
  border-bottom: 1px solid rgba(30, 84, 105, 0.13);
}

.eyebrow,
.section-label {
  margin: 0 0 10px;
  color: #2c849f;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.dashboard-header h1 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(32px, 3.2vw, 50px);
  line-height: 1.18;
}

.dashboard-header > div:first-child > p:last-child {
  margin: 13px 0 0;
  color: var(--muted);
}

.header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 16px;
}

.generated-time {
  padding-right: 16px;
  border-right: 1px solid rgba(30, 84, 105, 0.15);
  text-align: right;
}

.generated-time span,
.generated-time strong {
  display: block;
}
.generated-time span {
  margin-bottom: 3px;
  color: #83949e;
  font-size: 11px;
}
.generated-time strong {
  font-size: 13px;
}

.metric-grid,
.loading-grid {
  display: grid;
  max-width: 1720px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin: 0 auto;
}

.metric-card,
.metric-skeleton {
  min-height: 170px;
  padding: 22px;
  border: 1px solid rgba(30, 84, 105, 0.09);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 28px rgba(32, 82, 101, 0.07);
}

.metric-card {
  position: relative;
  overflow: hidden;
}
.metric-card::after {
  position: absolute;
  right: -26px;
  bottom: -34px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: var(--tone);
  opacity: 0.1;
  content: '';
}
.metric-index {
  color: var(--tone);
  font-family: Georgia, serif;
  font-size: 13px;
  font-weight: 700;
}
.metric-card p {
  margin: 13px 0 2px;
  color: var(--muted);
  font-size: 13px;
}
.metric-card > strong {
  display: block;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 44px;
  line-height: 1.05;
}
.metric-card small {
  display: block;
  margin-top: 10px;
  color: #80919c;
  font-size: 11px;
}
.tone-blue {
  --tone: #286f99;
}
.tone-teal {
  --tone: #208b7a;
}
.tone-amber {
  --tone: #d48c19;
}
.tone-cyan {
  --tone: #278aa5;
}
.tone-coral {
  --tone: #bd5963;
}

.insight-grid {
  display: grid;
  max-width: 1720px;
  grid-template-columns: 1.35fr 0.7fr 0.95fr;
  gap: 18px;
  margin: 20px auto;
}

.panel {
  border: 1px solid rgba(30, 84, 105, 0.09);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 32px rgba(32, 82, 101, 0.07);
}

.course-health,
.quality-card,
.learning-card {
  padding: 27px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.panel-heading h2,
.quality-card h2,
.learning-card h2 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 25px;
}
.panel-heading > span {
  color: #78909d;
  font-size: 12px;
}

.status-chart {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 25px;
}
.status-row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
  font-size: 12px;
}
.status-row-head span {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-row-head i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.status-row-head strong {
  font-size: 13px;
}
.status-row-head small {
  color: #8a9aa3;
  font-weight: 500;
}
.bar-track {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf2f3;
}
.bar-track span {
  display: block;
  min-width: 2px;
  height: 100%;
  border-radius: inherit;
  transition: width 500ms ease;
}

.approval-ring {
  display: grid;
  width: 150px;
  height: 150px;
  margin: 24px auto;
  border-radius: 50%;
  background: conic-gradient(#248c76 var(--rate), #e9f0f1 0);
  place-items: center;
}

.approval-ring > div {
  display: grid;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: #fff;
  place-items: center;
  align-content: center;
}
.approval-ring strong {
  font-family: Georgia, serif;
  font-size: 30px;
}
.approval-ring span {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}
.review-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.review-summary div {
  padding: 12px;
  border-radius: 12px;
  background: #f3f8f9;
}
.review-summary span,
.review-summary strong {
  display: block;
}
.review-summary span {
  color: var(--muted);
  font-size: 11px;
}
.review-summary strong {
  margin-top: 4px;
  font-size: 20px;
}

.learning-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 38px 0;
}
.learning-flow div {
  display: flex;
  min-width: 62px;
  flex-direction: column;
  align-items: center;
}
.learning-flow span {
  color: var(--muted);
  font-size: 11px;
}
.learning-flow strong {
  margin-top: 5px;
  font-family: Georgia, serif;
  font-size: 27px;
}
.learning-flow i {
  color: #9db2bb;
  font-style: normal;
}
.learning-note {
  margin: 0;
  padding: 15px;
  border-left: 3px solid #2a839b;
  color: #55707f;
  background: #edf8fa;
  font-size: 12px;
  line-height: 1.6;
}

.activity-panel {
  max-width: 1720px;
  margin: 0 auto;
  padding: 28px;
}
.activity-list {
  margin-top: 22px;
}
.activity-row {
  display: grid;
  grid-template-columns: 12px minmax(220px, 1fr) minmax(170px, 0.75fr) 90px;
  align-items: center;
  gap: 14px;
  padding: 16px 6px;
  border-top: 1px solid rgba(29, 83, 104, 0.1);
}
.activity-dot {
  width: 8px;
  height: 8px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #2c8ba4;
  box-shadow: 0 0 0 1px #2c8ba4;
}
.activity-main > div {
  display: flex;
  align-items: center;
  gap: 8px;
}
.activity-main p {
  margin: 4px 0 0;
  color: #54707f;
  font-size: 12px;
}
.role-chip {
  padding: 3px 7px;
  border-radius: 999px;
  color: #34758a;
  background: #e4f4f7;
  font-size: 10px;
  font-weight: 800;
}
.activity-detail {
  color: #718792;
  font-size: 12px;
}
.activity-row time {
  color: #8798a1;
  text-align: right;
  font-family: Georgia, serif;
  font-size: 11px;
}

.empty-activity,
.error-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.empty-activity {
  min-height: 190px;
  color: var(--muted);
}
.empty-activity span,
.error-panel > span {
  display: grid;
  width: 54px;
  height: 54px;
  border-radius: 16px;
  place-items: center;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 22px;
  font-weight: 800;
}
.empty-activity span {
  color: #2f8098;
  background: #e0f3f6;
}

.error-panel {
  min-height: 420px;
  max-width: 1720px;
  margin: 0 auto;
  padding: 40px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
}
.error-panel > span {
  color: #a3323c;
  background: #ffe1e3;
}
.error-panel h2 {
  margin: 17px 0 0;
}
.error-panel p {
  margin: 9px 0 22px;
  color: var(--muted);
}

@media (max-width: 1300px) {
  .metric-grid,
  .loading-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .insight-grid {
    grid-template-columns: 1fr 1fr;
  }
  .course-health {
    grid-column: span 2;
  }
}

@media (max-width: 820px) {
  .dashboard-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .metric-grid,
  .loading-grid,
  .insight-grid {
    grid-template-columns: 1fr;
  }
  .course-health {
    grid-column: auto;
  }
  .activity-row {
    grid-template-columns: 12px 1fr auto;
  }
  .activity-detail {
    display: none;
  }
}
</style>
