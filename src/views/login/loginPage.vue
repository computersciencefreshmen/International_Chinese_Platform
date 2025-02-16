<script setup>
import { useLocaleStore } from '@/stores'
import { useI18n } from 'vue-i18n' //引入vue-i18n语言库
import { computed, ref } from 'vue' //引入vue的计算属性

const localeStore = useLocaleStore() //获取语言存储
const { locale } = useI18n() //获取当前语言

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

//是否登录
const isLogin = ref(true)
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <!-- 头部导航栏填写 -->
    <header class="flex flex-row justify-between bg-primary px-4 py-2">
      <div class="flex flex-row items-center basic-1/4">
        <img class="w-8 sm:w-14" src="@/assets/icon/logo.png" alt="logo" />
        <img
          class="h-8 sm:h-14 mt-2"
          src="@/assets/icon/文字logo.png"
          alt="文字logo"
        />
      </div>
      <div class="flex flex-row items-center md:basis-6/12">
        <div>
          <select
            class="w-full sm:py-2 sm:px-4 border border-gray-300 rounded-full shadow-sm outline-none"
            v-model="currentLocale"
            @change="changeLanguage"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <input
          class="hidden md:block basis-2/3 py-2 px-4 border border-gray-300 rounded-full shadow-sm outline-none mx-4"
          type="text"
          placeholder="输入你想查询的内容"
        />
        <button
          class="bg-blue-200 rounded-full text-black w-12 h-6 mx-1 sm:font-semibold sm:w-16 sm:h-8 sm:mx-2 hover:ring hover:ring-blue-800 hover:ring-opacity-50 transition-all duration-300 ease-in-out"
        >
          登录
        </button>
        <button
          class="bg-red-400 rounded-full text-white w-12 h-6 sm:font-semibold sm:w-16 sm:h-8 hover:ring hover:ring-red-800 hover:ring-opacity-50 transition-all duration-300 ease-in-out"
        >
          注册
        </button>
      </div>
    </header>
    <!-- 主体内容填写 -->
    <main class="bg-green-100 flex-1 flex justify-center items-center">
      <div class="w-1/2 h-96 bg-primary rounded-2xl min-w-min p-4">
        <!-- 登录主体内容填写 -->
        <div
          v-if="isLogin"
          class="flex flex-col items-center justify-center h-full"
        >
          <span class="text-black text-3xl font-semibold"
            >欢迎登陆国际中文教育平台</span
          >
          <div>
            <button>我是学生</button>
            <button>我是教师</button>
            <button>我是管理员</button>
          </div>
        </div>
        <!-- 注册主体填写 -->
        <div v-else></div>
      </div>
    </main>
  </div>
</template>
