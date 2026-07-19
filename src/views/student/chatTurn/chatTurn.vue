<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  createDialogue,
  getDialogue,
  getDialogues,
  sendDialogueMessage
} from '@/api/platform'

const route = useRoute()
const router = useRouter()
const sessions = ref([])
const activeSession = ref(null)
const loading = ref(true)
const dialogueLoading = ref(false)
const generating = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const input = ref('')
const dialogueBody = ref(null)
const createForm = reactive({ title: '', keywords: ['', '', ''] })

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

async function scrollToBottom() {
  await nextTick()
  dialogueBody.value?.scrollTo({
    top: dialogueBody.value.scrollHeight,
    behavior: 'smooth'
  })
}

async function loadSession(sessionId) {
  if (!sessionId) return
  dialogueLoading.value = true
  try {
    activeSession.value = await getDialogue(sessionId)
    await router.replace({ query: { ...route.query, dialogueId: sessionId } })
    await scrollToBottom()
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || '对话加载失败')
  } finally {
    dialogueLoading.value = false
  }
}

async function loadSessions() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await getDialogues({ page: 1, pageSize: 50 })
    sessions.value = data.items
    const requested = route.query.dialogueId
    const initial =
      sessions.value.find((item) => item.id === requested) || sessions.value[0]
    if (initial) await loadSession(initial.id)
  } catch (error) {
    errorMessage.value = error?.response?.data?.msg || '历史对话加载失败'
  } finally {
    loading.value = false
  }
}

async function generateDialogue() {
  const keywords = createForm.keywords
    .map((item) => item.trim())
    .filter(Boolean)
  if (keywords.length < 1) {
    ElMessage.warning('请至少填写一个练习关键词')
    return
  }
  if (new Set(keywords).size !== keywords.length) {
    ElMessage.warning('关键词不能重复')
    return
  }

  generating.value = true
  try {
    const session = await createDialogue({
      keywords,
      ...(createForm.title.trim() ? { title: createForm.title.trim() } : {})
    })
    activeSession.value = session
    sessions.value.unshift({ ...session, turnCount: session.turns.length })
    createForm.title = ''
    createForm.keywords = ['', '', '']
    await router.replace({ query: { dialogueId: session.id } })
    await scrollToBottom()
    ElMessage.success('新的中文情境已生成')
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || '生成失败，请稍后重试')
  } finally {
    generating.value = false
  }
}

async function sendMessage() {
  const message = input.value.trim()
  if (!message || !activeSession.value || sending.value) return
  sending.value = true
  input.value = ''
  try {
    const data = await sendDialogueMessage(activeSession.value.id, message)
    activeSession.value.turns.push(...data.turns)
    activeSession.value.provider = data.provider
    const summary = sessions.value.find(
      (item) => item.id === activeSession.value.id
    )
    if (summary) {
      summary.lastMessage = data.turns.at(-1)?.content
      summary.turnCount = activeSession.value.turns.length
      summary.updatedAt = new Date().toISOString()
    }
    await scrollToBottom()
  } catch (error) {
    input.value = message
    ElMessage.error(error?.response?.data?.msg || '消息发送失败')
  } finally {
    sending.value = false
  }
}

