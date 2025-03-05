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

//定义老师筛选列表
const teacherFilterList = ref([
  {
    title: '评分',
    heightLight: 0,
    list: [
      {
        name: '4.8分及以上',
        value: 4.8
      },
      {
        name: '4.5分及以上',
        value: 4.5
      },
      {
        name: '4.0分及以上',
        value: 4.0
      },
      {
        name: '不限',
        value: 0
      }
    ]
  },
  {
    title: '教学经验',
    heightLight: 0, //高亮值
    list: [
      {
        name: '5年及以上',
        value: 5
      },
      {
        name: '3年及以上',
        value: 3
      },
      {
        name: '1年及以上',
        value: 1
      },
      {
        name: '不限',
        value: 0
      }
    ]
  },
  {
    title: '擅长方向',
    heightLight: '不限', //高亮值
    list: [
      {
        name: '汉语口语',
        value: '汉语口语'
      },
      {
        name: '汉语语法',
        value: '汉语语法'
      },
      {
        name: '商务英语',
        value: '商务英语'
      },
      {
        name: '不限',
        value: '不限'
      }
    ]
  }
])

// 老师卡片列表
const teacherCardList = ref([
  {
    id: 0,
    name: '老师名字',
    score: 4.8,
    //积分
    integral: 200,
    vip: true,
    avatar: '@/assets/student/avatar.png',
    graduate: '毕业于广东外语外贸大学',
    // 证书
    certificate: ['教师资格证', '英语专业四级证书'],
    // 擅长方向
    direction: ['汉语口语', '商务英语'],
    experience: '教学经验：5年',
    // 教学风格
    style: '风格：严谨、耐心',
    isSubscribe: true
  },
  {
    id: 1,
    name: '老师名字',
    score: 4.8,
    //积分
    integral: 200,
    vip: false,
    avatar: '@/assets/student/avatar.png',
    graduate: '毕业于中山大学',
    // 证书
    certificate: ['教师资格证', '英语专业六级证书'],
    // 擅长方向
    direction: ['汉语口语', '商务英语'],
    experience: '教学经验：5年',
    // 教学风格
    style: '风格：严谨、耐心',
    isSubscribe: false
  },
  {
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
  },
  {
    id: 3,
    name: '老师名字',
    score: 4.8,
    //积分
    integral: 200,
    vip: false,
    avatar: '@/assets/student/avatar.png',
    graduate: '毕业于广东外语外贸大学',
    // 证书
    certificate: ['教师资格证', '英语专业四级证书'],
    // 擅长方向
    direction: ['汉语口语', '商务英语'],
    experience: '教学经验：5年',
    // 教学风格
    style: '风格：严谨、耐心',
    isSubscribe: true
  },
  {
    id: 4,
    name: '老师名字',
    score: 4.8,
    //积分
    integral: 200,
    vip: true,
    avatar: '@/assets/student/avatar.png',
    graduate: '毕业于广东外语外贸大学',
    // 证书
    certificate: ['教师资格证', '英语专业四级证书'],
    // 擅长方向
    direction: ['汉语口语', '商务英语'],
    experience: '教学经验：5年',
    // 教学风格
    style: '风格：严谨、耐心'
  },
  {
    id: 5,
    name: '老师名字',
    score: 4.5,
    //积分
    integral: 200,
    avatar: '@/assets/student/avatar.png',
    graduate: '毕业于广东外语外贸大学',
    // 证书
    certificate: ['教师资格证', '英语专业四级证书'],
    // 擅长方向
    direction: ['汉语口语', '商务英语'],
    experience: '教学经验：5年',
    // 教学风格
    style: '风格：严谨、耐心'
  },
  {
    id: 6,
    name: '老师名字',
    score: 4.8,
    //积分
    integral: 200,
    avatar: '@/assets/student/avatar.png',
    graduate: '毕业于广东外语外贸大学',
    // 证书
    certificate: ['教师资格证', '英语专业四级证书'],
    // 擅长方向
    direction: ['汉语口语', '商务英语'],
    experience: '教学经验：5年',
    // 教学风格
    style: '风格：严谨、耐心'
  },
  {
    id: 7,
    name: '老师名字',
    score: 4.8,
    //积分
    integral: 200,
    avatar: '@/assets/student/avatar.png',
    graduate: '毕业于广东外语外贸大学',
    // 证书
    certificate: ['教师资格证', '英语专业四级证书'],
    // 擅长方向
    direction: ['汉语口语', '商务英语'],
    experience: '教学经验：5年',
    // 教学风格
    style: '风格：严谨、耐心'
  },
  {
    id: 8,
    name: '老师名字',
    score: 4.8,
    //积分
    integral: 200,
    avatar: '@/assets/student/avatar.png',
    graduate: '毕业于广东外语外贸大学',
    // 证书
    certificate: ['教师资格证', '英语专业四级证书'],
    // 擅长方向
    direction: ['汉语口语', '商务英语'],
    experience: '教学经验：5年',
    // 教学风格
    style: '风格：严谨、耐心'
  }
])
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      <!-- 顶部导航栏筛选框 -->
      <nav class="bg-white flex flex-col p-2 rounded-lg mb-4">
        <div
          class="grid grid-cols-5 xl:w-1/2 mb-2"
          v-for="item in teacherFilterList"
          :key="item.title"
        >
          <p class="font-semibold">{{ item.title }}:</p>
          <span
            class="mx-2 hover:bg-blue-300 py-1 px-2 rounded-lg cursor-pointer text-center transition-all duration-300 ease-in-out"
            v-for="temp in item.list"
            :class="{ 'bg-blue-300': temp.value === item.heightLight }"
            @click="item.heightLight = temp.value"
            :key="temp.name"
            >{{ temp.name }}</span
          >
        </div>
      </nav>
      <!-- 老师列表 -->
      <main
        class="flex-1 overflow-auto scrollBar rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-3"
      >
        <!-- 老师卡片盒子 -->
        <div
          class="bg-white shadow-lg rounded-lg p-4 cursor-pointer flex flex-col relative"
          v-for="item in teacherCardList"
          :key="item.id"
        >
          <!-- 斜挂横幅架子 -->
          <div
            class="absolute top-0 left-0 inset-0 pointer-events-none overflow-hidden"
          >
            <!-- 横幅 -->
            <div
              class="w-1/2 absolute top-4 -right-10 rotate-45 z-10 bg-red-500 text-white px-4 py-2 text-sm flex items-center justify-center"
            >
              <p>{{ item.integral }}积分/次</p>
            </div>
          </div>
          <!-- 老师头像和介绍 -->
          <div class="flex items-center mb-4">
            <img
              class="h-16 w-16 rounded-full border-2 mr-4 shadow-lg"
              src="@/assets/student/avatar.png"
              alt="老师头像"
            />
            <div class="flex flex-col">
              <div class="flex items-center mb-2">
                <p class="font-semibold text-lg">{{ item.name }}</p>
                <img
                  v-if="item.vip"
                  class="h-6 w-6 ml-1"
                  src="@/assets/student/vip.png"
                  alt="金标"
                />
              </div>

              <p class="text-gray-500 text-sm">
                评分：
                <span
                  :class="{
                    'text-red-400': item.score >= 4.8,
                    'text-lg': item.score >= 4.8,
                    'font-semibold': item.score >= 4.8
                  }"
                  >{{ item.score }}</span
                >
              </p>
            </div>
          </div>
          <!-- 老师简历 -->
          <div class="flex flex-col">
            <li class="text-gray-500 text-sm">{{ item.graduate }}</li>
            <li class="text-gray-500 text-sm">
              {{ item.certificate.join('、') }}
            </li>
            <li class="text-gray-500 text-sm">
              擅长{{ item.direction.join('、') }}
            </li>
            <li class="text-gray-500 text-sm">{{ item.experience }}</li>
            <li class="text-gray-500 text-sm">教学风格：{{ item.style }}</li>
          </div>
          <!-- 预约上课按钮 -->
          <div class="flex items-center justify-center mt-4">
            <MyButton
              :type="item.isSubscribe ? 'danger' : 'primary'"
              class="w-1/2"
              @click="router.push('teacherDetail')"
              >{{ item.isSubscribe ? '已预约' : '预约上课' }}</MyButton
            >
          </div>
        </div>
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
</style>
