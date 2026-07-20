<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  getAssignment,
  getCourseAssignments,
  getCourses,
  getMySubmissions,
  saveSubmission
} from '@/api/platform'

const route = useRoute()
const router = useRouter()

const courses = ref([])
const assignments = ref([])
const assignment = ref(null)
const answers = ref({})
const selectedCourseId = ref('')
const selectedAssignmentId = ref('')
const activeQuestionId = ref('')

const isBooting = ref(true)
const isLoadingAssignments = ref(false)
const isLoadingAssignment = ref(false)
const isSaving = ref(false)
const isSubmitting = ref(false)
const pageError = ref('')
const assignmentError = ref('')

const routeValue = (value) => (Array.isArray(value) ? value[0] : value)

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const selectedCourse = computed(() =>
  courses.value.find((item) => item.id === selectedCourseId.value)
)

const activeQuestion = computed(() =>
  assignment.value?.questions?.find(
    (question) => question.id === activeQuestionId.value
  )
)

const submission = computed(() => assignment.value?.submission || null)
const isLocked = computed(() =>
  ['submitted', 'graded'].includes(submission.value?.status)
)

const statusMeta = computed(() => {
  const status = submission.value?.status
  if (status === 'graded') {
    return { label: '已批阅', tone: 'graded', note: '教师已完成评分与反馈' }
  }
  if (status === 'submitted') {
    return { label: '待批阅', tone: 'submitted', note: '作业已正式提交' }
  }
  if (status === 'draft') {
    return { label: '云端草稿', tone: 'draft', note: '答案已保存至服务器' }
  }
  return { label: '未开始', tone: 'new', note: '完成后可保存草稿或提交' }
})

const isAnswered = (question) => {
  const answer = answers.value[question.id]
  if (Array.isArray(answer)) return answer.length > 0
  return typeof answer === 'string' && answer.trim().length > 0
}

const completedCount = computed(
  () => assignment.value?.questions?.filter(isAnswered).length || 0
)

const completionPercent = computed(() => {
  const total = assignment.value?.questions?.length || 0
  return total ? Math.round((completedCount.value / total) * 100) : 0
})

const dueLabel = computed(() => {
  if (!assignment.value?.dueAt) return '长期有效'
  return formatDate(assignment.value.dueAt)
})

const normalizeAnswers = (questions, savedAnswers = {}) =>
  Object.fromEntries(
    questions.map((question) => {
      const saved = savedAnswers?.[question.id]
      if (question.type === 'multiple_choice') {
        return [question.id, Array.isArray(saved) ? [...saved] : []]
      }
      return [question.id, typeof saved === 'string' ? saved : '']
    })
  )

const applyAssignment = (data) => {
  assignment.value = data
  selectedAssignmentId.value = data.id
  activeQuestionId.value = data.questions?.[0]?.id || ''
  answers.value = normalizeAnswers(
    data.questions || [],
    data.submission?.answers
  )
}

const syncQuery = () => {
  void router.replace({
    query: {
      ...route.query,
      courseId: selectedCourseId.value || undefined,
      assignmentId: selectedAssignmentId.value || undefined,
      submissionId: undefined
    }
  })
}

const loadAssignment = async (assignmentId, { sync = true } = {}) => {
  if (!assignmentId) {
    assignment.value = null
    return
  }

  isLoadingAssignment.value = true
  assignmentError.value = ''
  try {
    const data = await getAssignment(assignmentId)
    applyAssignment(data)
    selectedCourseId.value = data.courseId || data.course?.id
    if (sync) syncQuery()
  } catch (error) {
    assignment.value = null
    assignmentError.value = getErrorMessage(
      error,
      '作业详情加载失败，请稍后重试'
    )
  } finally {
    isLoadingAssignment.value = false
  }
}

