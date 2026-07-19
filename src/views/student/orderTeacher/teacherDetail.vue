<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Calendar,
  Check,
  Medal,
  School,
  Star
} from '@element-plus/icons-vue'

import { createAppointment, getTeacher, getTeachers } from '@/api/platform'

const route = useRoute()
const router = useRouter()
const teacher = ref(null)
const loading = ref(false)
const loadError = ref('')
const bookingVisible = ref(false)
const submitting = ref(false)

const tomorrowMorning = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(10, 0, 0, 0)
  return date
}

const form = reactive({
  courseId: '',
  topic: '',
  message: '',
  scheduledStart: tomorrowMorning(),
  durationMinutes: 60
})

const teacherId = computed(() =>
  typeof route.query.teacherId === 'string' ? route.query.teacherId : ''
)

const money = (cents) =>
  cents ? `¥${(cents / 100).toFixed(0)}/课时` : '价格面议'

const errorMessage = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const loadTeacher = async () => {
  loading.value = true
  loadError.value = ''

  try {
    if (teacherId.value) {
      teacher.value = await getTeacher(teacherId.value)
    } else {
      const result = await getTeachers({ page: 1, pageSize: 1 })
      const firstTeacher = result?.items?.[0]
      if (!firstTeacher) throw new Error('当前没有可预约教师')
      teacher.value = await getTeacher(firstTeacher.id)
    }
    form.courseId = teacher.value.courses?.[0]?.id || ''
  } catch (error) {
    loadError.value = errorMessage(error, '教师资料加载失败')
  } finally {
    loading.value = false
  }
}

const openBooking = () => {
  form.topic = teacher.value.courses?.[0]?.title || '一对一中文练习'
  form.message = ''
  form.scheduledStart = tomorrowMorning()
  form.durationMinutes = 60
  bookingVisible.value = true
}

const bookCourse = (course) => {
  form.courseId = course.id
  form.topic = course.title
  form.scheduledStart = tomorrowMorning()
  bookingVisible.value = true
}

const disabledDate = (date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const lastDay = new Date()
  lastDay.setDate(lastDay.getDate() + 366)
  return date < today || date > lastDay
}

const submitBooking = async () => {
  if (!form.topic.trim()) {
    ElMessage.warning('请填写本次预约的学习主题')
    return
  }

  const scheduledStart = new Date(form.scheduledStart)
  if (
    !Number.isFinite(scheduledStart.getTime()) ||
    scheduledStart <= new Date()
  ) {
    ElMessage.warning('请选择晚于当前时间的预约时段')
    return
  }

  submitting.value = true
  try {
    const appointment = await createAppointment({
      teacherId: teacher.value.id,
      courseId: form.courseId || null,
      topic: form.topic.trim(),
      message: form.message.trim(),
      scheduledStart: scheduledStart.toISOString(),
      durationMinutes: form.durationMinutes
    })
    bookingVisible.value = false
    ElMessage.success('预约已提交，等待教师确认')
    router.push({
      name: 'studentHome',
      query: { appointmentId: appointment.id }
    })
  } catch (error) {
    ElMessage.error(errorMessage(error, '预约提交失败'))
  } finally {
    submitting.value = false
  }
}

onMounted(loadTeacher)
</script>

