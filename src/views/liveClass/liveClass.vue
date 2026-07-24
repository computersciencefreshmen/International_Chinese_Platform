<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import defaultAvatar from '@/assets/student/avatar.png'
import {
  completeClassroom,
  createClassroomTicket,
  getClassroomJoinInfo,
  getClassroomMessages
} from '@/api/platform'
import { useUserStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const classroomId = computed(() =>
  String(route.query.classroomId || route.params.classroomId || '')
)
const joinInfo = ref(null)
const messages = ref([])
const loading = ref(true)
const errorMessage = ref('')
const connectionStatus = ref('connecting')
const onlineUserIds = ref([])
const raisedHands = ref([])
const chatInput = ref('')
const chatBody = ref(null)
const localVideo = ref(null)
const remoteVideo = ref(null)
const localStream = ref(null)
const remoteStream = ref(null)
const peerConnection = ref(null)
const pendingOffer = ref(null)
const incomingCallVisible = ref(false)
const microphoneEnabled = ref(false)
const cameraEnabled = ref(false)
const completing = ref(false)

let socket = null
let pingTimer = null
let reconnectTimer = null
let reconnectAttempts = 0
let intentionalClose = false
let pendingCandidates = []

const me = computed(() => userStore.profile || {})
const otherParticipant = computed(() =>
  joinInfo.value?.participants.find(
    (participant) => participant.id !== me.value.id
  )
)
const otherOnline = computed(() =>
  onlineUserIds.value.includes(otherParticipant.value?.id)
)
const connectionLabel = computed(
  () =>
    ({
      connecting: '正在连接',
      open: '课堂在线',
      reconnecting: '正在重连',
      closed: '连接已断开'
    })[connectionStatus.value] || connectionStatus.value
)
const canSend = computed(
  () => socket?.readyState === WebSocket.OPEN && chatInput.value.trim()
)

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function socketUrl(path) {
  const url = new URL(path, window.location.origin)
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function sendEvent(event) {
  if (socket?.readyState !== WebSocket.OPEN) return false
  socket.send(JSON.stringify(event))
  return true
}

async function scrollChat() {
  await nextTick()
  chatBody.value?.scrollTo({
    top: chatBody.value.scrollHeight,
    behavior: 'smooth'
  })
}

function upsertMessage(message) {
  if (!message || messages.value.some((item) => item.id === message.id)) return
  messages.value.push(message)
  messages.value.sort((left, right) =>
    String(left.createdAt).localeCompare(String(right.createdAt))
  )
  scrollChat()
}

async function syncHistory() {
  const history = await getClassroomMessages(classroomId.value, { limit: 100 })
  const merged = new Map(
    [...messages.value, ...history.items].map((message) => [
      message.id,
      message
    ])
  )
  messages.value = [...merged.values()].sort((left, right) =>
    String(left.createdAt).localeCompare(String(right.createdAt))
  )
  await scrollChat()
}

async function flushCandidates() {
  if (!peerConnection.value?.remoteDescription) return
  for (const candidate of pendingCandidates) {
    await peerConnection.value.addIceCandidate(candidate).catch(() => {})
  }
  pendingCandidates = []
}

async function ensurePeer() {
  if (peerConnection.value) return peerConnection.value
  const peer = new RTCPeerConnection({
    iceServers: joinInfo.value?.iceServers || []
  })
  peer.onicecandidate = ({ candidate }) => {
    if (!otherParticipant.value) return
    sendEvent({
      type: 'rtc.candidate',
      targetUserId: otherParticipant.value.id,
      candidate: candidate?.toJSON() || null
    })
  }
  peer.ontrack = ({ streams }) => {
    remoteStream.value = streams[0]
    if (remoteVideo.value) remoteVideo.value.srcObject = streams[0]
  }
  peer.onconnectionstatechange = () => {
    if (['failed', 'closed'].includes(peer.connectionState)) {
      remoteStream.value = null
    }
  }
  if (localStream.value) {
    for (const track of localStream.value.getTracks()) {
      peer.addTrack(track, localStream.value)
    }
  }
  peerConnection.value = peer
  return peer
}

async function startMedia() {
  if (localStream.value) return localStream.value
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持音视频采集')
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { width: { ideal: 1280 }, height: { ideal: 720 } }
  })
  localStream.value = stream
  microphoneEnabled.value = stream
    .getAudioTracks()
    .some((track) => track.enabled)
  cameraEnabled.value = stream.getVideoTracks().some((track) => track.enabled)
  if (localVideo.value) localVideo.value.srcObject = stream
  return stream
}

