<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import {
  getNotifications,
  readAllNotifications,
  readNotification
} from '@/api/platform'

const router = useRouter()
const loading = ref(true)
const actionLoading = ref(false)
const errorMessage = ref('')
const items = ref([])
const unread = ref(0)
const status = ref('all')
const page = ref(1)
const pagination = ref({ page: 1, pageSize: 12, total: 0, totalPages: 0 })

const statusLabel = {
  all: '全部来信',
  unread: '尚未阅读',
  read: '已归档'
}

const emptyText = computed(() =>
  status.value === 'unread' ? '所有通知都已读' : '这里还没有通知'
)

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function category(type) {
  if (type.startsWith('course.')) return '课程'
  if (type.startsWith('appointment.')) return '预约'
  if (type.startsWith('submission.') || type.startsWith('assignment.'))
    return '作业'
  return '系统'
}

async function loadNotifications() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await getNotifications({
      status: status.value,
      page: page.value,
      pageSize: 12
    })
    items.value = data.items
    unread.value = data.unread
    pagination.value = data.pagination
  } catch (error) {
    errorMessage.value = error?.response?.data?.msg || '通知加载失败'
  } finally {
    loading.value = false
  }
}

function changeStatus(nextStatus) {
  status.value = nextStatus
  page.value = 1
  loadNotifications()
}

async function openNotification(item) {
  if (!item.isRead) {
    try {
      const updated = await readNotification(item.id)
      Object.assign(item, updated)
      unread.value = Math.max(0, unread.value - 1)
    } catch (error) {
      ElMessage.error(error?.response?.data?.msg || '标记已读失败')
      return
    }
  }
  if (item.link?.startsWith('/')) await router.push(item.link)
}

async function markAllRead() {
  actionLoading.value = true
  try {
    await readAllNotifications()
    ElMessage.success('所有通知已标记为已读')
    await loadNotifications()
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || '操作失败')
  } finally {
    actionLoading.value = false
  }
}

function changePage(nextPage) {
  page.value = nextPage
  loadNotifications()
}

onMounted(loadNotifications)
</script>

<template>
  <section class="notice-room" aria-labelledby="notice-title">
    <header class="notice-header">
      <div>
        <p>INBOX · 站内来信</p>
        <h1 id="notice-title">消息通知</h1>
      </div>
      <div class="unread-counter">
        <strong>{{ unread }}</strong>
        <span>未读</span>
      </div>
    </header>

    <nav class="notice-nav" aria-label="通知筛选">
      <button
        v-for="key in ['all', 'unread', 'read']"
        :key="key"
        type="button"
        :class="{ active: status === key }"
        @click="changeStatus(key)"
      >
        {{ statusLabel[key] }}
      </button>
      <el-button
        link
        :disabled="unread === 0"
        :loading="actionLoading"
        @click="markAllRead"
      >
        全部已读
      </el-button>
    </nav>

    <el-skeleton v-if="loading" :rows="6" animated />
    <el-result v-else-if="errorMessage" icon="error" :title="errorMessage">
      <template #extra>
        <el-button type="primary" @click="loadNotifications"
          >重新加载</el-button
        >
      </template>
    </el-result>
    <el-empty v-else-if="items.length === 0" :description="emptyText" />
    <div v-else class="notice-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="notice-item"
        :class="{ unread: !item.isRead, actionable: item.link }"
        :tabindex="item.link || !item.isRead ? 0 : undefined"
        @click="openNotification(item)"
        @keyup.enter="openNotification(item)"
      >
        <span class="notice-dot" aria-hidden="true"></span>
        <div class="notice-content">
          <div class="notice-meta">
            <span>{{ category(item.type) }}</span>
            <time :datetime="item.createdAt">{{
              formatTime(item.createdAt)
            }}</time>
          </div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.body }}</p>
        </div>
        <span v-if="item.link" class="notice-arrow" aria-hidden="true">↗</span>
      </article>
    </div>

    <el-pagination
      v-if="pagination.totalPages > 1"
      class="notice-pagination"
      layout="prev, pager, next"
      :current-page="pagination.page"
      :page-count="pagination.totalPages"
      @current-change="changePage"
    />
  </section>
</template>

<style scoped>
.notice-room {
  min-height: 100%;
  padding: clamp(26px, 5vw, 64px);
  color: #172c35;
  background:
    radial-gradient(circle at 90% 8%, rgba(191, 61, 47, 0.08), transparent 25%),
    #fffdf7;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

.notice-header,
.notice-nav,
.notice-item,
.notice-meta,
.unread-counter {
  display: flex;
}

.notice-header {
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 28px;
}

.notice-header p {
  margin: 0;
  color: #bf3d2f;
  font:
    700 11px ui-monospace,
    monospace;
  letter-spacing: 0.17em;
}

.notice-header h1 {
  margin: 6px 0 0;
  font-size: clamp(34px, 6vw, 58px);
  letter-spacing: -0.05em;
}

.unread-counter {
  align-items: baseline;
  gap: 8px;
  color: #bf3d2f;
}

.unread-counter strong {
  font:
    500 clamp(36px, 6vw, 64px) ui-monospace,
    monospace;
}

.notice-nav {
  align-items: center;
  gap: 6px;
  margin-bottom: 22px;
  border-block: 1px solid rgba(23, 44, 53, 0.18);
  padding: 10px 0;
}

.notice-nav button {
  border: 0;
  padding: 8px 14px;
  color: #68777d;
  background: transparent;
  cursor: pointer;
}

.notice-nav button.active {
  color: #fffdf7;
  background: #172c35;
}

.notice-nav :deep(.el-button) {
  margin-left: auto;
  color: #bf3d2f;
}

.notice-list {
  border-top: 1px solid #172c35;
}

.notice-item {
  position: relative;
  align-items: flex-start;
  gap: 18px;
  border-bottom: 1px solid rgba(23, 44, 53, 0.18);
  padding: 22px 10px;
  transition:
    padding 0.2s ease,
    background 0.2s ease;
}

.notice-item.actionable {
  cursor: pointer;
}

.notice-item.actionable:hover,
.notice-item.actionable:focus-visible {
  padding-inline: 18px;
  outline: none;
  background: rgba(23, 44, 53, 0.045);
}

.notice-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  margin-top: 8px;
  border: 1px solid #8f9a9d;
  border-radius: 50%;
}

.unread .notice-dot {
  border-color: #bf3d2f;
  background: #bf3d2f;
  box-shadow: 0 0 0 5px rgba(191, 61, 47, 0.1);
}

.notice-content {
  min-width: 0;
  flex: 1;
}

.notice-meta {
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: #77858a;
  font:
    11px ui-monospace,
    monospace;
  letter-spacing: 0.08em;
}

.notice-content h2 {
  margin: 7px 0 5px;
  font-size: 19px;
}

.unread .notice-content h2 {
  color: #bf3d2f;
}

.notice-content p {
  margin: 0;
  color: #5b6b71;
  line-height: 1.7;
}

.notice-arrow {
  color: #bf3d2f;
  font-size: 20px;
}

.notice-pagination {
  justify-content: center;
  margin-top: 28px;
}
</style>
