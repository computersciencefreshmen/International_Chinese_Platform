<script setup>
import CourseList from '@/components/service/CourseList.vue'
import DidiClassBox from '@/components/didi/DidiClassBox.vue'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router' //引入路由

import { useStudentStore } from '@/stores' //引入学生仓库
const studentStore = useStudentStore() //获取学生仓库

// 计算属性，获取用户信息
const userInfo = computed(() => studentStore.getUserInfo())

// 计算属性，获取积分
const userPoint = computed(() => userInfo.value?.point || 0)

onMounted(() => {
  // 页面加载完成后执行的逻辑
  console.log('页面加载完成')
  // 获取学生信息
  studentStore.getUserInfo()

  console.log('学生信息', studentStore.getUserInfo())
})

const router = useRouter() //路由

const courseList = ref([
  {
    title: '话题6 中国的春节',
    time: '2025-05-01 09:00',
    teacher: 'Kimberly老师',
    id: 1
  },
  {
    title: '话题7 中国的夏天',
    time: '2025-05-02 09:00',
    teacher: '李老师',
    id: 2
  },
  {
    title: '话题8 中国的秋天',
    time: '2025-05-03 09:00',
    teacher: '王老师',
    id: 3
  },
  {
    title: '话题9 中国的冬天',
    time: '2025-05-10 09:00',
    teacher: '丘老师',
    id: 4
  },
  {
    title: '话题10 中国的节日',
    time: '2025-05-11 09:00',
    teacher: '刘老师',
    id: 5
  }
])

//已经上课的课程
const finishedCourseList = ref([
  {
    title: '话题1 中国的瓷器',
    time: '2025-04-01 09:00',
    teacher: 'Kimberly老师',
    id: 1
  },
  {
    title: '话题2 中国的书法',
    time: '2025-04-02 09:00',
    teacher: '李老师',
    id: 2
  },
  {
    title: '话题3 中国的山水画',
    time: '2025-04-03 09:00',
    teacher: '王老师',
    id: 3
  },
  {
    title: '话题4 中国的京剧',
    time: '2025-04-10 09:00',
    teacher: '丘老师',
    id: 4
  },
  {
    title: '话题5 中国的武术',
    time: '2025-04-11 09:00',
    teacher: '刘老师',
    id: 5
  }
])

const appointmentList = ref([
  {
    id: 1,
    topic: '中国的节日',
    teacher: '王老师',
    time: '2025-06-01 10:00',
    status: '未上课'
  },
  {
    id: 2,
    topic: '舌尖上的中国',
    teacher: '李老师',
    time: '2025-06-02 14:00',
    status: '未上课'
  }
])

// 进入课堂
const enterClass = (id) => {
  console.log('进入课堂', id)
  router.push('/student/liveClass')
}

// 预习
const preview = (id) => {
  console.log('预习', id)
  router.push('/student/chatTurn')
}

// 完成作业
const finishWork = (id) => {
  console.log('完成作业', id)
  router.push('/student/homeWork')
}
</script>

<template>
  <!-- 布局架子 -->
  <div class="container mx-auto p-4 h-screen">
    <!-- 布局容器 -->
    <div class="bg-blue-50 rounded-lg p-4 flex flex-col h-full">
      <!-- 个人数据显示 -->
      <div class="flex items-center justify-between mb-4 p-4">
        <!-- 头像、名称等展示 -->
        <div class="flex items-center">
          <img
            class="h-32 w-32 rounded-full border-2 mr-4"
            src="@/assets/student/avatar.png"
            alt="个人头像"
          />
          <div class="flex flex-col">
            <div class="flex justify-center items-center mb-1">
              <p class="text-lg font-bold">Kimberly</p>
              <img
                src="@/assets/student/vip.png"
                class="h-6 w-6 ml-1"
                alt="金标"
              />
            </div>
            <p class="text-sm py-1 px-2 bg-yellow-300 rounded-full text-center">
              HKS3
            </p>
          </div>
        </div>
        <!-- 横线隔开 -->
        <div class="w-0.5 h-28 bg-gray-300 mx-8"></div>
        <!-- 积分、余额等展示 -->
        <div class="grid grid-cols-5 flex-1 gap-6">
          <div class="text-center lg:p-6 rounded-lg bg-white flex flex-col">
            <p class="text-lg font-bold text-gray-500 mb-2">今日课程</p>
            <p class="text-lg font-bold">3</p>
          </div>
          <div class="text-center lg:p-6 rounded-lg bg-white flex flex-col">
            <p class="text-lg font-bold text-gray-500 mb-2">中文词汇量</p>
            <p class="text-lg font-bold">1000</p>
          </div>
          <div class="text-center lg:p-6 rounded-lg bg-white flex flex-col">
            <p class="text-lg font-bold text-gray-500 mb-2">话题学习数</p>
            <p class="text-lg font-bold">30</p>
          </div>
          <div class="text-center lg:p-6 rounded-lg bg-white flex flex-col">
            <p class="text-lg font-bold text-gray-500 mb-2">参与的课程</p>
            <p class="text-lg font-bold">5</p>
          </div>
          <div class="text-center lg:p-6 rounded-lg bg-white flex flex-col">
            <p class="text-lg font-bold text-gray-500 mb-2">积分</p>
            <p class="text-lg font-bold">
              {{ userPoint }}
            </p>
          </div>
        </div>
      </div>
      <!-- 滴滴上课组件 -->
      <DidiClassBox :appointments="appointmentList" class="mb-6" />
      <!-- 每日佳句 -->
      <div class="bg-white p-4 rounded-lg flex items-center">
        <p class="text-lg font-bold mr-8">每日佳句</p>
        <p class="text-gray-500 text-md">
          天生我材必有用，千金散尽还复来。 —— 唐·李白 《将进酒》
        </p>
      </div>
      <!-- 课程详情 -->
      <!-- 未上课列表 -->
      <div>
        <CourseList
          :course-list="courseList"
          @enterClass="enterClass"
          @preview="preview"
          @finishWork="finishWork"
          >未上课</CourseList
        >
      </div>
      <!-- 已上课列表 -->
      <div>
        <CourseList
          :course-list="finishedCourseList"
          @enterClass="enterClass"
          @preview="preview"
          @finishWork="finishWork"
          >已上课</CourseList
        >
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
</style>
