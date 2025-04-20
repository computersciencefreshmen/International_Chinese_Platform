<script setup>
import { ref, nextTick, watch, onUnmounted, onMounted } from 'vue' //引入vue的计算属性
import MySearchBox from '@/components/basic/MySearchBox.vue' //引入自定义搜索框组件
import logoComponent from '@/components/service/logoComponent.vue' //引入自定义logo组件
import LanguageToggle from '@/components/service/LanguageToggle.vue' //引入自定义语言切换组件
import { useWebSocket } from '@/utils/websocket.js'

// 引入仓库
import { useStudentStore } from '@/stores'

const studentStore = useStudentStore()
// 引入路由
import { useRouter } from 'vue-router'
const router = useRouter()

// 使用封装的 WebSocket
const { send, status } = useWebSocket({
  url: `ws://localhost:7788/websocket?token=${studentStore.getUserInfo().token}`,
  onMessage: (event) => {
    try {
      console.log(event)

      const data = JSON.parse(event.data)
      messages.value.push(`收到消息: ${JSON.stringify(data)}`)
    } catch (e) {
      messages.value.push(`收到非JSON消息: ${event.data}`)
      console.log(e)
    }
  },
  onOpen: () => {
    messages.value.push('连接已建立')
  },
  onClose: () => {
    messages.value.push('连接已关闭')
  },
  onError: (error) => {
    messages.value.push(`连接错误: ${error.message || '未知错误'}`)
  }
})

const messages = ref([])

// 发送消息函数
const sendMessage = (message) => {
  send(JSON.stringify(message))
}

// 实时监听连接状态
watch(status, (newStatus) => {
  if (newStatus === 'open') {
    console.log('✅ 连接成功')
  } else if (newStatus === 'close') {
    console.error('❌ 连接失败')
  }
})

onMounted(() => {
  sendMessage('你好')
})

// tab切换内容设置
const tabList = [
  { name: '首页', path: '/student/home' },
  { name: '预约老师', path: '/student/order' },
  { name: '发布预约', path: '/student/publish' },
  { name: '网络课程', path: '/student/course' }
]

//获取tab栏切换的盒子
const tabRef = ref([])

// 获取下划线
const lineRef = ref(null)

// 定义tab栏高亮下标
const activeTabIndex = ref(0)

// 获取消息提醒盒子
const messageRef = ref(null)

//获取个人中心盒子
const personalCenterRef = ref(null)

//定义设置高亮横线位置函数
const placeHightLine = (left, width) => {
  lineRef.value.style.left = left + 'px'
  lineRef.value.style.width = width + 'px'
}

// 获取鼠标移入时，当前盒子的位置
const handleMouseEnter = (event) => {
  const { left, width } = event.currentTarget.getBoundingClientRect()
  placeHightLine(left, width)
}

// 获取鼠标移出时，横向回到高亮盒子的位置
const handleMouseLeave = () => {
  // 获取高亮盒子的位置
  let activeTab = null
  // 如果activeTabIndex的值小于4，则获取tab栏切换高亮盒子的位置
  if (activeTabIndex.value < 4) {
    activeTab = tabRef.value[activeTabIndex.value]
  } else if (activeTabIndex.value === 4) {
    // 如果activeTabIndex的值等于4，则获取消息提醒高亮盒子的位置
    activeTab = messageRef.value
  } else if (activeTabIndex.value === 5) {
    // 如果activeTabIndex的值等于5，则获取个人中心高亮盒子的位置
    activeTab = personalCenterRef.value
  }

  const { left, width } = activeTab.getBoundingClientRect()
  placeHightLine(left, width)
}

// 首次加载页面时，让横线移动到第一个盒子的位置
const moveLineToFirstTab = () => {
  nextTick(() => {
    // 确保 DOM 更新完成后执行
    if (tabRef.value.length > 0) {
      const firstTab = tabRef.value[0]
      const { left, width } = firstTab.getBoundingClientRect()
      placeHightLine(left, width)
    }
    handleContainerHeight() // 添加导航栏高度
  })
}