<template>
  <section class="detail-page">
    <button
      type="button"
      class="back-button"
      @click="router.push({ name: 'orderTeacher' })"
    >
      <el-icon><ArrowLeft /></el-icon>
      返回教师列表
    </button>

    <el-skeleton v-if="loading" animated :rows="10" class="detail-shell" />

    <el-result
      v-else-if="loadError"
      icon="error"
      title="教师资料无法加载"
      :sub-title="loadError"
    >
      <template #extra>
        <el-button type="primary" @click="loadTeacher">重新加载</el-button>
      </template>
    </el-result>

    <template v-else-if="teacher">
      <header class="profile-hero">
        <div class="profile-avatar">
          <img
            v-if="teacher.avatarUrl"
            :src="teacher.avatarUrl"
            :alt="teacher.displayName"
          />
          <span v-else>{{ teacher.displayName.slice(0, 1) }}</span>
          <i v-if="teacher.verified"><Check /></i>
        </div>
        <div class="profile-copy">
          <div class="name-row">
            <h1>{{ teacher.displayName }}</h1>
            <el-tag v-if="teacher.verified" type="success" effect="dark" round>
              平台认证
            </el-tag>
          </div>
          <p>{{ teacher.title || '国际中文教师' }}</p>
          <div class="school-row">
            <span
              ><el-icon><School /></el-icon
              >{{ teacher.school || '独立教育者' }}</span
            >
            <span
              ><el-icon><Star /></el-icon
              >{{ teacher.rating.toFixed(1) }} 评分</span
            >
            <span
              ><el-icon><Medal /></el-icon
              >{{ teacher.experienceYears }} 年经验</span
            >
          </div>
        </div>
        <aside class="booking-card">
          <small>参考课时费</small>
          <strong>{{ money(teacher.hourlyRateCents) }}</strong>
          <span>预约申请由教师确认后生成课堂</span>
          <el-button
            type="primary"
            size="large"
            :icon="Calendar"
            @click="openBooking"
          >
            发起预约
          </el-button>
        </aside>
      </header>

      <main class="content-grid">
        <div class="main-column">
          <section class="content-card">
            <p class="section-label">ABOUT</p>
            <h2>教师介绍</h2>
            <p class="bio">{{ teacher.bio || '这位教师正在完善个人介绍。' }}</p>
          </section>

          <section class="content-card">
            <p class="section-label">COURSES</p>
            <h2>已通过审核的课程</h2>
            <div v-if="teacher.courses.length" class="course-list">
              <article v-for="course in teacher.courses" :key="course.id">
                <div class="course-initial">{{ course.title.slice(0, 1) }}</div>
                <div>
                  <h3>{{ course.title }}</h3>
                  <p>{{ course.summary }}</p>
                  <small>
                    {{ course.category }} · {{ course.durationMinutes }} 分钟 ·
                    ¥{{ (course.priceCents / 100).toFixed(0) }}
                  </small>
                </div>
                <el-button text type="primary" @click="bookCourse(course)">
                  预约此课
                </el-button>
              </article>
            </div>
            <el-empty
              v-else
              description="教师暂时没有已发布课程，仍可预约自定义主题"
            />
          </section>
        </div>

        <aside class="side-column">
          <section class="content-card">
            <p class="section-label">SPECIALTIES</p>
            <h2>擅长方向</h2>
            <div class="tag-cloud">
              <el-tag
                v-for="item in teacher.specialties"
                :key="item"
                effect="plain"
                round
              >
                {{ item }}
              </el-tag>
              <span v-if="teacher.specialties.length === 0">综合中文教学</span>
            </div>
          </section>
          <section class="content-card">
            <p class="section-label">CERTIFICATES</p>
            <h2>资质证书</h2>
            <ul v-if="teacher.certificates.length">
              <li v-for="item in teacher.certificates" :key="item">
                <el-icon><Check /></el-icon>{{ item }}
              </li>
            </ul>
            <p v-else class="muted">暂无公开证书信息</p>
          </section>
          <section class="content-card">
            <p class="section-label">STYLE & LANGUAGES</p>
            <h2>教学方式</h2>
            <p class="muted">
              {{ teacher.teachingStyle.join(' · ') || '因材施教' }}
            </p>
            <p class="muted">
              授课语言：{{ teacher.languages.join('、') || '中文' }}
            </p>
          </section>
        </aside>
      </main>
    </template>

    <el-dialog
      v-model="bookingVisible"
      title="预约一对一中文课"
      width="min(560px, 94vw)"
    >
      <el-form label-position="top">
        <el-form-item label="关联课程（可选）">
          <el-select
            v-model="form.courseId"
            clearable
            placeholder="自定义主题，不关联课程"
          >
            <el-option
              v-for="course in teacher?.courses || []"
              :key="course.id"
              :label="course.title"
              :value="course.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="学习主题" required>
          <el-input v-model="form.topic" maxlength="160" show-word-limit />
        </el-form-item>
        <div class="form-row">
          <el-form-item label="预约时间" required>
            <el-date-picker
              v-model="form.scheduledStart"
              type="datetime"
              :disabled-date="disabledDate"
              format="YYYY-MM-DD HH:mm"
              placeholder="选择日期与时间"
            />
          </el-form-item>
          <el-form-item label="课时长度">
            <el-select v-model="form.durationMinutes">
              <el-option label="30 分钟" :value="30" />
              <el-option label="45 分钟" :value="45" />
              <el-option label="60 分钟" :value="60" />
              <el-option label="90 分钟" :value="90" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="给老师的留言">
          <el-input
            v-model="form.message"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            placeholder="例如：希望重点练习发音，并准备一次面试自我介绍。"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bookingVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitBooking">
          提交预约
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.detail-page {
  min-height: calc(100vh - 120px);
  padding: 24px 30px 40px;
  color: #193753;
  background: #f7fafc;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 18px;
  padding: 8px 0;
  border: 0;
  color: #34799c;
  background: transparent;
  cursor: pointer;
}

