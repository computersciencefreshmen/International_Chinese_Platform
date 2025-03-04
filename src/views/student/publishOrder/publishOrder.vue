<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue' // 引入vue
import selectorsBasic from '@/components/service/selectorsBasic.vue'

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
    title: '教学经验',
    placeholder: '请选择教学经验',
    value: '',
    list: [
      {
        label: '5年及以上',
        value: 5
      },
      {
        label: '3年及以上',
        value: 3
      },
      {
        label: '1年及以上',
        value: 1
      }
    ]
  },
  {
    title: '擅长方向',
    placeholder: '请选择擅长方向',
    value: '',
    list: [
      {
        label: '汉语口语',
        value: '汉语口语'
      },
      {
        label: '商务英语',
        value: '商务英语'
      },
      {
        label: '日语',
        value: '日语'
      },
      {
        label: '韩语',
        value: '韩语'
      }
    ]
  },
  {
    title: '教学风格',
    placeholder: '请选择教学风格',
    value: '',
    list: [
      {
        label: '严谨',
        value: '严谨'
      },
      {
        label: '耐心',
        value: '耐心'
      },
      {
        label: '活泼',
        value: '活泼'
      }
    ]
  }
])
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      <!-- 课程匹配条件 -->
      <div class="bg-white rounded-lg p-4">
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
