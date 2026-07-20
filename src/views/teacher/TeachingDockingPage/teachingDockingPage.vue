<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import {
  Calendar,
  Check,
  Clock,
  Connection,
  CopyDocument,
  Refresh,
  UserFilled,
  VideoCamera
} from '@element-plus/icons-vue'

import {
  getAppointments,
  getClassroomJoinInfo,
  respondToAppointment
} from '@/api/platform'

const router = useRouter()

const statusOptions = [
  { label: '全部预约', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '已确认', value: 'accepted' },
  { label: '已完成', value: 'completed' },
  { label: '未成行', value: 'inactive' }
]

const statusMeta = {
  pending: { label: '等待处理', type: 'warning', className: 'status-pending' },
  accepted: { label: '已确认', type: 'success', className: 'status-accepted' },
  completed: { label: '已完成', type: '', className: 'status-completed' },
  rejected: { label: '已婉拒', type: 'danger', className: 'status-rejected' },
  cancelled: { label: '已取消', type: 'info', className: 'status-cancelled' }
}

const appointments = ref([])
const activeStatus = ref('')
const loading = ref(false)
const loadError = ref('')
const actionLoading = ref(false)
const responseDialogVisible = ref(false)
const responseAction = ref('accept')
const selectedAppointment = ref(null)
const responseNote = ref('')
const classroomDialogVisible = ref(false)
const classroomLoadingId = ref('')
const classroomInfo = ref(null)

const getStatusMeta = (status) =>
  statusMeta[status] || {
    label: status || '未知状态',
    type: 'info',
    className: 'status-cancelled'
  }

const statusCount = (status) => {
  if (!status) return appointments.value.length
  if (status === 'inactive') {
    return appointments.value.filter((item) =>
      ['rejected', 'cancelled'].includes(item.status)
    ).length
  }
  return appointments.value.filter((item) => item.status === status).length
}

const filteredAppointments = computed(() => {
  const matches = appointments.value.filter((item) => {
    if (!activeStatus.value) return true
    if (activeStatus.value === 'inactive') {
      return ['rejected', 'cancelled'].includes(item.status)
    }
    return item.status === activeStatus.value
  })

  const priority = {
    pending: 0,
    accepted: 1,
    completed: 2,
    rejected: 3,
    cancelled: 4
  }
  return [...matches].sort((left, right) => {
    const statusOrder =
      (priority[left.status] ?? 9) - (priority[right.status] ?? 9)
    if (statusOrder !== 0) return statusOrder
    return Date.parse(left.scheduledStart) - Date.parse(right.scheduledStart)
  })
})

const pendingCount = computed(() => statusCount('pending'))
const nextConfirmed = computed(
  () =>
    appointments.value
      .filter((item) => item.status === 'accepted')
      .sort(
        (left, right) =>
          Date.parse(left.scheduledStart) - Date.parse(right.scheduledStart)
      )[0]
)

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间待确认'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(date)
}

const formatTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
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

const avatarText = (name) =>
  String(name || '学')
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
    loadError.value = errorText(error, '预约数据加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const openResponseDialog = (appointment, action) => {
  selectedAppointment.value = appointment
  responseAction.value = action
  responseNote.value = ''
  responseDialogVisible.value = true
}

const submitResponse = async () => {
  if (!selectedAppointment.value) return
  if (
    responseAction.value === 'reject' &&
    responseNote.value.trim().length < 2
  ) {
    ElMessage.warning('请为学生留下一句简短说明')
    return
  }

  actionLoading.value = true
  try {
    const updated = await respondToAppointment(selectedAppointment.value.id, {
      action: responseAction.value,
      note: responseNote.value.trim()
    })
    const index = appointments.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) appointments.value.splice(index, 1, updated)
    responseDialogVisible.value = false
    ElMessage.success(
      responseAction.value === 'accept'
        ? '预约已确认，专属课堂已创建'
        : '已将处理结果通知学生'
    )
  } catch (error) {
    ElMessage.error(errorText(error, '预约处理失败，请稍后重试'))
  } finally {
    actionLoading.value = false
  }
}