const loadAssignments = async (
  courseId,
  { preferredAssignmentId, selectFirst = true } = {}
) => {
  if (!courseId) {
    assignments.value = []
    assignment.value = null
    return
  }

  isLoadingAssignments.value = true
  assignmentError.value = ''
  try {
    const data = await getCourseAssignments(courseId)
    assignments.value = data?.items || []

    const targetId = assignments.value.some(
      (item) => item.id === preferredAssignmentId
    )
      ? preferredAssignmentId
      : selectFirst
        ? assignments.value[0]?.id
        : ''

    if (targetId) {
      await loadAssignment(targetId)
    } else {
      selectedAssignmentId.value = ''
      assignment.value = null
      syncQuery()
    }
  } catch (error) {
    assignments.value = []
    assignment.value = null
    assignmentError.value = getErrorMessage(
      error,
      '课程作业加载失败，请稍后重试'
    )
  } finally {
    isLoadingAssignments.value = false
  }
}

const initialize = async () => {
  isBooting.value = true
  pageError.value = ''

  try {
    const courseData = await getCourses({ page: 1, pageSize: 100 })
    courses.value = courseData?.items || []

    let queryAssignmentId = routeValue(route.query.assignmentId)
    const querySubmissionId = routeValue(route.query.submissionId)
    if (!queryAssignmentId && querySubmissionId) {
      queryAssignmentId = await locateAssignmentBySubmission(querySubmissionId)
    }
    if (queryAssignmentId) {
      try {
        const detail = await getAssignment(queryAssignmentId)
        selectedCourseId.value = detail.courseId || detail.course?.id
        applyAssignment(detail)
        await loadAssignments(selectedCourseId.value, {
          preferredAssignmentId: detail.id
        })
        return
      } catch {
        // 链接中的作业可能已下架，继续回退到该生可见的首门课程。
      }
    }

    const queryCourseId = routeValue(route.query.courseId)
    selectedCourseId.value = courses.value.some(
      (item) => item.id === queryCourseId
    )
      ? queryCourseId
      : courses.value[0]?.id || ''

    await loadAssignments(selectedCourseId.value)
  } catch (error) {
    pageError.value = getErrorMessage(error, '学习任务加载失败，请稍后重试')
  } finally {
    isBooting.value = false
  }
}

const handleCourseChange = async () => {
  selectedAssignmentId.value = ''
  assignment.value = null
  await loadAssignments(selectedCourseId.value)
}

const locateAssignmentBySubmission = async (submissionId) => {
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const result = await getMySubmissions({ page, pageSize: 100 })
    const matched = result?.items?.find((item) => item.id === submissionId)
    if (matched) return matched.assignmentId || matched.assignment?.id
    totalPages = result?.pagination?.totalPages || 0
    page += 1
  }

  return ''
}

const selectAssignment = async (item) => {
  if (item.id === selectedAssignmentId.value && assignment.value) return
  await loadAssignment(item.id)
}

const selectQuestion = (questionId) => {
  activeQuestionId.value = questionId
}

const moveQuestion = (offset) => {
  const questions = assignment.value?.questions || []
  const index = questions.findIndex(
    (question) => question.id === activeQuestionId.value
  )
  const next = questions[index + offset]
  if (next) activeQuestionId.value = next.id
}

const handleSave = async () => {
  if (!assignment.value || isLocked.value) return
  isSaving.value = true
  try {
    const saved = await saveSubmission(assignment.value.id, {
      answers: answers.value,
      action: 'save'
    })
    assignment.value = { ...assignment.value, submission: saved }
    const summary = assignments.value.find(
      (item) => item.id === assignment.value.id
    )
    if (summary) summary.submission = saved
    ElMessage.success('草稿已安全保存到服务器')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '草稿保存失败，请稍后重试'))
  } finally {
    isSaving.value = false
  }
}

const handleSubmit = async () => {
  if (!assignment.value || isLocked.value) return
  if (completedCount.value !== assignment.value.questions.length) {
    ElMessage.warning('正式提交前，请完成全部题目')
    return
  }

  try {
    await ElMessageBox.confirm(
      '提交后答案将锁定，不能再次修改。确认提交这份作业吗？',
      '确认正式提交',
      { confirmButtonText: '确认提交', cancelButtonText: '继续检查' }
    )
  } catch {
    return
  }

  isSubmitting.value = true
  try {
    const saved = await saveSubmission(assignment.value.id, {
      answers: answers.value,
      action: 'submit'
    })
    assignment.value = { ...assignment.value, submission: saved }
    const summary = assignments.value.find(
      (item) => item.id === assignment.value.id
    )
    if (summary) summary.submission = saved
    ElMessage.success('作业已提交，教师将收到批阅通知')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '作业提交失败，请稍后重试'))
  } finally {
    isSubmitting.value = false
  }
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const assignmentStateLabel = (item) => {
  if (item.submission?.status === 'graded') return '已批阅'
  if (item.submission?.status === 'submitted') return '待批阅'
  if (item.submission?.status === 'draft') return '草稿'
  return '未开始'
}

