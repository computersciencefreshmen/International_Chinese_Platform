<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  closeAssignment,
  createAssignment,
  getAssignment,
  getAssignmentSubmissions,
  getCourse,
  getCourseAssignments,
  gradeSubmission,
  publishAssignment,
  submitCourse,
  updateAssignment,
  updateCourse
} from '@/api/platform'

const route = useRoute()
const router = useRouter()
const courseFormRef = ref(null)

const course = ref(null)
const isLoading = ref(false)
const isSaving = ref(false)
const isEditing = ref(false)
const errorMessage = ref('')

const assignments = ref([])
const isLoadingAssignments = ref(false)
const assignmentError = ref('')
const assignmentEditorOpen = ref(false)
const editingAssignmentId = ref('')
const isSavingAssignment = ref(false)
const questionSeed = ref(0)

const submissionReviewOpen = ref(false)
const selectedAssignmentDetail = ref(null)
const submissions = ref([])
const isLoadingSubmissions = ref(false)
const submissionError = ref('')
const gradingSubmissionId = ref('')
const gradingDrafts = ref({})
const handledLinkedAssignmentId = ref('')

const newQuestion = (type = 'single_choice') => ({
  _key: `question-${Date.now()}-${questionSeed.value++}`,
  type,
  prompt: '',
  options: type === 'text' ? [] : ['', ''],
  correctAnswer: type === 'multiple_choice' ? [] : '',
  points: 10,
  explanation: ''
})

const freshAssignmentForm = () => ({
  title: '',
  instructions: '',
  dueAt: null,
  questions: [
    newQuestion('single_choice'),
    newQuestion('multiple_choice'),
    newQuestion('text')
  ]
})

const assignmentForm = ref(freshAssignmentForm())

const form = ref({
  title: '',
  summary: '',
  description: '',
  category: '',
  level: 'beginner',
  coverUrl: '',
  durationMinutes: 45,
  priceYuan: 0,
  capacity: 20
})

const statusMeta = {
  draft: {
    label: '草稿',
    headline: '继续完善后即可提交审核',
    className: 'status-draft'
  },
  pending: {
    label: '审核中',
    headline: '管理员正在检查课程完整性',
    className: 'status-pending'
  },
  published: {
    label: '已发布',
    headline: '学习者已经可以看到这门课程',
    className: 'status-published'
  },
  rejected: {
    label: '已驳回',
    headline: '根据审核意见修改后可重新提交',
    className: 'status-rejected'
  },
  archived: {
    label: '已归档',
    headline: '课程当前不再对外展示',
    className: 'status-archived'
  }
}

const levelLabels = {
  beginner: '入门',
  elementary: '初级',
  intermediate: '中级',
  advanced: '高级',
  all: '全级别'
}

const rules = {
  title: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  summary: [{ required: true, message: '请输入课程简介', trigger: 'blur' }],
  description: [{ required: true, message: '请输入课程详情', trigger: 'blur' }],
  category: [{ required: true, message: '请选择课程分类', trigger: 'change' }],
  level: [{ required: true, message: '请选择适用级别', trigger: 'change' }]
}

const courseId = computed(() => {
  const id = route.query.id
  return Array.isArray(id) ? id[0] : id
})

const linkedAssignmentId = computed(() => {
  const id = route.query.assignmentId
  return Array.isArray(id) ? id[0] : id
})

const canEdit = computed(() =>
  ['draft', 'rejected'].includes(course.value?.status)
)

const currentStatus = computed(
  () =>
    statusMeta[course.value?.status] || {
      label: course.value?.status || '未知',
      headline: '请刷新后查看最新状态',
      className: 'status-archived'
    }
)

const reviewNote = computed(
  () => course.value?.latestReview?.note || course.value?.rejectionReason || ''
)

const assignmentTotalPoints = computed(() =>
  assignmentForm.value.questions.reduce(
    (total, question) => total + Number(question.points || 0),
    0
  )
)

const publishedAssignmentCount = computed(
  () => assignments.value.filter((item) => item.status === 'published').length
)

const fillForm = (value) => {
  form.value = {
    title: value.title || '',
    summary: value.summary || '',
    description: value.description || '',
    category: value.category || '综合汉语',
    level: value.level || 'beginner',
    coverUrl: value.coverUrl || '',
    durationMinutes: Number(value.durationMinutes || 45),
    priceYuan: Number(value.priceCents || 0) / 100,
    capacity: Number(value.capacity || 20)
  }
}

const loadAssignments = async () => {
  if (!courseId.value) {
    assignments.value = []
    return
  }

  isLoadingAssignments.value = true
  assignmentError.value = ''
  try {
    const data = await getCourseAssignments(courseId.value)
    assignments.value = data?.items || []

    const target = assignments.value.find(
      (item) => item.id === linkedAssignmentId.value
    )
    if (
      target &&
      handledLinkedAssignmentId.value !== linkedAssignmentId.value
    ) {
      handledLinkedAssignmentId.value = linkedAssignmentId.value
      void openSubmissionReview(target)
    }
  } catch (error) {
    assignments.value = []
    assignmentError.value =
      error?.response?.data?.msg || '作业列表加载失败，请稍后重试'
  } finally {
    isLoadingAssignments.value = false
  }
}

const loadCourse = async () => {
  if (!courseId.value) {
    if (linkedAssignmentId.value) {
      isLoading.value = true
      errorMessage.value = ''
      try {
        const linkedAssignment = await getAssignment(linkedAssignmentId.value)
        await router.replace({
          query: { ...route.query, id: linkedAssignment.courseId }
        })
      } catch (error) {
        errorMessage.value =
          error?.response?.data?.msg || '无法定位该作业所属课程'
      } finally {
        isLoading.value = false
      }
      return
    }

    errorMessage.value = '缺少课程 ID，请从课程列表重新进入'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await getCourse(courseId.value)
    course.value = data
    fillForm(data)
    isEditing.value = data.status === 'rejected'
    await loadAssignments()
  } catch (error) {
    course.value = null
    assignments.value = []
    errorMessage.value =
      error?.response?.data?.msg || '课程详情加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const buildPayload = () => ({
  title: form.value.title.trim(),
  summary: form.value.summary.trim(),
  description: form.value.description.trim(),
  category: form.value.category,
  level: form.value.level,
  coverUrl: form.value.coverUrl.trim() || null,
  durationMinutes: Number(form.value.durationMinutes),
  priceCents: Math.round(Number(form.value.priceYuan) * 100),
  capacity: Number(form.value.capacity)
})

const validateForm = async () => {
  const isValid = await courseFormRef.value?.validate().catch(() => false)
  if (!isValid) ElMessage.warning('请先完善课程信息')
  return isValid
}

const saveChanges = async ({ quiet = false } = {}) => {
  if (!(await validateForm())) return null

  const updated = await updateCourse(courseId.value, buildPayload())
  course.value = { ...course.value, ...updated }
  fillForm(course.value)

  if (!quiet) ElMessage.success('课程修改已保存')
  return updated
}

const handleSave = async () => {
  isSaving.value = true

  try {
    const updated = await saveChanges()
    if (updated) isEditing.value = false
  } catch (error) {
    if (!error?.messageShown) ElMessage.error('保存失败，请稍后重试')
  } finally {
    isSaving.value = false
  }
}

