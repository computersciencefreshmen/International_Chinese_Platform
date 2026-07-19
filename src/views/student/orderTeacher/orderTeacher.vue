<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh, Search, Star } from '@element-plus/icons-vue'

import { getTeachers } from '@/api/platform'

const router = useRouter()
const teachers = ref([])
const loading = ref(false)
const loadError = ref('')
const search = ref('')
const specialty = ref('')
const minRating = ref(undefined)
const verifiedOnly = ref(false)
const page = ref(1)
const pageSize = 8
const total = ref(0)

const specialties = ['', '生活口语', 'HSK 备考', '中国文化']
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
)

const money = (cents) =>
  cents ? `¥${(cents / 100).toFixed(0)}/课时` : '价格面议'

const errorMessage = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const loadTeachers = async ({ resetPage = false } = {}) => {
  if (resetPage) page.value = 1
  loading.value = true
  loadError.value = ''

  try {
    const result = await getTeachers({
      page: page.value,
      pageSize,
      search: search.value.trim() || undefined,
      specialty: specialty.value || undefined,
      minRating: minRating.value || undefined,
      verified: verifiedOnly.value ? 'true' : undefined
    })
    teachers.value = result?.items ?? []
    total.value = result?.pagination?.total ?? 0
  } catch (error) {
    teachers.value = []
    total.value = 0
    loadError.value = errorMessage(error, '教师列表加载失败')
  } finally {
    loading.value = false
  }
}

const openTeacher = (teacherId) => {
  router.push({ name: 'teacherDetail', query: { teacherId } })
}

const resetFilters = () => {
  search.value = ''
  specialty.value = ''
  minRating.value = undefined
  verifiedOnly.value = false
  loadTeachers({ resetPage: true })
}

onMounted(() => loadTeachers())
</script>

<template>
  <section class="teacher-page">
    <header class="teacher-hero">
      <div>
        <p>ONE-ON-ONE LEARNING</p>
        <h1>找到懂你学习节奏的中文老师</h1>
        <span>查看真实教师资料、已发布课程和可验证资历，再发起预约。</span>
      </div>
      <div class="teacher-count">
        <strong>{{ total }}</strong>
        <span>位可预约教师</span>
      </div>
    </header>

    <div class="filter-panel">
      <el-input
        v-model="search"
        clearable
        placeholder="搜索教师、学校或教学方向"
        :prefix-icon="Search"
        @keyup.enter="loadTeachers({ resetPage: true })"
        @clear="loadTeachers({ resetPage: true })"
      />
      <el-select
        v-model="specialty"
        placeholder="教学方向"
        @change="loadTeachers({ resetPage: true })"
      >
        <el-option
          v-for="item in specialties"
          :key="item"
          :label="item || '全部方向'"
          :value="item"
        />
      </el-select>
      <el-select
        v-model="minRating"
        clearable
        placeholder="最低评分"
        @change="loadTeachers({ resetPage: true })"
      >
        <el-option label="4.5 分以上" :value="4.5" />
        <el-option label="4.8 分以上" :value="4.8" />
      </el-select>
      <el-checkbox
        v-model="verifiedOnly"
        border
        @change="loadTeachers({ resetPage: true })"
      >
        仅认证教师
      </el-checkbox>
    </div>

    <el-alert
      v-if="loadError"
      type="error"
      show-icon
      :closable="false"
      :title="loadError"
      class="load-alert"
    >
      <template #default>
        <el-button link type="primary" :icon="Refresh" @click="loadTeachers()">
          重新加载
        </el-button>
      </template>
    </el-alert>

    <div v-if="loading" class="teacher-grid">
      <el-skeleton
        v-for="item in 4"
        :key="item"
        animated
        class="teacher-card skeleton"
      >
        <template #template>
          <el-skeleton-item
            variant="circle"
            style="width: 72px; height: 72px"
          />
          <el-skeleton-item variant="h3" style="width: 45%" />
          <el-skeleton-item variant="text" />
          <el-skeleton-item variant="text" style="width: 75%" />
        </template>
      </el-skeleton>
    </div>

    <el-empty
      v-else-if="teachers.length === 0 && !loadError"
      description="没有找到符合条件的教师"
    >
      <el-button type="primary" @click="resetFilters">清除筛选</el-button>
    </el-empty>

    <div v-else class="teacher-grid">
      <article
        v-for="teacher in teachers"
        :key="teacher.id"
        class="teacher-card"
      >
        <div class="teacher-topline">
          <div class="avatar-wrap">
            <img
              v-if="teacher.avatarUrl"
              :src="teacher.avatarUrl"
              :alt="teacher.displayName"
            />
            <span v-else>{{ teacher.displayName.slice(0, 1) }}</span>
            <i v-if="teacher.verified" title="平台认证">✓</i>
          </div>
          <div class="teacher-identity">
            <div>
              <h2>{{ teacher.displayName }}</h2>
              <el-tag v-if="teacher.verified" type="success" size="small">
                已认证
              </el-tag>
            </div>
            <p>{{ teacher.title || '国际中文教师' }}</p>
            <small>{{ teacher.school || '独立中文教育者' }}</small>
          </div>
          <div class="rating">
            <el-icon><Star /></el-icon>
            <strong>{{ teacher.rating.toFixed(1) }}</strong>
          </div>
        </div>

        <p class="bio">{{ teacher.bio || '这位教师正在完善个人介绍。' }}</p>

        <div class="tags">
          <el-tag
            v-for="tag in teacher.specialties.slice(0, 3)"
            :key="tag"
            effect="plain"
            round
          >
            {{ tag }}
          </el-tag>
          <span v-if="teacher.specialties.length === 0">综合中文</span>
        </div>

        <div class="teacher-facts">
          <span
            ><strong>{{ teacher.experienceYears }}</strong> 年经验</span
          >
          <span
            ><strong>{{ teacher.publishedCourseCount }}</strong> 门课程</span
          >
          <span
            ><strong>{{ teacher.languages.length }}</strong> 种语言</span
          >
        </div>

        <footer>
          <strong>{{ money(teacher.hourlyRateCents) }}</strong>
          <el-button type="primary" @click="openTeacher(teacher.id)">
            查看并预约
          </el-button>
        </footer>
      </article>
    </div>

    <el-pagination
      v-if="totalPages > 1"
      class="pagination"
      background
      layout="prev, pager, next"
      :page-size="pageSize"
      :total="total"
      :current-page="page"
      @current-change="
        (value) => {
          page = value
          loadTeachers()
        }
      "
    />
  </section>