async function startCall() {
  if (!otherOnline.value) {
    ElMessage.info('另一位课堂参与者还未上线')
    return
  }
  try {
    await startMedia()
    const peer = await ensurePeer()
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    sendEvent({
      type: 'rtc.offer',
      targetUserId: otherParticipant.value.id,
      description: peer.localDescription.toJSON()
    })
  } catch (error) {
    ElMessage.error(error?.message || '无法开启音视频')
  }
}

async function acceptCall() {
  if (!pendingOffer.value) return
  try {
    await startMedia()
    const peer = await ensurePeer()
    await peer.setRemoteDescription(pendingOffer.value.description)
    await flushCandidates()
    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)
    sendEvent({
      type: 'rtc.answer',
      targetUserId: pendingOffer.value.fromUserId,
      description: peer.localDescription.toJSON()
    })
    incomingCallVisible.value = false
    pendingOffer.value = null
  } catch (error) {
    ElMessage.error(error?.message || '接听失败')
  }
}

function declineCall() {
  pendingOffer.value = null
  incomingCallVisible.value = false
}

async function handleRtcEvent(event) {
  if (event.fromUserId !== otherParticipant.value?.id) return
  if (event.type === 'rtc.offer') {
    pendingOffer.value = event
    incomingCallVisible.value = true
    return
  }
  if (event.type === 'rtc.answer') {
    const peer = await ensurePeer()
    await peer.setRemoteDescription(event.description)
    await flushCandidates()
    return
  }
  if (event.type === 'rtc.candidate' && event.candidate) {
    const candidate = new RTCIceCandidate(event.candidate)
    if (peerConnection.value?.remoteDescription) {
      await peerConnection.value.addIceCandidate(candidate).catch(() => {})
    } else {
      pendingCandidates.push(candidate)
    }
  }
}

function handleSocketEvent(event) {
  if (
    event.type === 'presence.snapshot' ||
    event.type === 'presence.joined' ||
    event.type === 'presence.left'
  ) {
    onlineUserIds.value = event.onlineUserIds || []
    return
  }
  if (event.type === 'chat.message') {
    upsertMessage(event.message)
    return
  }
  if (event.type === 'hand.raise') {
    const next = new Set(raisedHands.value)
    if (event.raised) next.add(event.user.id)
    else next.delete(event.user.id)
    raisedHands.value = [...next]
    return
  }
  if (event.type.startsWith('rtc.')) {
    handleRtcEvent(event).catch(() => {
      ElMessage.error('音视频信令处理失败')
    })
    return
  }
  if (event.type === 'error') ElMessage.warning(event.message || '课堂事件失败')
}

function scheduleReconnect() {
  if (intentionalClose || reconnectAttempts >= 5) {
    connectionStatus.value = 'closed'
    return
  }
  connectionStatus.value = 'reconnecting'
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 10_000)
  reconnectAttempts += 1
  reconnectTimer = window.setTimeout(connectSocket, delay)
}

async function connectSocket() {
  try {
    const ticket = await createClassroomTicket(classroomId.value)
    if (intentionalClose) return
    socket = new WebSocket(
      ticket.websocketUrl || socketUrl(ticket.websocketPath)
    )
    socket.addEventListener('open', () => {
      connectionStatus.value = 'open'
      reconnectAttempts = 0
      window.clearInterval(pingTimer)
      pingTimer = window.setInterval(
        () => sendEvent({ type: 'ping', nonce: String(Date.now()) }),
        20_000
      )
      syncHistory().catch(() => {})
    })
    socket.addEventListener('message', ({ data }) => {
      try {
        handleSocketEvent(JSON.parse(data))
      } catch {
        ElMessage.warning('收到无法解析的课堂事件')
      }
    })
    socket.addEventListener('close', () => {
      window.clearInterval(pingTimer)
      scheduleReconnect()
    })
    socket.addEventListener('error', () => {
      connectionStatus.value = 'reconnecting'
    })
  } catch (error) {
    if (reconnectAttempts === 0) {
      errorMessage.value = error?.response?.data?.msg || '课堂连接授权失败'
    }
    scheduleReconnect()
  }
}