function speak(content) {
  if (!('speechSynthesis' in window)) {
    ElMessage.info('当前浏览器不支持语音朗读')
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(content)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.88
  window.speechSynthesis.speak(utterance)
}

function openDigitalHuman() {
  router.push({
    path: '/student/digitalHuman',
    query: { dialogueId: activeSession.value.id }
  })
}

onMounted(loadSessions)
</script>

<template>
  <div class="dialogue-studio">
    <aside class="session-rail">
      <header>
        <p>中文情境实验室</p>
        <span>Dialogue Lab / 01</span>
      </header>

      <el-skeleton v-if="loading" :rows="5" animated />
      <el-result v-else-if="errorMessage" icon="error" :title="errorMessage">
        <template #extra>
          <el-button link @click="loadSessions">重试</el-button>
        </template>
      </el-result>
      <div v-else class="session-list">
        <button
          v-for="session in sessions"
          :key="session.id"
          type="button"
          :class="{ active: activeSession?.id === session.id }"
          @click="loadSession(session.id)"
        >
          <span>{{ formatDate(session.updatedAt) }}</span>
          <strong>{{ session.title }}</strong>
          <small>{{ session.keywords.join(' · ') }}</small>
        </button>
        <p v-if="sessions.length === 0" class="rail-empty">
          还没有练习记录。<br />从右侧创建第一段中文对话。
        </p>
      </div>
    </aside>

    <main class="studio-main">
      <section class="generator-panel">
        <div class="generator-copy">
          <span>CREATE A SCENE</span>
          <h1>用三个词，打开一段中文</h1>
          <p>
            本地模式无需外部 AI 也可完整运行；配置 AI
            接口后会自动切换并保留降级能力。
          </p>
        </div>
        <div class="generator-form">
          <el-input
            v-model="createForm.title"
            maxlength="160"
            placeholder="练习标题（可选）"
          />
          <div class="keyword-row">
            <el-input
              v-for="(_, index) in createForm.keywords"
              :key="index"
              v-model="createForm.keywords[index]"
              :placeholder="`关键词 ${index + 1}`"
              maxlength="40"
              @keyup.enter="generateDialogue"
            />
          </div>
          <el-button
            type="primary"
            :loading="generating"
            @click="generateDialogue"
          >
            生成情境
          </el-button>
        </div>
      </section>

      <section class="conversation-panel">
        <header v-if="activeSession" class="conversation-header">
          <div>
            <p>{{ activeSession.keywords.join(' / ') }}</p>
            <h2>{{ activeSession.title }}</h2>
          </div>
          <div class="conversation-tools">
            <span :class="['provider-badge', activeSession.provider]">
              {{
                activeSession.provider === 'external'
                  ? 'AI ONLINE'
                  : 'LOCAL READY'
              }}
            </span>
            <el-button plain @click="openDigitalHuman">沉浸练习</el-button>
          </div>
        </header>

        <div v-if="dialogueLoading" class="conversation-state">
          <el-skeleton :rows="6" animated />
        </div>
        <el-empty
          v-else-if="!activeSession"
          class="conversation-state"
          description="输入关键词，创建第一段对话"
        />
        <template v-else>
          <div ref="dialogueBody" class="dialogue-body" aria-live="polite">
            <article
              v-for="turn in activeSession.turns"
              :key="turn.id"
              :class="['turn', turn.speaker]"
            >
              <span class="speaker-index">
                {{
                  turn.speaker === 'student'
                    ? '我'
                    : turn.speaker === 'tutor'
                      ? 'ICE'
                      : '提示'
                }}
              </span>
              <div>
                <p>{{ turn.content }}</p>
                <button
                  v-if="turn.speaker === 'tutor'"
                  type="button"
                  class="speak-button"
                  @click="speak(turn.content)"
                >
                  朗读 ↗
                </button>
              </div>
            </article>
            <div v-if="sending" class="typing-indicator">ICE 正在组织反馈…</div>
          </div>
          <form class="composer" @submit.prevent="sendMessage">
            <el-input
              v-model="input"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 4 }"
              maxlength="2000"
              placeholder="用中文继续这段对话…"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <el-button type="primary" native-type="submit" :loading="sending">
              发送
            </el-button>
          </form>
        </template>
      </section>
    </main>
  </div>
</template>