const questionTypeLabel = (type) =>
  ({ single_choice: '单选题', multiple_choice: '多选题', text: '文本题' })[
    type
  ] || '题目'

onMounted(initialize)
</script>

<template>
  <main class="homework-desk">
    <section class="desk-header">
      <button
        type="button"
        class="back-button"
        aria-label="返回上一页"
        @click="router.go(-1)"
      >
        ←
      </button>
      <div class="header-copy">
        <p>STUDY DESK · 云端作业本</p>
        <h1>把每一道回答，写进真实学习记录</h1>
      </div>
      <div class="course-picker">
        <label for="homework-course">当前课程</label>
        <el-select
          id="homework-course"
          v-model="selectedCourseId"
          :disabled="isBooting || !courses.length"
          placeholder="选择一门课程"
          @change="handleCourseChange"
        >
          <el-option
            v-for="item in courses"
            :key="item.id"
            :label="item.title"
            :value="item.id"
          />
        </el-select>
      </div>
    </section>

    <section v-if="isBooting" class="state-card">
      <el-skeleton animated :rows="8" />
    </section>

    <section v-else-if="pageError" class="state-card error-state" role="alert">
      <span>!</span>
      <h2>学习任务暂时没有打开</h2>
      <p>{{ pageError }}</p>
      <el-button type="primary" @click="initialize">重新加载</el-button>
    </section>

    <section v-else-if="!courses.length" class="state-card empty-state">
      <span>课</span>
      <h2>还没有可学习的课程</h2>
      <p>课程通过审核并发布后，对应作业会出现在这里。</p>
      <el-button type="primary" @click="router.push({ name: 'onlineCourse' })">
        浏览在线课程
      </el-button>
    </section>

    <section v-else class="desk-layout">
      <aside class="assignment-rail">
        <div class="rail-heading">
          <div>
            <p>ASSIGNMENTS</p>
            <h2>{{ selectedCourse?.title || '课程作业' }}</h2>
          </div>
          <span>{{ assignments.length }}</span>
        </div>

        <div v-if="isLoadingAssignments" class="rail-loading">
          <el-skeleton animated :rows="5" />
        </div>

        <div
          v-else-if="assignmentError && !assignments.length"
          class="rail-error"
        >
          <p>{{ assignmentError }}</p>
          <el-button text @click="loadAssignments(selectedCourseId)">
            重试
          </el-button>
        </div>

        <div v-else-if="!assignments.length" class="rail-empty">
          <strong>本课程暂无作业</strong>
          <span>教师发布学习任务后会自动同步。</span>
        </div>

        <button
          v-for="item in assignments"
          :key="item.id"
          type="button"
          class="assignment-ticket"
          :class="{ active: item.id === selectedAssignmentId }"
          @click="selectAssignment(item)"
        >
          <span class="ticket-index">
            {{ String(assignments.indexOf(item) + 1).padStart(2, '0') }}
          </span>
          <span class="ticket-copy">
            <strong>{{ item.title }}</strong>
            <small>
              {{ item.questionCount }} 题 · {{ item.maxScore }} 分
            </small>
          </span>
          <span class="ticket-state" :data-status="item.submission?.status">
            {{ assignmentStateLabel(item) }}
          </span>
        </button>
      </aside>

      <section class="workbook">
        <div v-if="isLoadingAssignment" class="workbook-loading">
          <el-skeleton animated :rows="11" />
        </div>

        <div v-else-if="assignmentError" class="workbook-state" role="alert">
          <span>!</span>
          <h2>作业详情加载失败</h2>
          <p>{{ assignmentError }}</p>
          <el-button
            v-if="selectedAssignmentId"
            type="primary"
            @click="loadAssignment(selectedAssignmentId)"
          >
            重新加载
          </el-button>
        </div>

        <div v-else-if="!assignment" class="workbook-state">
          <span>习</span>
          <h2>选择一份作业开始学习</h2>
          <p>你的云端草稿、正式提交和教师反馈都会保留在这里。</p>
        </div>

        <template v-else>
          <header class="workbook-header">
            <div>
              <div class="meta-line">
                <span class="submission-chip" :data-tone="statusMeta.tone">
                  {{ statusMeta.label }}
                </span>
                <span>{{ assignment.questionCount }} 道题</span>
                <span>满分 {{ assignment.maxScore }}</span>
                <span>截止 {{ dueLabel }}</span>
              </div>
              <h2>{{ assignment.title }}</h2>
              <p>{{ assignment.instructions || '请认真完成所有题目。' }}</p>
            </div>
            <div class="progress-seal">
              <strong>{{ completionPercent }}%</strong>
              <span
                >{{ completedCount }}/{{ assignment.questionCount }} 完成</span
              >
            </div>
          </header>

          <section v-if="submission?.status === 'graded'" class="feedback-card">
            <div class="score-orb">
              <strong>{{ submission.score }}</strong>
              <span>/ {{ assignment.maxScore }}</span>
            </div>
            <div>
              <p>TEACHER FEEDBACK · 教师反馈</p>
              <h3>{{ submission.feedback || '教师暂未留下文字反馈。' }}</h3>
              <small>批阅于 {{ formatDate(submission.gradedAt) }}</small>
            </div>
          </section>

          <section v-else-if="isLocked" class="locked-note">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>这份作业已正式提交</strong>
              <p>答案已锁定，教师批阅后会在此显示分数与反馈。</p>
            </div>
          </section>

          <section class="answer-layout">
            <nav class="question-map" aria-label="题目导航">
              <p>答题卡</p>
              <button
                v-for="(question, index) in assignment.questions"
                :key="question.id"
                type="button"
                :class="{
                  active: question.id === activeQuestionId,
                  answered: isAnswered(question)
                }"
                :aria-label="`第 ${index + 1} 题${isAnswered(question) ? '，已作答' : ''}`"
                @click="selectQuestion(question.id)"
              >
                {{ index + 1 }}
              </button>
              <div class="map-legend">
                <span><i></i> 已作答</span>
                <span><i></i> 当前题</span>
              </div>
            </nav>

            <article v-if="activeQuestion" class="question-paper">
              <div class="question-heading">
                <div>
                  <span>
                    QUESTION
                    {{ String(activeQuestion.position || 1).padStart(2, '0') }}
                  </span>
                  <em>{{ questionTypeLabel(activeQuestion.type) }}</em>
                </div>
                <strong>{{ activeQuestion.points }} 分</strong>
              </div>
              <h3>{{ activeQuestion.prompt }}</h3>

              <el-radio-group
                v-if="activeQuestion.type === 'single_choice'"
                v-model="answers[activeQuestion.id]"
                :disabled="isLocked"
                class="choice-list"
              >
                <el-radio
                  v-for="(option, index) in activeQuestion.options"
                  :key="option"
                  :value="option"
                  border
                >
                  <b>{{ String.fromCharCode(65 + index) }}</b>
                  {{ option }}
                </el-radio>
              </el-radio-group>

              <el-checkbox-group
                v-else-if="activeQuestion.type === 'multiple_choice'"
                v-model="answers[activeQuestion.id]"
                :disabled="isLocked"
                class="choice-list"
              >
                <el-checkbox
                  v-for="(option, index) in activeQuestion.options"
                  :key="option"
                  :value="option"
                  border
                >
                  <b>{{ String.fromCharCode(65 + index) }}</b>
                  {{ option }}
                </el-checkbox>
              </el-checkbox-group>

              <div v-else class="text-answer">
                <el-input
                  v-model="answers[activeQuestion.id]"
                  type="textarea"
                  :rows="8"
                  maxlength="10000"
                  show-word-limit
                  :disabled="isLocked"
                  placeholder="在这里组织你的中文表达……"
                />
              </div>

              <footer class="question-actions">
                <el-button
                  :disabled="activeQuestion.position <= 1"
                  @click="moveQuestion(-1)"
                >
                  上一题
                </el-button>
                <span>{{ statusMeta.note }}</span>
                <el-button
                  :disabled="
                    activeQuestion.position >= assignment.questions.length
                  "
                  @click="moveQuestion(1)"
                >
                  下一题
                </el-button>
              </footer>
            </article>
          </section>

          <footer class="submit-bar">
            <div>
              <strong>
                {{ isLocked ? '答案已锁定' : '完成后记得正式提交' }}
              </strong>
              <span>
                {{
                  isLocked
                    ? `提交时间：${formatDate(submission.submittedAt)}`
                    : '保存草稿可跨设备继续；正式提交后不可修改。'
                }}
              </span>
            </div>
            <div v-if="!isLocked">
              <el-button
                size="large"
                :loading="isSaving"
                :disabled="isSubmitting"
                @click="handleSave"
              >
                保存云端草稿
              </el-button>
              <el-button
                type="primary"
                size="large"
                :loading="isSubmitting"
                :disabled="isSaving"
                @click="handleSubmit"
              >
                正式提交作业
              </el-button>
            </div>
          </footer>
        </template>
      </section>
    </section>
  </main>
