<script setup>
import { defineProps, ref, nextTick, watch } from 'vue'
import { usePersonalStore } from '@/stores'
const personalStore = usePersonalStore() // 引入仓库

// 接收props的导航栏参数
const props = defineProps({
  tabList: Array
})

// 定义动态高亮tab栏下标
const isTabActive = ref(personalStore.isTabActive)

// 定义动态高亮背景横线
const bgRef = ref(null)

// 定义tab栏
const tabRef = ref([])

// 设置高亮背景横线位置
const placeHightLine = (height, width, top) => {
  bgRef.value.style.height = height + 'px'
  bgRef.value.style.width = width + 'px'
  bgRef.value.style.top = top + 'px'
}

// 鼠标移入事件
const handleMouseEnter = (event) => {
  const { height, width } = event.currentTarget.getBoundingClientRect()
  const top = event.currentTarget.offsetTop
  // 设置高亮横线位置
  placeHightLine(height, width, top)
}

// 鼠标移出事件
const handleMouseLeave = () => {
  // 获取高亮tab栏的位置
  const { height, width } =
    tabRef.value[isTabActive.value].getBoundingClientRect()
  const top = tabRef.value[isTabActive.value].offsetTop
  // 设置高亮横线位置
  placeHightLine(height, width, top)
}

// 监听personalStore.isTabActive的变化
watch(
  () => personalStore.isTabActive,
  (value) => {
    isTabActive.value = value
    handleMouseLeave() // 监听到变化后，为了让横线移动到高亮tab栏的位置
  }
)

// 首次加载页面时，让横线移动到第一个tab栏的位置
nextTick(() => {
  handleMouseLeave()
})
</script>
<template>
  <nav
    class="flex flex-col relative border-l-2 border-b-2 rounded-bl-lg overflow-hidden"
  >
    <!-- 背景颜色切换 -->
    <div
      ref="bgRef"
      class="absolute top-0 left-0 bg-blue-300 transition-all duration-300 ease-out items-center justify-center -z-10 border-l-8 border-blue-500 opacity-50 rounded-r-lg backdrop-blur-lg"
    ></div>
    <div
      v-for="(item, index) in props.tabList"
      :key="item.name"
      ref="tabRef"
      @click="((isTabActive = index), $router.push(item.path))"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      class="p-4 ease-linear flex items-center justify-center cursor-pointer"
    >
      <text>{{ item.name }}</text>
    </div>
  </nav>
</template>
<style scoped></style>
