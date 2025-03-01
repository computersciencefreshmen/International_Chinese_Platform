<script setup>
import MyButton from '@/components/basic/MyButton.vue'
import { ref, nextTick, onMounted } from 'vue'

//已上课列表是否展开
// const EdCursesShowMore = ref(false)

//未上课列表是否展开
const toCursesShowMore = ref(false) // 控制展开和收起状态
const contentRef = ref(null) // 获取内容容器的引用
const contentHeight = ref(0) // 动态计算的内容高度

const toggleShowMore = () => {
  toCursesShowMore.value = !toCursesShowMore.value // 切换展开和收起状态
  if (toCursesShowMore.value) {
    nextTick(() => {
      contentHeight.value = contentRef.value.scrollHeight // 动态获取内容的实际高度
    })
  }
}

onMounted(() => {
  nextTick(() => {
    contentHeight.value = contentRef.value.scrollHeight // 初始化内容高度
  })
})
</script>

<template>
  <!-- 布局架子 -->
  <div class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div class="bg-blue-50 rounded-lg p-4 flex flex-col">
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
        <div class="w-0.5 h-full bg-gray-300 mx-8"></div>
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
            <p class="text-lg font-bold">5000</p>
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
      <div>
        <!-- 未上课列表 -->
        <div class="bg-white p-4 rounded-lg mt-4">
          <p class="text-lg font-bold mb-2">未上课</p>
          <!-- 列表 -->
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-center p-2 rounded-lg border-2 border-blue-100 cursor-pointer hover:border-blue-300 transition-all duration-300 ease-in-out"
          >
            <!-- 话题 -->
            <p class="font-semibold">话题6 春节下的中国</p>
            <!-- 课程时间 -->
            <p>2021-10-01 09:00</p>
            <!-- 课程老师 -->
            <p>Kimberly老师</p>
            <div class="flex-1 grid grid-cols-3 gap-4">
              <MyButton type="primary">进入课堂</MyButton>
              <MyButton type="primary">预习</MyButton>
              <MyButton type="primary">完成作业</MyButton>
            </div>
          </div>

          <!-- 其余项 -->
          <div
            ref="contentRef"
            class="overflow-hidden transition-all duration-300 ease-in-out"
            :style="{
              maxHeight: toCursesShowMore ? contentHeight + 'px' : '0px'
            }"
          >
            <div
              v-for="i in 10"
              :key="i"
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-center p-2 rounded-lg border-2 border-blue-100 cursor-pointer hover:border-blue-300 transition-all duration-300 ease-in-out my-2"
            >
              <!-- 话题 -->
              <p class="font-semibold">话题6 春节下的中国</p>
              <!-- 课程时间 -->
              <p>2021-10-01 09:00</p>
              <!-- 课程老师 -->
              <p>Kimberly老师</p>
              <div class="flex-1 grid grid-cols-3 gap-4">
                <MyButton type="primary">进入课堂</MyButton>
                <MyButton type="primary">预习</MyButton>
                <MyButton type="primary">完成作业</MyButton>
              </div>
            </div>
          </div>
          <!-- 展开/收起按钮 -->
          <button
            @click="toggleShowMore"
            class="text-gray-400 text-sm mt-2 cursor-pointer"
          >
            {{ toCursesShowMore ? '收起' : '展开更多' }}
          </button>
        </div>
        <!-- 已上课列表 -->
        <div class="bg-white p-4 rounded-lg mt-4">
          <p class="text-lg font-bold mb-2">未上课</p>
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-center p-2 rounded-lg border-2 border-blue-100 cursor-pointer"
          >
            <!-- 话题 -->
            <p class="font-semibold">话题6 春节下的中国</p>
            <!-- 课程时间 -->
            <p>2021-10-01 09:00</p>
            <!-- 课程老师 -->
            <p>Kimberly老师</p>
            <div class="flex-1 grid grid-cols-3 gap-4">
              <MyButton type="primary">进入课堂</MyButton>
              <MyButton type="primary">预习</MyButton>
              <MyButton type="primary">完成作业</MyButton>
            </div>
          </div>
          <!-- 展开/收起按钮 -->
          <button
            @click="toggleShowMore"
            class="text-gray-400 text-sm mt-2 cursor-pointer"
          >
            {{ toCursesShowMore ? '收起' : '展开更多' }}
          </button>
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
</style>