const enterClassroom = async (appointment) => {
  if (!appointment.classroom?.id) {
    ElMessage.warning('课堂尚未创建')
    return
  }

  classroomLoadingId.value = appointment.id
  try {
    classroomInfo.value = {
      ...(await getClassroomJoinInfo(appointment.classroom.id)),
      appointment
    }
    classroomDialogVisible.value = true
  } catch (error) {
    ElMessage.error(errorText(error, '课堂加入信息获取失败'))
  } finally {
    classroomLoadingId.value = ''
  }
}

const copyRoomCode = async () => {
  try {
    await navigator.clipboard.writeText(classroomInfo.value?.roomCode || '')
    ElMessage.success('课堂口令已复制')
  } catch {
    ElMessage.warning('复制失败，请手动复制课堂口令')
  }
}

const goToClassroom = () => {
  if (!classroomInfo.value?.classroomId) return
  classroomDialogVisible.value = false
  router.push({
    name: 'teacherLiveClass',
    query: { classroomId: classroomInfo.value.classroomId }
  })
}

onMounted(loadAppointments)
</script>

<template>
  <main class="docking-page mt-36 mx-auto">
    <section class="docking-hero">
      <div class="hero-copy">
        <p class="eyebrow">TEACHING APPOINTMENTS · 授课对接</p>
        <h1>每一次确认，都是一堂好课的开场。</h1>
        <p>
          在这里处理学生预约、核对学习诉求，并进入系统为双方创建的专属课堂。
        </p>
      </div>
      <div class="hero-summary">
        <span class="summary-kicker">TODAY'S FOCUS</span>
        <strong>{{ pendingCount }}</strong>
        <small>个申请等待你的答复</small>
        <div v-if="nextConfirmed" class="next-class">
          <Calendar />
          <span>
            下一堂课
            <b>{{ formatDateTime(nextConfirmed.scheduledStart) }}</b>
          </span>
        </div>
      </div>
    </section>

    <section class="workspace-panel">
      <header class="workspace-header">
        <div class="status-tabs" role="tablist" aria-label="预约状态筛选">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            type="button"
            :class="['status-tab', { active: activeStatus === option.value }]"
            @click="activeStatus = option.value"
          >
            {{ option.label }}
            <span>{{ statusCount(option.value) }}</span>
          </button>
        </div>
        <el-button :icon="Refresh" :loading="loading" @click="loadAppointments">
          刷新数据
        </el-button>
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
          <el-button link type="primary" @click="loadAppointments"
            >重新加载</el-button
          >
        </template>
      </el-alert>

      <div v-if="loading" class="appointment-list" aria-label="预约加载中">
        <article
          v-for="item in 3"
          :key="item"
          class="appointment-card skeleton-card"
        >
          <el-skeleton :rows="3" animated />
        </article>
      </div>

      <div v-else-if="filteredAppointments.length" class="appointment-list">
        <article
          v-for="appointment in filteredAppointments"
          :key="appointment.id"
          :class="[
            'appointment-card',
            getStatusMeta(appointment.status).className
          ]"
        >
          <div class="date-block">
            <span>{{ formatDate(appointment.scheduledStart) }}</span>
            <strong>{{ formatTime(appointment.scheduledStart) }}</strong>
            <small>— {{ formatTime(appointment.scheduledEnd) }}</small>
          </div>

          <div class="student-block">
            <el-avatar
              :size="52"
              :src="appointment.student?.avatarUrl || undefined"
            >
              {{ avatarText(appointment.student?.displayName) }}
            </el-avatar>
            <div>
              <span class="section-label">LEARNER</span>
              <strong>{{
                appointment.student?.displayName || '匿名学生'
              }}</strong>
              <small>{{ appointment.durationMinutes }} 分钟 · 在线一对一</small>
            </div>
          </div>

          <div class="lesson-block">
            <div class="lesson-heading">
              <div>
                <span class="section-label">LESSON BRIEF</span>
                <h2>{{ appointment.topic }}</h2>
              </div>
              <el-tag
                :type="getStatusMeta(appointment.status).type"
                effect="light"
              >
                {{ getStatusMeta(appointment.status).label }}
              </el-tag>
            </div>
            <p>{{ appointment.message || '学生暂未补充具体学习诉求。' }}</p>
            <div class="lesson-meta">
              <span v-if="appointment.course">
                <Connection />
                {{ appointment.course.title }}
              </span>
              <span v-if="appointment.classroom">
                <VideoCamera />
                教室 {{ appointment.classroom.roomCode }}
              </span>
              <span v-if="appointment.responseNote">
                <Check />
                回复：{{ appointment.responseNote }}
              </span>
            </div>
          </div>

          <div class="card-actions">
            <template v-if="appointment.status === 'pending'">
              <el-button
                type="primary"
                @click="openResponseDialog(appointment, 'accept')"
              >
                接受预约
              </el-button>
              <el-button
                plain
                @click="openResponseDialog(appointment, 'reject')"
              >
                婉拒
              </el-button>
            </template>
            <el-button
              v-else-if="
                appointment.status === 'accepted' && appointment.classroom
              "
              type="primary"
              :icon="VideoCamera"
              :loading="classroomLoadingId === appointment.id"
              @click="enterClassroom(appointment)"
            >
              进入课堂
            </el-button>
            <span v-else class="resolved-time">
              <Clock />
              更新于 {{ formatDateTime(appointment.updatedAt) }}
            </span>
          </div>
        </article>
      </div>

      <div v-else-if="!loadError" class="empty-state">
        <div class="empty-mark">静</div>
        <h2>这一栏暂时没有预约</h2>
        <p>新的学生申请到来后，会第一时间出现在这里。</p>
        <el-button plain :icon="Refresh" @click="loadAppointments"
          >再次检查</el-button
        >
      </div>
    </section>

    <el-dialog
      v-model="responseDialogVisible"
      width="520px"
      align-center
      destroy-on-close
      class="response-dialog"
      :title="
        responseAction === 'accept' ? '确认接受这次预约' : '说明无法授课的原因'
      "
    >
      <div v-if="selectedAppointment" class="dialog-brief">
        <span>{{ selectedAppointment.student?.displayName }}</span>
        <strong>{{ selectedAppointment.topic }}</strong>
        <small>{{ formatDateTime(selectedAppointment.scheduledStart) }}</small>
      </div>
      <el-input
        v-model="responseNote"
        type="textarea"
        :rows="4"
        maxlength="300"
        show-word-limit
        :placeholder="
          responseAction === 'accept'
            ? '可以告诉学生你会准备哪些课堂材料（选填）'
            : '请留下简短说明，帮助学生重新安排时间'
        "
      />
      <template #footer>
        <el-button @click="responseDialogVisible = false">取消</el-button>
        <el-button
          :type="responseAction === 'accept' ? 'primary' : 'danger'"
          :loading="actionLoading"
          @click="submitResponse"
        >
          {{ responseAction === 'accept' ? '确认并创建课堂' : '确认婉拒' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="classroomDialogVisible"
      width="760px"
      align-center
      destroy-on-close
      class="classroom-dialog"
      title="课堂已授权"
    >
      <section v-if="classroomInfo" class="classroom-pass">
        <div class="room-stage">
          <span class="live-indicator"><i></i> CLASSROOM READY</span>
          <div class="room-seal">课</div>
          <h2>{{ classroomInfo.appointment.topic }}</h2>
          <p>{{ formatDateTime(classroomInfo.appointment.scheduledStart) }}</p>
        </div>
        <div class="room-details">
          <span class="section-label">ROOM ACCESS</span>
          <h3>专属课堂口令</h3>
          <button type="button" class="room-code" @click="copyRoomCode">
            {{ classroomInfo.roomCode }}
            <CopyDocument />
          </button>
          <div class="participant-list">
            <div
              v-for="participant in classroomInfo.participants"
              :key="participant.id"
            >
              <el-avatar :size="38" :src="participant.avatarUrl || undefined">
                {{ avatarText(participant.displayName) }}
              </el-avatar>
              <span>
                <strong>{{ participant.displayName }}</strong>
                <small>{{
                  participant.role === 'teacher' ? '授课教师' : '学习者'
                }}</small>
              </span>
              <UserFilled />
            </div>
          </div>
          <p class="room-note">
            授权已由服务端校验。实时音视频接入后可直接复用此课堂编号。
          </p>
        </div>
      </section>
      <template #footer>
        <el-button type="primary" @click="goToClassroom">
          进入实时课堂
        </el-button>
      </template>
    </el-dialog>
  </main>
</template>

<style scoped>
.docking-page {
  --ink: #18354b;
  --muted: #718393;
  --line: rgba(26, 69, 92, 0.12);
  max-width: 1900px;
  overflow: hidden;
  border-radius: 28px;
  color: var(--ink);
  background: #f4fafb;
  box-shadow: 0 28px 70px rgba(31, 91, 113, 0.14);
}

.docking-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 42px;
  align-items: center;
  min-height: 255px;
  padding: 46px 54px;
  color: #f5fcff;
  background:
    radial-gradient(
      circle at 84% 20%,
      rgba(133, 220, 224, 0.35),
      transparent 24%
    ),
    repeating-linear-gradient(
      135deg,
      transparent 0 24px,
      rgba(255, 255, 255, 0.025) 24px 25px
    ),
    #153f55;
}

.eyebrow,
.summary-kicker,
.section-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.17em;
}

