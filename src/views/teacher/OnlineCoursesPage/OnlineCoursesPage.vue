<script setup>
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getCourses } from '@/api/platform'

const router = useRouter()

const statusTabs = [
  { label: '全部课程', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '待审核', value: 'pending' },
  { label: '已发布', value: 'published' },
  { label: '已驳回', value: 'rejected' }
]

const statusMeta = {
  draft: { label: '草稿', className: 'status-draft' },
  pending: { label: '待审核', className: 'status-pending' },
  published: { label: '已发布', className: 'status-published' },
  rejected: { label: '已驳回', className: 'status-rejected' },
  archived: { label: '已归档', className: 'status-archived' }
}

const levelLabels = {
  beginner: '入门',
  elementary: '初级',
  intermediate: '中级',
  advanced: '高级',
  all: '全级别'
}

const courses = ref([])
const activeStatus = ref('')
const searchInput = ref('')
const appliedSearch = ref('')
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(8)
const isLoading = ref(false)
const errorMessage = ref('')

const getStatusMeta = (status) =>
  statusMeta[status] || {
    label: status || '未知',
    className: 'status-archived'
  }

const formatDate = (value) => {
  if (!value) return '尚未更新'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const loadCourses = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value
    }

    if (activeStatus.value) params.status = activeStatus.value
    if (appliedSearch.value) params.search = appliedSearch.value

    const data = await getCourses(params)
    courses.value = Array.isArray(data?.items) ? data.items : []
    total.value = Number(data?.pagination?.total || 0)
  } catch (error) {
    courses.value = []
    total.value = 0
    errorMessage.value =
      error?.response?.data?.msg || '课程列表加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const changeStatus = (status) => {
  if (activeStatus.value === status) return

  activeStatus.value = status
  currentPage.value = 1
  loadCourses()
}

const applySearch = () => {
  appliedSearch.value = searchInput.value.trim()
  currentPage.value = 1
  loadCourses()
}

const clearSearch = () => {
  searchInput.value = ''
  appliedSearch.value = ''
  currentPage.value = 1
  loadCourses()
}

const handleCurrentChange = (page) => {
  currentPage.value = page
  loadCourses()
}

const openCourse = (course) => {
  router.push({ path: '/teacher/courseDetails', query: { id: course.id } })
}

const goToCreate = () => {
  router.push('/teacher/uploadCourses')
}

const copyCourseId = async (courseId) => {
  try {
    await navigator.clipboard.writeText(courseId)
    ElMessage.success('课程 ID 已复制')
  } catch {
    ElMessage.warning('当前浏览器不支持自动复制')
  }
}

onMounted(loadCourses)
</script>

