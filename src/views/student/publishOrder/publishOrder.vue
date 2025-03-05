<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue' // 引入vue
import selectorsBasic from '@/components/service/selectorsBasic.vue'
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

//定义老师筛选列表
const teacherFilterList = ref([
  {
    title: '教师评分',
    placeholder: '请选择评分',
    value: '',
    list: [
      {
        label: '4.8分及以上',
        value: 4.8
      },
      {
        label: '4.5分及以上',
        value: 4.5
      },
      {
        label: '4.0分及以上',
        value: 4.0
      },
      {
        label: '3.5分及以上',
        value: 3.5
      },
      {
        label: '3.0分及以上',
        value: 3.0
      }
    ]
  },
  {
    title: '课程内容',
    placeholder: '请选择课程内容',
    value: '',
    list: [
      {
        label: '语法',
        value: '语法'
      },
      {
        label: '口语',
        value: '口语'
      }
    ]
  },
  {
    title: '教师擅长领域',
    placeholder: '请选择擅长领域',
    value: '',
    list: [
      {
        label: '语法',
        value: '语法'
      },
      {
        label: '口语',
        value: '口语'
      }
    ]
  },
  {
    title: '学习目标',
    placeholder: '请选择学习目标',
    value: '',
    list: [
      {
        label: '日常交流',
        value: '日常交流'
      },
      {
        label: '考试冲刺',
        value: '考试冲刺'
      },
      {
        label: '职场提升',
        value: '职场提升'
      },
      {
        label: '文化兴趣',
        value: '文化兴趣'
      }
    ]
  },
  {
    // 教学经验
    title: '教学经验',
    placeholder: '请选择教学经验',
    value: '',
    list: [
      {
        label: '5年以上',
        value: '5年以上'
      },
      {
        label: '3-5年',
        value: '3-5年'
      },
      {
        label: '1-3年',
        value: '1-3年'
      },
      {
        label: '不限',
        value: '不限'
      }
    ]
  },
  {
    //课程难度
    title: '课程难度',
    placeholder: '请选择课程难度',
    value: '',
    list: [
      {
        label: '初级',
        value: '初级'
      },
      {
        label: '中级',
        value: '中级'
      },
      {
        label: '高级',
        value: '高级'
      }
    ]
  }
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

//定义历史记录标题
const historyTitle = ref([
  '话题',
  '关键词',
  '选择话轮',
  '是否选择',
  '预约日期和时段'
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
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      <!-- 课程匹配条件 -->
      <div class="bg-white rounded-lg p-4 mb-4">
        <!-- 标题 -->
        <div class="flex mb-4">
          <p class="text-lg font-bold bg-blue-300 px-2 py-1 rounded-lg">
            课程匹配条件
          </p>
        </div>
        <!-- 各种标准 -->
        <div>
          <!-- 教师评分 -->
          <div class="grid grid-cols-2 gap-2 lg:w-1/2">
            <selectorsBasic
              v-for="item in teacherFilterList"
              v-model="item.value"
              :key="item.title"
              :placeholder="item.placeholder"
              :title="item.title"
              :options="item.list"
            />
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
              @click="router.push('createNewPublish')"
              class="font-semibold py-1 px-2 bg-yellow-300 rounded-lg cursor-pointer hover:bg-yellow-400 transition-all duration-300 ease-in-out"
            >
              生成新的话题
            </h1>
          </div>
          <!-- 确认预约 -->
          <MyButton type="primary" class="py-1 px-2 !bg-blue-300"
            >确认发布</MyButton
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
</style>
