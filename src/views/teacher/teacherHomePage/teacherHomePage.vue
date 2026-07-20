<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Calendar,
  CircleCheck,
  Clock,
  Collection,
  EditPen,
  Refresh,
  Right,
  TrendCharts,
  User,
  VideoCamera
} from '@element-plus/icons-vue'

import { getAppointments, getCourses } from '@/api/platform'
import { useUserStore } from '@/stores'

const router = useRouter()
const userStore = useUserStore()
const appointments = ref([])
const courses = ref([])
const loading = ref(false)
const loadError = ref('')

const profile = computed(() => userStore.profile || {})
const teacherName = computed(() => profile.value.displayName || '中文老师')
const teacherInitial = computed(() => teacherName.value.trim().slice(0, 1))

const statusMeta = {
  pending: { label: '待处理', type: 'warning' },
  accepted: { label: '已确认', type: 'success' },
  completed: { label: '已完成', type: '' },
  rejected: { label: '已婉拒', type: 'danger' },
  cancelled: { label: '已取消', type: 'info' }
}

const stats = computed(() => {
  const activeClasses = appointments.value.filter((item) =>
    ['accepted', 'completed'].includes(item.status)
  )
  const uniqueStudents = new Set(activeClasses.map((item) => item.student?.id))
  const publishedCourses = courses.value.filter(
    (course) => course.status === 'published'
  )

  return [
    {
      label: '待处理申请',
      value: appointments.value.filter((item) => item.status === 'pending')
        .length,
      note: '需要及时回复',
      icon: Clock,
      tone: 'amber'
    },
    {
      label: '已确认课堂',
      value: appointments.value.filter((item) => item.status === 'accepted')
        .length,
      note: '专属教室已就绪',
      icon: Calendar,
      tone: 'teal'
    },
    {
      label: '服务学生',
      value: uniqueStudents.size,
      note: '来自真实预约记录',
      icon: User,
      tone: 'blue'
    },
    {
      label: '已发布课程',
      value: publishedCourses.length,
      note: `${courses.value.length} 门课程作品`,
      icon: Collection,
      tone: 'green'
    }
  ]
})

const recentAppointments = computed(() => {
  const priority = {
    pending: 0,
    accepted: 1,
    completed: 2,
    rejected: 3,
    cancelled: 4
  }
  return [...appointments.value]
    .sort((left, right) => {
      const statusOrder =
        (priority[left.status] ?? 9) - (priority[right.status] ?? 9)
      if (statusOrder !== 0) return statusOrder
      return Date.parse(left.scheduledStart) - Date.parse(right.scheduledStart)
    })
    .slice(0, 5)
})

const courseProgress = computed(() => {
  const statusOrder = ['published', 'pending', 'draft', 'rejected', 'archived']
  const labels = {
    published: '已发布',
    pending: '审核中',
    draft: '草稿',
    rejected: '待修改',
    archived: '已归档'
  }
  return statusOrder
    .map((status) => ({
      status,
      label: labels[status],
      value: courses.value.filter((course) => course.status === status).length
    }))
    .filter((item) => item.value > 0)
})

const nextClass = computed(
  () =>
    appointments.value
      .filter((item) => item.status === 'accepted')
      .sort(
        (left, right) =>
          Date.parse(left.scheduledStart) - Date.parse(right.scheduledStart)
      )[0]
)

const statusInfo = (status) =>
  statusMeta[status] || { label: status || '未知', type: 'info' }

const formatTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间待确认'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