</template>

<style lang="scss" scoped>
.homework-desk {
  --ink: #153a4b;
  --muted: #6c8189;
  min-height: calc(100vh - 120px);
  margin: 120px auto 36px;
  overflow: hidden;
  border: 1px solid rgba(21, 58, 75, 0.08);
  border-radius: 30px;
  color: var(--ink);
  background:
    linear-gradient(rgba(24, 93, 111, 0.035) 1px, transparent 1px), #f4faf9;
  background-size: 100% 28px;
  box-shadow: 0 28px 70px rgba(34, 87, 99, 0.14);
}

.desk-header {
  display: grid;
  grid-template-columns: auto 1fr minmax(250px, 340px);
  align-items: center;
  gap: 22px;
  padding: 34px 42px;
  color: #f4fffd;
  background:
    radial-gradient(
      circle at 82% 10%,
      rgba(163, 229, 213, 0.28),
      transparent 24%
    ),
    linear-gradient(118deg, #153c4d, #236d75);
}

.back-button {
  display: grid;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  place-items: center;
  font-size: 22px;
  transition: 160ms ease;
}
.back-button:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: translateX(-2px);
}

.header-copy p,
.rail-heading p,
.feedback-card p {
  margin: 0 0 7px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
}
.header-copy p {
  color: #9ad4cd;
}
.header-copy h1 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(25px, 2.8vw, 40px);
}

