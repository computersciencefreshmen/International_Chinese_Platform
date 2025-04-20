import { ref, onUnmounted } from 'vue'

// 单例实例
let socketInstance = null

export function useWebSocket(options) {
  // 如果已存在实例且没有新配置，直接返回
  if (socketInstance && !options) {
    return socketInstance
  }

  // 如果有新配置，先关闭旧连接
  if (socketInstance && options) {
    socketInstance.close()
    socketInstance = null
  }

  // 解构配置参数（带默认值）
  const {
    url,
    autoConnect = true,
    reconnectLimit = 3,
    reconnectInterval = 3000,
    heartbeatInterval = 30000,
    onOpen,
    onMessage,
    onClose,
    onError
  } = options || {}

  // 响应式状态
  const ws = ref(null)
  const status = ref('closed')
  const reconnectCount = ref(0)
  const messageQueue = ref([])

  // 计时器引用
  let reconnectTimer = null
  let heartbeatTimer = null

  /**
   * 启动心跳检测
   */
  const startHeartbeat = () => {
    heartbeatTimer = setInterval(() => {
      if (status.value === 'open') {
        send(JSON.stringify({ type: 'ping' }))
      }
    }, heartbeatInterval)
  }

  /**
   * 建立 WebSocket 连接
   */
  const connect = () => {
    if (status.value === 'open' || status.value === 'connecting') return

    status.value = 'connecting'
    ws.value = new WebSocket(url)

    ws.value.onopen = (event) => {
      status.value = 'open'
      reconnectCount.value = 0
      startHeartbeat()

      while (messageQueue.value.length > 0) {
        const msg = messageQueue.value.shift()
        ws.value.send(msg)
      }

      onOpen?.(event)
    }

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type !== 'pong') {
          onMessage?.(event)
        }
      } catch {
        onMessage?.(event)
      }
    }

    ws.value.onclose = (event) => {
      clearInterval(heartbeatTimer)
      status.value = 'closed'
      onClose?.(event)

      if (reconnectCount.value < reconnectLimit) {
        reconnectCount.value++
        reconnectTimer = setTimeout(connect, reconnectInterval)
      }
    }

    ws.value.onerror = (event) => {
      status.value = 'error'
      onError?.(event)
    }
  }

  /**
   * 发送消息
   */
  const send = (message) => {
    if (status.value === 'open') {
      ws.value.send(message)
    } else {
      messageQueue.value.push(message)
      if (status.value === 'closed') {
        connect()
      }
    }
  }

  /**
   * 关闭连接
   */
  const close = () => {
    clearInterval(heartbeatTimer)
    clearTimeout(reconnectTimer)
    ws.value?.close()
    socketInstance = null // 清除单例引用
  }

  // 初始化连接
  if (autoConnect && url) {
    connect()
  }

  // 组件卸载时的处理
  onUnmounted(() => {
    // 只有最后一个使用组件会真正关闭连接
    if (socketInstance === instance) {
      close()
    }
  })

  // 创建实例
  const instance = {
    ws,
    status,
    connect,
    send,
    close
  }

  // 保存单例引用
  if (!socketInstance && options) {
    socketInstance = instance
  }

  return socketInstance || instance
}