async function initialize() {
  if (!classroomId.value) {
    errorMessage.value = '缺少课堂 ID，请从已确认预约进入课堂'
    loading.value = false
    return
  }
  loading.value = true
  try {
    const [info, history] = await Promise.all([
      getClassroomJoinInfo(classroomId.value),
      getClassroomMessages(classroomId.value, { limit: 100 })
    ])
    joinInfo.value = info
    messages.value = history.items
    await connectSocket()
    await scrollChat()
  } catch (error) {
    errorMessage.value = error?.response?.data?.msg || '课堂加载失败'
  } finally {
    loading.value = false
  }
}

function sendChat() {
  const content = chatInput.value.trim()
  if (!content) return
  const sent = sendEvent({
    type: 'chat.message',
    clientMessageId: crypto.randomUUID(),
    content
  })
  if (sent) chatInput.value = ''
  else ElMessage.warning('课堂连接尚未就绪')
}

function toggleHand() {
  const raised = !raisedHands.value.includes(me.value.id)
  sendEvent({ type: 'hand.raise', raised })
}

function toggleTrack(kind) {
  const track = localStream.value
    ?.getTracks()
    .find((item) => item.kind === kind)
  if (!track) {
    startMedia().catch((error) => ElMessage.error(error.message))
    return
  }
  track.enabled = !track.enabled
  if (kind === 'audio') microphoneEnabled.value = track.enabled
  if (kind === 'video') cameraEnabled.value = track.enabled
}

function leaveClassroom() {
  intentionalClose = true
  socket?.close(1000, 'User left classroom')
  router.push(
    userStore.role === 'teacher' ? '/teacher/teachingDocking' : '/student/home'
  )
}

async function finishClassroom() {
  try {
    await ElMessageBox.confirm(
      '结束后双方都不能再次进入本课堂，聊天记录和课堂审计仍会保留。',
      '确认结束课堂',
      { confirmButtonText: '结束课堂', cancelButtonText: '继续上课' }
    )
  } catch {
    return
  }

  completing.value = true
  try {
    await completeClassroom(classroomId.value)
    ElMessage.success('课堂已完成并安全归档')
    leaveClassroom()
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || '课堂结束失败，请稍后重试')
  } finally {
    completing.value = false
  }
}

onMounted(initialize)
onBeforeUnmount(() => {
  intentionalClose = true
  window.clearTimeout(reconnectTimer)
  window.clearInterval(pingTimer)
  socket?.close(1000, 'Page unmounted')
  peerConnection.value?.close()
  for (const track of localStream.value?.getTracks() || []) track.stop()
})
</script>