.eyebrow {
  margin: 0 0 14px;
  color: #86dce5;
}
.hero-copy h1 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(34px, 3vw, 52px);
  line-height: 1.15;
}
.hero-copy > p:last-child {
  max-width: 730px;
  margin: 18px 0 0;
  color: rgba(236, 249, 252, 0.72);
  font-size: 15px;
  line-height: 1.8;
}

.hero-summary {
  padding: 24px 26px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
}
.summary-kicker {
  display: block;
  color: #a6e6eb;
}
.hero-summary > strong {
  display: block;
  margin-top: 5px;
  font-family: Georgia, serif;
  font-size: 54px;
  line-height: 1;
}
.hero-summary > small {
  color: rgba(255, 255, 255, 0.68);
}
.next-class {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.13);
}
.next-class svg {
  width: 20px;
}
.next-class span {
  display: flex;
  flex-direction: column;
  font-size: 12px;
}
.next-class b {
  margin-top: 3px;
  font-size: 13px;
}

.workspace-panel {
  padding: 28px 34px 42px;
}
.workspace-header {
  display: flex;
  gap: 22px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.status-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.status-tab {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #587284;
  background: rgba(255, 255, 255, 0.62);
  font-weight: 700;
  transition: 180ms ease;
}
.status-tab span {
  min-width: 22px;
  padding: 2px 6px;
  border-radius: 999px;
  color: #78909d;
  background: #eaf2f4;
  font-size: 11px;
}
.status-tab:hover,
.status-tab.active {
  border-color: rgba(21, 111, 139, 0.22);
  color: #0b6685;
  background: #fff;
  box-shadow: 0 9px 22px rgba(35, 91, 112, 0.1);
}
.status-tab.active span {
  color: #fff;
  background: #167998;
}
.load-alert {
  margin-bottom: 20px;
}

.appointment-list {
  display: grid;
  gap: 14px;
}
.appointment-card {
  position: relative;
  display: grid;
  grid-template-columns: 145px 215px minmax(300px, 1fr) 150px;
  gap: 24px;
  align-items: center;
  overflow: hidden;
  padding: 22px 24px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 28px rgba(29, 80, 99, 0.06);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}
.appointment-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #9db5bf;
  content: '';
}
.appointment-card.status-pending::before {
  background: #efa72f;
}
.appointment-card.status-accepted::before {
  background: #19a271;
}
.appointment-card.status-rejected::before {
  background: #d7656f;
}
.appointment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 34px rgba(29, 80, 99, 0.11);
}
.skeleton-card {
  min-height: 140px;
}