.detail-shell,
.profile-hero,
.content-card {
  border: 1px solid #e1ebf0;
  border-radius: 22px;
  background: white;
  box-shadow: 0 13px 35px rgba(39, 75, 99, 0.07);
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 30px;
  background:
    radial-gradient(
      circle at 80% 20%,
      rgba(104, 199, 192, 0.18),
      transparent 28%
    ),
    white;
}

.profile-avatar {
  position: relative;
  display: grid;
  width: 112px;
  height: 112px;
  flex: none;
  border-radius: 32px;
  color: white;
  font-size: 40px;
  font-weight: 800;
  place-items: center;
  background: linear-gradient(145deg, #237ca6, #6bc5bd);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.profile-avatar i {
  position: absolute;
  right: -6px;
  bottom: -6px;
  display: grid;
  width: 34px;
  height: 34px;
  border: 4px solid white;
  border-radius: 50%;
  place-items: center;
  background: #27a66f;
}

.profile-avatar svg {
  width: 17px;
}

.profile-copy {
  min-width: 0;
  flex: 1;
}

.name-row,
.school-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.name-row h1 {
  margin: 0;
  font-size: 34px;
}

.profile-copy > p {
  margin: 6px 0 14px;
  color: #668093;
  font-size: 18px;
}

.school-row {
  gap: 16px;
  color: #718797;
  font-size: 13px;
}

.school-row span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.booking-card {
  display: flex;
  width: 220px;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border-radius: 18px;
  background: #eff7fa;
}

.booking-card small,
.booking-card span {
  color: #6f8798;
}

.booking-card strong {
  color: #d6743a;
  font-size: 26px;
}

.booking-card span {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.8fr);
  gap: 20px;
  margin-top: 20px;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.content-card {
  padding: 24px;
}

.section-label {
  margin: 0 0 5px;
  color: #3383a6;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.2em;
}

.content-card h2 {
  margin: 0 0 15px;
  font-size: 20px;
}

.bio,
.muted {
  color: #667e90;
  line-height: 1.8;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.course-list article {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: 13px;
  padding: 14px;
  border: 1px solid #e5edf2;
  border-radius: 15px;
}

.course-initial {
  display: grid;
  width: 48px;
  height: 48px;
  border-radius: 13px;
  color: white;
  font-weight: 800;
  place-items: center;
  background: linear-gradient(140deg, #2683aa, #67c0ba);
}

.course-list h3,
.course-list p {
  margin: 0;
}

.course-list p {
  margin-top: 4px;
  color: #6c8292;
  font-size: 13px;
}

.course-list small {
  display: block;
  margin-top: 7px;
  color: #8a9aa6;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.content-card ul {
  display: flex;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 10px;
  list-style: none;
}

.content-card li {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #5d778a;
}

.content-card li .el-icon {
  color: #27a66f;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 160px;
  gap: 14px;
}

@media (max-width: 900px) {
  .profile-hero {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .booking-card {
    width: 100%;
  }

  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .detail-page {
    padding: 15px;
  }

  .profile-hero {
    padding: 20px;
  }

  .profile-avatar {
    width: 82px;
    height: 82px;
    border-radius: 24px;
  }

  .name-row h1 {
    font-size: 26px;
  }

  .course-list article,
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