<template>
  <div class="classroom-shell">
    <header class="classroom-header">
      <div>
        <span class="room-code">ROOM {{ joinInfo?.roomCode || '------' }}</span>
        <h1>实时互动课堂</h1>
      </div>
      <div class="connection-pill" :class="connectionStatus">
        <i></i>{{ connectionLabel }} · {{ onlineUserIds.length }}/2 在线
      </div>
      <div class="header-actions">
        <el-button plain @click="leaveClassroom">暂时离开</el-button>
        <el-button type="danger" :loading="completing" @click="finishClassroom">
          结束课堂
        </el-button>
      </div>
    </header>

    <el-skeleton v-if="loading" class="page-state" :rows="12" animated />
    <el-result v-else-if="errorMessage" icon="error" :title="errorMessage">
      <template #extra>
        <el-button type="primary" @click="initialize">重新加载</el-button>
      </template>
    </el-result>

    <main v-else class="classroom-grid">
      <section class="video-workspace">
        <div class="remote-stage">
          <video ref="remoteVideo" autoplay playsinline></video>
          <div v-if="!remoteStream" class="participant-placeholder">
            <img :src="otherParticipant?.avatarUrl || defaultAvatar" alt="" />
            <strong>{{ otherParticipant?.displayName }}</strong>
            <span>{{
              otherOnline ? '已上线，等待开启音视频' : '等待对方进入课堂'
            }}</span>
          </div>
          <div
            v-if="raisedHands.includes(otherParticipant?.id)"
            class="hand-badge"
          >
            对方正在举手
          </div>
          <span class="participant-label">
            {{ otherParticipant?.role === 'teacher' ? '授课教师' : '学习者' }}
          </span>
        </div>

        <div class="local-stage">
          <video ref="localVideo" autoplay playsinline muted></video>
          <div v-if="!localStream" class="local-placeholder">
            <img :src="me.avatarUrl || defaultAvatar" alt="" />
          </div>
          <span>我 · {{ me.displayName }}</span>
        </div>

        <nav class="media-controls" aria-label="课堂媒体控制">
          <button type="button" @click="toggleTrack('audio')">
            {{ microphoneEnabled ? '关闭麦克风' : '开启麦克风' }}
          </button>
          <button type="button" @click="toggleTrack('video')">
            {{ cameraEnabled ? '关闭摄像头' : '开启摄像头' }}
          </button>
          <button type="button" :disabled="!otherOnline" @click="startCall">
            发起音视频
          </button>
          <button
            type="button"
            :class="{ active: raisedHands.includes(me.id) }"
            @click="toggleHand"
          >
            {{ raisedHands.includes(me.id) ? '放下手' : '举手' }}
          </button>
        </nav>
      </section>

      <aside class="chat-panel">
        <header>
          <div>
            <span>CLASSROOM CHAT</span>
            <h2>课堂消息</h2>
          </div>
          <b>{{ messages.length }}</b>
        </header>
        <div ref="chatBody" class="message-list" aria-live="polite">
          <article
            v-for="messageItem in messages"
            :key="messageItem.id"
            :class="{ mine: messageItem.senderId === me.id }"
          >
            <div class="message-meta">
              <strong>{{ messageItem.sender?.displayName || '系统' }}</strong>
              <time :datetime="messageItem.createdAt">
                {{ formatTime(messageItem.createdAt) }}
              </time>
            </div>
            <p>{{ messageItem.content }}</p>
          </article>
          <el-empty
            v-if="messages.length === 0"
            description="发送第一条课堂消息"
          />
        </div>
        <form class="chat-composer" @submit.prevent="sendChat">
          <el-input
            v-model="chatInput"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 5 }"
            maxlength="4000"
            show-word-limit
            placeholder="输入课堂消息…"
            @keydown.enter.exact.prevent="sendChat"
          />
          <el-button type="primary" native-type="submit" :disabled="!canSend">
            发送
          </el-button>
        </form>
      </aside>
    </main>

    <el-dialog
      v-model="incomingCallVisible"
      width="420px"
      align-center
      :close-on-click-modal="false"
      title="收到音视频邀请"
    >
      <p>{{ otherParticipant?.displayName }} 邀请你开启课堂音视频。</p>
      <template #footer>
        <el-button @click="declineCall">暂不接听</el-button>
        <el-button type="primary" @click="acceptCall">授权设备并接听</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.classroom-shell {
  --night: #0c2630;
  --cyan: #71d8d4;
  --amber: #eab768;
  min-height: 100vh;
  padding: clamp(14px, 2.5vw, 34px);
  color: #eef8f8;
  background:
    radial-gradient(
      circle at 12% 10%,
      rgba(113, 216, 212, 0.13),
      transparent 27%
    ),
    var(--night);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

.classroom-header {
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto 1fr;
  gap: 18px;
  margin-bottom: 20px;
}

.classroom-header > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.classroom-header h1 {
  margin: 0;
  font-size: clamp(20px, 3vw, 30px);
}

.room-code {
  color: var(--cyan);
  font:
    9px ui-monospace,
    monospace;
  letter-spacing: 0.15em;
}

.classroom-header :deep(.el-button) {
  justify-self: end;
}

.header-actions {
  display: flex;
  justify-self: end;
  gap: 8px;
}

.connection-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9cb3b7;
  font-size: 12px;
}

.connection-pill i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8b9ba0;
}

.connection-pill.open i {
  background: var(--cyan);
  box-shadow: 0 0 0 5px rgba(113, 216, 212, 0.12);
}

.connection-pill.reconnecting i,
.connection-pill.connecting i {
  background: var(--amber);
  animation: blink 0.8s ease-in-out infinite alternate;
}

.classroom-grid {
  display: grid;
  min-height: calc(100vh - 120px);
  grid-template-columns: minmax(0, 1fr) minmax(310px, 380px);
  gap: 16px;
}

.video-workspace {
  position: relative;
  min-height: 600px;
  overflow: hidden;
  border: 1px solid rgba(238, 248, 248, 0.13);
  background: #081b22;
}

.remote-stage,
.remote-stage video {
  width: 100%;
  height: 100%;
}

.remote-stage video {
  display: block;
  object-fit: cover;
}

