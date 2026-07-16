<script setup>
import { computed, ref, onMounted, nextTick, onUnmounted } from 'vue' // 引入vue
import { useRouter } from 'vue-router' //引入路由
import MyButton from '@/components/basic/MyButton.vue'
import { ElMessage } from 'element-plus' //引入element-plus的消息提示组件
//引入api
import { getStudentHomework, submitHomework } from '@/api/student.js'
//引入仓库
import { useStudentStore } from '@/stores'
const studentStore = useStudentStore() //获取学生仓库

//获取作业列表
const homeworkList = ref([]) //作业列表
const courseId = ref(1) //课程id
const courseType = ref('口语课程') //课程类型
const isLoading = ref(false)
const isSaving = ref(false)
const isSubmitting = ref(false)
const loadError = ref('')

// 原型阶段使用 10 道习题的本地答题草稿；接入真实题目接口后可按题目 id 映射。
const answerDrafts = ref(Array.from({ length: 10 }, () => ''))

//定义标题高亮下标
const activeIndex = ref(1) // 默认高亮第一个

const currentAnswer = computed({
  get: () => answerDrafts.value[activeIndex.value - 1],
  set: (value) => {
    answerDrafts.value[activeIndex.value - 1] = value
  }
})

const homeworkTitle = computed(() => {
  const homework = homeworkList.value
  if (Array.isArray(homework)) {
    return homework[0]?.title || homework[0]?.homeworkTitle || '春节下的中国'
  }

  return homework?.title || homework?.homeworkTitle || '春节下的中国'
})

const draftStorageKey = computed(
  () => `homework-draft:${courseType.value}:${courseId.value}`
)

const getToken = () => studentStore.getUserInfo()?.token

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const restoreDraft = () => {
  try {
    const savedDraft = localStorage.getItem(draftStorageKey.value)
    if (!savedDraft) return

    const parsedDraft = JSON.parse(savedDraft)
    if (Array.isArray(parsedDraft.answers)) {
      answerDrafts.value = Array.from(
        { length: 10 },
        (_, index) => parsedDraft.answers[index] || ''
      )
    }
  } catch {
    localStorage.removeItem(draftStorageKey.value)
  }
}

const getHomeworkList = async () => {
  const token = getToken()
  if (!token) {
    loadError.value = '登录状态已失效，请重新登录后加载作业。'
    return
  }

  isLoading.value = true
  loadError.value = ''

  try {
    const res = await getStudentHomework(
      courseType.value,
      courseId.value,
      token
    )

    if (res.data?.code !== 0) {
      throw new Error(res.data?.msg || '作业加载失败')
    }

    homeworkList.value = res.data?.data || []
  } catch (error) {
    loadError.value = getErrorMessage(
      error,
      '作业加载失败，当前仍可编辑并保存本地草稿。'
    )
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  restoreDraft()
  await getHomeworkList()
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

//保存按钮点击事件
const handleSave = async () => {
  isSaving.value = true

  try {
    localStorage.setItem(
      draftStorageKey.value,
      JSON.stringify({
        courseId: courseId.value,
        courseType: courseType.value,
        answers: answerDrafts.value,
        savedAt: new Date().toISOString()
      })
    )
    ElMessage.success('草稿已保存在当前浏览器')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '草稿保存失败'))
  } finally {
    isSaving.value = false
  }
}

const handleSubmit = async () => {
  const token = getToken()
  if (!token) {
    ElMessage.error('登录状态已失效，请重新登录后提交作业')
    return
  }

  const answers = answerDrafts.value
    .map((answer, index) => ({ questionIndex: index + 1, answer }))
    .filter((item) => item.answer)

  if (answers.length === 0) {
    ElMessage.warning('请至少完成一道习题后再提交')
    return
  }

  isSubmitting.value = true

  try {
    const res = await submitHomework(courseType.value, courseId.value, token, {
      answers
    })

    if (res.data?.code !== 0) {
      throw new Error(res.data?.msg || '作业提交失败')
    }

    localStorage.removeItem(draftStorageKey.value)
    ElMessage.success('作业提交成功')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '作业提交失败，请稍后重试'))
  } finally {
    isSubmitting.value = false
  }
}
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
          <p class="font-semibold text-lg">作业：{{ homeworkTitle }}</p>
        </div>
        <!-- 提交作业 -->
        <MyButton
          type="primary"
          class="py-1 px-2 !bg-blue-300"
          :disabled="isSubmitting || isLoading"
          :loading="isSubmitting"
          @click="handleSubmit"
          >提交作业</MyButton
        >
      </div>
      <div
        v-if="isLoading"
        class="mb-3 rounded-lg bg-white px-4 py-3 text-center text-gray-500"
        role="status"
      >
        正在加载作业...
      </div>
      <div
        v-else-if="loadError"
        class="mb-3 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-amber-800"
        role="alert"
      >
        <span>{{ loadError }}</span>
        <button
          type="button"
          class="rounded-md bg-amber-100 px-3 py-1 hover:bg-amber-200"
          @click="getHomeworkList"
        >
          重试
        </button>
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
          <!-- 内容：接口题目结构确定前保留一份可交互的原型题目。 -->
          <div class="mb-6">
            <p class="mb-4 font-medium">
              {{ activeIndex }}. 请问你的名字是什么？
            </p>
            <el-radio-group
              v-model="currentAnswer"
              class="flex flex-col items-start gap-3"
            >
              <el-radio value="A">A. 我叫李明。</el-radio>
              <el-radio value="B">B. 我是老师。</el-radio>
              <el-radio value="C">C. 我是学生。</el-radio>
              <el-radio value="D">D. 我是医生。</el-radio>
            </el-radio-group>
          </div>
          <!-- 保存按钮 -->
          <div class="text-center mt-4">
            <MyButton
              type="primary"
              size="large"
              class="!bg-blue-300"
              :disabled="isSaving"
              :loading="isSaving"
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