const errorText = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const loadDashboard = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [appointmentData, courseData] = await Promise.all([
      getAppointments({ page: 1, pageSize: 100 }),
      getCourses({ page: 1, pageSize: 100 })
    ])
    appointments.value = Array.isArray(appointmentData?.items)
      ? appointmentData.items
      : []
    courses.value = Array.isArray(courseData?.items) ? courseData.items : []
  } catch (error) {
    appointments.value = []
    courses.value = []
    loadError.value = errorText(error, '教师工作台加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const goToAppointments = () => router.push({ name: 'teachingDocking' })
const goToCourses = () => router.push({ name: 'onlineCourses' })
const goToCreateCourse = () => router.push({ name: 'uploadCourses' })

onMounted(loadDashboard)
</script>

<template>
  <main class="teacher-dashboard mt-36 mx-auto">
    <section class="welcome-panel">
      <div class="welcome-copy">
        <p class="eyebrow">TEACHER DESK · 教师工作台</p>
        <h1>{{ teacherName }}，把今天的中文课教得更有温度。</h1>
        <p>
          预约、课堂与课程作品均由平台实时汇总。你只需要专注于学生与教学本身。
        </p>
        <div class="welcome-actions">
          <el-button type="primary" size="large" @click="goToAppointments">
            处理预约
          </el-button>
          <el-button size="large" @click="goToCreateCourse">创建课程</el-button>
        </div>
      </div>

      <div class="teacher-portrait">
        <span class="portrait-label">YOUR TEACHING DAY</span>
        <el-avatar
          :size="94"
          :src="profile.avatarUrl || undefined"
          class="portrait-avatar"
        >
          {{ teacherInitial }}
        </el-avatar>
        <strong>{{ teacherName }}</strong>
        <small>{{ profile.title || '国际中文教育教师' }}</small>
        <div v-if="nextClass" class="next-class-chip">
          <VideoCamera />
          <span>
            下一堂 · {{ nextClass.topic }}
            <b>{{ formatTime(nextClass.scheduledStart) }}</b>
          </span>
        </div>
        <div v-else class="next-class-chip quiet">
          <CircleCheck />
          <span>暂无已确认课堂<b>可以安排课程创作</b></span>
        </div>
      </div>
    </section>

    <el-alert
      v-if="loadError"
      class="load-alert"
      type="error"
      show-icon
      :closable="false"
      :title="loadError"
    >
      <template #default>
        <el-button link type="primary" :icon="Refresh" @click="loadDashboard">
          重新加载
        </el-button>
      </template>
    </el-alert>

    <section class="stat-grid" v-loading="loading">
      <article
        v-for="stat in stats"
        :key="stat.label"
        :class="['stat-card', stat.tone]"
      >
        <span class="stat-icon"><component :is="stat.icon" /></span>
        <div>
          <strong>{{ stat.value }}</strong>
          <span>{{ stat.label }}</span>
          <small>{{ stat.note }}</small>
        </div>
      </article>
    </section>

    <section class="dashboard-grid">
      <section class="panel schedule-panel">
        <header class="panel-header">
          <div>
            <p>RECENT REQUESTS</p>
            <h2>近期授课安排</h2>
          </div>
          <el-button text type="primary" @click="goToAppointments">
            查看全部 <el-icon><Right /></el-icon>
          </el-button>
        </header>

        <div v-if="loading" class="schedule-list">
          <el-skeleton v-for="item in 3" :key="item" :rows="2" animated />
        </div>
        <div v-else-if="recentAppointments.length" class="schedule-list">
          <button
            v-for="appointment in recentAppointments"
            :key="appointment.id"
            type="button"
            class="schedule-row"
            @click="goToAppointments"
          >
            <span class="date-tile">
              <strong>{{
                new Date(appointment.scheduledStart).getDate()
              }}</strong>
              <small
                >{{
                  new Date(appointment.scheduledStart).getMonth() + 1
                }}
                月</small
              >
            </span>
            <span class="schedule-copy">
              <span class="schedule-title">
                <strong>{{ appointment.topic }}</strong>
                <el-tag
                  :type="statusInfo(appointment.status).type"
                  size="small"
                >
                  {{ statusInfo(appointment.status).label }}
                </el-tag>
              </span>
              <small>
                {{ appointment.student?.displayName || '匿名学生' }} ·
                {{ formatTime(appointment.scheduledStart) }} ·
                {{ appointment.durationMinutes }} 分钟
              </small>
            </span>
            <Right />
          </button>
        </div>
        <el-empty v-else description="还没有学生预约">
          <el-button type="primary" @click="goToCourses"
            >完善公开课程</el-button
          >
        </el-empty>
      </section>

      <aside class="panel studio-panel">
        <header class="panel-header">
          <div>
            <p>COURSE STUDIO</p>
            <h2>课程作品进度</h2>
          </div>
          <el-icon class="studio-mark"><TrendCharts /></el-icon>
        </header>

        <div v-if="courseProgress.length" class="course-progress">
          <div v-for="item in courseProgress" :key="item.status">
            <span><i :class="item.status"></i>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <p v-else class="no-course-copy">
          还没有课程作品，从一份教学灵感开始吧。
        </p>

        <button type="button" class="studio-action" @click="goToCourses">
          <Collection />
          <span
            ><strong>管理课程作品</strong
            ><small>查看草稿、审核与发布状态</small></span
          >
          <Right />
        </button>
        <button
          type="button"
          class="studio-action accent"
          @click="goToCreateCourse"
        >
          <EditPen />
          <span
            ><strong>创建一门新课程</strong
            ><small>将教学方案沉淀为平台内容</small></span
          >
          <Right />
        </button>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.teacher-dashboard {
  --ink: #17364d;
  --muted: #708391;
  --line: rgba(26, 72, 96, 0.12);
  max-width: 1900px;
  padding-bottom: 44px;
  color: var(--ink);
}

.welcome-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: 54px;
  align-items: center;
  overflow: hidden;
  min-height: 300px;
  padding: 48px 56px;
  border-radius: 28px;
  color: #f7fcfd;
  background:
    radial-gradient(
      circle at 82% 16%,
      rgba(154, 224, 220, 0.3),
      transparent 22%
    ),
    repeating-linear-gradient(
      145deg,
      transparent 0 25px,
      rgba(255, 255, 255, 0.025) 25px 26px
    ),
    #173f53;
  box-shadow: 0 26px 65px rgba(22, 70, 91, 0.2);
}
.eyebrow,
.panel-header p,
.portrait-label {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.17em;
}
.eyebrow {
  color: #8ee0e3;
}
.welcome-copy h1 {
  max-width: 800px;
  margin: 15px 0 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(34px, 3vw, 52px);
  line-height: 1.18;
}
.welcome-copy > p:last-of-type {
  max-width: 720px;
  margin: 18px 0 0;
  color: rgba(239, 250, 252, 0.7);
  font-size: 15px;
  line-height: 1.75;
}
.welcome-actions {
  display: flex;
  gap: 10px;
  margin-top: 28px;
}
.welcome-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.teacher-portrait {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 23px 22px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(12px);
}
.portrait-label {
  color: rgba(207, 244, 245, 0.72);
}
.portrait-avatar {
  margin: 18px 0 12px;
  border: 3px solid rgba(255, 255, 255, 0.2);
}
.teacher-portrait > strong {
  font-size: 21px;
}
.teacher-portrait > small {
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.62);
}
.next-class-chip {
  display: flex;
  width: 100%;
  gap: 10px;
  align-items: center;
  margin-top: 20px;
  padding: 12px 14px;
  border-radius: 14px;
  color: #17465b;
  background: #a9e4e4;
}
.next-class-chip.quiet {
  background: rgba(255, 255, 255, 0.13);
  color: #f1fafb;
}
.next-class-chip svg {
  width: 22px;
}
.next-class-chip span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  font-size: 11px;
}
.next-class-chip b {
  overflow: hidden;
  margin-top: 2px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.load-alert {
  margin-top: 20px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  margin-top: 22px;
}
.stat-card {
  display: flex;
  gap: 17px;
  align-items: center;
  padding: 22px 23px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(30, 77, 96, 0.07);
}
.stat-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 15px;
  color: #176b87;
  background: #dff2f4;
}
.stat-icon svg {
  width: 23px;
}
.stat-card.amber .stat-icon {
  color: #9b6506;
  background: #fff0c9;
}
.stat-card.teal .stat-icon {
  color: #08755a;
  background: #d7f3e8;
}
.stat-card.green .stat-icon {
  color: #547112;
  background: #eaf2d2;
}
.stat-card > div {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  column-gap: 10px;
}
.stat-card strong {
  font-family: Georgia, serif;
  font-size: 31px;
}
.stat-card span {
  font-weight: 800;
}
.stat-card small {
  grid-column: 1 / -1;
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.7fr);
  gap: 20px;
  margin-top: 20px;
}
.panel {
  overflow: hidden;
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 14px 32px rgba(30, 77, 96, 0.07);
}
.panel-header {
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.panel-header p {
  color: #5792a5;
}
.panel-header h2 {
  margin: 4px 0 0;
  font-size: 24px;
}

.schedule-list {
  display: grid;
  gap: 9px;
}
.schedule-row {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) 18px;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 15px;
  text-align: left;
  color: inherit;
  background: #f6f9f9;
  transition: 170ms ease;
}
.schedule-row:hover {
  border-color: rgba(26, 107, 134, 0.19);
  background: #eff7f8;
  transform: translateX(3px);
}
.schedule-row > svg {
  width: 17px;
  color: #84a0ab;
}
.date-tile {
  display: flex;
  height: 54px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  color: #185a73;
  background: #dceff2;
}
.date-tile strong {
  font-family: Georgia, serif;
  font-size: 22px;
  line-height: 1;
}
.date-tile small {
  margin-top: 2px;
  font-size: 10px;
}
.schedule-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.schedule-title {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}
.schedule-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.schedule-copy > small {
  margin-top: 6px;
  color: var(--muted);
}

