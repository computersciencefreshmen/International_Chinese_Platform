import { ref, onUnmounted } from 'vue'

export function useWebRTC() {
  const localStream = ref(null)
  const remoteStreams = ref([])
  const screenStream = ref(null)
  const peerConnections = new Map()
  const socket = ref(null)
  const config = {
    iceServers: [
      // 本地开发只需 STUN
      { urls: 'stun:stun.l.google.com:19302' }

      // 如果需要测试 TURN 功能，可以使用免费测试服务器（不要用于生产）
      // {
      //   urls: 'turn:numb.viagenie.ca',
      //   username: 'your_email@example.com',
      //   credential: 'testpassword'
      // }
    ]
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      localStream.value = stream
    } catch (error) {
      console.error('Error accessing media devices:', error)
    }
  }

  const stopCamera = () => {
    if (localStream.value) {
      localStream.value.getTracks().forEach((track) => track.stop())
      localStream.value = null
    }
  }

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })
      screenStream.value = stream

      // 监听屏幕共享停止事件
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare()
      }
    } catch (error) {
      console.error('Error sharing screen:', error)
    }
  }

  const stopScreenShare = () => {
    if (screenStream.value) {
      screenStream.value.getTracks().forEach((track) => track.stop())
      screenStream.value = null
    }
  }

  const toggleMic = () => {
    if (localStream.value) {
      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
  }

  // 改造后的信令系统
  const initializeConnection = async (token) => {
    try {
      // 1. 建立带Token的WebSocket连接
      socket.value = new WebSocket(
        `ws://localhost:7788/websocket?token=${token}`
      )

      // 2. 获取当前房间信息
      // const roomRes = await fetch('/api/rooms/current', {
      //   headers: { Authorization: `Bearer ${token}` }
      // })
      // const { roomId } = await roomRes.json()

      // 3. 初始化信令监听
      setupSignaling()
    } catch (error) {
      console.error('初始化失败:', error)
    }
  }

  const setupSignaling = () => {
    socket.value.onmessage = async (event) => {
      const message = JSON.parse(event.data)

      switch (message.type) {
        case 'offer':
          await handleOffer(message)
          break
        case 'answer':
          await handleAnswer(message)
          break
        case 'candidate':
          await handleCandidate(message)
          break
        case 'user-joined':
          handlePeerJoined(message)
          break
        case 'user-left':
          handlePeerLeft(message)
          break
      }
    }

    socket.value.onclose = handleDisconnect
  }

  // 处理新用户加入
  const handlePeerJoined = ({ userId, role }) => {
    if (role === 'student') {
      initiateConnection(userId)
    }
  }

  // 处理用户离开
  const handlePeerLeft = ({ userId }) => {
    const pc = peerConnections.get(userId)
    pc?.close()
    peerConnections.delete(userId)
    remoteStreams.value = remoteStreams.value.filter((s) => s.id !== userId)
  }

  // 创建PeerConnection
  const createPeerConnection = (userId) => {
    const pc = new RTCPeerConnection(config)

    // 添加本地轨道
    localStream.value?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream.value)
    })

    // ICE候选处理
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal({
          type: 'candidate',
          target: userId,
          candidate: candidate.toJSON()
        })
      }
    }

    // 接收远程流
    pc.ontrack = (event) => {
      remoteStreams.value = [
        ...remoteStreams.value,
        {
          id: userId,
          stream: event.streams[0]
        }
      ]
    }

    peerConnections.set(userId, pc)
    return pc
  }

  // 处理Offer（学生端）
  const handleOffer = async ({ sdp, senderId }) => {
    const pc = createPeerConnection(senderId)
    await pc.setRemoteDescription({ type: 'offer', sdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    sendSignal({
      type: 'answer',
      target: senderId,
      sdp: answer.sdp
    })
  }

  // 处理Answer（教师端）
  const handleAnswer = async ({ sdp, senderId }) => {
    const pc = peerConnections.get(senderId)
    await pc?.setRemoteDescription({ type: 'answer', sdp })
  }

  // 处理ICE候选
  const handleCandidate = async ({ candidate, senderId }) => {
    const pc = peerConnections.get(senderId)
    await pc?.addIceCandidate(new RTCIceCandidate(candidate))
  }

  // 发起连接（教师端）
  const initiateConnection = async (userId) => {
    const pc = createPeerConnection(userId)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    sendSignal({
      type: 'offer',
      target: userId,
      sdp: offer.sdp
    })
  }

  // 发送信令消息
  const sendSignal = (message) => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify(message))
    }
  }

  // 清理资源
  const handleDisconnect = () => {
    peerConnections.forEach((pc) => pc.close())
    peerConnections.clear()
    remoteStreams.value = []
    socket.value?.close()
  }

  onUnmounted(handleDisconnect)

  return {
    localStream,
    remoteStreams,
    screenStream,
    initializeConnection,
    startCamera,
    stopCamera,
    startScreenShare,
    stopScreenShare,
    toggleMic
  }
}