const handleSubmit = async () => {
  isSaving.value = true

  try {
    if (isEditing.value && !(await saveChanges({ quiet: true }))) return

    const updated = await submitCourse(courseId.value)
    course.value = { ...course.value, ...updated }
    fillForm(course.value)
    isEditing.value = false
    ElMessage.success(
      course.value.status === 'pending' ? '课程已提交审核' : '课程状态已更新'
    )
  } catch (error) {
    if (!error?.messageShown) ElMessage.error('提交失败，请稍后重试')
  } finally {
    isSaving.value = false
  }
}

const startEditing = () => {
  fillForm(course.value)
  isEditing.value = true
}

const cancelEditing = () => {
  fillForm(course.value)
  isEditing.value = false
  courseFormRef.value?.clearValidate()
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

const formatPrice = (priceCents) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2
  }).format(Number(priceCents || 0) / 100)

const openCreateAssignment = () => {
  editingAssignmentId.value = ''
  assignmentForm.value = freshAssignmentForm()
  assignmentEditorOpen.value = true
}

const openEditAssignment = async (item) => {
  isSavingAssignment.value = true
  try {
    const detail = await getAssignment(item.id)
    editingAssignmentId.value = detail.id
    assignmentForm.value = {
      title: detail.title,
      instructions: detail.instructions || '',
      dueAt: detail.dueAt ? new Date(detail.dueAt) : null,
      questions: detail.questions.map((question) => ({
        _key: `question-${question.id}`,
        type: question.type,
        prompt: question.prompt,
        options: question.options ? [...question.options] : [],
        correctAnswer: Array.isArray(question.correctAnswer)
          ? [...question.correctAnswer]
          : question.correctAnswer || '',
        points: Number(question.points),
        explanation: question.explanation || ''
      }))
    }
    assignmentEditorOpen.value = true
  } catch (error) {
    ElMessage.error(
      error?.response?.data?.msg || '作业内容加载失败，请稍后重试'
    )
  } finally {
    isSavingAssignment.value = false
  }
}

const setQuestionType = (question) => {
  if (question.type === 'text') {
    question.options = []
    question.correctAnswer = ''
    return
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    question.options = ['', '']
  }
  question.correctAnswer = question.type === 'multiple_choice' ? [] : ''
}

const addQuestion = (type = 'single_choice') => {
  assignmentForm.value.questions.push(newQuestion(type))
}

const removeQuestion = (index) => {
  if (assignmentForm.value.questions.length <= 1) {
    ElMessage.warning('一份作业至少需要一道题')
    return
  }
  assignmentForm.value.questions.splice(index, 1)
}

const addOption = (question) => {
  question.options.push('')
}

const removeOption = (question, index) => {
  if (question.options.length <= 2) {
    ElMessage.warning('选择题至少需要两个选项')
    return
  }
  const removed = question.options[index]
  question.options.splice(index, 1)
  if (Array.isArray(question.correctAnswer)) {
    question.correctAnswer = question.correctAnswer.filter(
      (answer) => answer !== removed
    )
  } else if (question.correctAnswer === removed) {
    question.correctAnswer = ''
  }
}

const validateAssignment = () => {
  if (!assignmentForm.value.title.trim()) {
    ElMessage.warning('请填写作业名称')
    return false
  }
  if (!assignmentForm.value.questions.length) {
    ElMessage.warning('请至少添加一道题')
    return false
  }

  for (const [index, question] of assignmentForm.value.questions.entries()) {
    const prefix = `第 ${index + 1} 题`
    if (!question.prompt.trim()) {
      ElMessage.warning(`${prefix}还没有填写题干`)
      return false
    }
    if (
      !Number.isFinite(Number(question.points)) ||
      Number(question.points) <= 0
    ) {
      ElMessage.warning(`${prefix}的分值必须大于 0`)
      return false
    }
    if (question.type === 'text') continue

    const options = question.options.map((option) => option.trim())
    if (options.length < 2 || options.some((option) => !option)) {
      ElMessage.warning(`${prefix}至少需要两个完整选项`)
      return false
    }
    if (new Set(options).size !== options.length) {
      ElMessage.warning(`${prefix}存在重复选项`)
      return false
    }
    if (
      question.type === 'single_choice' &&
      !options.includes(
        typeof question.correctAnswer === 'string'
          ? question.correctAnswer.trim()
          : ''
      )
    ) {
      ElMessage.warning(`${prefix}还没有选择正确答案`)
      return false
    }
    if (
      question.type === 'multiple_choice' &&
      (!Array.isArray(question.correctAnswer) ||
        !question.correctAnswer.length ||
        question.correctAnswer.some(
          (answer) =>
            typeof answer !== 'string' || !options.includes(answer.trim())
        ))
    ) {
      ElMessage.warning(`${prefix}还没有设置完整的正确答案`)
      return false
    }
  }

  if (assignmentTotalPoints.value <= 0) {
    ElMessage.warning('作业满分必须大于 0')
    return false
  }
  return true
}

const buildAssignmentPayload = () => ({
  title: assignmentForm.value.title.trim(),
  instructions: assignmentForm.value.instructions.trim(),
  dueAt: assignmentForm.value.dueAt
    ? new Date(assignmentForm.value.dueAt).toISOString()
    : null,
  maxScore: assignmentTotalPoints.value,
  questions: assignmentForm.value.questions.map((question) => ({
    type: question.type,
    prompt: question.prompt.trim(),
    options:
      question.type === 'text'
        ? null
        : question.options.map((option) => option.trim()),
    correctAnswer:
      question.type === 'text'
        ? question.correctAnswer.trim() || null
        : Array.isArray(question.correctAnswer)
          ? question.correctAnswer.map((answer) => answer.trim())
          : question.correctAnswer.trim(),
    points: Number(question.points),
    explanation: question.explanation.trim()
  }))
})

const saveAssignment = async () => {
  if (!validateAssignment()) return
  isSavingAssignment.value = true
  try {
    if (editingAssignmentId.value) {
      await updateAssignment(
        editingAssignmentId.value,
        buildAssignmentPayload()
      )
      ElMessage.success('作业草稿已更新')
    } else {
      await createAssignment(courseId.value, buildAssignmentPayload())
      ElMessage.success('作业草稿已创建')
    }
    assignmentEditorOpen.value = false
    await loadAssignments()
  } catch (error) {
    ElMessage.error(
      error?.response?.data?.msg || '作业草稿保存失败，请稍后重试'
    )
  } finally {
    isSavingAssignment.value = false
  }
}

const handlePublishAssignment = async (item) => {
  try {
    await ElMessageBox.confirm(
      `发布「${item.title}」后，题目和答案将锁定，学生即可查看。`,
      '确认发布作业',
      { confirmButtonText: '确认发布', cancelButtonText: '再检查一下' }
    )
  } catch {
    return
  }

  isSavingAssignment.value = true
  try {
    await publishAssignment(item.id)
    ElMessage.success('作业已发布，学生端已同步')
    await loadAssignments()
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || '作业发布失败，请稍后重试')
  } finally {
    isSavingAssignment.value = false
  }
}

const handleCloseAssignment = async (item) => {
  try {
    await ElMessageBox.confirm(
      `关闭「${item.title}」后，学生不能再保存或提交答案，但已有提交仍可批阅。`,
      '确认关闭作业',
      { confirmButtonText: '确认关闭', cancelButtonText: '暂不关闭' }
    )
  } catch {
    return
  }

  isSavingAssignment.value = true
  try {
    await closeAssignment(item.id)
    ElMessage.success('作业已关闭，已有提交仍保留')
    await loadAssignments()
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || '作业关闭失败，请稍后重试')
  } finally {
    isSavingAssignment.value = false
  }
}