// 鼠标点击tab栏事件
const handleTabClick = (number1, number2, path) => {
  activeTabIndex.value = number1
  router.push(path)
  studentStore.isTabActive = number2
}

//定义导航栏容器高度
const containerHeight = ref(null)

//定义导航栏
const headerRef = ref(null)

//定义占位盒子
const fakeHeader = ref(null)

//一进页面就计算导航栏的高度
const handleContainerHeight = () => {
  //获取导航栏的高度
  containerHeight.value = headerRef.value.offsetHeight
  //设置占位盒子的高度
  fakeHeader.value.style.height = containerHeight.value + 'px'
}

//监听窗口大小变化，改变高亮线的位置
window.addEventListener('resize', handleMouseLeave)

setTimeout(() => {
  moveLineToFirstTab()
}, 200)

// 组件卸载时断开连接
onUnmounted(() => {
  window.removeEventListener('resize', handleMouseLeave)
})
</script>

<template>
  <div class="flex flex-col min-h-screen bg-image">
    <!-- 头部导航栏填写 -->
    <header
      ref="headerRef"
      class="flex flex-row bg-primary bg-primary1 px-4 py-1 relative border-b border-gray-300"
      style="position: fixed; top: 0; left: 0; right: 0; z-index: 100"
    >
      <!-- logo -->
      <logoComponent></logoComponent>
      <span
        ref="lineRef"
        class="absolute bottom-0 left-0 h-1 bg-blue-300 transition-all duration-500 ease-out rounded-lg"
      ></span>
      <!-- 导航栏 -->
      <div class="flex-1 flex flex-row items-center ml-8">
        <!-- tab栏切换 -->
        <nav
          ref="tabRef"
          v-for="(item, index) in tabList"
          :key="item.name"
          @click="
            () => {
              activeTabIndex = index
              $router.push(item.path)
            }
          "
          :class="{ 'bg-blue-300': activeTabIndex === index }"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
          class="cursor-pointer px-4 py-2 mx-1 transition-all duration-100 rounded-lg hover:bg-blue-300 ease-linear"
        >
          <text class="text-md font-sans lg:text-xl">{{ item.name }}</text>
        </nav>
        <!-- 语言切换 -->
        <div class="mx-1">
          <LanguageToggle />
        </div>
        <!-- 搜索框 -->
        <div class="mx-2 hidden md:block flex-1">
          <MySearchBox />
        </div>
        <!-- 个人中心 -->
        <div class="flex items-center justify-center">
          <img
            class="h-10 w-10 mx-2 cursor-pointer border-2 border-primary hover:border-blue-300 p-2 rounded-lg transition-all duration-100 ease-linear"
            src="@/assets/student/message.png"
            alt="消息提醒"
            ref="messageRef"
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
            :class="{ '!border-blue-300': activeTabIndex === 4 }"
            @click="handleTabClick(4, 3, '/student/center/message')"
          />
          <!-- 个人头像 -->
          <div
            class="flex items-center justify-center ml-2 cursor-pointer hover:bg-blue-300 p-1 rounded-full transition-all duration-100 ease-linear"
            ref="personalCenterRef"
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
            @click="handleTabClick(5, 0, '/student/center/info')"
            :class="{ 'bg-blue-300': activeTabIndex === 5 }"
          >
            <img
              class="h-10 w-10 rounded-full mr-2 border-2 border-gray-300"
              src="@/assets/student/avatar.png"
              alt="个人头像"
            />
            <text>Kimberly</text>
          </div>
        </div>
      </div>
    </header>
    <!-- 占位盒子 -->
    <div ref="fakeHeader"></div>
    <!-- 主体内容填写 -->
    <router-view class="flex-1"></router-view>
  </div>
</template>

<style scoped></style>
