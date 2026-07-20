<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Check,
  DocumentChecked,
  Refresh,
  Search
} from '@element-plus/icons-vue'

import { getCourseReviewQueue, reviewCourse } from '@/api/platform'
import TeacherVerificationPanel from './teacherVerificationPanel.vue'

const reviewMode = ref('courses')
const queue = ref([])
const loading = ref(false)
const loadError = ref('')
const search = ref('')
const status = ref('pending')
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)
const selectedItem = ref(null)
const detailVisible = ref(false)
const reviewDialogVisible = ref(false)
const reviewAction = ref('approve')
const reviewNote = ref('')
const reviewing = ref(false)

const statusTabs = [
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'published' },
  { label: '已驳回', value: 'rejected' }
]

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
)

const statusMeta = {
  pending: { label: '待审核', type: 'warning' },
  published: { label: '已发布', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
  draft: { label: '草稿', type: 'info' },
  archived: { label: '已归档', type: 'info' }
}

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '—'

const errorMessage = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const loadQueue = async ({ resetPage = false } = {}) => {
  if (resetPage) currentPage.value = 1
  loading.value = true
  loadError.value = ''

  try {
    const result = await getCourseReviewQueue({
      page: currentPage.value,
      pageSize,
      status: status.value,
      search: search.value.trim() || undefined
    })
    queue.value = result?.items ?? []
    total.value = result?.pagination?.total ?? 0
  } catch (error) {
    queue.value = []
    total.value = 0
    loadError.value = errorMessage(error, '审核列表加载失败')
  } finally {
    loading.value = false
  }
}

const selectStatus = (value) => {
  status.value = value
  loadQueue({ resetPage: true })
}

const openDetail = (item) => {
  selectedItem.value = item
  detailVisible.value = true
}

const openReview = (item, action) => {
  selectedItem.value = item
  reviewAction.value = action
  reviewNote.value = ''
  reviewDialogVisible.value = true
}

const submitReview = async () => {
  if (reviewAction.value === 'reject' && !reviewNote.value.trim()) {
    ElMessage.warning('驳回课程时必须填写具体修改意见')
    return
  }

  reviewing.value = true
  try {
    await reviewCourse(selectedItem.value.course.id, {
      action: reviewAction.value,
      note: reviewNote.value.trim()
    })
    ElMessage.success(
      reviewAction.value === 'approve' ? '课程已审核通过' : '课程已驳回'
    )
    reviewDialogVisible.value = false
    detailVisible.value = false
    await loadQueue()
  } catch (error) {
    ElMessage.error(errorMessage(error, '审核提交失败'))
  } finally {
    reviewing.value = false
  }
}

onMounted(() => loadQueue())
</script>

<template>
  <section class="audit-page">
    <header class="audit-header">
      <div>
        <p>QUALITY CONTROL</p>
        <h1>平台审核中心</h1>
        <span>课程发布与教师身份决定都会留存审核人、时间和审计记录。</span>
      </div>
      <div class="pending-badge">
        <el-icon><DocumentChecked /></el-icon>
        <strong>{{
          reviewMode === 'courses' && status === 'pending' ? total : '双轨'
        }}</strong>
        <span>课程 · 教师</span>
      </div>
    </header>

    <nav class="audit-domain-tabs" aria-label="审核类型">
      <button
        type="button"
        :class="{ active: reviewMode === 'courses' }"
        @click="reviewMode = 'courses'"
      >
        课程内容审核
      </button>
      <button
        type="button"
        :class="{ active: reviewMode === 'teachers' }"
        @click="reviewMode = 'teachers'"
      >
        教师身份认证
      </button>
    </nav>

    <template v-if="reviewMode === 'courses'">
      <div class="audit-toolbar">
        <div class="status-tabs">
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            type="button"
            :class="{ active: status === tab.value }"
            @click="selectStatus(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>
        <el-input
          v-model="search"
          clearable
          class="audit-search"
          placeholder="搜索课程或教师"
          :prefix-icon="Search"
          @keyup.enter="loadQueue({ resetPage: true })"
          @clear="loadQueue({ resetPage: true })"
        />
      </div>

      <el-alert
        v-if="loadError"
        type="error"
        show-icon
        :closable="false"
        :title="loadError"
        class="error-alert"
      >
        <template #default>
          <el-button link type="primary" :icon="Refresh" @click="loadQueue()">
            重新加载
          </el-button>
        </template>
      </el-alert>

      <div class="table-shell">
        <el-table v-loading="loading" :data="queue" row-key="course.id">
          <el-table-column label="课程" min-width="280">
            <template #default="{ row }">
              <button
                type="button"
                class="course-cell"
                @click="openDetail(row)"
              >
                <span class="course-monogram">{{
                  row.course.title.slice(0, 1)
                }}</span>
                <span>
                  <strong>{{ row.course.title }}</strong>
                  <small
                    >{{ row.course.category }} · {{ row.course.level }}</small
                  >
                </span>
              </button>
            </template>
          </el-table-column>
          <el-table-column label="授课教师" min-width="180">
            <template #default="{ row }">
              <strong>{{ row.course.teacher.displayName }}</strong>
              <small class="muted">{{
                row.course.teacher.school || '未填写机构'
              }}</small>
            </template>
          </el-table-column>
          <el-table-column label="提交/更新时间" min-width="180">
            <template #default="{ row }">{{
              formatTime(row.submittedAt)
            }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusMeta[row.course.status]?.type">
                {{ statusMeta[row.course.status]?.label || row.course.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-button @click="openDetail(row)">查看详情</el-button>
              <template v-if="row.course.status === 'pending'">
                <el-button
                  type="success"
                  plain
                  @click="openReview(row, 'approve')"
                >
                  通过
                </el-button>
                <el-button
                  type="danger"
                  plain
                  @click="openReview(row, 'reject')"
                >
                  驳回
                </el-button>
              </template>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty
              :description="`暂无${statusMeta[status]?.label || ''}课程`"
            />
          </template>
        </el-table>
      </div>

      <el-pagination
        v-if="totalPages > 1"
        class="pagination"
        background
        layout="prev, pager, next"
        :page-size="pageSize"
        :total="total"
        :current-page="currentPage"
        @current-change="
          (page) => {
            currentPage = page
            loadQueue()
          }
        "
      />

      <el-drawer v-model="detailVisible" size="min(620px, 94vw)">
        <template #header>
          <div>
            <p class="drawer-eyebrow">REVIEW DETAILS</p>
            <h2>{{ selectedItem?.course.title }}</h2>
          </div>
        </template>

        <article v-if="selectedItem" class="review-detail">
          <div class="detail-hero">
            <span>{{ selectedItem.course.category }}</span>
            <el-tag
              :type="statusMeta[selectedItem.course.status]?.type"
              effect="dark"
            >
              {{ statusMeta[selectedItem.course.status]?.label }}
            </el-tag>
          </div>
          <section>
            <h3>课程摘要</h3>
            <p>{{ selectedItem.course.summary || '暂无摘要' }}</p>
          </section>
          <section>
            <h3>详细介绍</h3>
            <p class="pre-line">
              {{ selectedItem.course.description || '暂无详细介绍' }}
            </p>
          </section>
          <div class="facts">
            <span>教师：{{ selectedItem.course.teacher.displayName }}</span>
            <span>时长：{{ selectedItem.course.durationMinutes }} 分钟</span>
            <span>容量：{{ selectedItem.course.capacity }} 人</span>
            <span
              >价格：¥{{
                (selectedItem.course.priceCents / 100).toFixed(0)
              }}</span
            >
          </div>
          <el-alert
            v-if="selectedItem.latestReview"
            :type="
              selectedItem.latestReview.decision === 'approved'
                ? 'success'
                : 'warning'
            "
            :title="`最近审核：${selectedItem.latestReview.note || '无备注'}`"
            :closable="false"
            show-icon
          />
          <div
            v-if="selectedItem.course.status === 'pending'"
            class="drawer-actions"
          >
            <el-button
              type="danger"
              plain
              @click="openReview(selectedItem, 'reject')"
            >
              驳回并给出意见
            </el-button>
            <el-button
              type="success"
              :icon="Check"
              @click="openReview(selectedItem, 'approve')"
            >
              审核通过
            </el-button>
          </div>
        </article>
      </el-drawer>

      <el-dialog
        v-model="reviewDialogVisible"
        :title="reviewAction === 'approve' ? '确认通过课程' : '驳回课程并反馈'"
        width="min(500px, 92vw)"
      >
        <p class="dialog-course">{{ selectedItem?.course.title }}</p>
        <el-input
          v-model="reviewNote"
          type="textarea"
          :rows="4"
          maxlength="2000"
          show-word-limit
          :placeholder="
            reviewAction === 'approve'
              ? '可选：记录审核依据或发布建议'
              : '必填：请写明需要教师修改的具体内容'
          "
        />
        <template #footer>
          <el-button @click="reviewDialogVisible = false">取消</el-button>
          <el-button
            :type="reviewAction === 'approve' ? 'success' : 'danger'"
            :loading="reviewing"
            @click="submitReview"
          >
            确认{{ reviewAction === 'approve' ? '通过' : '驳回' }}
          </el-button>
        </template>
      </el-dialog>
    </template>

    <TeacherVerificationPanel v-else />
  </section>
</template>

<style scoped>
.audit-page {
  min-height: calc(100vh - 110px);
  padding: 26px;
  color: #183153;
  background: #f6faff;
}

.audit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 30px;
  border-radius: 22px;
  color: white;
  background: linear-gradient(125deg, #163b65, #1e87b8);
  box-shadow: 0 18px 40px rgba(19, 69, 103, 0.18);
}

.audit-header p,
.drawer-eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.2em;
  opacity: 0.75;
}

.audit-header h1,
.drawer-eyebrow + h2 {
  margin: 0;
}

.audit-header > div > span {
  display: block;
  margin-top: 10px;
  opacity: 0.82;
}

.pending-badge {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 0 10px;
  min-width: 130px;
  padding: 14px 18px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
}

.pending-badge .el-icon {
  grid-row: span 2;
  font-size: 30px;
}

.pending-badge strong {
  font-size: 26px;
  line-height: 1;
}

.pending-badge span {
  font-size: 12px;
  opacity: 0.72;
}

.audit-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin: 22px 0;
}

