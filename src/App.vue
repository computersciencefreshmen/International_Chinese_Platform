<script setup>
import { onMounted } from 'vue'
import { useLocaleStore } from '@/stores'

// 获取 Pinia 中定义的语言存储
const localeStore = useLocaleStore()

// 在组件挂载后设置语言
onMounted(() => {
  // 尝试从 localStorage 获取语言，如果没有存储或存储的语言不在支持的语言列表中，则默认使用 'zh'
  const savedLang = localStorage.getItem('lang')
  const availableLangs = ['zh', 'en']
  const lang = availableLangs.includes(savedLang) ? savedLang : 'zh'

  // 设置语言
  localeStore.setLocale(lang)
})
</script>

<template>
  <router-view></router-view>
</template>