const openSubmissionReview = async (item) => {
  submissionReviewOpen.value = true
  isLoadingSubmissions.value = true
  submissionError.value = ''
  selectedAssignmentDetail.value = null
  submissions.value = []

  try {
    const [detail, result] = await Promise.all([
      getAssignment(item.id),
      getAssignmentSubmissions(item.id, { page: 1, pageSize: 100 })
    ])
    selectedAssignmentDetail.value = detail
    submissions.value = result?.items || []
    gradingDrafts.value = Object.fromEntries(
      submissions.value.map((submission) => [
        submission.id,
        {
          score: submission.score ?? '',
          feedback: submission.feedback || ''
        }
      ])
    )
  } catch (error) {
    submissionError.value =
      error?.response?.data?.msg || '提交记录加载失败，请稍后重试'
  } finally {
    isLoadingSubmissions.value = false
  }
}

const handleGradeSubmission = async (submission) => {
  const draft = gradingDrafts.value[submission.id]
  const score = Number(draft?.score)
  const maxScore = Number(selectedAssignmentDetail.value?.maxScore || 0)
  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    ElMessage.warning(`得分应在 0 至 ${maxScore} 之间`)
    return
  }

  gradingSubmissionId.value = submission.id
  try {
    const graded = await gradeSubmission(submission.id, {
      score,
      feedback: draft.feedback.trim()
    })
    const index = submissions.value.findIndex((item) => item.id === graded.id)
    if (index >= 0) submissions.value[index] = graded
    ElMessage.success('评分与反馈已发送给学生')
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || '批阅保存失败，请稍后重试')
  } finally {
    gradingSubmissionId.value = ''
  }
}

const assignmentStatusLabel = (status) =>
  ({ draft: '草稿', published: '已发布', closed: '已关闭' })[status] || status

const assignmentStatusNote = (item) => {
  if (item.status === 'draft') return '仅你可见，可继续编辑题目与答案'
  if (item.status === 'closed') return '停止接收新答案，已有提交仍可继续批阅'
  if (course.value?.status !== 'published') {
    return '作业已发布；课程通过审核后学生可见'
  }
  return '学生可见，题目内容已锁定'
}

const questionTypeLabel = (type) =>
  ({ single_choice: '单选题', multiple_choice: '多选题', text: '文本题' })[
    type
  ] || type

const formatAnswer = (answer) => {
  if (Array.isArray(answer)) return answer.length ? answer.join('、') : '未作答'
  return typeof answer === 'string' && answer.trim() ? answer : '未作答'
}

const disabledDueDate = (date) =>
  date.getTime() < new Date().setHours(0, 0, 0, 0)

onMounted(loadCourse)
watch(courseId, loadCourse)
</script>

