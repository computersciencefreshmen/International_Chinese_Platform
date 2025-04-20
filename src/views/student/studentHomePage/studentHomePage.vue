<script setup>
import CourseList from '@/components/service/CourseList.vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router' //引入路由

import { useStudentStore } from '@/stores' //引入学生仓库
const studentStore = useStudentStore() //获取学生仓库

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
    title: '话题6 春节下的中国',
    time: '2021-10-01 09:00',
    teacher: 'Kimberly老师',
    id: 1
  },
  {
    title: '话题6 春节下的中国',
    time: '2021-10-01 09:00',
    teacher: 'Kimberly老师',
    id: 2
  },
  {
    title: '话题6 春节下的中国',
    time: '2021-10-01 09:00',
    teacher: 'Kimberly老师',
    id: 3
  },
  {
    title: '话题7 夏天下的中国',
    time: '2021-10-10 09:00',
    teacher: 'nb老师',
    id: 4
  },
  {
    title: '话题8 秋天下的中国',
    time: '2021-10-11 09:00',
    teacher: 'nb2老师',
    id: 5
  },
  {
    title: '话题9 冬天下的中国',
    time: '2021-10-12 09:00',
    teacher: 'nb3老师',
    id: 6
  },
  {
    title: '话题10 春天下的中国',
    time: '2021-10-13 09:00',
    teacher: 'nb4老师',
    id: 7
  },
  {
    title: '话题11 夏天下的中国',
    time: '2021-10-14 09:00',
    teacher: 'nb5老师',
    id: 8
  },
  {
    title: '话题12 秋天下的中国',
    time: '2021-10-15 09:00',
    teacher: 'nb6老师',
    id: 9
  },
  {
    title: '话题13 冬天下的中国',
    time: '2021-10-16 09:00',
    teacher: 'nb7老师',
    id: 10
  },
  {
    title: '话题14 春天下的中国',
    time: '2021-10-17 09:00',
    teacher: 'nb8老师',
    id: 11
  },
  {
    title: '话题15 夏天下的中国',
    time: '2021-10-18 09:00',
    teacher: 'nb9老师',
    id: 12
  },
  {
    title: '话题16 秋天下的中国',
    time: '2021-10-19 09:00',
    teacher: 'nb10老师',
    id: 13
  },
  {
    title: '话题17 冬天下的中国',
    time: '2021-10-20 09:00',
    teacher: 'nb11老师',
    id: 14
  },
  {
    title: '话题18 春天下的中国',
    time: '2021-10-21 09:00',
    teacher: 'nb12老师',
    id: 15
  },
  {
    title: '话题19 夏天下的中国',
    time: '2021-10-22 09:00',
    teacher: 'nb13老师',
    id: 16
  },
  {
    title: '话题20 秋天下的中国',
    time: '2021-10-23 09:00',
    teacher: 'nb14老师',
    id: 17
  },
  {
    title: '话题21 冬天下的中国',
    time: '2021-10-24 09:00',
    teacher: 'nb15老师',
    id: 18
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
              {{ studentStore.getUserInfo().point }}
            </p>
          </div>
        </div>
      </div>
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
          :course-list="courseList"
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
