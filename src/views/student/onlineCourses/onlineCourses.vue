<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue' // 引入vue
import MyButton from '@/components/basic/MyButton.vue'
import MySearchBox from '@/components/basic/MySearchBox.vue'
import { ElMessage } from 'element-plus' //引入element-plus的消息提示组件
//引入api
import { getOnlineCoursesDetail, getOnlineCoursesList } from '@/api/student.js'
//引入仓库
import { useStudentStore } from '@/stores'
const studentStore = useStudentStore() //获取学生仓库

//获取课程列表
// const courseList = ref([])
const currentPage = ref(1) //当前页码
const courseCategory = ref('grammar') //课程分类
const title = ref('') //课程标题

const getCourseList = async () => {
  const res = await getOnlineCoursesList(
    studentStore.getUserInfo().token,
    currentPage.value,
    10,
    courseCategory.value,
    title.value
  )

  console.log('课程列表', res)
  if (res.data.code === 0) {
    // courseList.value = res.data.data
    console.log('课程列表', res)
  } else {
    // 登录失败，提示错误信息
    ElMessage.error(res.data.msg)
  }
}

//获取课程详情页
const getCourseDetail = async (courseId) => {
  const res = await getOnlineCoursesDetail(
    studentStore.getUserInfo().token,
    courseId
  )
  if (res.data.code === 0) {
    // courseList.value = res.data.data
    console.log('课程详情', res.data.data)
  } else {
    // 登录失败，提示错误信息
    // ElMessage.error(res.data.msg)
  }
}

onMounted(async () => {
  // 页面加载完成后执行的逻辑
  console.log('页面加载完成')
  getCourseDetail(1) //获取课程详情
  getCourseList()
})

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

//定义是否是口语课程
const isSpokenCourse = ref(true)

//监听课程分类的变化
watch(isSpokenCourse, (newVal) => {
  if (newVal) {
    courseCategory.value = 'speaking'
  } else {
    courseCategory.value = 'grammar'
  }
  getCourseList()
})

//定义动画方向
const direction = ref('slide-left')
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      <!-- tab栏切换 -->
      <nav class="flex items-center mb-4">
        <MyButton
          type="primary"
          class="py-2 px-4 mx-4"
          :class="{ 'bg-blue-500': isSpokenCourse }"
          @click="((isSpokenCourse = true), (direction = 'slide-left'))"
          >口语</MyButton
        >
        <MyButton
          type="primary"
          class="py-2 px-4 mr-4"
          :class="{ 'bg-blue-500': !isSpokenCourse }"
          @click="((isSpokenCourse = false), (direction = 'slide-right'))"
          >语法</MyButton
        >
        <MySearchBox class="w-2/5"></MySearchBox>
      </nav>
      <!-- 网课列表，网格布局 -->
      <main class="overflow-auto flex-1 scrollBar px-4">
        <Transition :name="direction" mode="out-in">
          <!-- 口语课程-->
          <div
            v-if="isSpokenCourse"
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            <!-- 口语课程 -->
            <div
              v-for="i in 18"
              :key="i"
              class="bg-white shadow-lg rounded-lg p-4 cursor-pointer hover:scale-90 transition-all duration-300 ease-in-out"
            >
              <img
                class="w-full h-32 object-cover rounded-lg"
                src="@/assets/student/onlineCourses/鞭炮.png"
                alt=""
              />
              <p class="text-lg font-semibold mt-2 text-ellipsis">
                交通对话学习
              </p>
              <p
                class="line-clamp-3 text-sm text-gray-500 mt-2 text-multiline-ellipsis"
              >
                当你来到中国，需要搭乘交通工具的时候应该如何表述呢？述呢？述呢？述呢？述呢？述呢？述呢？
              </p>
            </div>
            <div
              class="bg-white shadow-lg rounded-lg p-4 cursor-pointer hover:scale-90 transition-all duration-300 ease-in-out"
            >
              <img
                class="w-full h-32 object-cover rounded-lg"
                src="@/assets/student/onlineCourses/鞭炮.png"
                alt=""
              />
              <p class="text-lg font-semibold mt-2">交通对话学习</p>
              <p class="text-sm text-gray-500 mt-2">当你来到中</p>
            </div>
          </div>
          <!-- 语法课程 -->
          <div
            v-else
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            <!-- 语法课程 -->
            <div
              v-for="i in 18"
              :key="i"
              class="bg-white shadow-lg rounded-lg p-4 cursor-pointer hover:scale-90 transition-all duration-300 ease-in-out"
            >
              <img
                class="w-full h-32 object-cover rounded-lg"
                src="@/assets/student/onlineCourses/春节.png"
                alt=""
              />
              <p class="text-lg font-semibold mt-2 text-ellipsis">
                交通对话学习
              </p>
              <p
                class="line-clamp-3 text-sm text-gray-500 mt-2 text-multiline-ellipsis"
              >
                当你来到中国，需要搭乘交通工具的时候应该如何表述呢？述呢？述呢？述呢？述呢？述呢？述呢？
              </p>
            </div>
          </div>
        </Transition>
      </main>
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

/* 动画 */
/* 如果是向左走，那就是离开的元素向左边离开，进来的元素从右边进来 */
.slide-left-enter-active,
.slide-left-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* 如果是向右走，那就是离开的元素向右边离开，进来的元素从左边进来 */
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-right-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
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
