<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  Calendar,
  Connection,
  DataLine,
  Refresh,
  Search,
  User,
  VideoCamera,
  View
} from '@element-plus/icons-vue'

import { getAppointments } from '@/api/platform'

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待教师处理', value: 'pending' },
  { label: '课堂已确认', value: 'accepted' },
  { label: '已完成', value: 'completed' },
  { label: '未成行', value: 'inactive' }
]

const statusMeta = {
  pending: { label: '待教师处理', type: 'warning', className: 'pending' },
  accepted: { label: '课堂已确认', type: 'success', className: 'accepted' },
  completed: { label: '已完成', type: '', className: 'completed' },
  rejected: { label: '教师已婉拒', type: 'danger', className: 'rejected' },
  cancelled: { label: '预约已取消', type: 'info', className: 'cancelled' }
}

const appointments = ref([])
const activeStatus = ref('')
const searchKeyword = ref('')
const loading = ref(false)
const loadError = ref('')
const currentPage = ref(1)
const pageSize = ref(8)
const detailVisible = ref(false)
const selectedAppointment = ref(null)

const getStatusMeta = (status) =>
  statusMeta[status] || {
    label: status || '未知状态',
    type: 'info',
    className: 'cancelled'
  }

const matchesStatus = (appointment, status) => {
  if (!status) return true
  if (status === 'inactive') {
    return ['rejected', 'cancelled'].includes(appointment.status)
  }
  return appointment.status === status
}

const statusCount = (status) =>
  appointments.value.filter((appointment) => matchesStatus(appointment, status))
    .length

const filteredAppointments = computed(() => {
  const keyword = searchKeyword.value.trim().toLocaleLowerCase()
  return appointments.value
    .filter((appointment) => matchesStatus(appointment, activeStatus.value))
    .filter((appointment) => {
      if (!keyword) return true
      return [
        appointment.topic,
        appointment.student?.displayName,
        appointment.teacher?.displayName,
        appointment.course?.title,
        appointment.classroom?.roomCode,
        appointment.id
      ].some((value) =>
        String(value || '')
          .toLocaleLowerCase()
          .includes(keyword)
      )
    })
    .sort(
      (left, right) =>
        Date.parse(left.scheduledStart) - Date.parse(right.scheduledStart)
    )
})

const pagedAppointments = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredAppointments.value.slice(start, start + pageSize.value)
})

const metrics = computed(() => [
  {
    label: '全量预约',
    value: appointments.value.length,
    note: '跨学生与教师',
    icon: DataLine,
    tone: 'blue'
  },
  {
    label: '待处理',
    value: statusCount('pending'),
    note: '需要教师响应',
    icon: Calendar,
    tone: 'amber'
  },
  {
    label: '已确认课堂',
    value: statusCount('accepted'),
    note: '已建立课堂关联',
    icon: VideoCamera,
    tone: 'green'
  },
  {
    label: '课堂记录',
    value: appointments.value.filter((item) => item.classroom).length,
    note: '具备可追踪房间号',
    icon: Connection,
    tone: 'teal'
  }
])

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间待确认'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).format(date)
}

const formatTimeRange = (start, end) => {
  const format = (value) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--:--'
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date)
  }
  return `${format(start)} — ${format(end)}`
}