<template>
  <main class="course-details mt-36 mx-auto overflow-hidden rounded-[28px]">
    <div v-if="isLoading" class="loading-panel">
      <el-skeleton animated :rows="9" />
    </div>

    <div v-else-if="errorMessage" class="error-panel" role="alert">
      <span aria-hidden="true">!</span>
      <h1>无法打开课程</h1>
      <p>{{ errorMessage }}</p>
      <div>
        <el-button @click="router.push('/teacher/onlineCourses')"
          >返回列表</el-button
        >
        <el-button v-if="courseId" type="primary" @click="loadCourse"
          >重新加载</el-button
        >
      </div>
    </div>

    <template v-else-if="course">
      <header class="detail-header">
        <button
          type="button"
          class="back-button"
          aria-label="返回课程列表"
          @click="router.push('/teacher/onlineCourses')"
        >
          ←
        </button>
        <div class="header-copy">
          <p class="eyebrow">COURSE FILE · {{ course.id.slice(0, 8) }}</p>
          <h1>{{ course.title }}</h1>
          <p>{{ currentStatus.headline }}</p>
        </div>
        <span class="status-badge" :class="currentStatus.className">
          {{ currentStatus.label }}
        </span>
      </header>

      <section v-if="course.status === 'rejected'" class="review-alert">
        <div class="review-symbol" aria-hidden="true">审</div>
        <div>
          <p>管理员审核意见</p>
          <strong>{{
            reviewNote || '课程被退回，请完善内容后重新提交。'
          }}</strong>
          <small v-if="course.latestReview?.createdAt">
            审核时间：{{ formatDate(course.latestReview.createdAt) }}
          </small>
        </div>
      </section>

      <section class="detail-layout">
        <article class="course-main">
          <div class="cover-stage">
            <img
              v-if="course.coverUrl"
              :src="course.coverUrl"
              :alt="`${course.title}课程封面`"
            />
            <div v-else class="cover-placeholder">
              <small>INTERNATIONAL CHINESE COURSE</small>
              <strong>{{ course.title }}</strong>
              <span
                >{{ course.category }} · {{ levelLabels[course.level] }}</span
              >
            </div>
          </div>

          <div v-if="!isEditing" class="content-sheet">
            <p class="section-label">COURSE OVERVIEW</p>
            <h2>{{ course.summary || '暂未填写课程简介' }}</h2>
            <p class="description-text">
              {{ course.description || '暂未填写课程详情。' }}
            </p>

            <div class="fact-grid">
              <div>
                <span>课程分类</span>
                <strong>{{ course.category }}</strong>
              </div>
              <div>
                <span>适用级别</span>
                <strong>{{ levelLabels[course.level] || course.level }}</strong>
              </div>
              <div>
                <span>单课时长</span>
                <strong>{{ course.durationMinutes }} 分钟</strong>
              </div>
              <div>
                <span>班级容量</span>
                <strong>{{ course.capacity }} 人</strong>
              </div>
              <div>
                <span>课程价格</span>
                <strong>{{ formatPrice(course.priceCents) }}</strong>
              </div>
              <div>
                <span>最近更新</span>
                <strong>{{ formatDate(course.updatedAt) }}</strong>
              </div>
            </div>
          </div>

          <div v-else class="edit-sheet">
            <div class="edit-heading">
              <div>
                <p class="section-label">EDIT COURSE</p>
                <h2>
                  {{
                    course.status === 'rejected'
                      ? '根据审核意见修改课程'
                      : '编辑课程草稿'
                  }}
                </h2>
              </div>
              <el-button text @click="cancelEditing">取消编辑</el-button>
            </div>

            <el-form
              ref="courseFormRef"
              :model="form"
              :rules="rules"
              label-position="top"
              size="large"
            >
              <div class="edit-grid">
                <el-form-item class="span-two" label="课程名称" prop="title">
                  <el-input
                    v-model="form.title"
                    maxlength="160"
                    show-word-limit
                  />
                </el-form-item>
                <el-form-item
                  class="span-two"
                  label="一句话简介"
                  prop="summary"
                >
                  <el-input
                    v-model="form.summary"
                    maxlength="500"
                    show-word-limit
                  />
                </el-form-item>
                <el-form-item label="课程分类" prop="category">
                  <el-select
                    v-model="form.category"
                    class="w-full"
                    allow-create
                    filterable
                  >
                    <el-option label="综合汉语" value="综合汉语" />
                    <el-option label="生活口语" value="生活口语" />
                    <el-option label="文化口语" value="文化口语" />
                    <el-option label="语法精讲" value="语法精讲" />
                    <el-option label="HSK 备考" value="HSK 备考" />
                  </el-select>
                </el-form-item>
                <el-form-item label="适用级别" prop="level">
                  <el-select v-model="form.level" class="w-full">
                    <el-option label="入门" value="beginner" />
                    <el-option label="初级" value="elementary" />
                    <el-option label="中级" value="intermediate" />
                    <el-option label="高级" value="advanced" />
                    <el-option label="全级别" value="all" />
                  </el-select>
                </el-form-item>
                <el-form-item label="单课时长（分钟）">
                  <el-input-number
                    v-model="form.durationMinutes"
                    :min="1"
                    :max="1440"
                    class="number-input"
                  />
                </el-form-item>
                <el-form-item label="课程价格（元）">
                  <el-input-number
                    v-model="form.priceYuan"
                    :min="0"
                    :max="1000000"
                    :precision="2"
                    class="number-input"
                  />
                </el-form-item>
                <el-form-item label="班级容量（人）">
                  <el-input-number
                    v-model="form.capacity"
                    :min="1"
                    :max="10000"
                    class="number-input"
                  />
                </el-form-item>
                <el-form-item label="封面 URL（可选）">
                  <el-input v-model="form.coverUrl" placeholder="https://…" />
                </el-form-item>
                <el-form-item
                  class="span-two"
                  label="课程详情"
                  prop="description"
                >
                  <el-input
                    v-model="form.description"
                    type="textarea"
                    :rows="9"
                    maxlength="30000"
                    show-word-limit
                  />
                </el-form-item>
              </div>
            </el-form>
          </div>
        </article>

        <aside class="course-sidebar">
          <section class="teacher-card">
            <p class="section-label">INSTRUCTOR</p>
            <div class="teacher-profile">
              <img
                v-if="course.teacher?.avatarUrl"
                :src="course.teacher.avatarUrl"
                :alt="course.teacher.displayName"
              />
              <span v-else class="avatar-fallback" aria-hidden="true">
                {{ course.teacher?.displayName?.slice(0, 1) || '师' }}
              </span>
              <div>
                <h2>{{ course.teacher?.displayName || '授课教师' }}</h2>
                <p>{{ course.teacher?.title || '国际中文教师' }}</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>任教院校</dt>
                <dd>{{ course.teacher?.school || '暂未填写' }}</dd>
              </div>
              <div>
                <dt>综合评分</dt>
                <dd>
                  {{
                    course.teacher?.rating
                      ? `${course.teacher.rating} / 5.0`
                      : '暂无评分'
                  }}
                </dd>
              </div>
            </dl>
          </section>

          <section class="timeline-card">
            <p class="section-label">STATUS HISTORY</p>
            <div class="timeline-item active">
              <span></span>
              <div>
                <strong>创建课程</strong>
                <small>{{ formatDate(course.createdAt) }}</small>
              </div>
            </div>
            <div
              class="timeline-item"
              :class="{ active: course.status !== 'draft' }"
            >
              <span></span>
              <div>
                <strong>提交审核</strong>
                <small>{{
                  course.status === 'draft'
                    ? '尚未提交'
                    : formatDate(course.updatedAt)
                }}</small>
              </div>
            </div>
            <div
              class="timeline-item"
              :class="{
                active: ['published', 'rejected'].includes(course.status)
              }"
            >
              <span></span>
              <div>
                <strong>{{
                  course.status === 'rejected' ? '退回修改' : '审核发布'
                }}</strong>
                <small>
                  {{
                    ['published', 'rejected'].includes(course.status)
                      ? formatDate(
                          course.publishedAt ||
                            course.latestReview?.createdAt ||
                            course.updatedAt
                        )
                      : '等待审核结果'
                  }}
                </small>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section class="assignment-studio">
        <header class="studio-heading">
          <div>
            <p class="section-label">ASSIGNMENT WORKFLOW</p>
            <h2>作业与批阅工作台</h2>
            <p>
              课程所有权已由服务端校验；草稿仅你可见，发布后学生端实时同步。
            </p>
          </div>
          <div class="studio-actions">
            <div class="assignment-stat">
              <strong>{{ assignments.length }}</strong>
              <span>全部作业</span>
            </div>
            <div class="assignment-stat">
              <strong>{{ publishedAssignmentCount }}</strong>
              <span>已发布</span>
            </div>
            <el-button
              type="primary"
              size="large"
              :disabled="course.status === 'archived'"
              @click="openCreateAssignment"
            >
              创建作业
            </el-button>
          </div>
        </header>

        <div v-if="isLoadingAssignments" class="assignment-loading">
          <el-skeleton animated :rows="4" />
        </div>

        <div v-else-if="assignmentError" class="assignment-error" role="alert">
          <div>
            <strong>作业列表加载失败</strong>
            <span>{{ assignmentError }}</span>
          </div>
          <el-button @click="loadAssignments">重新加载</el-button>
        </div>

        <div v-else-if="!assignments.length" class="assignment-empty">
          <span aria-hidden="true">作</span>
          <div>
            <h3>为这门课程布置第一份真实作业</h3>
            <p>支持单选、多选与文本题，发布、提交、评分和反馈完整留痕。</p>
          </div>
          <el-button
            type="primary"
            :disabled="course.status === 'archived'"
            @click="openCreateAssignment"
          >
            新建作业草稿
          </el-button>
        </div>

        <div v-else class="assignment-grid">
          <article
            v-for="(item, index) in assignments"
            :key="item.id"
            class="assignment-card"
          >
            <div class="assignment-card-top">
              <span class="assignment-number">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
              <span class="assignment-status" :data-status="item.status">
                {{ assignmentStatusLabel(item.status) }}
              </span>
            </div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.instructions || '暂未填写作业说明。' }}</p>
            <dl>
              <div>
                <dt>题目</dt>
                <dd>{{ item.questionCount }} 道</dd>
              </div>
              <div>
                <dt>满分</dt>
                <dd>{{ item.maxScore }} 分</dd>
              </div>
              <div>
                <dt>截止</dt>
                <dd>{{ item.dueAt ? formatDate(item.dueAt) : '长期有效' }}</dd>
              </div>
            </dl>
            <small>{{ assignmentStatusNote(item) }}</small>
            <footer>
              <el-button
                v-if="item.status === 'draft'"
                :disabled="isSavingAssignment"
                @click="openEditAssignment(item)"
              >
                编辑题目
              </el-button>
              <el-button
                v-if="item.status === 'draft'"
                type="primary"
                :disabled="isSavingAssignment"
                @click="handlePublishAssignment(item)"
              >
                发布
              </el-button>
              <template v-else>
                <el-button
                  type="primary"
                  plain
                  @click="openSubmissionReview(item)"
                >
                  查看提交与批阅
                </el-button>
                <el-button
                  v-if="item.status === 'published'"
                  type="danger"
                  plain
                  :disabled="isSavingAssignment"
                  @click="handleCloseAssignment(item)"
                >
                  关闭作业
                </el-button>
              </template>
            </footer>
          </article>
        </div>
      </section>

      <el-drawer
        v-model="assignmentEditorOpen"
        size="min(820px, 96vw)"
        class="assignment-editor-drawer"
        :close-on-click-modal="!isSavingAssignment"
      >
        <template #header>
          <div class="drawer-heading">
            <p>ASSIGNMENT BUILDER</p>
            <h2>{{ editingAssignmentId ? '编辑作业草稿' : '创建课程作业' }}</h2>
          </div>
        </template>

        <div class="assignment-form">
          <section class="assignment-basics">
            <el-form label-position="top" size="large">
              <el-form-item label="作业名称（必填）">
                <el-input
                  v-model="assignmentForm.title"
                  maxlength="160"
                  show-word-limit
                  placeholder="例如：第一单元 · 初次见面"
                />
              </el-form-item>
              <el-form-item label="作业说明">
                <el-input
                  v-model="assignmentForm.instructions"
                  type="textarea"
                  :rows="3"
                  maxlength="10000"
                  show-word-limit
                  placeholder="说明学习目标、完成方式与注意事项"
                />
              </el-form-item>
              <el-form-item label="截止时间（可选）">
                <el-date-picker
                  v-model="assignmentForm.dueAt"
                  type="datetime"
                  placeholder="未设置则长期有效"
                  :disabled-date="disabledDueDate"
                  class="due-date-picker"
                />
              </el-form-item>
            </el-form>
          </section>

          <section class="question-builder">
            <header>
              <div>
                <p>QUESTION SET</p>
                <h3>题目设计</h3>
              </div>
              <div class="score-total">
                <strong>{{ assignmentTotalPoints }}</strong>
                <span>自动汇总满分</span>
              </div>
            </header>

            <article
              v-for="(question, questionIndex) in assignmentForm.questions"
              :key="question._key"
              class="question-editor"
            >
              <div class="question-editor-heading">
                <span>Q{{ String(questionIndex + 1).padStart(2, '0') }}</span>
                <el-select
                  v-model="question.type"
                  aria-label="题型"
                  @change="setQuestionType(question)"
                >
                  <el-option label="单选题" value="single_choice" />
                  <el-option label="多选题" value="multiple_choice" />
                  <el-option label="文本题" value="text" />
                </el-select>
                <el-input-number
                  v-model="question.points"
                  :min="0.5"
                  :max="10000"
                  :precision="1"
                  aria-label="题目分值"
                />
                <span class="points-unit">分</span>
                <el-button
                  text
                  type="danger"
                  @click="removeQuestion(questionIndex)"
                >
                  删除
                </el-button>
              </div>

              <el-input
                v-model="question.prompt"
                type="textarea"
                :rows="3"
                maxlength="4000"
                show-word-limit
                placeholder="输入题干（必填）"
              />

              <div v-if="question.type !== 'text'" class="option-editor">
                <p>选项与正确答案</p>
                <div
                  v-for="(option, optionIndex) in question.options"
                  :key="`${question._key}-option-${optionIndex}`"
                  class="option-row"
                >
                  <span>{{ String.fromCharCode(65 + optionIndex) }}</span>
                  <el-input
                    v-model="question.options[optionIndex]"
                    maxlength="500"
                    :placeholder="`选项 ${optionIndex + 1}`"
                  />
                  <el-button
                    text
                    type="danger"
                    aria-label="删除选项"
                    @click="removeOption(question, optionIndex)"
                  >
                    ×
                  </el-button>
                </div>
                <el-button text type="primary" @click="addOption(question)">
                  + 添加选项
                </el-button>

                <div class="correct-answer">
                  <label>正确答案</label>
                  <el-radio-group
                    v-if="question.type === 'single_choice'"
                    v-model="question.correctAnswer"
                  >
                    <el-radio
                      v-for="(option, optionIndex) in question.options"
                      :key="`${question._key}-answer-${optionIndex}`"
                      :value="option"
                      :disabled="!option.trim()"
                    >
                      {{ String.fromCharCode(65 + optionIndex) }}
                    </el-radio>
                  </el-radio-group>
                  <el-checkbox-group v-else v-model="question.correctAnswer">
                    <el-checkbox
                      v-for="(option, optionIndex) in question.options"
                      :key="`${question._key}-answer-${optionIndex}`"
                      :value="option"
                      :disabled="!option.trim()"
                    >
                      {{ String.fromCharCode(65 + optionIndex) }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>

              <div v-else class="reference-answer">
                <label>参考答案（可选，学生端不会显示）</label>
                <el-input
                  v-model="question.correctAnswer"
                  type="textarea"
                  :rows="3"
                  maxlength="10000"
                  placeholder="输入教师批阅时使用的参考答案"
                />
              </div>

              <div class="explanation-field">
                <label>答案解析（可选，教师端留档）</label>
                <el-input
                  v-model="question.explanation"
                  type="textarea"
                  :rows="2"
                  maxlength="4000"
                  placeholder="记录考查重点或讲评要点"
                />
              </div>
            </article>

            <div class="add-question-bar">
              <span>添加题型</span>
              <el-button @click="addQuestion('single_choice')"
                >单选题</el-button
              >
              <el-button @click="addQuestion('multiple_choice')"
                >多选题</el-button
              >
              <el-button @click="addQuestion('text')">文本题</el-button>
            </div>
          </section>
        </div>

        <template #footer>
          <div class="drawer-footer">
            <span>
              {{ assignmentForm.questions.length }} 道题 · 满分
              {{ assignmentTotalPoints }} 分
            </span>
            <div>
              <el-button @click="assignmentEditorOpen = false">取消</el-button>
              <el-button
                type="primary"
                :loading="isSavingAssignment"
                @click="saveAssignment"
              >
                {{ editingAssignmentId ? '保存修改' : '创建草稿' }}
              </el-button>
            </div>
          </div>
        </template>
      </el-drawer>

      <el-drawer
        v-model="submissionReviewOpen"
        size="min(900px, 96vw)"
        class="submission-review-drawer"
      >
        <template #header>
          <div class="drawer-heading">
            <p>SUBMISSION REVIEW</p>
            <h2>{{ selectedAssignmentDetail?.title || '查看提交与批阅' }}</h2>
          </div>
        </template>

        <div v-if="isLoadingSubmissions" class="review-loading">
          <el-skeleton animated :rows="10" />
        </div>

        <div v-else-if="submissionError" class="review-state" role="alert">
          <span>!</span>
          <h3>提交记录加载失败</h3>
          <p>{{ submissionError }}</p>
        </div>

        <template v-else-if="selectedAssignmentDetail">
          <section class="review-overview">
            <div>
              <span>{{ submissions.length }}</span>
              <small>份有效提交</small>
            </div>
            <div>
              <span>{{ selectedAssignmentDetail.questionCount }}</span>
              <small>道题目</small>
            </div>
            <div>
              <span>{{ selectedAssignmentDetail.maxScore }}</span>
              <small>作业满分</small>
            </div>
            <p>
              只显示已正式提交或已批阅的记录；学生云端草稿不会进入教师批阅队列。
            </p>
          </section>

          <div v-if="!submissions.length" class="review-state">
            <span>阅</span>
            <h3>还没有学生正式提交</h3>
            <p>学生提交后，你会收到通知并可在这里逐份评分。</p>
          </div>

          <el-collapse v-else class="submission-list" accordion>
            <el-collapse-item
              v-for="(submission, index) in submissions"
              :key="submission.id"
              :name="submission.id"
            >
              <template #title>
                <div class="submission-title">
                  <span>{{ String(index + 1).padStart(2, '0') }}</span>
                  <div>
                    <strong>
                      {{ submission.student?.displayName || '学习者' }}
                    </strong>
                    <small>
                      提交于 {{ formatDate(submission.submittedAt) }}
                    </small>
                  </div>
                  <em :data-status="submission.status">
                    {{ submission.status === 'graded' ? '已批阅' : '待批阅' }}
                  </em>
                  <b v-if="submission.status === 'graded'">
                    {{ submission.score }} /
                    {{ selectedAssignmentDetail.maxScore }}
                  </b>
                </div>
              </template>

              <div class="submission-body">
                <div class="answer-review-list">
                  <article
                    v-for="(
                      question, questionIndex
                    ) in selectedAssignmentDetail.questions"
                    :key="question.id"
                  >
                    <header>
                      <span>Q{{ questionIndex + 1 }}</span>
                      <strong>{{ questionTypeLabel(question.type) }}</strong>
                      <em>{{ question.points }} 分</em>
                    </header>
                    <h4>{{ question.prompt }}</h4>
                    <div class="answer-comparison">
                      <div>
                        <label>学生回答</label>
                        <p>
                          {{ formatAnswer(submission.answers[question.id]) }}
                        </p>
                      </div>
                      <div>
                        <label>参考答案</label>
                        <p>{{ formatAnswer(question.correctAnswer) }}</p>
                      </div>
                    </div>
                    <small v-if="question.explanation">
                      讲评要点：{{ question.explanation }}
                    </small>
                  </article>
                </div>

                <section
                  v-if="submission.status === 'submitted'"
                  class="grading-panel"
                >
                  <div>
                    <label>得分</label>
                    <el-input-number
                      v-model="gradingDrafts[submission.id].score"
                      :min="0"
                      :max="selectedAssignmentDetail.maxScore"
                      :precision="1"
                    />
                    <span>/ {{ selectedAssignmentDetail.maxScore }}</span>
                  </div>
                  <div>
                    <label>教师反馈</label>
                    <el-input
                      v-model="gradingDrafts[submission.id].feedback"
                      type="textarea"
                      :rows="4"
                      maxlength="5000"
                      show-word-limit
                      placeholder="给出具体、可执行的学习建议"
                    />
                  </div>
                  <el-button
                    type="primary"
                    :loading="gradingSubmissionId === submission.id"
                    @click="handleGradeSubmission(submission)"
                  >
                    提交评分与反馈
                  </el-button>
                </section>

                <section v-else class="graded-result">
                  <span>✓</span>
                  <div>
                    <strong>
                      已评分 {{ submission.score }} /
                      {{ selectedAssignmentDetail.maxScore }}
                    </strong>
                    <p>{{ submission.feedback || '未填写文字反馈。' }}</p>
                    <small>批阅于 {{ formatDate(submission.gradedAt) }}</small>
                  </div>
                </section>
              </div>
            </el-collapse-item>
          </el-collapse>
        </template>
      </el-drawer>

      <footer v-if="canEdit" class="sticky-actions">
        <div>
          <strong>{{
            course.status === 'rejected'
              ? '修改完成后重新进入审核队列'
              : '这门课程仍可继续编辑'
          }}</strong>
          <span>{{
            isEditing
              ? '请保存修改，或直接保存并提交审核。'
              : '提交审核后，审核期间不可修改。'
          }}</span>
        </div>
        <div>
          <el-button v-if="!isEditing" size="large" @click="startEditing"
            >编辑课程</el-button
          >
          <el-button
            v-else
            size="large"
            :disabled="isSaving"
            @click="handleSave"
            >保存修改</el-button
          >
          <el-button
            type="primary"
            size="large"
            :loading="isSaving"
            @click="handleSubmit"
          >
            {{ course.status === 'rejected' ? '保存并重新提交' : '提交审核' }}
          </el-button>
        </div>
      </footer>
    </template>
  </main>
