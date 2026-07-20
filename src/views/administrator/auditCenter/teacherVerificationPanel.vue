<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Refresh, Search, UserFilled } from '@element-plus/icons-vue'

import {
  decideTeacherVerification,
  getTeacherVerificationQueue
} from '@/api/platform'

const queue = ref([])
const loading = ref(false)
const loadError = ref('')
const search = ref('')
const status = ref('pending')
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)
const selectedTeacher = ref(null)
const decisionVisible = ref(false)
const decisionAction = ref('approve')
const decisionNote = ref('')
const deciding = ref(false)

const statusTabs = [
  { label: '待认证', value: 'pending' },
  { label: '已认证', value: 'verified' }
]

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
)

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
    const result = await getTeacherVerificationQueue({
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
    loadError.value = errorMessage(error, '教师认证列表加载失败')
  } finally {
    loading.value = false
  }
}

const selectStatus = (value) => {
  status.value = value
  loadQueue({ resetPage: true })
}

const openDecision = (teacher, action) => {
  selectedTeacher.value = teacher
  decisionAction.value = action
  decisionNote.value = ''
  decisionVisible.value = true
}

const submitDecision = async () => {
  if (decisionAction.value === 'revoke' && !decisionNote.value.trim()) {
    ElMessage.warning('撤销认证时必须填写具体原因')
    return
  }

  deciding.value = true
  try {
    await decideTeacherVerification(selectedTeacher.value.id, {
      action: decisionAction.value,
      note: decisionNote.value.trim()
    })
    ElMessage.success(
      decisionAction.value === 'approve'
        ? '教师身份认证已通过'
        : '教师身份认证已撤销'
    )
    decisionVisible.value = false
    await loadQueue()
  } catch (error) {
    ElMessage.error(errorMessage(error, '认证决定提交失败'))
  } finally {
    deciding.value = false
  }
}

onMounted(() => loadQueue())
</script>

<template>
  <section class="teacher-verification">
    <div class="verification-summary">
      <div class="summary-icon">
        <el-icon><UserFilled /></el-icon>
      </div>
      <div>
        <strong>教师身份认证</strong>
        <p>
          根据教师提交的机构、职称与证书信息作出平台内认证决定；证书真实性仍需审核人员线下核验。
        </p>
      </div>
      <span class="summary-count">{{ total }} 人</span>
    </div>

    <div class="verification-toolbar">
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
        class="verification-search"
        placeholder="搜索教师、邮箱或任职机构"
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
      <el-table v-loading="loading" :data="queue" row-key="id">
        <el-table-column label="教师" min-width="220">
          <template #default="{ row }">
            <div class="teacher-cell">
              <el-avatar :size="42" :src="row.avatarUrl">
                {{ row.displayName.slice(0, 1) }}
              </el-avatar>
              <span>
                <strong>{{ row.displayName }}</strong>
                <small>{{ row.email }}</small>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="专业信息" min-width="250">
          <template #default="{ row }">
            <strong>{{ row.title || '未填写职称' }}</strong>
            <small class="muted">{{ row.school || '未填写任职机构' }}</small>
            <div v-if="row.specialties.length" class="tag-row">
              <el-tag
                v-for="item in row.specialties.slice(0, 3)"
                :key="item"
                size="small"
                effect="plain"
              >
                {{ item }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="证书材料" min-width="210">
          <template #default="{ row }">
            <div v-if="row.certificates.length" class="certificate-list">
              <span v-for="item in row.certificates" :key="item">
                {{ item }}
              </span>
            </div>
            <span v-else class="muted">未填写证书信息</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="status === 'pending' ? '提交/更新时间' : '认证时间'"
          min-width="170"
        >
          <template #default="{ row }">
            {{ formatTime(row.verifiedAt || row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag
              :type="
                row.verificationStatus === 'verified' ? 'success' : 'warning'
              "
            >
              {{ row.verificationStatus === 'verified' ? '已认证' : '待认证' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.verificationStatus === 'pending'"
              type="success"
              plain
              :icon="Check"
              @click="openDecision(row, 'approve')"
            >
              通过认证
            </el-button>
            <el-button
              v-else
              type="danger"
              plain
              @click="openDecision(row, 'revoke')"
            >
              撤销认证
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty
            :description="
              status === 'pending' ? '暂无待认证教师' : '暂无已认证教师'
            "
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

    <el-dialog
      v-model="decisionVisible"
      :title="
        decisionAction === 'approve' ? '确认教师身份认证' : '撤销教师身份认证'
      "
      width="min(520px, 92vw)"
    >
      <div v-if="selectedTeacher" class="decision-context">
        <strong>{{ selectedTeacher.displayName }}</strong>
        <span>
          {{ selectedTeacher.school || '未填写机构' }} ·
          {{ selectedTeacher.title || '未填写职称' }}
        </span>
        <p>
          证书：{{
            selectedTeacher.certificates.join('、') || '未填写证书信息'
          }}
        </p>
      </div>
      <el-alert
        v-if="decisionAction === 'revoke'"
        type="warning"
        :closable="false"
        show-icon
        title="撤销后，该教师将立即从默认公开发现中隐藏，且不能接受新的预约。"
      />
      <el-input
        v-model="decisionNote"
        type="textarea"
        :rows="4"
        maxlength="2000"
        show-word-limit
        :placeholder="
          decisionAction === 'approve'
            ? '可选：记录人工核验依据'
            : '必填：说明撤销原因，教师将在通知中看到该说明'
        "
      />
      <template #footer>
        <el-button @click="decisionVisible = false">取消</el-button>
        <el-button
          :type="decisionAction === 'approve' ? 'success' : 'danger'"
          :loading="deciding"
          @click="submitDecision"
        >
          确认{{ decisionAction === 'approve' ? '通过' : '撤销' }}
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.teacher-verification {
  color: #183153;
}

.verification-summary {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  margin: 22px 0;
  padding: 18px 20px;
  border: 1px solid #dcebf2;
  border-radius: 18px;
  background: linear-gradient(135deg, #ffffff, #eef8fa);
}

.summary-icon {
  display: grid;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  color: white;
  font-size: 22px;
  background: linear-gradient(140deg, #237ca9, #56b4b8);
  place-items: center;
}

.verification-summary strong,
.teacher-cell strong,
.teacher-cell small,
.muted {
  display: block;
}

.verification-summary p {
  margin: 5px 0 0;
  color: #688093;
  font-size: 13px;
  line-height: 1.55;
}

.summary-count {
  padding: 7px 12px;
  border-radius: 999px;
  color: #1e779e;
  font-weight: 700;
  background: #e0f3f5;
}

.verification-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
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

.verification-search {
  width: min(380px, 100%);
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

.teacher-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.teacher-cell small,
.muted {
  margin-top: 4px;
  color: #8193a3;
  font-size: 12px;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}

.certificate-list {
  display: grid;
  gap: 5px;
  color: #526f83;
  font-size: 13px;
}

.pagination {
  justify-content: center;
  margin-top: 24px;
}

.decision-context {
  display: grid;
  gap: 5px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 12px;
  color: #587187;
  background: #edf6fa;
}

.decision-context strong {
  color: #23445f;
  font-size: 16px;
}

.decision-context p {
  margin: 4px 0 0;
}

.decision-context + .el-alert {
  margin-bottom: 14px;
}

@media (max-width: 760px) {
  .verification-summary,
  .verification-toolbar {
    align-items: stretch;
    grid-template-columns: auto 1fr;
    flex-direction: column;
  }

  .summary-count {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .verification-search {
    width: 100%;
  }
}
</style>
