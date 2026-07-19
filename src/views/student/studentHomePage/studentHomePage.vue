<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Calendar,
  ChatLineRound,
  CircleCheck,
  Clock,
  Reading,
  Refresh,
  User
} from '@element-plus/icons-vue'

import { cancelAppointment, getAppointments, getCourses } from '@/api/platform'
import { useUserStore } from '@/stores'

const router = useRouter()
const userStore = useUserStore()
const appointments = ref([])
const recommendedCourses = ref([])
const loading = ref(false)
const loadError = ref('')
const cancellingId = ref(null)

const profile = computed(() => userStore.profile || {})
const firstName = computed(() => profile.value.displayName || '同学')

const statusMeta = {
  pending: { label: '等待教师确认', type: 'warning' },
  accepted: { label: '已确认', type: 'success' },
  rejected: { label: '教师未接受', type: 'danger' },
  cancelled: { label: '已取消', type: 'info' },
  completed: { label: '已完成', type: '' }
}

const stats = computed(() => [
  {
    label: '待确认预约',
    value: appointments.value.filter((item) => item.status === 'pending')
      .length,
    icon: Clock,
    tone: 'amber'
  },
  {
    label: '已确认课堂',
    value: appointments.value.filter((item) => item.status === 'accepted')
      .length,
    icon: Calendar,
    tone: 'blue'
  },
  {
    label: '已完成学习',
    value: appointments.value.filter((item) => item.status === 'completed')
      .length,
    icon: CircleCheck,
    tone: 'green'
  },
  {
    label: '中文水平',
    value: profile.value.chineseLevel || '待评估',
    icon: Reading,
    tone: 'violet'
  }
])

const upcomingAppointments = computed(() =>
  appointments.value
    .filter((item) => ['pending', 'accepted'].includes(item.status))
    .sort(
      (left, right) =>
        Date.parse(left.scheduledStart) - Date.parse(right.scheduledStart)
    )
)

const formatTime = (value) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))