<template>
  <main class="course-library mt-36 mx-auto overflow-hidden rounded-[28px]">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">COURSE STUDIO · 教师工作台</p>
        <h1>把每一门中文课，打磨成可被看见的作品。</h1>
        <p class="hero-description">
          管理草稿、跟进审核并查看发布状态。所有课程数据均来自平台服务。
        </p>
      </div>
      <button type="button" class="create-button" @click="goToCreate">
        <span aria-hidden="true">＋</span>
        创建新课程
      </button>
    </section>

    <section class="workspace-panel">
      <div class="toolbar">
        <div class="status-tabs" role="tablist" aria-label="课程状态筛选">
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            type="button"
            class="status-tab"
            :class="{ active: activeStatus === tab.value }"
            :aria-selected="activeStatus === tab.value"
            role="tab"
            @click="changeStatus(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="search-group">
          <el-input
            v-model="searchInput"
            clearable
            size="large"
            placeholder="搜索课程名称、简介或教师"
            :prefix-icon="Search"
            aria-label="搜索课程"
            @keyup.enter="applySearch"
            @clear="clearSearch"
          />
          <el-button type="primary" size="large" @click="applySearch">
            查询
          </el-button>
        </div>
      </div>

      <div class="result-heading">
        <div>
          <p class="result-kicker">MY COURSE ARCHIVE</p>
          <h2>{{ total }} 门课程</h2>
        </div>
        <p v-if="appliedSearch" class="search-caption">
          正在查看“{{ appliedSearch }}”的搜索结果
        </p>
      </div>

      <div v-if="isLoading" class="course-grid" aria-live="polite">
        <article
          v-for="index in 8"
          :key="index"
          class="course-card skeleton-card"
        >
          <el-skeleton animated>
            <template #template>
              <el-skeleton-item variant="image" class="skeleton-cover" />
              <div class="p-5">
                <el-skeleton-item variant="h3" style="width: 72%" />
                <el-skeleton-item variant="text" style="margin-top: 16px" />
                <el-skeleton-item variant="text" style="width: 45%" />
              </div>
            </template>
          </el-skeleton>
        </article>
      </div>

      <div
        v-else-if="errorMessage"
        class="state-panel error-state"
        role="alert"
      >
        <span class="state-symbol" aria-hidden="true">!</span>
        <h2>暂时无法读取课程</h2>
        <p>{{ errorMessage }}</p>
        <el-button type="primary" @click="loadCourses">重新加载</el-button>
      </div>

      <div v-else-if="courses.length === 0" class="state-panel empty-state">
        <span class="state-symbol" aria-hidden="true">空</span>
        <h2>{{ appliedSearch ? '没有匹配的课程' : '这个状态下还没有课程' }}</h2>
        <p>
          {{
            appliedSearch
              ? '换个关键词，或清除搜索条件后再试。'
              : '从一个清晰的教学目标开始创建第一门课程。'
          }}
        </p>
        <el-button v-if="appliedSearch" @click="clearSearch"
          >清除搜索</el-button
        >
        <el-button v-else type="primary" @click="goToCreate"
          >创建课程</el-button
        >
      </div>

      <div v-else class="course-grid">
        <article
          v-for="course in courses"
          :key="course.id"
          class="course-card"
          tabindex="0"
          @click="openCourse(course)"
          @keyup.enter="openCourse(course)"
        >
          <div class="cover-stage">
            <img
              v-if="course.coverUrl"
              class="course-cover"
              :src="course.coverUrl"
              :alt="`${course.title}课程封面`"
            />
            <div v-else class="cover-placeholder" aria-hidden="true">
              <span>{{ course.category?.slice(0, 4) || '中文课' }}</span>
              <small>INTERNATIONAL CHINESE</small>
            </div>
            <span
              class="status-pill"
              :class="getStatusMeta(course.status).className"
            >
              {{ getStatusMeta(course.status).label }}
            </span>
          </div>

          <div class="course-body">
            <div class="course-meta">
              <span>{{ course.category || '综合中文' }}</span>
              <span>{{ levelLabels[course.level] || course.level }}</span>
              <span>{{ course.durationMinutes }} 分钟</span>
            </div>
            <h3>{{ course.title }}</h3>
            <p class="course-summary">
              {{ course.summary || '这门课程还没有填写简介。' }}
            </p>

            <div v-if="course.status === 'rejected'" class="rejection-hint">
              <span aria-hidden="true">↺</span>
              已退回修改，点击查看审核意见
            </div>

            <div class="course-footer">
              <button
                type="button"
                class="course-id"
                title="复制课程 ID"
                @click.stop="copyCourseId(course.id)"
              >
                ID · {{ course.id.slice(0, 8) }}
              </button>
              <span>更新于 {{ formatDate(course.updatedAt) }}</span>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="!isLoading && !errorMessage && total > pageSize"
        class="pagination-wrap"
      >
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          background
          layout="prev, pager, next, jumper"
          :total="total"
          @current-change="handleCurrentChange"
        />
      </div>
    </section>
  </main>
</template>

<style lang="scss" scoped>
.course-library {
  --ink: #16304a;
  --muted: #667b8e;
  --line: rgba(21, 63, 91, 0.12);
  max-width: 2000px;
  color: var(--ink);
  background:
    radial-gradient(
      circle at 88% 10%,
      rgba(124, 210, 232, 0.32),
      transparent 24%
    ),
    #eaf7fb;
  box-shadow: 0 28px 70px rgba(41, 96, 119, 0.16);
}

.hero-panel {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 40px;
  padding: 54px 56px 42px;
  color: #f8fdff;
  background:
    linear-gradient(115deg, rgba(11, 52, 74, 0.98), rgba(17, 91, 116, 0.93)),
    repeating-linear-gradient(
      135deg,
      transparent 0 20px,
      rgba(255, 255, 255, 0.06) 20px 21px
    );
}

.eyebrow,
.result-kicker {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.hero-copy h1 {
  max-width: 820px;
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(34px, 3vw, 52px);
  font-weight: 700;
  line-height: 1.18;
}

.hero-description {
  max-width: 720px;
  margin: 18px 0 0;
  color: rgba(240, 251, 255, 0.76);
  font-size: 16px;
}

.create-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 22px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 999px;
  color: #103249;
  background: #bcecf3;
  font-size: 16px;
  font-weight: 800;
  box-shadow: 0 14px 28px rgba(4, 29, 44, 0.22);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.create-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(4, 29, 44, 0.3);
}

.workspace-panel {
  padding: 28px 34px 42px;
}

.toolbar,
.result-heading,
.course-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.toolbar {
  align-items: flex-start;
}

