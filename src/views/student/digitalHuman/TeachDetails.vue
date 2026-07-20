<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import teacherAvatar from '@/assets/icon/teacher.png'
import studentAvatar from '@/assets/student/avatar.png'
import {
  createDialogue,
  getDialogue,
  getDialogues,
  sendDialogueMessage
} from '@/api/platform'

const route = useRoute()
const router = useRouter()
const session = ref(null)
const loading = ref(true)
const sending = ref(false)
const listening = ref(false)
const autoSpeak = ref(true)
const message = ref('')
const errorMessage = ref('')
const transcript = ref(null)
const stage = ref(null)

const SpeechRecognition =
  typeof window === 'undefined'
    ? null
    : window.SpeechRecognition || window.webkitSpeechRecognition
const canListen = computed(() => Boolean(SpeechRecognition))

async function scrollToBottom() {
  await nextTick()
  stage.value?.scrollTo({ top: stage.value.scrollHeight, behavior: 'smooth' })
}

function speak(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.86
  utterance.pitch = 1.02
  window.speechSynthesis.speak(utterance)
}

async function loadSession() {
  loading.value = true
  errorMessage.value = ''
  try {
    let sessionId = route.query.dialogueId
    if (!sessionId) {
      const data = await getDialogues({ page: 1, pageSize: 1 })
      sessionId = data.items[0]?.id
    }
    if (!sessionId) {
      const created = await createDialogue({
        title: '餐厅点餐沉浸练习',
        keywords: ['点餐', '餐厅', '价格']
      })
      sessionId = created.id
    }
    session.value = await getDialogue(sessionId)
    await router.replace({ query: { dialogueId: sessionId } })
    await scrollToBottom()
  } catch (error) {
    errorMessage.value = error?.response?.data?.msg || '沉浸课堂加载失败'
  } finally {
    loading.value = false
  }
}

async function send() {
  const content = message.value.trim()
  if (!content || sending.value || !session.value) return
  sending.value = true
  message.value = ''
  try {
    const data = await sendDialogueMessage(session.value.id, content)
    session.value.turns.push(...data.turns)
    session.value.provider = data.provider
    await scrollToBottom()
    const tutorReply = data.turns.findLast((turn) => turn.speaker === 'tutor')
    if (autoSpeak.value && tutorReply) speak(tutorReply.content)
  } catch (error) {
    message.value = content
    ElMessage.error(error?.response?.data?.msg || '发送失败')
  } finally {
    sending.value = false
  }
}

function startListening() {
  if (!SpeechRecognition || listening.value) return
  transcript.value = new SpeechRecognition()
  transcript.value.lang = 'zh-CN'
  transcript.value.interimResults = false
  transcript.value.maxAlternatives = 1
  transcript.value.onstart = () => {
    listening.value = true
  }
  transcript.value.onresult = (event) => {
    message.value = event.results[0][0].transcript
  }
  transcript.value.onerror = () => {
    ElMessage.info('没有识别到语音，请重试或直接输入')
  }
  transcript.value.onend = () => {
    listening.value = false
    transcript.value = null
  }
  transcript.value.start()
}

onMounted(loadSession)
onBeforeUnmount(() => {
  transcript.value?.abort()
  window.speechSynthesis?.cancel()
})
</script>