.date-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-right: 18px;
  border-right: 1px solid var(--line);
}
.date-block span {
  color: #4c7889;
  font-size: 12px;
  font-weight: 700;
}
.date-block strong {
  margin: 4px 0 -2px;
  font-family: Georgia, serif;
  font-size: 34px;
}
.date-block small {
  color: #8799a4;
}

.student-block {
  display: flex;
  gap: 12px;
  align-items: center;
}
.student-block > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.section-label {
  color: #6c9aaa;
}
.student-block strong {
  overflow: hidden;
  margin-top: 3px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.student-block small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}

.lesson-block {
  min-width: 0;
}
.lesson-heading {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
}
.lesson-heading h2 {
  margin: 4px 0 0;
  font-size: 19px;
}
.lesson-block > p {
  display: -webkit-box;
  margin: 9px 0 11px;
  overflow: hidden;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.lesson-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.lesson-meta span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  color: #4f7687;
  font-size: 11px;
}
.lesson-meta svg {
  width: 14px;
}
.card-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}
.card-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.resolved-time {
  display: flex;
  gap: 5px;
  align-items: center;
  color: #8999a3;
  font-size: 11px;
}
.resolved-time svg {
  width: 15px;
}

.empty-state {
  display: flex;
  min-height: 330px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(35, 94, 116, 0.23);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.55);
}
.empty-mark {
  display: grid;
  width: 62px;
  height: 62px;
  place-items: center;
  border-radius: 20px;
  color: #176d88;
  background: #d7f0f3;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 26px;
  font-weight: 800;
}
.empty-state h2 {
  margin: 18px 0 4px;
}
.empty-state p {
  margin: 0 0 20px;
  color: var(--muted);
}