.status-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-tab {
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #547084;
  background: rgba(255, 255, 255, 0.58);
  font-weight: 700;
  transition: all 160ms ease;
}

.status-tab:hover,
.status-tab.active {
  border-color: rgba(22, 108, 137, 0.28);
  color: #0d6687;
  background: #fff;
  box-shadow: 0 8px 20px rgba(44, 102, 124, 0.1);
}

.search-group {
  display: flex;
  width: min(430px, 100%);
  gap: 8px;
}

.result-heading {
  margin: 32px 0 20px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
}

.result-kicker {
  margin-bottom: 4px;
  color: #4d90a8;
}

.result-heading h2 {
  margin: 0;
  font-size: 28px;
}

.search-caption {
  color: var(--muted);
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}

.course-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(34, 91, 112, 0.1);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 12px 28px rgba(31, 82, 102, 0.08);
  cursor: pointer;
  transition:
    transform 190ms ease,
    box-shadow 190ms ease,
    border-color 190ms ease;
}

.course-card:hover,
.course-card:focus-visible {
  border-color: rgba(21, 126, 158, 0.34);
  outline: none;
  transform: translateY(-5px);
  box-shadow: 0 22px 38px rgba(31, 82, 102, 0.15);
}

.cover-stage {
  position: relative;
  height: 190px;
  overflow: hidden;
  background: #d7edf3;
}

.course-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 300ms ease;
}

.course-card:hover .course-cover {
  transform: scale(1.035);
}

.cover-placeholder {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #123e58;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.68), transparent 50%),
    repeating-linear-gradient(
      45deg,
      transparent 0 18px,
      rgba(15, 93, 122, 0.07) 18px 19px
    ),
    #aadee7;
}

.cover-placeholder span {
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 34px;
  font-weight: 700;
}

.cover-placeholder small {
  margin-top: 7px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.status-pill {
  position: absolute;
  top: 14px;
  right: 14px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  backdrop-filter: blur(10px);
}

.status-draft {
  color: #43596c;
  background: rgba(238, 245, 248, 0.92);
}
.status-pending {
  color: #8c5a00;
  background: rgba(255, 236, 185, 0.94);
}
.status-published {
  color: #0d6b4b;
  background: rgba(200, 244, 223, 0.94);
}
.status-rejected {
  color: #a12f39;
  background: rgba(255, 216, 219, 0.94);
}
.status-archived {
  color: #615e67;
  background: rgba(232, 230, 235, 0.94);
}

.course-body {
  padding: 20px;
}

.course-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  color: #4b7c90;
  font-size: 12px;
  font-weight: 700;
}

.course-meta span:not(:last-child)::after {
  margin-left: 7px;
  color: #acc3cc;
  content: '·';
}

.course-body h3 {
  min-height: 58px;
  margin: 12px 0 7px;
  font-size: 21px;
  line-height: 1.35;
}

.course-summary {
  display: -webkit-box;
  min-height: 44px;
  margin: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.rejection-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding: 9px 10px;
  border-radius: 10px;
  color: #98333e;
  background: #fff0f1;
  font-size: 12px;
  font-weight: 700;
}

.course-footer {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: #82939e;
  font-size: 11px;
}

.course-id {
  padding: 0;
  border: 0;
  color: #2c7894;
  background: transparent;
  font: inherit;
  font-weight: 800;
  cursor: copy;
}

.state-panel {
  display: flex;
  min-height: 330px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  border: 1px dashed rgba(38, 101, 124, 0.25);
  border-radius: 22px;
  text-align: center;
  background: rgba(255, 255, 255, 0.62);
}

.state-symbol {
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 18px;
  place-items: center;
  border-radius: 18px;
  color: #2c7894;
  background: #d7f0f5;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 24px;
  font-weight: 800;
}

.state-panel h2 {
  margin: 0;
  font-size: 24px;
}
.state-panel p {
  margin: 10px 0 22px;
  color: var(--muted);
}
.error-state .state-symbol {
  color: #a12f39;
  background: #ffe1e3;
}

.skeleton-card {
  cursor: default;
}
.skeleton-cover {
  width: 100%;
  height: 190px;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 34px;
}

@media (max-width: 1500px) {
  .course-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .course-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .toolbar {
    flex-direction: column;
  }
  .search-group {
    width: 100%;
  }
}

@media (max-width: 760px) {
  .hero-panel {
    align-items: flex-start;
    flex-direction: column;
    padding: 38px 24px;
  }
  .workspace-panel {
    padding: 24px 18px 34px;
  }
  .course-grid {
    grid-template-columns: 1fr;
  }
}
</style>