const errorMessage = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const loadDashboard = async () => {
  loading.value = true
  loadError.value = ''

  try {
    const [appointmentResult, courseResult] = await Promise.all([
      getAppointments({ page: 1, pageSize: 20 }),
      getCourses({ page: 1, pageSize: 3 })
    ])
    appointments.value = appointmentResult?.items ?? []
    recommendedCourses.value = courseResult?.items ?? []
  } catch (error) {
    loadError.value = errorMessage(error, '学习数据加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const cancelBooking = async (appointment) => {
  try {
    await ElMessageBox.confirm(
      `确定取消“${appointment.topic}”的预约吗？`,
      '取消预约',
      {
        type: 'warning',
        confirmButtonText: '确认取消',
        cancelButtonText: '保留预约'
      }
    )
  } catch {
    return
  }

  cancellingId.value = appointment.id
  try {
    await cancelAppointment(appointment.id)
    ElMessage.success('预约已取消')
    await loadDashboard()
  } catch (error) {
    ElMessage.error(errorMessage(error, '取消预约失败'))
  } finally {
    cancellingId.value = null
  }
}

const enterClassroom = (appointment) => {
  router.push({
    name: 'liveClass',
    query: { classroomId: appointment.classroom.id }
  })
}

onMounted(loadDashboard)
</script>

<template>
  <section class="dashboard-page">
    <header class="welcome-panel">
      <div>
        <p>LEARNING DASHBOARD</p>
        <h1>{{ firstName }}，今天也一起说中文吧</h1>
        <span
          >你的预约、课堂与课程进度都来自平台实时数据，刷新页面也不会丢失。</span
        >
        <div class="welcome-actions">
          <el-button
            type="primary"
            size="large"
            @click="router.push({ name: 'orderTeacher' })"
          >
            预约中文老师
          </el-button>
          <el-button
            size="large"
            @click="router.push({ name: 'onlineCourse' })"
          >
            浏览在线课程
          </el-button>
        </div>
      </div>
      <div class="welcome-mark">你好</div>
    </header>

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

    <div class="stat-grid" v-loading="loading">
      <article
        v-for="item in stats"
        :key="item.label"
        :class="['stat-card', item.tone]"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <div>
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </div>
      </article>
    </div>

    <main class="dashboard-grid">
      <section class="panel appointment-panel">
        <header class="panel-header">
          <div>
            <p>UPCOMING</p>
            <h2>接下来的学习安排</h2>
          </div>
          <el-button
            text
            type="primary"
            @click="router.push({ name: 'orderTeacher' })"
          >
            新建预约
          </el-button>
        </header>

        <div v-if="upcomingAppointments.length" class="appointment-list">
          <article
            v-for="appointment in upcomingAppointments"
            :key="appointment.id"
          >
            <div class="date-tile">
              <strong>{{
                new Date(appointment.scheduledStart).getDate()
              }}</strong>
              <span
                >{{
                  new Date(appointment.scheduledStart).getMonth() + 1
                }}
                月</span
              >
            </div>
            <div class="appointment-copy">
              <div>
                <h3>{{ appointment.topic }}</h3>
                <el-tag
                  :type="statusMeta[appointment.status]?.type"
                  size="small"
                >
                  {{ statusMeta[appointment.status]?.label }}
                </el-tag>
              </div>
              <p>
                <el-icon><User /></el-icon>
                {{ appointment.teacher.displayName }}
                <span>·</span>
                {{ formatTime(appointment.scheduledStart) }}
                <span>·</span>
                {{ appointment.durationMinutes }} 分钟
              </p>
            </div>
            <div class="appointment-actions">
              <el-button
                v-if="
                  appointment.status === 'accepted' && appointment.classroom
                "
                type="primary"
                @click="enterClassroom(appointment)"
              >
                进入课堂
              </el-button>
              <el-button
                plain
                :loading="cancellingId === appointment.id"
                @click="cancelBooking(appointment)"
              >
                取消
              </el-button>
            </div>
          </article>
        </div>
        <el-empty v-else description="当前没有待处理或已确认的预约">
          <el-button
            type="primary"
            @click="router.push({ name: 'orderTeacher' })"
          >
            找一位老师
          </el-button>
        </el-empty>
      </section>

      <aside class="panel quick-panel">
        <header class="panel-header">
          <div>
            <p>QUICK START</p>
            <h2>继续学习</h2>
          </div>
        </header>
        <button type="button" @click="router.push({ name: 'homeWork' })">
          <span class="quick-icon homework"><Reading /></span>
          <span
            ><strong>完成课程作业</strong
            ><small>提交后等待教师批阅</small></span
          >
          <i>→</i>
        </button>
        <button type="button" @click="router.push({ name: 'chatTurn' })">
          <span class="quick-icon chat"><ChatLineRound /></span>
          <span
            ><strong>练习情景话轮</strong
            ><small>本地服务也能稳定生成</small></span
          >
          <i>→</i>
        </button>
        <button type="button" @click="router.push({ name: 'digitalHuman' })">
          <span class="quick-icon tutor"><User /></span>
          <span
            ><strong>数字人跟读</strong
            ><small>支持浏览器语音朗读降级</small></span
          >
          <i>→</i>
        </button>
      </aside>
    </main>

    <section class="panel course-panel">
      <header class="panel-header">
        <div>
          <p>RECOMMENDED</p>
          <h2>通过平台审核的课程</h2>
        </div>
        <el-button
          text
          type="primary"
          @click="router.push({ name: 'onlineCourse' })"
        >
          查看全部
        </el-button>
      </header>
      <div class="course-row">
        <article v-for="course in recommendedCourses" :key="course.id">
          <div class="course-cover">{{ course.title.slice(0, 1) }}</div>
          <div>
            <el-tag size="small" effect="plain">{{ course.category }}</el-tag>
            <h3>{{ course.title }}</h3>
            <p>{{ course.summary }}</p>
            <small
              >{{ course.teacher.displayName }} ·
              {{ course.durationMinutes }} 分钟</small
            >
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.dashboard-page {
  min-height: calc(100vh - 120px);
  padding: 26px;
  color: #193653;
  background: #f6fafc;
}

.welcome-panel {
  position: relative;
  display: flex;
  min-height: 250px;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  padding: 34px 42px;
  border-radius: 26px;
  color: white;
  background:
    radial-gradient(
      circle at 82% 20%,
      rgba(255, 255, 255, 0.18),
      transparent 20%
    ),
    linear-gradient(125deg, #174669, #217ca1 62%, #5cb8b5);
  box-shadow: 0 20px 48px rgba(23, 70, 105, 0.2);
}

.welcome-panel p,
.panel-header p {
  margin: 0 0 7px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.2em;
  opacity: 0.72;
}

.welcome-panel h1 {
  max-width: 680px;
  margin: 0;
  font-size: clamp(28px, 3.5vw, 44px);
  line-height: 1.25;
}

.welcome-panel > div > span {
  display: block;
  max-width: 650px;
  margin-top: 12px;
  line-height: 1.7;
  opacity: 0.8;
}

.welcome-actions {
  display: flex;
  gap: 10px;
  margin-top: 22px;
}

.welcome-mark {
  flex: none;
  padding-right: 4vw;
  font-family: serif;
  font-size: clamp(70px, 11vw, 150px);
  font-weight: 900;
  line-height: 1;
  opacity: 0.12;
  transform: rotate(-7deg);
}

.load-alert {
  margin-top: 18px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin: 20px 0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid #e3ebf0;
  border-radius: 18px;
  background: white;
  box-shadow: 0 10px 25px rgba(41, 76, 97, 0.06);
}

.stat-card > .el-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex: none;
  border-radius: 14px;
  place-items: center;
}

.stat-card strong,
.stat-card span {
  display: block;
}

.stat-card strong {
  font-size: 24px;
}

.stat-card span {
  margin-top: 3px;
  color: #758998;
  font-size: 12px;
}

.stat-card.amber > .el-icon {
  color: #b66f1b;
  background: #fff2d9;
}
.stat-card.blue > .el-icon {
  color: #277ba4;
  background: #e5f4fb;
}
.stat-card.green > .el-icon {
  color: #25855d;
  background: #e3f6ed;
}
.stat-card.violet > .el-icon {
  color: #6a5ba8;
  background: #eeebfb;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.7fr);
  gap: 20px;
}

.panel {
  padding: 22px;
  border: 1px solid #e2ebf0;
  border-radius: 21px;
  background: white;
  box-shadow: 0 12px 30px rgba(40, 78, 101, 0.06);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.panel-header p {
  color: #317b9d;
}

.panel-header h2 {
  margin: 0;
  font-size: 21px;
}

.appointment-list {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.appointment-list article {
  display: grid;
  grid-template-columns: 58px 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 13px;
  border: 1px solid #e6edf1;
  border-radius: 15px;
}

.date-tile {
  display: grid;
  width: 58px;
  height: 58px;
  border-radius: 14px;
  place-content: center;
  text-align: center;
  background: #eaf5f9;
}

.date-tile strong {
  color: #276d8c;
  font-size: 22px;
  line-height: 1;
}

.date-tile span {
  margin-top: 3px;
  color: #79909e;
  font-size: 11px;
}

.appointment-copy > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.appointment-copy h3,
.appointment-copy p {
  margin: 0;
}

.appointment-copy h3 {
  font-size: 16px;
}

.appointment-copy p {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
  color: #778b99;
  font-size: 12px;
}

.appointment-actions {
  display: flex;
  gap: 7px;
}

.quick-panel {
  display: flex;
  flex-direction: column;
}

.quick-panel button {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 11px;
  padding: 13px 0;
  border: 0;
  border-bottom: 1px solid #e9eff2;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.quick-panel button:last-child {
  border-bottom: 0;
}

.quick-icon {
  display: grid;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  place-items: center;
}

.quick-icon svg {
  width: 20px;
}
.quick-icon.homework {
  color: #24759c;
  background: #e4f3fa;
}
.quick-icon.chat {
  color: #7b5aaf;
  background: #f0ebfb;
}
.quick-icon.tutor {
  color: #b26b24;
  background: #fff0dc;
}

.quick-panel strong,
.quick-panel small {
  display: block;
}

.quick-panel small {
  margin-top: 4px;
  color: #82939f;
}

.quick-panel i {
  color: #7e95a2;
  font-style: normal;
}

.course-panel {
  margin-top: 20px;
}

.course-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.course-row article {
  display: grid;
  grid-template-columns: 74px 1fr;
  gap: 13px;
  padding: 13px;
  border: 1px solid #e5edf1;
  border-radius: 15px;
}

.course-cover {
  display: grid;
  height: 74px;
  border-radius: 13px;
  color: white;
  font-size: 27px;
  font-weight: 800;
  place-items: center;
  background: linear-gradient(140deg, #247da4, #64beb8);
}

.course-row h3,
.course-row p {
  margin: 0;
}

.course-row h3 {
  margin-top: 7px;
  font-size: 15px;
}

.course-row p {
  display: -webkit-box;
  margin-top: 4px;
  overflow: hidden;
  color: #718695;
  font-size: 12px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.course-row small {
  display: block;
  margin-top: 6px;
  color: #8a9aa5;
}

@media (max-width: 1050px) {
  .stat-grid,
  .course-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .dashboard-page {
    padding: 14px;
  }

  .welcome-panel {
    padding: 25px;
  }

  .welcome-mark {
    display: none;
  }

  .welcome-actions,
  .appointment-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .stat-grid,
  .course-row {
    grid-template-columns: 1fr;
  }

  .appointment-list article {
    grid-template-columns: 52px 1fr;
  }

  .appointment-actions {
    grid-column: 1 / -1;
  }
}
</style>
