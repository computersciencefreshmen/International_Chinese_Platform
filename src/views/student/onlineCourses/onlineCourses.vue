<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Clock, Reading, Refresh, Search, User } from '@element-plus/icons-vue'

import { getCourse, getCourses } from '@/api/platform'

const router = useRouter()
const courses = ref([])
const loading = ref(false)
const loadError = ref('')
const search = ref('')
const selectedCategory = ref('')
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)
const detailVisible = ref(false)
const detailLoading = ref(false)
const selectedCourse = ref(null)

const categories = [
  { label: '全部课程', value: '' },
  { label: '综合汉语', value: '综合汉语' },
  { label: '文化口语', value: '文化口语' }
]

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
)

const levelLabels = {
  beginner: '入门',
  elementary: '初级',
  intermediate: '中级',
  advanced: '高级',
  all: '全等级'
}

const formatPrice = (priceCents) => {
  if (!priceCents) return '免费体验'
  return `¥${(priceCents / 100).toFixed(0)}`
}

const errorMessage = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const loadCourses = async ({ resetPage = false } = {}) => {
  if (resetPage) currentPage.value = 1
  loading.value = true
  loadError.value = ''

  try {
    const result = await getCourses({
      page: currentPage.value,
      pageSize,
      search: search.value.trim() || undefined,
      category: selectedCategory.value || undefined
    })
    courses.value = result?.items ?? []
    total.value = result?.pagination?.total ?? 0
  } catch (error) {
    courses.value = []
    total.value = 0
    loadError.value = errorMessage(error, '课程加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const chooseCategory = (value) => {
  selectedCategory.value = value
  loadCourses({ resetPage: true })
}

const resetFilters = () => {
  search.value = ''
  chooseCategory('')
}

const openCourse = async (courseId) => {
  detailVisible.value = true
  detailLoading.value = true
  selectedCourse.value = null

  try {
    selectedCourse.value = await getCourse(courseId)
  } catch (error) {
    detailVisible.value = false
    ElMessage.error(errorMessage(error, '课程详情加载失败'))
  } finally {
    detailLoading.value = false
  }
}

const changePage = (page) => {
  currentPage.value = page
  loadCourses()
}

const startHomework = (courseId) => {
  detailVisible.value = false
  router.push({ name: 'homeWork', query: { courseId } })
}

const viewTeacher = (teacherId) => {
  detailVisible.value = false
  router.push({ name: 'teacherDetail', query: { teacherId } })
}

onMounted(() => loadCourses())
</script>

<template>
  <section class="course-page">
    <header class="hero-panel">
      <div>
        <p class="eyebrow">COURSE LIBRARY</p>
        <h1>选择一堂真正适合你的中文课</h1>
        <p class="hero-copy">
          课程均由教师创建并通过平台审核。搜索、状态与内容来自同一套持久化数据。
        </p>
      </div>
      <div class="hero-stat">
        <strong>{{ total }}</strong>
        <span>门已发布课程</span>
      </div>
    </header>

    <div class="toolbar">
      <div class="category-tabs" aria-label="课程分类">
        <button
          v-for="category in categories"
          :key="category.value"
          type="button"
          :class="{ active: selectedCategory === category.value }"
          @click="chooseCategory(category.value)"
        >
          {{ category.label }}
        </button>
      </div>
      <el-input
        v-model="search"
        class="course-search"
        clearable
        placeholder="搜索课程、简介或教师"
        :prefix-icon="Search"
        @keyup.enter="loadCourses({ resetPage: true })"
        @clear="loadCourses({ resetPage: true })"
      >
        <template #append>
          <el-button :icon="Search" @click="loadCourses({ resetPage: true })">
            搜索
          </el-button>
        </template>
      </el-input>
    </div>

    <div v-if="loading" class="course-grid" aria-busy="true">
      <el-skeleton v-for="item in 6" :key="item" animated class="skeleton-card">
        <template #template>
          <el-skeleton-item variant="image" class="skeleton-cover" />
          <div class="skeleton-body">
            <el-skeleton-item variant="h3" style="width: 68%" />
            <el-skeleton-item variant="text" />
            <el-skeleton-item variant="text" style="width: 82%" />
          </div>
        </template>
      </el-skeleton>
    </div>

    <el-result
      v-else-if="loadError"
      icon="error"
      title="课程暂时无法加载"
      :sub-title="loadError"
    >
      <template #extra>
        <el-button type="primary" :icon="Refresh" @click="loadCourses()">
          重新加载
        </el-button>
      </template>
    </el-result>

    <el-empty
      v-else-if="courses.length === 0"
      description="没有找到符合条件的已发布课程"
    >
      <el-button type="primary" @click="resetFilters"> 查看全部课程 </el-button>
    </el-empty>

    <div v-else class="course-grid">
      <article
        v-for="course in courses"
        :key="course.id"
        class="course-card"
        tabindex="0"
        @click="openCourse(course.id)"
        @keyup.enter="openCourse(course.id)"
      >
        <div class="course-cover">
          <img
            v-if="course.coverUrl"
            :src="course.coverUrl"
            :alt="course.title"
          />
          <div v-else class="cover-fallback">
            <span>{{ course.category }}</span>
            <strong>{{ course.title.slice(0, 2) }}</strong>
          </div>
          <span class="level-chip">{{
            levelLabels[course.level] || course.level
          }}</span>
        </div>
        <div class="course-body">
          <div class="course-heading">
            <h2>{{ course.title }}</h2>
            <strong>{{ formatPrice(course.priceCents) }}</strong>
          </div>
          <p>{{ course.summary || '教师正在完善课程介绍。' }}</p>
          <div class="course-meta">
            <span
              ><el-icon><User /></el-icon>{{ course.teacher.displayName }}</span
            >
            <span
              ><el-icon><Clock /></el-icon
              >{{ course.durationMinutes }} 分钟</span
            >
          </div>
        </div>
      </article>
    </div>

    <el-pagination
      v-if="totalPages > 1"
      class="pagination"
      background
      layout="prev, pager, next"
      :page-size="pageSize"
      :total="total"
      :current-page="currentPage"
      @current-change="changePage"
    />

    <el-drawer v-model="detailVisible" size="min(560px, 92vw)" destroy-on-close>
      <template #header>
        <div>
          <p class="drawer-eyebrow">COURSE DETAILS</p>
          <h2 class="drawer-title">
            {{ selectedCourse?.title || '课程详情' }}
          </h2>
        </div>
      </template>

      <div v-loading="detailLoading" class="course-detail">
        <template v-if="selectedCourse">
          <div class="detail-banner">
            <span>{{ selectedCourse.category }}</span>
            <strong>{{
              levelLabels[selectedCourse.level] || selectedCourse.level
            }}</strong>
          </div>
          <p class="detail-summary">{{ selectedCourse.summary }}</p>
          <p class="detail-description">{{ selectedCourse.description }}</p>

          <div class="detail-facts">
            <div>
              <Clock /> <span>{{ selectedCourse.durationMinutes }} 分钟</span>
            </div>
            <div>
              <Reading /> <span>{{ selectedCourse.capacity }} 人容量</span>
            </div>
            <div>
              <User /> <span>{{ selectedCourse.teacher.displayName }}</span>
            </div>
          </div>

          <button
            type="button"
            class="teacher-card"
            @click="viewTeacher(selectedCourse.teacher.id)"
          >
            <span class="teacher-avatar">
              {{ selectedCourse.teacher.displayName?.slice(0, 1) || '师' }}
            </span>
            <span>
              <strong>{{ selectedCourse.teacher.displayName }}</strong>
              <small>
                {{ selectedCourse.teacher.school || '认证国际中文教师' }}
              </small>
            </span>
            <span class="teacher-link">查看教师 →</span>
          </button>

          <div class="drawer-actions">
            <span class="detail-price">{{
              formatPrice(selectedCourse.priceCents)
            }}</span>
            <el-button
              type="primary"
              size="large"
              @click="startHomework(selectedCourse.id)"
            >
              进入课程作业
            </el-button>
          </div>
        </template>
      </div>
    </el-drawer>
  </section>
</template>

<style scoped>
.course-page {
  min-height: calc(100vh - 120px);
  padding: 28px;
  color: #183153;
  background:
    radial-gradient(circle at 8% 0%, rgba(83, 183, 255, 0.16), transparent 28%),
    #f7fbff;
}

.hero-panel {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 30px 34px;
  border: 1px solid rgba(47, 128, 237, 0.14);
  border-radius: 24px;
  background: linear-gradient(120deg, #ffffff 0%, #edf8ff 100%);
  box-shadow: 0 18px 50px rgba(35, 90, 130, 0.08);
}

.eyebrow,
.drawer-eyebrow {
  margin: 0 0 8px;
  color: #1d85c9;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.hero-panel h1 {
  margin: 0;
  font-size: clamp(26px, 3vw, 40px);
  line-height: 1.2;
}

.hero-copy {
  max-width: 680px;
  margin: 12px 0 0;
  color: #60758c;
  line-height: 1.8;
}

.hero-stat {
  min-width: 130px;
  padding: 18px 22px;
  border-radius: 18px;
  color: white;
  text-align: center;
  background: linear-gradient(145deg, #1588d0, #50b6e8);
}

.hero-stat strong,
.hero-stat span {
  display: block;
}

.hero-stat strong {
  font-size: 34px;
}

.hero-stat span {
  margin-top: 2px;
  font-size: 13px;
  opacity: 0.86;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin: 24px 0;
}

.category-tabs {
  display: flex;
  gap: 8px;
  padding: 5px;
  border-radius: 14px;
  background: #eaf4fb;
}

.category-tabs button {
  padding: 9px 16px;
  border: 0;
  border-radius: 10px;
  color: #577089;
  background: transparent;
  cursor: pointer;
}

.category-tabs button.active {
  color: #176da7;
  font-weight: 700;
  background: white;
  box-shadow: 0 4px 14px rgba(31, 105, 150, 0.12);
}

.course-search {
  width: min(460px, 100%);
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.course-card,
.skeleton-card {
  overflow: hidden;
  border: 1px solid rgba(43, 113, 158, 0.12);
  border-radius: 20px;
  background: white;
}

.course-card {
  cursor: pointer;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.course-card:hover,
.course-card:focus-visible {
  outline: none;
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(36, 92, 128, 0.13);
}

.course-cover,
.skeleton-cover {
  position: relative;
  width: 100%;
  height: 168px;
}

.course-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-fallback {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 22px;
  color: white;
  background:
    linear-gradient(145deg, rgba(17, 117, 172, 0.92), rgba(83, 188, 207, 0.85)),
    radial-gradient(circle at 80% 20%, white, transparent 30%);
}

.cover-fallback span {
  font-size: 13px;
  letter-spacing: 0.08em;
}

.cover-fallback strong {
  align-self: flex-end;
  font-size: 54px;
  line-height: 1;
  opacity: 0.28;
}

.level-chip {
  position: absolute;
  top: 14px;
  right: 14px;
  padding: 5px 10px;
  border-radius: 999px;
  color: #15577d;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
}

.course-body,
.skeleton-body {
  padding: 18px;
}

.course-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.course-heading h2 {
  margin: 0;
  font-size: 18px;
}

.course-heading strong {
  flex: none;
  color: #e8773d;
  font-size: 14px;
}

.course-body > p {
  display: -webkit-box;
  min-height: 44px;
  margin: 10px 0 16px;
  overflow: hidden;
  color: #687e92;
  font-size: 14px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.course-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #7b90a3;
  font-size: 12px;
}

.course-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pagination {
  justify-content: center;
  margin-top: 28px;
}

.drawer-title {
  margin: 0;
  color: #183153;
}

.course-detail {
  min-height: 320px;
}

.detail-banner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  min-height: 150px;
  padding: 24px;
  border-radius: 20px;
  color: white;
  background: linear-gradient(135deg, #147ebd, #5ec0cb);
}

.detail-banner strong {
  font-size: 28px;
  opacity: 0.45;
}

.detail-summary {
  margin: 22px 0 10px;
  color: #26445e;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.7;
}

.detail-description {
  color: #687e92;
  line-height: 1.8;
  white-space: pre-wrap;
}

.detail-facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 22px 0;
}

.detail-facts div {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  color: #4f6d83;
  background: #eef7fb;
}

.detail-facts svg {
  width: 18px;
}

.teacher-card {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 14px;
  border: 1px solid #dcebf3;
  border-radius: 16px;
  color: inherit;
  text-align: left;
  background: white;
  cursor: pointer;
}

.teacher-avatar {
  display: grid;
  width: 44px;
  height: 44px;
  margin-right: 12px;
  border-radius: 50%;
  color: white;
  font-weight: 800;
  place-items: center;
  background: #38a2d2;
}

.teacher-card strong,
.teacher-card small {
  display: block;
}

.teacher-card small {
  margin-top: 4px;
  color: #7c91a3;
}

.teacher-link {
  margin-left: auto;
  color: #1b82bd;
  font-size: 13px;
}

.drawer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid #e7eff4;
}

.detail-price {
  color: #e8773d;
  font-size: 24px;
  font-weight: 800;
}

@media (max-width: 760px) {
  .course-page {
    padding: 16px;
  }

  .hero-panel,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-stat {
    align-self: flex-start;
  }

  .category-tabs {
    overflow-x: auto;
  }

  .course-search {
    width: 100%;
  }

  .detail-facts {
    grid-template-columns: 1fr;
  }
}
</style>