</template>

<style lang="scss" scoped>
.course-details {
  --ink: #173247;
  --muted: #687e8c;
  max-width: 1720px;
  color: var(--ink);
  background: #edf8fb;
  box-shadow: 0 28px 70px rgba(32, 87, 107, 0.15);
}

.loading-panel,
.error-panel {
  min-height: 620px;
  padding: 64px;
  background: #fff;
}

.error-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.error-panel > span {
  display: grid;
  width: 64px;
  height: 64px;
  margin-bottom: 18px;
  border-radius: 20px;
  color: #a6333d;
  background: #ffe2e4;
  place-items: center;
  font-size: 28px;
  font-weight: 900;
}

.error-panel h1 {
  margin: 0;
}
.error-panel p {
  margin: 10px 0 24px;
  color: var(--muted);
}

.detail-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 22px;
  padding: 38px 48px;
  color: #f5fcff;
  background:
    radial-gradient(
      circle at 88% 20%,
      rgba(138, 220, 231, 0.33),
      transparent 25%
    ),
    linear-gradient(120deg, #123d57, #1f728c);
}

.back-button {
  display: grid;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  place-items: center;
  font-size: 22px;
  transition:
    background 160ms ease,
    transform 160ms ease;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: translateX(-2px);
}

.eyebrow,
.section-label {
  margin: 0 0 8px;
  color: #6daabd;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.17em;
}