<template>
  <div class="immersion-room">
    <header class="room-header">
      <button type="button" @click="router.push('/student/chatTurn')">
        ← 返回对话实验室
      </button>
      <div class="room-status">
        <span class="live-dot"></span>
        <strong>ICE 数字助教</strong>
        <small>{{
          session?.provider === 'external' ? 'AI ONLINE' : 'LOCAL MODE'
        }}</small>
      </div>
      <el-switch v-model="autoSpeak" active-text="自动朗读" />
    </header>

    <el-skeleton v-if="loading" class="room-loading" :rows="10" animated />
    <el-result v-else-if="errorMessage" icon="error" :title="errorMessage">
      <template #extra>
        <el-button type="primary" @click="loadSession">重新进入</el-button>
      </template>
    </el-result>
    <main v-else class="room-grid">
      <section class="avatar-stage">
        <div class="orbital orbital-one"></div>
        <div class="orbital orbital-two"></div>
        <div class="avatar-frame">
          <img :src="teacherAvatar" alt="ICE 数字助教" />
        </div>
        <p>ICE / 国际中文数字助教</p>
        <h1>{{ session.title }}</h1>
        <div class="keywords">
          <span v-for="keyword in session.keywords" :key="keyword">{{
            keyword
          }}</span>
        </div>
        <div class="voice-wave" :class="{ active: sending }" aria-hidden="true">
          <i v-for="index in 14" :key="index"></i>
        </div>
      </section>

      <section class="practice-console">
        <header>
          <div>
            <span>LIVE PRACTICE</span>
            <h2>中文口语练习</h2>
          </div>
          <p>点击 ICE 的回答即可再次朗读</p>
        </header>

        <div ref="stage" class="turn-stage" aria-live="polite">
          <article
            v-for="turn in session.turns"
            :key="turn.id"
            :class="['practice-turn', turn.speaker]"
            @click="turn.speaker === 'tutor' && speak(turn.content)"
          >
            <img
              v-if="turn.speaker !== 'system'"
              :src="turn.speaker === 'student' ? studentAvatar : teacherAvatar"
              alt=""
            />
            <div>
              <small>
                {{
                  turn.speaker === 'student'
                    ? '我'
                    : turn.speaker === 'tutor'
                      ? 'ICE'
                      : '练习提示'
                }}
              </small>
              <p>{{ turn.content }}</p>
            </div>
          </article>
          <div v-if="sending" class="thinking">ICE 正在分析你的表达…</div>
        </div>

        <form class="voice-composer" @submit.prevent="send">
          <button
            class="microphone"
            type="button"
            :disabled="!canListen"
            :class="{ listening }"
            :title="canListen ? '语音输入' : '当前浏览器不支持语音识别'"
            @click="startListening"
          >
            {{ listening ? '录' : '麦' }}
          </button>
          <el-input
            v-model="message"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            maxlength="2000"
            placeholder="说一句中文，ICE 会给出下一步反馈…"
            @keydown.enter.exact.prevent="send"
          />
          <el-button type="primary" native-type="submit" :loading="sending">
            发送
          </el-button>
        </form>
      </section>
    </main>
  </div>
</template>

<style scoped>
.immersion-room {
  --night: #071d24;
  --mint: #75d7bd;
  --warm: #f2bb68;
  min-height: calc(100vh - 72px);
  color: #edf8f4;
  background:
    radial-gradient(
      circle at 18% 28%,
      rgba(117, 215, 189, 0.14),
      transparent 28%
    ),
    radial-gradient(
      circle at 82% 78%,
      rgba(242, 187, 104, 0.1),
      transparent 24%
    ),
    var(--night);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

.room-header {
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto 1fr;
  gap: 20px;
  border-bottom: 1px solid rgba(237, 248, 244, 0.13);
  padding: 14px clamp(18px, 4vw, 48px);
}

.room-header > button {
  justify-self: start;
  border: 0;
  color: #b6cbc4;
  background: transparent;
  cursor: pointer;
}

.room-header :deep(.el-switch) {
  justify-self: end;
}

.room-status {
  display: flex;
  align-items: center;
  gap: 9px;
}

.room-status small {
  color: var(--mint);
  font:
    9px ui-monospace,
    monospace;
  letter-spacing: 0.13em;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--mint);
  box-shadow: 0 0 0 5px rgba(117, 215, 189, 0.12);
}

.room-loading {
  padding: 70px;
}

.room-grid {
  display: grid;
  min-height: calc(100vh - 132px);
  grid-template-columns: minmax(290px, 0.82fr) minmax(430px, 1.18fr);
}

.avatar-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(237, 248, 244, 0.13);
  padding: 42px;
  text-align: center;
}

.avatar-frame {
  z-index: 1;
  width: clamp(150px, 20vw, 250px);
  overflow: hidden;
  border: 1px solid rgba(117, 215, 189, 0.5);
  border-radius: 50%;
  padding: 12px;
  background: rgba(117, 215, 189, 0.06);
  box-shadow: 0 0 70px rgba(117, 215, 189, 0.14);
  aspect-ratio: 1;
}

.avatar-frame img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.orbital {
  position: absolute;
  border: 1px solid rgba(117, 215, 189, 0.16);
  border-radius: 50%;
  animation: rotate 26s linear infinite;
}