.participant-placeholder,
.local-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background:
    linear-gradient(rgba(8, 27, 34, 0.82), rgba(8, 27, 34, 0.92)),
    repeating-linear-gradient(
      135deg,
      transparent 0 22px,
      rgba(255, 255, 255, 0.025) 22px 23px
    );
}

.participant-placeholder img {
  width: 108px;
  height: 108px;
  border: 2px solid rgba(113, 216, 212, 0.45);
  border-radius: 50%;
  object-fit: cover;
}

.participant-placeholder strong {
  margin-top: 17px;
  font-size: 22px;
}

.participant-placeholder span {
  margin-top: 5px;
  color: #8fa6aa;
  font-size: 12px;
}

.participant-label,
.hand-badge {
  position: absolute;
  top: 18px;
  left: 18px;
  border: 1px solid rgba(238, 248, 248, 0.2);
  padding: 6px 10px;
  background: rgba(8, 27, 34, 0.72);
  font-size: 11px;
  backdrop-filter: blur(8px);
}

.hand-badge {
  right: 18px;
  left: auto;
  border-color: var(--amber);
  color: var(--amber);
}

.local-stage {
  position: absolute;
  right: 18px;
  bottom: 82px;
  width: min(27%, 260px);
  overflow: hidden;
  border: 1px solid rgba(113, 216, 212, 0.5);
  background: #102f39;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
  aspect-ratio: 16 / 10;
}

.local-stage video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.local-placeholder img {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  object-fit: cover;
}

.local-stage > span {
  position: absolute;
  bottom: 6px;
  left: 8px;
  font-size: 10px;
}

.media-controls {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 15px;
  background: linear-gradient(transparent, rgba(3, 13, 17, 0.94));
}

.media-controls button {
  border: 1px solid rgba(238, 248, 248, 0.25);
  padding: 9px 13px;
  color: #e6f3f2;
  background: rgba(12, 38, 48, 0.72);
  cursor: pointer;
}

.media-controls button:hover,
.media-controls button.active {
  border-color: var(--cyan);
  color: var(--night);
  background: var(--cyan);
}

.media-controls button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.chat-panel {
  display: grid;
  min-height: 0;
  grid-template-rows: auto 1fr auto;
  border: 1px solid rgba(238, 248, 248, 0.13);
  background: rgba(7, 27, 34, 0.74);
}

.chat-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(238, 248, 248, 0.12);
  padding: 18px;
}

.chat-panel header span {
  color: var(--cyan);
  font:
    8px ui-monospace,
    monospace;
  letter-spacing: 0.15em;
}

.chat-panel h2 {
  margin: 3px 0 0;
  font-size: 19px;
}

.chat-panel header b {
  color: #8fa5a8;
  font:
    13px ui-monospace,
    monospace;
}

.message-list {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding: 18px;
}

.message-list article {
  margin-bottom: 17px;
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #789096;
  font-size: 10px;
}

.message-list article.mine .message-meta strong {
  color: var(--cyan);
}

.message-list p {
  margin: 6px 0 0;
  border-left: 2px solid rgba(238, 248, 248, 0.18);
  padding-left: 10px;
  color: #d5e6e5;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.message-list article.mine p {
  border-color: var(--cyan);
}

.chat-composer {
  display: grid;
  gap: 9px;
  border-top: 1px solid rgba(238, 248, 248, 0.12);
  padding: 12px;
}

.chat-composer :deep(.el-textarea__inner) {
  color: #e4f1ef;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: none;
}

.chat-composer :deep(.el-button--primary) {
  border-color: var(--cyan);
  background: var(--cyan);
  color: var(--night);
}

.page-state {
  padding: 60px;
}

@keyframes blink {
  to {
    opacity: 0.3;
  }
}

@media (max-width: 900px) {
  .classroom-header {
    grid-template-columns: 1fr auto;
  }

  .connection-pill {
    display: none;
  }

  .classroom-grid {
    grid-template-columns: 1fr;
  }

  .chat-panel {
    min-height: 560px;
  }

  .message-list {
    max-height: 430px;
  }
}

@media (max-width: 620px) {
  .classroom-header > div:first-child {
    align-items: flex-start;
    flex-direction: column;
  }

  .video-workspace {
    min-height: 500px;
  }

  .local-stage {
    width: 42%;
  }

  .media-controls {
    flex-wrap: wrap;
  }
}
</style>
