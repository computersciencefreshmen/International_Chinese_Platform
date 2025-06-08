<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// 记录当前选择的是哪个页面,0为首页,1为授课对接,2为网络课程,3为个人中心
const activeIndex = ref(0)

// 监视activeIndex变化的函数
const route = useRoute()
function getActiveIndex(path) {
  if (path === '/teacher/home') {
    activeIndex.value = 0
  } else if (path === '/teacher/teachingDocking') {
    activeIndex.value = 1
  } else if (
    path === '/teacher/onlineCourses' ||
    path === '/teacher/uploadCourses' ||
    path === '/teacher/courseDetails'
  ) {
    activeIndex.value = 2
  } else if (path === '/teacher/user') {
    activeIndex.value = 3
  }
}
watch(
  route,
  (newValue) => {
    getActiveIndex(newValue.fullPath)
  },
  { immediate: true }
)

// 页面跳转
const router = useRouter()
const pageJump = (url, index) => {
  router.push(url)
  activeIndex.value = index
}

// 选中此时选中的语言种类
const LanguageValue = ref('Chinese')
// 用于存储可选择语言的列表
const options = [
  {
    value: 'Chinese',
    label: '中文'
  },
  {
    value: 'English',
    label: '英文'
  },
  {
    value: 'French',
    label: '法语'
  },
  {
    value: 'Spanish',
    label: '西班牙语'
  },
  {
    value: 'Japanese',
    label: '日语'
  }
]

// 导入字体图标
import { Search } from '@element-plus/icons-vue'
// 绑定输入框输入的内容
const SearchValue = ref('')
</script>

<template>
  <div
    class="HeaderNavContainer px-4 py-2 w-full flex h-24 fixed top-0 left-0 bg-primary items-center justify-between z-50"
  >
    <!-- 左侧 -->
    <div class="LeftContainer flex items-center">
      <!-- logo区域 -->
      <div class="LogoContainer mr-5 flex items-center">
        <img class="w-14 h-14" src="/src/assets/icon/logo.png" alt="" />
        <img
          class="h-14 w-56 xl:h-14 xl:w-64 2xl:h-16 2xl:w-72"
          src="/src/assets/icon/textLogo.png"
          alt=""
        />
      </div>
      <!-- 导航部分 -->
      <div class="NavContainer flex items-center">
        <div
          @click="pageJump('/teacher/home', 0)"
          class="mr-5 px-5 py-3 text-xl 2xl:text-2xl duration-500 hover:ring-2 ring-blue-500/50 cursor-pointer rounded-3xl"
          :class="{ 'bg-sky-200': activeIndex === 0 }"
        >
          首页
        </div>
        <div
          @click="pageJump('/teacher/teachingDocking', 1)"
          class="mr-5 px-5 py-3 text-xl 2xl:text-2xl duration-500 rounded-3xl cursor-pointer hover:ring-2 ring-blue-500/50"
          :class="{ 'bg-sky-200': activeIndex === 1 }"
        >
          授课对接
        </div>
        <div
          @click="pageJump('/teacher/onlineCourses', 2)"
          class="px-5 py-3 text-xl 2xl:text-2xl duration-500 rounded-3xl hover:ring-2 ring-blue-500/50 cursor-pointer"
          :class="{ 'bg-sky-200': activeIndex === 2 }"
        >
          网络课程
        </div>
      </div>
    </div>
    <!-- 右侧 -->
    <div class="RightContainer flex items-center">
      <!-- 语言选择 -->
      <div class="LanguageSelector mr-5">
        <el-select
          v-model="LanguageValue"
          placeholder="Select"
          size="default"
          style="width: 80px"
        >
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <!-- 搜索框 -->
      <div
        class="SearchContainer mr-5 h-16 bg-white rounded-3xl hidden xl:flex"
      >
        <el-input
          v-model="SearchValue"
          style="width: 320px"
          size="large"
          placeholder="Pick a date"
          :suffix-icon="Search"
        />
      </div>
      <!-- 消息图标 -->
      <div class="MessageContainer mr-5 cursor-pointer">
        <img class="w-10 h-10" src="/src/assets/student/message.png" alt="" />
      </div>
      <!-- 用户栏 -->
      <div
        @click="pageJump('/teacher/user', 3)"
        class="UserContainer flex items-center hover:ring-2 ring-blue-500/50 rounded-3xl duration-500 px-3 py-2"
        :class="{ 'bg-sky-200': activeIndex === 3 }"
      >
        <img
          class="mr-3 w-12 h-12 rounded-full"
          src="/src/assets/student/avatar.png"
          alt=""
        />
        <div
          class="UserName text-xl hover:text-red-500 duration-500 cursor-pointer"
        >
          Sandy
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less"></style>