.course-picker label {
  display: block;
  margin-bottom: 7px;
  color: rgba(245, 255, 253, 0.7);
  font-size: 11px;
}
.course-picker :deep(.el-select) {
  width: 100%;
}
.course-picker :deep(.el-select__wrapper) {
  min-height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: none;
}

.state-card,
.workbook-state {
  display: flex;
  min-height: 560px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 52px;
  text-align: center;
}
.state-card > span,
.workbook-state > span {
  display: grid;
  width: 66px;
  height: 66px;
  margin-bottom: 18px;
  border-radius: 20px;
  color: #1d6672;
  background: #ccece6;
  place-items: center;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 28px;
  font-weight: 900;
}
.error-state > span,
.workbook-state[role='alert'] > span {
  color: #9f353e;
  background: #ffe0e2;
}
.state-card h2,
.workbook-state h2 {
  margin: 0;
}
.state-card p,
.workbook-state p {
  margin: 9px 0 22px;
  color: var(--muted);
}

.desk-layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  min-height: 700px;
}

.assignment-rail {
  padding: 28px 20px;
  border-right: 1px solid rgba(22, 74, 86, 0.1);
  background: rgba(228, 243, 240, 0.72);
}
.rail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin: 0 8px 22px;
}
.rail-heading p {
  color: #579398;
}
.rail-heading h2 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 22px;
}
.rail-heading > span {
  display: grid;
  min-width: 31px;
  height: 31px;
  border-radius: 50%;
  color: #fff;
  background: #2b7c82;
  place-items: center;
  font-size: 12px;
  font-weight: 900;
}
.rail-loading,
.rail-error,
.rail-empty {
  padding: 22px 9px;
}
.rail-error p,
.rail-empty span {
  display: block;
  margin: 8px 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.assignment-ticket {
  display: grid;
  width: 100%;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin-bottom: 10px;
  padding: 17px 15px;
  border: 1px solid transparent;
  border-radius: 16px;
  color: var(--ink);
  text-align: left;
  background: rgba(255, 255, 255, 0.8);
  transition: 170ms ease;
}
.assignment-ticket:hover,
.assignment-ticket.active {
  border-color: rgba(36, 119, 126, 0.25);
  background: #fff;
  box-shadow: 0 12px 24px rgba(44, 98, 105, 0.1);
  transform: translateY(-1px);
}
.assignment-ticket.active {
  box-shadow:
    inset 4px 0 #2d8589,
    0 12px 24px rgba(44, 98, 105, 0.1);
}
.ticket-index {
  color: #7aa5a5;
  font-family: Georgia, serif;
  font-size: 13px;
}
.ticket-copy strong,
.ticket-copy small {
  display: block;
}
.ticket-copy strong {
  line-height: 1.35;
}
.ticket-copy small {
  margin-top: 6px;
  color: var(--muted);
  font-size: 11px;
}
.ticket-state {
  grid-column: 2;
  justify-self: start;
  padding: 3px 8px;
  border-radius: 999px;
  color: #657d84;
  background: #eef4f4;
  font-size: 10px;
  font-weight: 800;
}
.ticket-state[data-status='draft'] {
  color: #815b0a;
  background: #fff0c9;
}
.ticket-state[data-status='submitted'] {
  color: #1e6680;
  background: #d9eff8;
}
.ticket-state[data-status='graded'] {
  color: #176747;
  background: #d8f2e5;
}

.workbook {
  min-width: 0;
  background: rgba(255, 255, 255, 0.82);
}
.workbook-loading {
  padding: 48px;
}
.workbook-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 26px;
  padding: 36px 42px 30px;
  border-bottom: 1px solid rgba(25, 77, 90, 0.1);
}
.meta-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px 14px;
  color: #71868e;
  font-size: 11px;
}
.submission-chip {
  padding: 5px 10px;
  border-radius: 999px;
  color: #547179;
  background: #e9f0f0;
  font-weight: 900;
}
.submission-chip[data-tone='draft'] {
  color: #845c08;
  background: #fff0c6;
}
.submission-chip[data-tone='submitted'] {
  color: #17647f;
  background: #d8f0f8;
}
.submission-chip[data-tone='graded'] {
  color: #126744;
  background: #d5f2e3;
}
.workbook-header h2 {
  margin: 13px 0 8px;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(28px, 3vw, 40px);
}
.workbook-header p {
  max-width: 760px;
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
  white-space: pre-wrap;
}
.progress-seal {
  display: grid;
  width: 104px;
  height: 104px;
  flex: 0 0 auto;
  border: 1px solid #a7d3cc;
  border-radius: 50%;
  background: #edfaf6;
  place-content: center;
  text-align: center;
  box-shadow: inset 0 0 0 7px #fff;
}
.progress-seal strong {
  font-family: Georgia, serif;
  font-size: 25px;
}
.progress-seal span {
  color: var(--muted);
  font-size: 10px;
}