.dialog-brief {
  display: flex;
  flex-direction: column;
  margin-bottom: 18px;
  padding: 15px 17px;
  border-radius: 14px;
  color: #315468;
  background: #eff7f8;
}
.dialog-brief span {
  color: #6b8997;
  font-size: 12px;
}
.dialog-brief strong {
  margin: 4px 0;
}
.dialog-brief small {
  color: #79909b;
}

.classroom-pass {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  overflow: hidden;
  border-radius: 22px;
  background: #f4f8f8;
}
.room-stage {
  display: flex;
  min-height: 390px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 34px;
  text-align: center;
  color: #f5fbfc;
  background:
    radial-gradient(
      circle at 50% 35%,
      rgba(107, 211, 216, 0.22),
      transparent 28%
    ),
    #143c50;
}
.live-indicator {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  color: #a5e6e7;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.13em;
}
.live-indicator i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #48d69c;
  box-shadow: 0 0 0 5px rgba(72, 214, 156, 0.12);
}
.room-seal {
  display: grid;
  width: 82px;
  height: 82px;
  margin: 30px 0 22px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 26px;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 37px;
  background: rgba(255, 255, 255, 0.08);
}
.room-stage h2 {
  margin: 0;
  font-size: 23px;
}
.room-stage p {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.6);
}
.room-details {
  padding: 38px 34px;
}
.room-details h3 {
  margin: 6px 0 14px;
  font-size: 19px;
}
.room-code {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px dashed rgba(22, 105, 132, 0.35);
  border-radius: 13px;
  color: #125e79;
  background: #e7f5f6;
  font-family: Consolas, monospace;
  font-weight: 700;
}
.room-code svg {
  width: 17px;
}
.participant-list {
  display: grid;
  gap: 9px;
  margin-top: 20px;
}
.participant-list > div {
  display: grid;
  grid-template-columns: 38px 1fr 18px;
  gap: 11px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: #fff;
}
.participant-list span {
  display: flex;
  flex-direction: column;
}
.participant-list small {
  color: var(--muted);
  font-size: 11px;
}
.participant-list svg {
  width: 17px;
  color: #77a1b0;
}
.room-note {
  margin: 18px 0 0;
  color: #788d98;
  font-size: 11px;
  line-height: 1.6;
}

@media (max-width: 1280px) {
  .appointment-card {
    grid-template-columns: 130px 190px minmax(250px, 1fr);
  }
  .card-actions {
    grid-column: 2 / -1;
    flex-direction: row;
    justify-content: flex-end;
  }
}

@media (max-width: 960px) {
  .docking-hero {
    grid-template-columns: 1fr;
  }
  .appointment-card {
    grid-template-columns: 125px 1fr;
  }
  .lesson-block {
    grid-column: 1 / -1;
  }
  .card-actions {
    grid-column: 1 / -1;
  }
}
</style>