</template>

<style scoped>
.teacher-page {
  min-height: calc(100vh - 120px);
  padding: 28px;
  color: #193653;
  background:
    radial-gradient(
      circle at 90% 0%,
      rgba(255, 190, 116, 0.14),
      transparent 30%
    ),
    #f8fbfd;
}

.teacher-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 30px 34px;
  border-radius: 24px;
  color: white;
  background: linear-gradient(125deg, #19486a, #257ca0 62%, #5eb5b4);
  box-shadow: 0 18px 45px rgba(24, 73, 102, 0.17);
}

.teacher-hero p {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.2em;
  opacity: 0.7;
}

.teacher-hero h1 {
  margin: 0;
  font-size: clamp(26px, 3vw, 40px);
}

.teacher-hero > div > span {
  display: block;
  margin-top: 12px;
  opacity: 0.78;
}

.teacher-count {
  min-width: 128px;
  padding: 18px 22px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 18px;
  text-align: center;
  background: rgba(255, 255, 255, 0.11);
}

.teacher-count strong,
.teacher-count span {
  display: block;
}

.teacher-count strong {
  font-size: 34px;
}

.teacher-count span {
  font-size: 12px;
  opacity: 0.75;
}

.filter-panel {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 180px 160px auto;
  gap: 12px;
  margin: 22px 0;
  padding: 14px;
  border: 1px solid #e2ebf1;
  border-radius: 17px;
  background: white;
}

.load-alert {
  margin-bottom: 18px;
}

.teacher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
}

.teacher-card {
  padding: 22px;
  border: 1px solid #e1ebf0;
  border-radius: 21px;
  background: white;
  box-shadow: 0 13px 32px rgba(42, 80, 104, 0.07);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.teacher-card:not(.skeleton):hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 40px rgba(42, 80, 104, 0.12);
}

.teacher-topline {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar-wrap {
  position: relative;
  display: grid;
  width: 72px;
  height: 72px;
  flex: none;
  overflow: visible;
  border-radius: 22px;
  color: white;
  font-size: 25px;
  font-weight: 800;
  place-items: center;
  background: linear-gradient(145deg, #2381ad, #64bfc0);
}

.avatar-wrap img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.avatar-wrap i {
  position: absolute;
  right: -5px;
  bottom: -5px;
  display: grid;
  width: 24px;
  height: 24px;
  border: 3px solid white;
  border-radius: 50%;
  color: white;
  font-size: 11px;
  font-style: normal;
  place-items: center;
  background: #2eaa73;
}

.teacher-identity {
  min-width: 0;
}

.teacher-identity > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.teacher-identity h2 {
  margin: 0;
  font-size: 20px;
}

.teacher-identity p,
.teacher-identity small {
  display: block;
  margin: 4px 0 0;
  color: #647d90;
}

.teacher-identity small {
  font-size: 12px;
}

.rating {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: #dc8b2f;
}

.bio {
  display: -webkit-box;
  min-height: 48px;
  margin: 18px 0 14px;
  overflow: hidden;
  color: #637b8d;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tags {
  display: flex;
  min-height: 28px;
  flex-wrap: wrap;
  gap: 7px;
}

.tags > span:not(.el-tag) {
  color: #7b8f9d;
  font-size: 13px;
}

.teacher-facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 18px 0;
}

.teacher-facts span {
  padding: 10px;
  border-radius: 11px;
  color: #718797;
  font-size: 12px;
  text-align: center;
  background: #f0f7fa;
}

.teacher-facts strong {
  color: #28556f;
  font-size: 15px;
}

.teacher-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e8eff3;
}

.teacher-card footer > strong {
  color: #d87439;
}

.pagination {
  justify-content: center;
  margin-top: 26px;
}

@media (max-width: 850px) {
  .filter-panel {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 620px) {
  .teacher-page {
    padding: 14px;
  }

  .teacher-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-panel,
  .teacher-grid {
    grid-template-columns: 1fr;
  }

  .teacher-facts {
    grid-template-columns: 1fr;
  }
}
</style>