.feedback-card,
.locked-note {
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 26px 42px 0;
  padding: 22px 24px;
  border-radius: 18px;
}
.feedback-card {
  color: #194a3a;
  background: linear-gradient(125deg, #dcf5e7, #f4fbec);
}
.score-orb {
  display: grid;
  width: 76px;
  height: 76px;
  flex: 0 0 auto;
  border: 1px solid rgba(25, 101, 72, 0.18);
  border-radius: 50%;
  background: #fff;
  place-content: center;
  text-align: center;
}
.score-orb strong {
  font-family: Georgia, serif;
  font-size: 27px;
}
.score-orb span {
  font-size: 10px;
}
.feedback-card p {
  color: #4b8b70;
}
.feedback-card h3 {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1.55;
}
.feedback-card small {
  color: #6d9382;
}
.locked-note {
  background: #eef7fa;
}
.locked-note > span {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 50%;
  color: #fff;
  background: #3d899c;
  place-items: center;
}
.locked-note strong,
.locked-note p {
  display: block;
  margin: 0;
}
.locked-note p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.answer-layout {
  display: grid;
  grid-template-columns: 142px minmax(0, 1fr);
  gap: 26px;
  padding: 32px 42px 40px;
}
.question-map {
  align-self: start;
  display: grid;
  grid-template-columns: repeat(3, 36px);
  gap: 8px;
}
.question-map > p {
  grid-column: 1 / -1;
  margin: 0 0 5px;
  color: #74898f;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
}
.question-map > button {
  width: 36px;
  height: 36px;
  border: 1px solid #d7e3e2;
  border-radius: 10px;
  color: #60777e;
  background: #fff;
  font-size: 12px;
  transition: 150ms ease;
}
.question-map > button.answered {
  color: #1a665b;
  background: #d9f1ea;
}
.question-map > button.active {
  border-color: #247d84;
  color: #fff;
  background: #247d84;
  transform: translateY(-2px);
}
.map-legend {
  grid-column: 1 / -1;
  margin-top: 12px;
  color: #819299;
  font-size: 10px;
  line-height: 1.9;
}
.map-legend span {
  display: block;
}
.map-legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 3px;
  background: #d9f1ea;
}
.map-legend span:last-child i {
  background: #247d84;
}