.orbital::after {
  position: absolute;
  top: 8%;
  left: 16%;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--warm);
  content: '';
}

.orbital-one {
  width: 390px;
  height: 390px;
}

.orbital-two {
  width: 520px;
  height: 520px;
  animation-direction: reverse;
  animation-duration: 38s;
}

.avatar-stage > p {
  z-index: 1;
  margin: 24px 0 5px;
  color: var(--mint);
  font:
    10px ui-monospace,
    monospace;
  letter-spacing: 0.16em;
}

.avatar-stage h1 {
  z-index: 1;
  margin: 0;
  font-size: clamp(24px, 3.5vw, 42px);
}

.keywords {
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 7px;
  margin-top: 16px;
}

.keywords span {
  border: 1px solid rgba(237, 248, 244, 0.25);
  padding: 4px 9px;
  color: #b9cbc6;
  font-size: 12px;
}

.voice-wave {
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 42px;
  margin-top: 24px;
}

.voice-wave i {
  width: 2px;
  height: 8px;
  background: var(--mint);
}

.voice-wave.active i {
  animation: wave 0.8s ease-in-out infinite alternate;
}

.voice-wave i:nth-child(3n) {
  animation-delay: 0.2s;
}
.voice-wave i:nth-child(4n) {
  animation-delay: 0.4s;
}

.practice-console {
  display: grid;
  min-height: 0;
  grid-template-rows: auto 1fr auto;
  padding: clamp(24px, 4vw, 50px);
}

.practice-console > header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid rgba(237, 248, 244, 0.13);
  padding-bottom: 20px;
}

.practice-console header span {
  color: var(--warm);
  font:
    9px ui-monospace,
    monospace;
  letter-spacing: 0.17em;
}

.practice-console header h2 {
  margin: 6px 0 0;
  font-size: 27px;
}

.practice-console header p {
  margin: 0;
  color: #91a59f;
  font-size: 12px;
}

.turn-stage {
  max-height: calc(100vh - 330px);
  overflow-y: auto;
  padding: 28px 2px;
}

.practice-turn {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 82%;
  margin-bottom: 20px;
}

.practice-turn.student {
  margin-left: auto;
  flex-direction: row-reverse;
  text-align: right;
}

.practice-turn.system {
  max-width: 100%;
  border-left: 2px solid var(--warm);
  padding: 4px 12px;
  color: #9baea8;
}

.practice-turn img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.practice-turn small {
  color: var(--mint);
  font:
    9px ui-monospace,
    monospace;
  letter-spacing: 0.1em;
}

.practice-turn p {
  margin: 5px 0 0;
  color: #e5f1ed;
  line-height: 1.8;
}

.practice-turn.tutor {
  cursor: pointer;
}

.thinking {
  color: var(--mint);
  font-size: 12px;
  animation: fade 1.1s ease-in-out infinite alternate;
}

.voice-composer {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 9px;
  border-top: 1px solid rgba(237, 248, 244, 0.13);
  padding-top: 16px;
}

.microphone {
  width: 42px;
  border: 1px solid rgba(117, 215, 189, 0.5);
  border-radius: 50%;
  color: var(--mint);
  background: transparent;
  cursor: pointer;
}

.microphone.listening {
  color: var(--night);
  background: var(--warm);
  animation: fade 0.6s ease-in-out infinite alternate;
}

.voice-composer :deep(.el-textarea__inner) {
  color: #e5f1ed;
  border-color: rgba(237, 248, 244, 0.2);
  background: rgba(255, 255, 255, 0.045);
  box-shadow: none;
}

.voice-composer :deep(.el-button--primary) {
  border-color: var(--mint);
  background: var(--mint);
  color: var(--night);
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}
@keyframes wave {
  to {
    height: 34px;
  }
}
@keyframes fade {
  to {
    opacity: 0.45;
  }
}

@media (max-width: 900px) {
  .room-header {
    grid-template-columns: 1fr auto;
  }

  .room-status {
    display: none;
  }

  .room-grid {
    grid-template-columns: 1fr;
  }

  .avatar-stage {
    min-height: 480px;
    border-right: 0;
    border-bottom: 1px solid rgba(237, 248, 244, 0.13);
  }

  .turn-stage {
    max-height: 560px;
  }
}
</style>
