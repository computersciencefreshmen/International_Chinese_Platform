<script setup>
import { useLocaleStore } from '@/stores'
import { useI18n } from 'vue-i18n' //引入vue-i18n语言库
import { computed } from 'vue' //引入vue的计算属性
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
</script>

<template>
  <!-- <select
    class="w-full sm:py-2 sm:px-4 border border-gray-300 rounded-full shadow-sm outline-none"
    v-model="currentLocale"
    @change="changeLanguage"
  >
    <option value="zh">中文</option>
    <option value="en">English</option>
  </select> -->
  <el-select
    placeholder="Select"
    class="!w-28"
    size="large"
    v-model="currentLocale"
    @change="changeLanguage"
  >
    <el-option label="中文" value="zh" />
    <el-option label="English" value="en" />
  </el-select>
</template>

<style scoped></style>
