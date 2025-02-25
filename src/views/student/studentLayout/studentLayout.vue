<script setup>
import { useLocaleStore } from '@/stores'
import { useI18n } from 'vue-i18n' //引入vue-i18n语言库
import { computed, ref, nextTick } from 'vue' //引入vue的计算属性
import MySearchBox from '@/components/basic/MySearchBox.vue' //引入自定义搜索框组件
import logoComponent from '@/components/service/logoComponent.vue' //引入自定义logo组件
const localeStore = useLocaleStore() //获取语言存储
const { locale } = useI18n() //

//计算具体的语言
const currentLocale = computed({
  get: () => locale.value,
  set: (value) => {
    localeStore.setLocale(value)
  }
})

//切换语言
const changeLanguage = () => {
  localeStore.setLocale(currentLocale.value)
}

// tab切换内容设置
const tabList = [
  { name: '首页', path: '/student/home' },
  { name: '预约老师', path: '/student/order' },
  { name: '发布预约', path: '/student/publish' },
  { name: '网络课程', path: '/student/course' }
]

//获取tab栏切换的盒子
const tabRef = ref([])

// 获取下划线
const lineRef = ref(null)

// 定义tab栏高亮下标
const activeTabIndex = ref(0)

// 获取鼠标移入时，当前盒子的位置
const handleMouseEnter = (event) => {
  const target = event.target
  const { left, width } = target.getBoundingClientRect()
  lineRef.value.style.left = left + 'px'
  lineRef.value.style.width = width + 'px'
}

// 获取鼠标移出时，横向回到高亮盒子的位置
const handleMouseLeave = () => {
  // 获取高亮盒子的位置
  const activeTab = tabRef.value[activeTabIndex.value]
  const { left, width } = activeTab.getBoundingClientRect()
  lineRef.value.style.left = left + 'px'
  lineRef.value.style.width = width + 'px'
}

// 首次加载页面时，让横线移动到第一个盒子的位置
const moveLineToFirstTab = () => {
  nextTick(() => {
    // 确保 DOM 更新完成后执行
    if (tabRef.value.length > 0) {
      const firstTab = tabRef.value[0]
      const { left, width } = firstTab.getBoundingClientRect()
      lineRef.value.style.left = `${left + window.scrollX}px` // 考虑滚动偏移
      lineRef.value.style.width = `${width}px`
    }
  })
}

setTimeout(() => {
  moveLineToFirstTab()
}, 200)
</script>

<template>
  <div class="flex flex-col min-h-screen bg-image">
    <!-- 头部导航栏填写 -->
    <header class="flex flex-row bg-primary bg-primary1 px-4 py-2 relative">
      <logoComponent></logoComponent>
      <span
        ref="lineRef"
        class="absolute bottom-0 left-0 h-1 bg-blue-300 transition-all duration-300 ease-in-out rounded-lg"
      ></span>
      <div class="flex-1 flex flex-row items-center ml-8">
        <!-- tab栏切换 -->
        <div
          ref="tabRef"
          v-for="(item, index) in tabList"
          :key="item.name"
          @click="
            () => {
              activeTabIndex = index
              $router.push(item.path)
            }
          "
          :class="{ 'bg-blue-300': activeTabIndex === index }"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
          class="cursor-pointer px-4 py-2 mx-1 transition-all duration-100 rounded-lg hover:bg-blue-300 ease-linear"
        >
          <text class="text-md font-sans lg:text-xl">{{ item.name }}</text>
        </div>
        <div class="mx-2">
          <select
            class="w-full sm:py-2 sm:px-4 border border-gray-300 rounded-full shadow-sm outline-none"
            v-model="currentLocale"
            @change="changeLanguage"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <!-- 搜索框 -->
        <div class="mx-4 hidden md:block">
          <MySearchBox />
        </div>
      </div>
    </header>
    <!-- 主体内容填写 -->
    <router-view></router-view>
  </div>
</template>

<style scoped></style>
