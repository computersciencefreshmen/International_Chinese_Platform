<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue' // 引入vue
import MyButton from '@/components/basic/MyButton.vue'
//引入路由
import { useRouter } from 'vue-router'
const router = useRouter()

//定义容器盒子
const container = ref(null)

//容器距离顶部的距离
const containerTop = ref(0)

//定义布局架子
const layout = ref(null)

// 动态计算容器的高度
const handleContainerHeight = () => {
  if (container.value && layout.value) {
    // 容器距离顶部的高度
    containerTop.value = container.value.offsetTop
    // //获取布局架子的内边距
    // const layoutPadding =
    // 设置容器的高度
    container.value.style.height = `${
      window.innerHeight -
      containerTop.value -
      parseInt(window.getComputedStyle(layout.value).paddingBottom)
    }px`
  }
}

// 监听窗口大小变化
const handleResize = () => {
  handleContainerHeight()
}

onMounted(() => {
  nextTick(() => {
    // 初始计算容器高度
    handleContainerHeight()

    // 添加窗口大小变化的监听器
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  // 移除窗口大小变化的监听器
  window.removeEventListener('resize', handleResize)
})

// 老师个人信息
const teacherInfo = ref({
  id: 2,
  name: '老师名字',
  score: 4.8,
  //积分
  integral: 200,
  vip: false,
  avatar: '@/assets/student/avatar.png',
  graduate: '毕业于清华大学',
  // 证书
  certificate: ['教师资格证', '英语专业八级证书'],
  // 擅长方向
  direction: ['汉语口语', '商务英语'],
  experience: '教学经验：5年',
  // 教学风格
  style: '风格：严谨、耐心',
  isSubscribe: false
})

//定义历史记录标题
const historyTitle = ref([
  '话题',
  '关键词',
  '选择话轮',
  '是否选择',
  '预约日期和时段'
])

//定义历史记录
const historyRecords = ref([
  {
    topic: '舌尖上的中国',
    keywords: '美食、菜系、中国',
    selectedRound: '话轮2',
    appointmentTime: ''
  },
  {
    topic: '中国的节日',
    keywords: '春节、端午节、中秋节',
    selectedRound: '话轮1',
    appointmentTime: ''
  },
  {
    topic: '中国的节日',
    keywords: '春节、端午节、中秋节',
    selectedRound: '话轮1',
    appointmentTime: ''
  },
  {
    topic: '中国的节日',
    keywords: '春节、端午节、中秋节',
    selectedRound: '话轮1',
    appointmentTime: ''
  },
  {
    topic: '中国的节日',
    keywords: '春节、端午节、中秋节',
    selectedRound: '话轮1',
    appointmentTime: ''
  },
  {
    topic: '中国的节日',
    keywords: '春节、端午节、中秋节',
    selectedRound: '话轮1',
    appointmentTime: ''
  }
])

// 禁用当前时间之前的所有日期
const disabledDate = (time) => {
  return time.getTime() < Date.now() // 禁用当前时间之前的所有日期
}
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div
      ref="container"
      class="bg-blue-50 rounded-lg p-4 flex flex-col relative"
    >
      <!-- 绝对定位的返回图标 -->
      <img
        class="h-6 w-6 cursor-pointer absolute top-4 left-4"
        src="@/assets/student/back.png"
        @click="router.go(-1)"
        alt="返回图标"
      />
      <!-- 老师详情介绍 -->
      <div class="flex items-center justify-end mb-4">
        <div
          class="bg-white relative rounded-lg flex items-center justify-end w-11/12 p-4"
        >
          <!-- 老师头像 -->
          <img
            class="h-32 w-32 rounded-full border-2 mr-4 shadow-lg absolute top-12 -left-16"
            src="@/assets/student/avatar.png"
            alt="老师头像"
          />
          <div class="w-11/12 flex items-center">
            <!-- 老师个人信息 -->
            <div class="flex flex-col">
              <!-- 老师名称和评级和金标 -->
              <div class="flex items-center mb-2">
                <p class="font-semibold text-lg ml-2">老师名字</p>
                <p class="ml-2 text-sm text-gray-500">评级：4.8</p>
                <img
                  class="h-6 w-6 ml-1"
                  src="@/assets/student/vip.png"
                  alt="金标"
                />
              </div>
              <!-- 老师简介 -->
              <div class="flex flex-col">
                <li class="text-gray-500 text-sm">
                  {{ teacherInfo.graduate }}
                </li>
                <li class="text-gray-500 text-sm">
                  {{ teacherInfo.certificate.join('、') }}
                </li>
                <li class="text-gray-500 text-sm">
                  擅长{{ teacherInfo.direction.join('、') }}
                </li>
                <li class="text-gray-500 text-sm">
                  {{ teacherInfo.experience }}
                </li>
                <li class="text-gray-500 text-sm">
                  教学风格：{{ teacherInfo.style }}
                </li>
              </div>
            </div>
            <!-- 中间隔线 -->
            <div class="w-0.5 h-48 bg-gray-300 mx-4"></div>
            <!-- 右侧老师所拥有的课程展示 -->
            <div class="flex-1 flex flex-row overflow-x-auto">
              <!-- <p class="mb-2">该老师的网络课程</p> -->
              <!-- 课程列表 -->
              <div class="flex-1 flex flex-row space-x-4">
                <!-- 课程 -->
                <div
                  class="w-48 border-2 rounded-lg overflow-hidden shadow-lg"
                  v-for="i in 2"
                  :key="i"
                >
                  <img
                    class="w-full h-24 object-cover"
                    src="@/assets/student/onlineCourses/春节.png"
                    alt=""
                  />
                  <div class="p-2">
                    <p class="font-semibold text-sm text-ellipsis">
                      交通对话学习
                    </p>
                    <p
                      class="line-clamp-3 text-xs text-gray-500 text-multiline-ellipsis"
                    >
                      当你来到中国，需要搭乘交通工具的时候应该如何表述呢？述呢？述呢？述呢？述呢？述呢？述呢？述呢？
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 话轮选择 -->
      <div class="bg-white p-4 rounded-lg flex-1 overflow-y-auto scrollBar">
        <!-- 标题 -->
        <div class="flex items-center justify-between mb-4 space-x-2">
          <div class="flex items-center space-x-2">
            <h1 class="font-semibold py-1 px-2 bg-blue-300 rounded-lg">
              选择历史话题
            </h1>
            <h1
              @click="router.push('createNewChat')"
              class="font-semibold py-1 px-2 bg-yellow-300 rounded-lg cursor-pointer hover:bg-yellow-400 transition-all duration-300 ease-in-out"
            >
              生成新的话题
            </h1>
          </div>
          <!-- 确认预约 -->
          <MyButton type="primary" class="py-1 px-2 !bg-blue-300"
            >确认预约</MyButton
          >
        </div>
        <!-- 网格布局列表 -->
        <div class="flex-1">
          <!-- 表格标题 -->
          <div class="grid grid-cols-5 font-semibold text-center gap-4">
            <span v-for="title in historyTitle" :key="title">{{ title }}</span>
          </div>
          <!-- 表格内容 -->
          <div
            v-for="(record, index) in historyRecords"
            :key="index"
            class="grid grid-cols-5 text-center cursor-pointer border-2 border-white border-dashed hover:border-blue-200 my-2 rounded-lg transition-all duration-300 ease-in-out py-2"
          >
            <span>{{ record.topic }}</span>
            <span>{{ record.keywords }}</span>
            <span>{{ record.selectedRound }}</span>
            <!-- 是否选择 -->
            <div class="flex items-center justify-center">
              <MyButton type="primary" class="w-24">选择</MyButton>
            </div>
            <!-- 预约时段 -->
            <el-date-picker
              v-model="record.appointmentTime"
              type="datetime"
              placeholder="请选择预约时间"
              :disabled-date="disabledDate"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.scrollBar::-webkit-scrollbar {
  width: 6px; /* 滚动条的宽度 */
}
.scrollBar::-webkit-scrollbar-track {
  background: #f1f1f1; /* 滚动条轨道的背景颜色 */
  border-radius: 10px; /* 滚动条轨道的圆角 */
}

.scrollBar::-webkit-scrollbar-thumb {
  background: #888; /* 滚动条的背景颜色 */
  border-radius: 10px; /* 滚动条的圆角 */
}

.scrollBar::-webkit-scrollbar-thumb:hover {
  background: #6e6d6d; /* 滚动条悬停时的背景颜色 */
}

/* 单行隐藏 */
.text-ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 100%; /* 或者设置一个固定宽度 */
}

/* 多行隐藏*/
.text-multiline-ellipsis {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* 设置最大显示行数 */
  line-clamp: 2; /* 设置最大显示行数 */
  -webkit-box-orient: vertical;
  width: 100%; /* 或者设置一个固定宽度 */
}
</style>