.question-paper {
  min-width: 0;
  padding: 32px 36px;
  border: 1px solid rgba(25, 77, 90, 0.1);
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 16px 34px rgba(31, 83, 92, 0.07);
}
.question-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.question-heading span {
  color: #5e9797;
  font-family: Georgia, serif;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.13em;
}
.question-heading em {
  margin-left: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  color: #6f8288;
  background: #eef4f4;
  font-size: 10px;
  font-style: normal;
}
.question-heading > strong {
  color: #2f7480;
  font-size: 12px;
}
.question-paper > h3 {
  margin: 22px 0 28px;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 24px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.choice-list {
  display: grid;
  gap: 12px;
}
.choice-list :deep(.el-radio),
.choice-list :deep(.el-checkbox) {
  width: 100%;
  height: auto;
  min-height: 48px;
  margin: 0;
  padding: 11px 16px;
  border-radius: 12px;
}
.choice-list :deep(.el-radio__label),
.choice-list :deep(.el-checkbox__label) {
  overflow: hidden;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: normal;
}
.choice-list b {
  margin-right: 8px;
  color: #3c7d82;
  font-family: Georgia, serif;
}
.text-answer :deep(.el-textarea__inner) {
  padding: 18px;
  line-height: 1.8;
  background-image: linear-gradient(transparent 31px, #e8efed 32px);
  background-size: 100% 32px;
}
.question-actions {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #eef2f2;
}
.question-actions span {
  color: var(--muted);
  text-align: center;
  font-size: 11px;
}

.submit-bar {
  position: sticky;
  bottom: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 42px;
  border-top: 1px solid rgba(29, 79, 91, 0.12);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 -12px 28px rgba(31, 76, 86, 0.07);
  backdrop-filter: blur(14px);
}
.submit-bar strong,
.submit-bar span {
  display: block;
}
.submit-bar span {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 1100px) {
  .desk-layout {
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .answer-layout {
    grid-template-columns: 1fr;
  }
  .question-map {
    grid-template-columns: repeat(10, 36px);
  }
  .map-legend {
    display: none;
  }
}

@media (max-width: 760px) {
  .homework-desk {
    margin-top: 92px;
    border-radius: 20px;
  }
  .desk-header {
    grid-template-columns: auto 1fr;
    padding: 26px 20px;
  }
  .course-picker {
    grid-column: 1 / -1;
  }
  .desk-layout {
    grid-template-columns: 1fr;
  }
  .assignment-rail {
    border-right: 0;
    border-bottom: 1px solid rgba(22, 74, 86, 0.1);
  }
  .workbook-header {
    padding: 28px 20px;
  }
  .progress-seal {
    width: 80px;
    height: 80px;
  }
  .feedback-card,
  .locked-note {
    margin: 20px 20px 0;
  }
  .answer-layout {
    padding: 24px 20px 30px;
  }
  .question-map {
    grid-template-columns: repeat(7, 34px);
  }
  .question-map > button {
    width: 34px;
    height: 34px;
  }
  .question-paper {
    padding: 26px 20px;
  }
  .submit-bar {
    align-items: stretch;
    flex-direction: column;
    padding: 16px 20px;
  }
  .submit-bar > div:last-child {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
