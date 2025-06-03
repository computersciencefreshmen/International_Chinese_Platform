<script setup>
import { ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()

//引入模态框
import CustomModal from '@/components/basic/CustomModal.vue'

// 接收props的导航栏参数
const props = defineProps({
  tabList: Array,
  activeTabIndex: Number
})

// 定义动态高亮tab栏下标
const isTabActive = ref(props.activeTabIndex)

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
  () => props.activeTabIndex,
  (value) => {
    isTabActive.value = value
    handleMouseLeave() // 监听到变化后，为了让横线移动到高亮tab栏的位置
  }
)

// 点击tab栏事件
const handleTabClick = (index, path) => {
  isTabActive.value = index // 更新状态
  router.push(path) // 触发路由跳转
}

// 首次加载页面时，让横线移动到第一个tab栏的位置
nextTick(() => {
  handleMouseLeave()
})

//定义模态框状态
const showModal = ref(false)

//模态框确认事件
const handleExit = () => {
  console.log('退出')
  router.push('/login')
}
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
      :key="item.id"
      ref="tabRef"
      @click="handleTabClick(index, item.path)"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      class="p-4 ease-linear flex items-center justify-center cursor-pointer font-sans"
    >
      <text>{{ item.name }}</text>
    </div>
    <div
      @click="showModal = true"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      class="p-4 ease-linear flex items-center justify-center cursor-pointer font-sans"
    >
      <text>退出登录</text>
    </div>
  </nav>
  <CustomModal
    :isVisible="showModal"
    @close="showModal = false"
    @confirm="handleExit"
  >
    <template #content>确定要退出登录吗？</template>
  </CustomModal>
</template>
<style scoped></style>