.header-copy h1 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(32px, 3vw, 46px);
}

.header-copy > p:last-child {
  margin: 9px 0 0;
  color: rgba(240, 251, 255, 0.72);
}

.status-badge {
  padding: 8px 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
}

.status-draft {
  color: #43596c;
  background: #edf3f5;
}
.status-pending {
  color: #805200;
  background: #ffedbd;
}
.status-published {
  color: #0c6949;
  background: #cbf2df;
}
.status-rejected {
  color: #9e3039;
  background: #ffdadd;
}
.status-archived {
  color: #625e68;
  background: #e8e6eb;
}

.review-alert {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin: 28px 48px 0;
  padding: 20px 22px;
  border: 1px solid rgba(170, 54, 64, 0.18);
  border-radius: 16px;
  color: #7f2d35;
  background: #fff3f3;
}

.review-symbol {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 12px;
  color: #fff;
  background: #b24650;
  place-items: center;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 20px;
}

.review-alert p {
  margin: 0 0 5px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.review-alert strong {
  display: block;
  line-height: 1.6;
}
.review-alert small {
  display: block;
  margin-top: 6px;
  color: #a66b70;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 30px;
  padding: 34px 48px 46px;
}

.course-main,
.teacher-card,
.timeline-card {
  overflow: hidden;
  border: 1px solid rgba(29, 82, 103, 0.1);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 15px 34px rgba(32, 87, 107, 0.08);
}

.cover-stage {
  min-height: 370px;
  background: #a9dce6;
}
.cover-stage img {
  width: 100%;
  height: 420px;
  object-fit: cover;
}

.cover-placeholder {
  display: flex;
  min-height: 370px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px;
  text-align: center;
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.7), transparent 55%),
    repeating-linear-gradient(
      45deg,
      transparent 0 28px,
      rgba(17, 78, 101, 0.07) 28px 29px
    ),
    #a7dce5;
}

.cover-placeholder small {
  color: #3b7c93;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.2em;
}
.cover-placeholder strong {
  max-width: 720px;
  margin: 28px 0 18px;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(40px, 5vw, 68px);
  line-height: 1.1;
}
.cover-placeholder span {
  color: #486f7f;
}

.content-sheet,
.edit-sheet {
  padding: 34px 38px 40px;
}
.content-sheet h2,
.edit-heading h2 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 29px;
}

.description-text {
  margin: 20px 0 30px;
  color: #536b7a;
  line-height: 1.85;
  white-space: pre-wrap;
}

.fact-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid rgba(34, 90, 111, 0.12);
  border-left: 1px solid rgba(34, 90, 111, 0.12);
}

.fact-grid > div {
  display: flex;
  min-height: 92px;
  flex-direction: column;
  justify-content: center;
  padding: 16px;
  border-right: 1px solid rgba(34, 90, 111, 0.12);
  border-bottom: 1px solid rgba(34, 90, 111, 0.12);
}

.fact-grid span {
  margin-bottom: 7px;
  color: #82939e;
  font-size: 12px;
}
.fact-grid strong {
  font-size: 15px;
}

