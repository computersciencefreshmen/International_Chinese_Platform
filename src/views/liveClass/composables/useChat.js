import { ref, onMounted, onUnmounted } from 'vue'

export function useChat(socket) {
  const messages = ref([])
  const isHandRaised = ref(false)
  const unreadCount = ref(0) // 未读消息计数

  // 消息处理器
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      // 处理不同类型的消息
      switch (data.type) {
        case 'chat':
          messages.value.push({
            type: 'user',
            user: data.user || '匿名用户',
            content: data.content,
            timestamp: data.timestamp || Date.now()
          })
          unreadCount.value++
          break

        case 'system':
          messages.value.push({
            type: 'system',
            content: data.content
          })
          break

        case 'hand_raise':
          // 处理举手通知
          if (data.status === 'approved') {
            messages.value.push({
              type: 'system',
              content: '您的连麦请求已通过'
            })
          } else if (data.status === 'rejected') {
            messages.value.push({
              type: 'system',
              content: '您的连麦请求被拒绝'
            })
          }
          break

        default:
          console.log('收到未知类型消息:', data)
      }
    } catch (e) {
      console.error('消息解析错误:', e)
    }
  }

  // 发送消息
  const sendMessage = (content) => {
    if (socket.readyState === WebSocket.OPEN) {
      const message = {
        type: 'chat',
        content,
        timestamp: Date.now()
      }
      socket.send(JSON.stringify(message))

      // 本地添加消息
      messages.value.push({
        type: 'user',
        user: '我',
        content,
        timestamp: message.timestamp
      })
    } else {
      console.error('发送失败: WebSocket连接未就绪')
    }
  }

  // 举手连麦
  const raiseHand = () => {
    if (socket.readyState === WebSocket.OPEN) {
      isHandRaised.value = !isHandRaised.value
      socket.send(
        JSON.stringify({
          type: 'hand_raise',
          status: isHandRaised.value ? 'request' : 'cancel'
        })
      )
    }
  }

  // 初始化
  onMounted(() => {
    if (socket) {
      socket.addEventListener('message', handleMessage)
    }
  })

  // 清理
  onUnmounted(() => {
    if (socket) {
      socket.removeEventListener('message', handleMessage)
    }
  })

  return {
    messages,
    sendMessage,
    raiseHand,
    isHandRaised,
    unreadCount
  }
}