<style scoped>
.dialogue-studio {
  --ink: #10282d;
  --paper: #f5f0e4;
  --jade: #1d6d63;
  --cinnabar: #c74935;
  display: grid;
  min-height: calc(100vh - 76px);
  grid-template-columns: minmax(220px, 280px) 1fr;
  color: var(--ink);
  background: var(--paper);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

.session-rail {
  min-height: 0;
  border-right: 1px solid rgba(16, 40, 45, 0.22);
  padding: 30px 18px;
  background: #e7e1d3;
}

.session-rail > header {
  margin: 0 10px 24px;
  border-bottom: 1px solid rgba(16, 40, 45, 0.18);
  padding-bottom: 18px;
}

.session-rail header p {
  margin: 0 0 5px;
  font-size: 18px;
  font-weight: 700;
}

.session-rail header span,
.generator-copy > span {
  color: var(--cinnabar);
  font:
    700 10px ui-monospace,
    monospace;
  letter-spacing: 0.17em;
}

.session-list {
  display: grid;
  gap: 7px;
  max-height: calc(100vh - 190px);
  overflow-y: auto;
}

.session-list button {
  display: grid;
  gap: 5px;
  border: 0;
  border-left: 3px solid transparent;
  padding: 13px 12px;
  color: var(--ink);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: 0.2s ease;
}

.session-list button:hover,
.session-list button.active {
  border-left-color: var(--cinnabar);
  background: rgba(255, 253, 247, 0.66);
}

.session-list button span,
.session-list button small {
  color: #6d7979;
  font:
    10px ui-monospace,
    monospace;
}

.session-list button strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-empty {
  padding: 30px 12px;
  color: #758180;
  line-height: 1.8;
}

.studio-main {
  min-width: 0;
  padding: clamp(22px, 4vw, 54px);
}

.generator-panel {
  display: grid;
  grid-template-columns: minmax(230px, 0.8fr) minmax(320px, 1.2fr);
  gap: clamp(24px, 5vw, 72px);
  margin-bottom: 32px;
  border-bottom: 1px solid rgba(16, 40, 45, 0.2);
  padding-bottom: 34px;
}

.generator-copy h1 {
  margin: 8px 0;
  font-size: clamp(28px, 4vw, 48px);
  letter-spacing: -0.055em;
  line-height: 1.15;
}

.generator-copy p {
  max-width: 620px;
  margin: 0;
  color: #667572;
  line-height: 1.8;
}

.generator-form {
  display: grid;
  align-content: center;
  gap: 12px;
}

.keyword-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.generator-form :deep(.el-button--primary),
.composer :deep(.el-button--primary) {
  border-color: var(--ink);
  border-radius: 0;
  background: var(--ink);
}

.conversation-panel {
  min-height: 520px;
  border: 1px solid rgba(16, 40, 45, 0.35);
  background: rgba(255, 253, 247, 0.72);
  box-shadow: 12px 12px 0 rgba(16, 40, 45, 0.08);
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid rgba(16, 40, 45, 0.18);
  padding: 18px 22px;
}

.conversation-header p {
  margin: 0;
  color: var(--cinnabar);
  font:
    10px ui-monospace,
    monospace;
  letter-spacing: 0.13em;
}

.conversation-header h2 {
  margin: 4px 0 0;
  font-size: 22px;
}

.conversation-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-badge {
  border: 1px solid currentColor;
  padding: 5px 8px;
  color: var(--jade);
  font:
    700 9px ui-monospace,
    monospace;
  letter-spacing: 0.12em;
}

.provider-badge.external {
  color: var(--cinnabar);
}

.dialogue-body {
  height: min(52vh, 540px);
  overflow-y: auto;
  padding: clamp(20px, 4vw, 42px);
}

.turn {
  display: grid;
  max-width: 78%;
  grid-template-columns: 44px 1fr;
  gap: 13px;
  margin-bottom: 25px;
}

.turn.student {
  margin-left: auto;
  grid-template-columns: 1fr 44px;
}

.turn.student .speaker-index {
  grid-column: 2;
  grid-row: 1;
  background: var(--cinnabar);
}

.turn.student > div {
  grid-column: 1;
  grid-row: 1;
  text-align: right;
}

.turn.system {
  max-width: 100%;
  padding-block: 8px;
  color: #74817f;
  font-size: 13px;
}

.speaker-index {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: white;
  background: var(--jade);
  font-size: 12px;
}

.turn p {
  margin: 0;
  line-height: 1.85;
}

.speak-button {
  border: 0;
  padding: 5px 0;
  color: var(--jade);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
}

.typing-indicator {
  color: #72807e;
  font-size: 12px;
  animation: pulse 1.2s ease-in-out infinite;
}

.composer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  border-top: 1px solid rgba(16, 40, 45, 0.18);
  padding: 14px;
}

.conversation-state {
  padding: 80px 30px;
}

@keyframes pulse {
  50% {
    opacity: 0.45;
  }
}

@media (max-width: 900px) {
  .dialogue-studio {
    grid-template-columns: 1fr;
  }

  .session-rail {
    border-right: 0;
    border-bottom: 1px solid rgba(16, 40, 45, 0.2);
  }

  .session-list {
    display: flex;
    max-height: none;
    overflow-x: auto;
  }

  .session-list button {
    min-width: 210px;
  }

  .generator-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .keyword-row {
    grid-template-columns: 1fr;
  }

  .conversation-header,
  .conversation-tools {
    align-items: flex-start;
    flex-direction: column;
  }

  .turn {
    max-width: 96%;
  }
}
</style>