const formatDateTime = (value) => {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

const avatarText = (name, fallback) =>
  String(name || fallback)
    .trim()
    .slice(0, 1)

const errorText = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const loadAppointments = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const data = await getAppointments({ page: 1, pageSize: 100 })
    appointments.value = Array.isArray(data?.items) ? data.items : []
  } catch (error) {
    appointments.value = []
    loadError.value = errorText(error, '课程对接记录加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const showDetail = (appointment) => {
  selectedAppointment.value = appointment
  detailVisible.value = true
}

const clearFilters = () => {
  activeStatus.value = ''
  searchKeyword.value = ''
}

watch([activeStatus, searchKeyword], () => {
  currentPage.value = 1
})

onMounted(loadAppointments)
</script>

<template>
  <main class="admin-docking">
    <section class="overview-hero">
      <div class="hero-copy">
        <p class="eyebrow">MATCHING OBSERVATORY · 教学对接总览</p>
        <h1>让每一场师生对接，都清楚地留下轨迹。</h1>
        <p>
          管理员在此查看平台全量预约、跨角色关系与课堂创建状态；处理权限仍归属于实际授课教师。
        </p>
      </div>
      <div class="hero-emblem" aria-hidden="true">
        <span>师</span><i></i><span>生</span>
        <small>CONNECTED LEARNING</small>
      </div>
    </section>

    <section class="metrics-grid" v-loading="loading">
      <article
        v-for="metric in metrics"
        :key="metric.label"
        :class="metric.tone"
      >
        <span class="metric-icon"><component :is="metric.icon" /></span>
        <div>
          <strong>{{ metric.value }}</strong>
          <span>{{ metric.label }}</span>
          <small>{{ metric.note }}</small>
        </div>
      </article>
    </section>

    <section class="data-panel">
      <header class="panel-header">
        <div>
          <p>APPOINTMENT LEDGER</p>
          <h2>课程对接台账</h2>
        </div>
        <div class="header-actions">
          <el-input
            v-model="searchKeyword"
            :prefix-icon="Search"
            clearable
            placeholder="搜索学生、教师、课程或课堂号"
          />
          <el-button
            :icon="Refresh"
            :loading="loading"
            @click="loadAppointments"
          >
            刷新
          </el-button>
        </div>
      </header>

      <div class="status-tabs" role="tablist" aria-label="对接状态筛选">
        <button
          v-for="option in statusOptions"
          :key="option.value"
          type="button"
          :class="{ active: activeStatus === option.value }"
          @click="activeStatus = option.value"
        >
          {{ option.label }}
          <span>{{ statusCount(option.value) }}</span>
        </button>
      </div>

      <el-alert
        v-if="loadError"
        class="load-alert"
        type="error"
        show-icon
        :closable="false"
        :title="loadError"
      >
        <template #default>
          <el-button link type="primary" @click="loadAppointments"
            >重新加载</el-button
          >
        </template>
      </el-alert>

      <div v-if="loading" class="record-list">
        <article
          v-for="item in 4"
          :key="item"
          class="record-card skeleton-card"
        >
          <el-skeleton :rows="2" animated />
        </article>
      </div>

      <div v-else-if="pagedAppointments.length" class="record-list">
        <article
          v-for="appointment in pagedAppointments"
          :key="appointment.id"
          :class="['record-card', getStatusMeta(appointment.status).className]"
        >
          <div class="schedule-column">
            <span>{{ formatDate(appointment.scheduledStart) }}</span>
            <strong>
              {{
                formatTimeRange(
                  appointment.scheduledStart,
                  appointment.scheduledEnd
                )
              }}
            </strong>
            <small>{{ appointment.durationMinutes }} 分钟</small>
          </div>

          <div class="people-column">
            <div class="person">
              <el-avatar
                :size="40"
                :src="appointment.student?.avatarUrl || undefined"
              >
                {{ avatarText(appointment.student?.displayName, '学') }}
              </el-avatar>
              <span>
                <small>学习者</small>
                <strong>{{
                  appointment.student?.displayName || '匿名学生'
                }}</strong>
              </span>
            </div>
            <Connection class="connection-icon" />
            <div class="person">
              <el-avatar
                :size="40"
                :src="appointment.teacher?.avatarUrl || undefined"
              >
                {{ avatarText(appointment.teacher?.displayName, '师') }}
              </el-avatar>
              <span>
                <small>授课教师</small>
                <strong>{{
                  appointment.teacher?.displayName || '未命名教师'
                }}</strong>
              </span>
            </div>
          </div>

          <div class="lesson-column">
            <span class="record-label">LESSON</span>
            <h3>{{ appointment.topic }}</h3>
            <p>{{ appointment.course?.title || '独立主题预约' }}</p>
          </div>

          <div class="classroom-column">
            <span class="record-label">CLASSROOM</span>
            <template v-if="appointment.classroom">
              <strong>{{ appointment.classroom.roomCode }}</strong>
              <small>{{ appointment.classroom.status }}</small>
            </template>
            <template v-else>
              <strong class="muted-room">尚未创建</strong>
              <small>教师接受后自动生成</small>
            </template>
          </div>

          <div class="status-column">
            <el-tag
              :type="getStatusMeta(appointment.status).type"
              effect="light"
            >
              {{ getStatusMeta(appointment.status).label }}
            </el-tag>
            <el-button
              text
              type="primary"
              :icon="View"
              @click="showDetail(appointment)"
            >
              查看详情
            </el-button>
          </div>
        </article>
      </div>

      <div v-else-if="!loadError" class="empty-state">
        <span>录</span>
        <h2>没有符合条件的对接记录</h2>
        <p>尝试切换状态或清除搜索条件。</p>
        <el-button plain @click="clearFilters"> 清除筛选 </el-button>
      </div>

      <footer
        v-if="filteredAppointments.length > pageSize"
        class="pagination-footer"
      >
        <span>共 {{ filteredAppointments.length }} 条真实记录</span>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          background
          layout="prev, pager, next"
          :total="filteredAppointments.length"
        />
      </footer>
    </section>

    <el-dialog
      v-model="detailVisible"
      width="680px"
      align-center
      destroy-on-close
      title="对接记录详情"
    >
      <section v-if="selectedAppointment" class="detail-sheet">
        <header>
          <div>
            <span class="record-label">APPOINTMENT RECORD</span>
            <h2>{{ selectedAppointment.topic }}</h2>
          </div>
          <el-tag
            :type="getStatusMeta(selectedAppointment.status).type"
            size="large"
          >
            {{ getStatusMeta(selectedAppointment.status).label }}
          </el-tag>
        </header>

        <div class="detail-people">
          <div>
            <User />
            <span>
              <small>学习者</small>
              <strong>{{ selectedAppointment.student?.displayName }}</strong>
              <code>{{ selectedAppointment.student?.id }}</code>
            </span>
          </div>
          <Connection />
          <div>
            <User />
            <span>
              <small>授课教师</small>
              <strong>{{ selectedAppointment.teacher?.displayName }}</strong>
              <code>{{ selectedAppointment.teacher?.id }}</code>
            </span>
          </div>
        </div>

        <dl class="detail-grid">
          <div>
            <dt>预约时间</dt>
            <dd>{{ formatDateTime(selectedAppointment.scheduledStart) }}</dd>
          </div>
          <div>
            <dt>课时长度</dt>
            <dd>{{ selectedAppointment.durationMinutes }} 分钟</dd>
          </div>
          <div>
            <dt>关联课程</dt>
            <dd>{{ selectedAppointment.course?.title || '独立主题预约' }}</dd>
          </div>
          <div>
            <dt>课堂编号</dt>
            <dd>{{ selectedAppointment.classroom?.roomCode || '未创建' }}</dd>
          </div>
          <div class="wide">
            <dt>学生诉求</dt>
            <dd>{{ selectedAppointment.message || '未填写' }}</dd>
          </div>
          <div class="wide">
            <dt>教师回复</dt>
            <dd>{{ selectedAppointment.responseNote || '暂无回复说明' }}</dd>
          </div>
          <div class="wide technical-id">
            <dt>预约 ID</dt>
            <dd>{{ selectedAppointment.id }}</dd>
          </div>
        </dl>
      </section>
      <template #footer>
        <el-button type="primary" @click="detailVisible = false"
          >完成查看</el-button
        >
      </template>
    </el-dialog>
  </main>
</template>

<style scoped>
.admin-docking {
  --ink: #17364c;
  --muted: #718491;
  --line: rgba(27, 75, 99, 0.12);
  width: min(1760px, calc(100% - 34px));
  margin: 22px auto 48px;
  color: var(--ink);
}

.overview-hero {
  display: flex;
  min-height: 235px;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  padding: 42px 50px;
  border-radius: 26px;
  color: #f7fcfd;
  background:
    radial-gradient(
      circle at 85% 30%,
      rgba(127, 215, 219, 0.3),
      transparent 24%
    ),
    repeating-linear-gradient(
      135deg,
      transparent 0 23px,
      rgba(255, 255, 255, 0.028) 23px 24px
    ),
    #173f53;
  box-shadow: 0 24px 60px rgba(22, 70, 91, 0.2);
}
.eyebrow,
.panel-header p,
.record-label {
  margin: 0;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.17em;
}
.eyebrow {
  color: #8cdde1;
}
.hero-copy h1 {
  margin: 13px 0 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(34px, 3vw, 50px);
  line-height: 1.18;
}
.hero-copy > p:last-child {
  max-width: 760px;
  margin: 16px 0 0;
  color: rgba(239, 249, 251, 0.7);
  line-height: 1.75;
}
.hero-emblem {
  display: grid;
  grid-template-columns: 70px 52px 70px;
  gap: 10px;
  align-items: center;
  margin-right: 36px;
}
.hero-emblem span {
  display: grid;
  width: 70px;
  height: 70px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 30px;
  background: rgba(255, 255, 255, 0.08);
}
.hero-emblem i {
  height: 1px;
  background: #83dadd;
}
.hero-emblem small {
  grid-column: 1 / -1;
  margin-top: 4px;
  text-align: center;
  color: #8cdde1;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}
.metrics-grid article {
  display: flex;
  gap: 15px;
  align-items: center;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 26px rgba(29, 79, 99, 0.07);
}
.metric-icon {
  display: grid;
  width: 45px;
  height: 45px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
  color: #176b87;
  background: #dff1f3;
}
.metric-icon svg {
  width: 22px;
}
.metrics-grid article.amber .metric-icon {
  color: #9c6505;
  background: #fff0c8;
}
.metrics-grid article.green .metric-icon {
  color: #087454;
  background: #d8f2e7;
}
.metrics-grid article.teal .metric-icon {
  color: #186b70;
  background: #daf0ed;
}
.metrics-grid article > div {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  column-gap: 9px;
}
.metrics-grid strong {
  font-family: Georgia, serif;
  font-size: 29px;
}
.metrics-grid span {
  font-weight: 800;
}
.metrics-grid small {
  grid-column: 1 / -1;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.data-panel {
  margin-top: 18px;
  padding: 27px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 36px rgba(28, 76, 95, 0.08);
}
.panel-header {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
}
.panel-header p {
  color: #5791a4;
}
.panel-header h2 {
  margin: 4px 0 0;
  font-size: 25px;
}
.header-actions {
  display: flex;
  width: min(540px, 48%);
  gap: 9px;
}
.header-actions :deep(.el-input) {
  flex: 1;
}
.status-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 22px 0;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.status-tabs button {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 9px 13px;
  border: 1px solid transparent;
  border-radius: 11px;
  color: #60798a;
  background: #f3f7f8;
  font-weight: 700;
  transition: 170ms ease;
}
.status-tabs button span {
  padding: 1px 6px;
  border-radius: 999px;
  background: #e4edef;
  font-size: 10px;
}
.status-tabs button:hover,
.status-tabs button.active {
  border-color: rgba(23, 106, 134, 0.2);
  color: #0f6886;
  background: #e8f5f6;
}
.status-tabs button.active span {
  color: #fff;
  background: #167997;
}
.load-alert {
  margin-bottom: 18px;
}

.record-list {
  display: grid;
  gap: 10px;
}
.record-card {
  position: relative;
  display: grid;
  grid-template-columns:
    155px minmax(270px, 1.15fr) minmax(190px, 0.9fr)
    155px 135px;
  gap: 20px;
  align-items: center;
  overflow: hidden;
  padding: 18px 19px;
  border: 1px solid var(--line);
  border-radius: 17px;
  background: #fbfdfd;
  transition: 170ms ease;
}
.record-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #9cafb7;
  content: '';
}
.record-card.pending::before {
  background: #eeac3b;
}
.record-card.accepted::before {
  background: #20a371;
}
.record-card.rejected::before {
  background: #dc7078;
}
.record-card:hover {
  border-color: rgba(26, 104, 132, 0.2);
  box-shadow: 0 11px 25px rgba(31, 80, 98, 0.08);
}
.skeleton-card {
  min-height: 105px;
}
.schedule-column {
  display: flex;
  flex-direction: column;
  padding-right: 16px;
  border-right: 1px solid var(--line);
}
.schedule-column span {
  color: #537a8c;
  font-size: 11px;
  font-weight: 700;
}
.schedule-column strong {
  margin: 5px 0 2px;
  font-size: 15px;
}
.schedule-column small {
  color: var(--muted);
  font-size: 10px;
}
.people-column {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
}
.person {
  display: flex;
  min-width: 0;
  gap: 9px;
  align-items: center;
}
.person span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.person small {
  color: var(--muted);
  font-size: 9px;
}
.person strong {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-icon {
  width: 19px;
  color: #75a2b0;
}
.record-label {
  color: #72a0ae;
}
.lesson-column {
  min-width: 0;
}
.lesson-column h3 {
  overflow: hidden;
  margin: 4px 0 3px;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-column p {
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.classroom-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.classroom-column strong {
  overflow: hidden;
  margin-top: 5px;
  color: #17647f;
  font-family: Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.classroom-column small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
}
.classroom-column .muted-room {
  color: #7f9098;
  font-family: inherit;
}
.status-column {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-end;
}
.empty-state {
  display: flex;
  min-height: 300px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(30, 91, 115, 0.22);
  border-radius: 20px;
  background: #f7fbfb;
}
.empty-state > span {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 18px;
  color: #176c87;
  background: #dceff2;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 25px;
  font-weight: 800;
}
.empty-state h2 {
  margin: 16px 0 4px;
}
.empty-state p {
  margin: 0 0 18px;
  color: var(--muted);
}
.pagination-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.pagination-footer > span {
  color: var(--muted);
  font-size: 11px;
}

.detail-sheet header {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
.detail-sheet h2 {
  margin: 5px 0 0;
  font-size: 23px;
}
.detail-people {
  display: grid;
  grid-template-columns: 1fr 30px 1fr;
  gap: 14px;
  align-items: center;
  margin: 20px 0;
}
.detail-people > div {
  display: flex;
  min-width: 0;
  gap: 11px;
  align-items: center;
  padding: 13px;
  border-radius: 14px;
  background: #edf6f7;
}
.detail-people > div > svg {
  width: 22px;
  color: #31788f;
}
.detail-people > svg {
  width: 21px;
  color: #7b9ca8;
}
.detail-people span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.detail-people small {
  color: var(--muted);
  font-size: 9px;
}
.detail-people code {
  overflow: hidden;
  margin-top: 3px;
  color: #77909b;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}
.detail-grid > div {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
}
.detail-grid .wide {
  grid-column: 1 / -1;
}
.detail-grid dt {
  color: var(--muted);
  font-size: 10px;
}
.detail-grid dd {
  margin: 5px 0 0;
  line-height: 1.55;
}
.detail-grid .technical-id dd {
  overflow-wrap: anywhere;
  color: #58798a;
  font-family: Consolas, monospace;
  font-size: 11px;
}

@media (max-width: 1300px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .record-card {
    grid-template-columns: 145px minmax(250px, 1fr) minmax(180px, 0.8fr) 120px;
  }
  .classroom-column {
    grid-column: 2 / 4;
  }
  .status-column {
    grid-column: 4;
    grid-row: 1 / 3;
  }
}

@media (max-width: 900px) {
  .hero-emblem {
    display: none;
  }
  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .header-actions {
    width: 100%;
  }
  .record-card {
    grid-template-columns: 130px 1fr;
  }
  .lesson-column,
  .classroom-column,
  .status-column {
    grid-column: 1 / -1;
  }
  .status-column {
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
  }
}
</style>