.studio-panel {
  color: #f4fbfc;
  background:
    radial-gradient(
      circle at 100% 0,
      rgba(133, 212, 216, 0.2),
      transparent 32%
    ),
    #183f52;
}
.studio-panel .panel-header p {
  color: #84d5da;
}
.studio-mark {
  color: #96dfe2;
  font-size: 27px;
}
.course-progress {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 9px;
  margin-bottom: 18px;
}
.course-progress > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
}
.course-progress span {
  display: flex;
  gap: 7px;
  align-items: center;
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
}
.course-progress i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #abc0c8;
}
.course-progress i.published {
  background: #4bd49e;
}
.course-progress i.pending {
  background: #f1bb50;
}
.course-progress i.rejected {
  background: #ec7d85;
}
.no-course-copy {
  color: rgba(255, 255, 255, 0.64);
}
.studio-action {
  display: grid;
  grid-template-columns: 38px 1fr 17px;
  gap: 12px;
  align-items: center;
  width: 100%;
  margin-top: 9px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 15px;
  text-align: left;
  color: #eaf8fa;
  background: rgba(255, 255, 255, 0.07);
  transition: 180ms ease;
}
.studio-action:hover {
  background: rgba(255, 255, 255, 0.13);
  transform: translateY(-2px);
}
.studio-action.accent {
  color: #153f52;
  background: #a9e2e3;
}
.studio-action > svg:first-child {
  width: 25px;
}
.studio-action > svg:last-child {
  width: 16px;
}
.studio-action span {
  display: flex;
  flex-direction: column;
}
.studio-action small {
  margin-top: 3px;
  color: inherit;
  opacity: 0.66;
  font-size: 10px;
}

@media (max-width: 1280px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .welcome-panel {
    grid-template-columns: 1fr;
    padding: 38px 30px;
  }
  .teacher-portrait {
    display: none;
  }
}
</style>