.edit-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 26px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(34, 90, 111, 0.12);
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 22px;
}
.span-two {
  grid-column: span 2;
}
.number-input {
  width: 100%;
}

.course-sidebar {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.teacher-card,
.timeline-card {
  padding: 26px;
}

.teacher-profile {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 20px 0 24px;
}
.teacher-profile img,
.avatar-fallback {
  width: 64px;
  height: 64px;
  border-radius: 18px;
}
.teacher-profile img {
  object-fit: cover;
}
.avatar-fallback {
  display: grid;
  color: #174a62;
  background: #bce7ed;
  place-items: center;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 28px;
  font-weight: 800;
}
.teacher-profile h2 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 24px;
}
.teacher-profile p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.teacher-card dl {
  margin: 0;
}
.teacher-card dl > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 0;
  border-top: 1px solid rgba(34, 90, 111, 0.1);
}
.teacher-card dt {
  color: #84959f;
  font-size: 12px;
}
.teacher-card dd {
  margin: 0;
  text-align: right;
  font-size: 13px;
  font-weight: 700;
}

.timeline-card .section-label {
  margin-bottom: 22px;
}
.timeline-item {
  position: relative;
  display: flex;
  gap: 14px;
  min-height: 74px;
  color: #97a4ab;
}
.timeline-item > span {
  position: relative;
  width: 12px;
  height: 12px;
  margin-top: 3px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #b8c4c9;
  box-shadow: 0 0 0 1px #b8c4c9;
}
.timeline-item:not(:last-child) > span::after {
  position: absolute;
  top: 12px;
  left: 2px;
  width: 2px;
  height: 55px;
  background: #dce5e8;
  content: '';
}
.timeline-item.active {
  color: #204c61;
}
.timeline-item.active > span {
  background: #2584a0;
  box-shadow: 0 0 0 1px #2584a0;
}
.timeline-item strong,
.timeline-item small {
  display: block;
}
.timeline-item small {
  margin-top: 5px;
  color: #84959f;
  font-size: 11px;
}

.assignment-studio {
  margin: 0 48px 46px;
  padding: 34px;
  border: 1px solid rgba(29, 82, 103, 0.1);
  border-radius: 22px;
  background:
    linear-gradient(rgba(29, 99, 116, 0.035) 1px, transparent 1px),
    rgba(255, 255, 255, 0.96);
  background-size: 100% 28px;
  box-shadow: 0 15px 34px rgba(32, 87, 107, 0.08);
}