.audit-domain-tabs {
  display: inline-flex;
  gap: 8px;
  margin-top: 22px;
  padding: 5px;
  border: 1px solid #dce8ef;
  border-radius: 14px;
  background: white;
  box-shadow: 0 8px 22px rgba(40, 82, 111, 0.06);
}

.audit-domain-tabs button {
  padding: 10px 20px;
  border: 0;
  border-radius: 10px;
  color: #627b8f;
  font-weight: 700;
  background: transparent;
  cursor: pointer;
}

.audit-domain-tabs button.active {
  color: white;
  background: linear-gradient(135deg, #1c6f9d, #3ea2b5);
  box-shadow: 0 6px 14px rgba(30, 126, 163, 0.22);
}

.status-tabs {
  display: flex;
  gap: 8px;
  padding: 5px;
  border-radius: 13px;
  background: #e8f2f9;
}

.status-tabs button {
  padding: 9px 18px;
  border: 0;
  border-radius: 9px;
  color: #587187;
  background: transparent;
  cursor: pointer;
}

.status-tabs button.active {
  color: #176b9c;
  font-weight: 700;
  background: white;
  box-shadow: 0 4px 13px rgba(32, 91, 126, 0.12);
}

.audit-search {
  width: min(360px, 100%);
}

.error-alert {
  margin-bottom: 16px;
}

.table-shell {
  overflow: hidden;
  padding: 8px 16px 16px;
  border: 1px solid #e4edf3;
  border-radius: 20px;
  background: white;
  box-shadow: 0 14px 35px rgba(40, 82, 111, 0.07);
}

.course-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.course-monogram {
  display: grid;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 12px;
  color: white;
  font-weight: 800;
  place-items: center;
  background: linear-gradient(140deg, #2487bd, #6bc2ca);
}

.course-cell strong,
.course-cell small,
.muted {
  display: block;
}

.course-cell small,
.muted {
  margin-top: 4px;
  color: #8193a3;
  font-size: 12px;
}

.pagination {
  justify-content: center;
  margin-top: 24px;
}

.drawer-eyebrow {
  color: #247dac;
}

.review-detail section {
  margin: 22px 0;
}

.review-detail h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.review-detail p {
  color: #60778a;
  line-height: 1.75;
}

.detail-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  min-height: 130px;
  padding: 22px;
  border-radius: 18px;
  color: white;
  background: linear-gradient(140deg, #235c82, #4babc3);
}

.pre-line {
  white-space: pre-line;
}

.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.facts span {
  padding: 12px;
  border-radius: 10px;
  color: #526f83;
  background: #edf6fa;
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.dialog-course {
  margin-top: 0;
  color: #23445f;
  font-weight: 700;
}

@media (max-width: 720px) {
  .audit-page {
    padding: 14px;
  }

  .audit-header,
  .audit-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .audit-domain-tabs {
    display: flex;
  }

  .audit-domain-tabs button {
    flex: 1;
  }

  .pending-badge {
    align-self: flex-start;
  }

  .status-tabs {
    overflow-x: auto;
  }

  .audit-search {
    width: 100%;
  }

  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
