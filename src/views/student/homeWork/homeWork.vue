<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue' // 引入vue
import { useRouter } from 'vue-router' //引入路由
import MyButton from '@/components/basic/MyButton.vue'
import { ElMessage } from 'element-plus' //引入element-plus的消息提示组件
//引入api
import { getStudentHomework } from '@/api/student.js'
//引入仓库
import { useStudentStore } from '@/stores'
const studentStore = useStudentStore() //获取学生仓库

//获取作业列表
const homeworkList = ref([]) //作业列表
const courseId = ref(1) //课程id
const courseType = ref('口语课程') //课程类型

const getHomeworkList = async () => {
  const res = await getStudentHomework(
    courseType,
    courseId,
    studentStore.getUserInfo().token
  )
  if (res.data.code === 0) {
    homeworkList.value = res.data.data
    console.log('作业列表', homeworkList.value)
  } else {
    // 登录失败，提示错误信息
    ElMessage.error(res.data.msg)
  }
}

onMounted(async () => {
  // 页面加载完成后执行的逻辑
  console.log('页面加载完成')
  getHomeworkList() //获取作业列表
})

const router = useRouter() //路由

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

//定义标题高亮下标
const activeIndex = ref(1) // 默认高亮第一个

//保存按钮点击事件
const handleSave = () => {
  console.log('保存成功')
}

//作业内容列表
const questions = [
  {
    id: 1,
    question: '春节前，人们通常会进行的一项重要活动是？',
    options: [
      { label: 'A. 游泳健身', value: 'A' },
      { label: 'B. 打扫房屋', value: 'B' },
      { label: 'C. 种植花卉', value: 'C' },
      { label: 'D. 学习外语', value: 'D' }
    ],
    answer: 'B'
  },
  {
    id: 2,
    question: '春节期间，孩子们最期待的习俗之一是？',
    options: [
      { label: 'A. 贴春联', value: 'A' },
      { label: 'B. 放鞭炮', value: 'B' },
      { label: 'C. 走亲戚', value: 'C' },
      { label: 'D. 看电影', value: 'D' }
    ],
    answer: 'B'
  },
  {
    id: 3,
    question: '春节期间，中国人通常会吃哪种食物来象征团圆？',
    options: [
      { label: 'A. 饺子', value: 'A' },
      { label: 'B. 粽子', value: 'B' },
      { label: 'C. 汤圆', value: 'C' },
      { label: 'D. 面条', value: 'D' }
    ],
    answer: 'C'
  },
  {
    id: 4,
    question: '春节联欢晚会首次播出是在哪一年？',
    options: [
      { label: 'A. 1978年', value: 'A' },
      { label: 'B. 1983年', value: 'B' },
      { label: 'C. 1990年', value: 'C' },
      { label: 'D. 2000年', value: 'D' }
    ],
    answer: 'B'
  },
  {
    id: 5,
    question: '春节期间，人们会在门上贴“福”字，通常“福”字会怎么贴？',
    options: [
      { label: 'A. 正着贴', value: 'A' },
      { label: 'B. 倒着贴', value: 'B' },
      { label: 'C. 斜着贴', value: 'C' },
      { label: 'D. 随意贴', value: 'D' }
    ],
    answer: 'B'
  },
  {
    id: 6,
    question: '春节期间，舞龙舞狮表演的主要目的是？',
    options: [
      { label: 'A. 娱乐观众', value: 'A' },
      { label: 'B. 驱邪避凶', value: 'B' },
      { label: 'C. 展示技艺', value: 'C' },
      { label: 'D. 增加气氛', value: 'D' }
    ],
    answer: 'B'
  },
  {
    id: 7,
    question: '春节期间，中国城市中最繁忙的交通方式通常是？',
    options: [
      { label: 'A. 地铁', value: 'A' },
      { label: 'B. 飞机', value: 'B' },
      { label: 'C. 火车', value: 'C' },
      { label: 'D. 汽车', value: 'D' }
    ],
    answer: 'C'
  },
  {
    id: 8,
    question: '春节期间，中国家庭中压岁钱的金额通常由什么决定？',
    options: [
      { label: 'A. 家庭经济状况', value: 'A' },
      { label: 'B. 孩子的年龄', value: 'B' },
      { label: 'C. 亲戚关系远近', value: 'C' },
      { label: 'D. 以上都是', value: 'D' }
    ],
    answer: 'D'
  },
  {
    id: 9,
    question: '春节期间，中国旅游市场的主要特点是？',
    options: [
      { label: 'A. 价格下降', value: 'A' },
      { label: 'B. 人流量减少', value: 'B' },
      { label: 'C. 人流量增加', value: 'C' },
      { label: 'D. 景点关闭', value: 'D' }
    ],
    answer: 'C'
  },
  {
    id: 10,
    question: '春节期间，中国农村最重要的活动之一是？',
    options: [
      { label: 'A. 农业生产', value: 'A' },
      { label: 'B. 家庭聚会', value: 'B' },
      { label: 'C. 商业活动', value: 'C' },
      { label: 'D. 体育比赛', value: 'D' }
    ],
    answer: 'B'
  }
]

const selectedAnswers = ref({}) // 保存选中的答案
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      <!-- 作业标题 -->
      <div class="p-2 mb-2 flex items-center justify-between">
        <!-- 返回图标 -->
        <img
          class="h-6 w-6 cursor-pointer"
          src="@/assets/student/back.png"
          @click="router.go(-1)"
          alt="返回图标"
        />
        <!-- 作业标题回显 -->
        <div class="flex-1 bg-white mx-4 p-2 rounded-lg text-center">
          <p class="font-semibold text-lg">作业：中国的春节</p>
        </div>
        <!-- 提交作业 -->
        <MyButton type="primary" class="py-1 px-2 !bg-blue-300"
          >提交作业</MyButton
        >
      </div>
      <!-- 作业主体 -->
      <div class="flex flex-1 overflow-y-auto">
        <!-- 左侧习题列表 -->
        <aside class="bg-white w-24 border-2 mr-4 rounded-lg p-2">
          <div
            v-for="index in 10"
            :key="index"
            @click="activeIndex = index"
            :class="{
              'bg-gray-400': activeIndex === index
            }"
            class="bg-blue-200 text-center mb-2 cursor-pointer hover:bg-gray-400 rounded-md"
          >
            习题{{ index }}
          </div>
        </aside>
        <!-- 右侧题目内容 -->
        <div class="flex-1 p-4 rounded-lg overflow-y-auto bg-white scrollBar">
          <!-- 内容 -->
          <div>
            <div
              v-for="(question, index) in questions"
              :key="question.id"
              class="mb-4"
            >
              <h3>{{ index + 1 }}. {{ question.question }}</h3>
              <ul>
                <li v-for="option in question.options" :key="option.value">
                  <label>
                    <input
                      type="radio"
                      :name="'question' + question.id"
                      :value="option.value"
                      v-model="selectedAnswers[question.id]"
                    />
                    {{ option.label }}
                  </label>
                </li>
              </ul>
            </div>
          </div>
          <!-- 保存按钮 -->
          <div class="text-center mt-4">
            <MyButton
              type="primary"
              size="large"
              class="!bg-blue-300"
              @click="handleSave"
              >保存</MyButton
            >
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
</style>