.studio-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(34, 90, 111, 0.12);
}
.studio-heading h2 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 30px;
}
.studio-heading > div:first-child > p:last-child {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.studio-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.assignment-stat {
  min-width: 70px;
  text-align: center;
}
.assignment-stat strong,
.assignment-stat span {
  display: block;
}
.assignment-stat strong {
  font-family: Georgia, serif;
  font-size: 25px;
}
.assignment-stat span {
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.assignment-loading {
  padding: 12px;
}
.assignment-error,
.assignment-empty {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 120px;
  padding: 24px;
  border-radius: 16px;
  background: #f4f8f8;
}
.assignment-error > div,
.assignment-empty > div {
  flex: 1;
}
.assignment-error strong,
.assignment-error span {
  display: block;
}
.assignment-error span,
.assignment-empty p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.assignment-empty > span {
  display: grid;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border-radius: 15px;
  color: #1a6278;
  background: #cfeaf0;
  place-items: center;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 23px;
  font-weight: 900;
}
.assignment-empty h3 {
  margin: 0;
}

.assignment-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.assignment-card {
  display: flex;
  min-width: 0;
  min-height: 300px;
  flex-direction: column;
  padding: 22px;
  border: 1px solid rgba(27, 86, 103, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 11px 26px rgba(32, 87, 107, 0.07);
  transition: 170ms ease;
}
.assignment-card:hover {
  border-color: rgba(33, 117, 136, 0.3);
  box-shadow: 0 18px 34px rgba(32, 87, 107, 0.11);
  transform: translateY(-2px);
}
.assignment-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.assignment-number {
  color: #74a3ae;
  font-family: Georgia, serif;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
}
.assignment-status {
  padding: 5px 9px;
  border-radius: 999px;
  color: #7e5b12;
  background: #fff0c8;
  font-size: 10px;
  font-weight: 900;
}
.assignment-status[data-status='published'] {
  color: #146547;
  background: #d7f1e4;
}
.assignment-status[data-status='closed'] {
  color: #645f69;
  background: #ecebed;
}
.assignment-card h3 {
  margin: 17px 0 9px;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 23px;
  line-height: 1.35;
}
.assignment-card > p {
  display: -webkit-box;
  overflow: hidden;
  min-height: 42px;
  margin: 0 0 18px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.assignment-card dl {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid #e5edef;
  border-radius: 10px;
  background: #e5edef;
}
.assignment-card dl > div {
  padding: 10px;
  background: #f8fbfb;
}
.assignment-card dl > div:last-child {
  grid-column: 1 / -1;
}
.assignment-card dt {
  color: #8a9aa1;
  font-size: 9px;
}
.assignment-card dd {
  margin: 4px 0 0;
  font-size: 11px;
  font-weight: 800;
}
.assignment-card > small {
  display: block;
  margin: 13px 0;
  color: #70878e;
  font-size: 10px;
  line-height: 1.5;
}
.assignment-card footer {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
}

:global(.assignment-editor-drawer .el-drawer__header),
:global(.submission-review-drawer .el-drawer__header) {
  margin: 0;
  padding: 26px 30px 20px;
  border-bottom: 1px solid #e4edef;
}
:global(.assignment-editor-drawer .el-drawer__body),
:global(.submission-review-drawer .el-drawer__body) {
  padding: 0;
  background: #f3f8f8;
}
:global(.assignment-editor-drawer .el-drawer__footer) {
  padding: 16px 28px;
  border-top: 1px solid #e0e9eb;
  background: #fff;
}
.drawer-heading p,
.question-builder > header p {
  margin: 0 0 6px;
  color: #6298a5;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
}
.drawer-heading h2 {
  margin: 0;
  color: var(--ink);
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 28px;
}
.assignment-form {
  padding: 28px;
}
.assignment-basics,
.question-builder {
  padding: 24px;
  border: 1px solid rgba(30, 84, 101, 0.1);
  border-radius: 18px;
  background: #fff;
}
.due-date-picker {
  width: 100% !important;
}
.question-builder {
  margin-top: 20px;
}
.question-builder > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}
.question-builder > header h3 {
  margin: 0;
  font-size: 21px;
}
.score-total {
  min-width: 105px;
  padding: 10px 14px;
  border-radius: 14px;
  text-align: right;
  background: #e7f5f2;
}
.score-total strong,
.score-total span {
  display: block;
}
.score-total strong {
  font-family: Georgia, serif;
  font-size: 24px;
}
.score-total span {
  color: #64877f;
  font-size: 9px;
}

.question-editor {
  margin-bottom: 16px;
  padding: 20px;
  border: 1px solid #e0e9eb;
  border-radius: 15px;
  background: #fbfdfd;
}
.question-editor-heading {
  display: grid;
  grid-template-columns: auto minmax(130px, 180px) 130px auto 1fr;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}
.question-editor-heading > span:first-child {
  color: #4c8d98;
  font-family: Georgia, serif;
  font-size: 12px;
  font-weight: 900;
}
.question-editor-heading .el-button {
  justify-self: end;
}
.points-unit {
  color: var(--muted);
  font-size: 11px;
}
.option-editor,
.reference-answer,
.explanation-field {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed #dbe6e7;
}
.option-editor > p,
.reference-answer label,
.explanation-field label,
.correct-answer label {
  display: block;
  margin: 0 0 10px;
  color: #637a82;
  font-size: 11px;
  font-weight: 800;
}
.option-row {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.option-row > span {
  display: grid;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  color: #276c77;
  background: #dceff0;
  place-items: center;
  font-family: Georgia, serif;
  font-size: 11px;
  font-weight: 900;
}
.correct-answer {
  margin-top: 14px;
  padding: 14px;
  border-radius: 12px;
  background: #edf7f4;
}
.add-question-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 1px dashed #a9c6cb;
  border-radius: 14px;
  color: var(--muted);
  background: #f5fafa;
  font-size: 11px;
}
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.drawer-footer > span {
  color: var(--muted);
  font-size: 12px;
}

.review-loading {
  padding: 30px;
}
.review-state {
  display: flex;
  min-height: 380px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px;
  text-align: center;
}
.review-state > span {
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 16px;
  border-radius: 18px;
  color: #1a6376;
  background: #d5ecf0;
  place-items: center;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 24px;
  font-weight: 900;
}
.review-state[role='alert'] > span {
  color: #99343d;
  background: #ffe1e3;
}
.review-state h3 {
  margin: 0;
}
.review-state p {
  margin: 8px 0 0;
  color: var(--muted);
}
.review-overview {
  display: grid;
  grid-template-columns: repeat(3, 110px) 1fr;
  align-items: center;
  gap: 12px;
  margin: 24px;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(120deg, #17475d, #287487);
  color: #f5fdff;
}
.review-overview > div {
  padding-right: 12px;
  border-right: 1px solid rgba(255, 255, 255, 0.18);
  text-align: center;
}
.review-overview span,
.review-overview small {
  display: block;
}
.review-overview span {
  font-family: Georgia, serif;
  font-size: 25px;
}
.review-overview small {
  color: rgba(245, 253, 255, 0.68);
  font-size: 9px;
}
.review-overview p {
  margin: 0;
  color: rgba(245, 253, 255, 0.74);
  font-size: 11px;
  line-height: 1.6;
}
.submission-list {
  margin: 0 24px 28px;
}
.submission-list :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 76px;
  padding: 10px 18px;
  border-radius: 14px;
}
.submission-list :deep(.el-collapse-item__content) {
  padding-bottom: 18px;
}
.submission-title {
  display: grid;
  width: 100%;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 14px;
  padding-right: 12px;
}
.submission-title > span {
  color: #6a99a2;
  font-family: Georgia, serif;
  font-size: 11px;
}
.submission-title strong,
.submission-title small {
  display: block;
}
.submission-title small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}
.submission-title em {
  padding: 5px 9px;
  border-radius: 999px;
  color: #1b6680;
  background: #daf0f7;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}
.submission-title em[data-status='graded'] {
  color: #136546;
  background: #d5f1e3;
}
.submission-title > b {
  color: #176a4b;
  font-family: Georgia, serif;
}
.submission-body {
  padding: 18px;
}
.answer-review-list article {
  margin-bottom: 12px;
  padding: 18px;
  border: 1px solid #e0e9ea;
  border-radius: 14px;
  background: #fff;
}
.answer-review-list header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.answer-review-list header span {
  color: #478694;
  font-family: Georgia, serif;
  font-size: 11px;
  font-weight: 900;
}
.answer-review-list header strong {
  padding: 3px 7px;
  border-radius: 999px;
  color: #71848a;
  background: #edf3f3;
  font-size: 9px;
}
.answer-review-list header em {
  margin-left: auto;
  color: #397481;
  font-size: 10px;
  font-style: normal;
}
.answer-review-list h4 {
  margin: 12px 0;
  line-height: 1.6;
}
.answer-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.answer-comparison > div {
  padding: 12px;
  border-radius: 10px;
  background: #f4f8f8;
}
.answer-comparison label {
  color: #809198;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.08em;
}
.answer-comparison p {
  margin: 6px 0 0;
  line-height: 1.65;
  white-space: pre-wrap;
}
.answer-review-list article > small {
  display: block;
  margin-top: 10px;
  color: #638278;
  line-height: 1.5;
}
.grading-panel,
.graded-result {
  margin-top: 18px;
  padding: 20px;
  border-radius: 15px;
  background: #eaf5f2;
}
.grading-panel > div {
  margin-bottom: 15px;
}
.grading-panel label {
  display: block;
  margin-bottom: 8px;
  color: #5d7e78;
  font-size: 11px;
  font-weight: 900;
}
.grading-panel > div:first-child {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grading-panel > div:first-child label {
  margin: 0 8px 0 0;
}
.grading-panel > .el-button {
  display: block;
  margin-left: auto;
}
.graded-result {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.graded-result > span {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 50%;
  color: #fff;
  background: #358263;
  place-items: center;
}
.graded-result p {
  margin: 5px 0;
  color: #526f66;
  white-space: pre-wrap;
}
.graded-result small {
  color: #789087;
}

.sticky-actions {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 48px;
  border-top: 1px solid rgba(31, 82, 102, 0.12);
  background: rgba(255, 255, 255, 0.93);
  box-shadow: 0 -12px 30px rgba(28, 75, 94, 0.08);
  backdrop-filter: blur(14px);
}

.sticky-actions strong,
.sticky-actions span {
  display: block;
}
.sticky-actions span {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 1180px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
  .course-sidebar {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .assignment-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .detail-header {
    grid-template-columns: auto 1fr;
    padding: 32px 22px;
  }
  .status-badge {
    grid-column: 2;
    justify-self: start;
  }
  .review-alert {
    margin: 22px 18px 0;
  }
  .detail-layout {
    padding: 24px 18px 34px;
  }
  .content-sheet,
  .edit-sheet {
    padding: 26px 20px;
  }
  .fact-grid,
  .edit-grid,
  .course-sidebar {
    grid-template-columns: 1fr;
  }
  .span-two {
    grid-column: auto;
  }
  .assignment-studio {
    margin: 0 18px 34px;
    padding: 22px 18px;
  }
  .studio-heading {
    align-items: stretch;
    flex-direction: column;
  }
  .studio-actions {
    flex-wrap: wrap;
  }
  .assignment-grid {
    grid-template-columns: 1fr;
  }
  .assignment-form {
    padding: 16px;
  }
  .assignment-basics,
  .question-builder {
    padding: 16px;
  }
  .question-editor {
    padding: 15px;
  }
  .question-editor-heading {
    grid-template-columns: auto 1fr;
  }
  .question-editor-heading .el-input-number {
    width: 100%;
  }
  .question-editor-heading .points-unit {
    display: none;
  }
  .question-editor-heading .el-button {
    justify-self: end;
  }
  .add-question-bar {
    align-items: stretch;
    flex-direction: column;
  }
  .drawer-footer {
    align-items: stretch;
    flex-direction: column;
  }
  .review-overview {
    grid-template-columns: repeat(3, 1fr);
    margin: 16px;
  }
  .review-overview p {
    grid-column: 1 / -1;
  }
  .submission-list {
    margin: 0 16px 22px;
  }
  .submission-title {
    grid-template-columns: auto 1fr auto;
  }
  .submission-title > b {
    grid-column: 2;
  }
  .answer-comparison {
    grid-template-columns: 1fr;
  }
  .sticky-actions {
    align-items: stretch;
    flex-direction: column;
    padding: 16px 20px;
  }
  .sticky-actions > div:last-child {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
