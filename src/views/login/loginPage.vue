<script setup>
import { useLocaleStore } from '@/stores'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const localeStore = useLocaleStore()
const { locale } = useI18n()

const currentLocale = computed({
  get: () => locale.value,
  set: (value) => {
    localeStore.setLocale(value)
  }
})

const changeLanguage = () => {
  localeStore.setLocale(currentLocale.value)
}
</script>

<template>
  <div>
    <select v-model="currentLocale" @change="changeLanguage">
      <option value="zh">中文</option>
      <option value="en">English</option>
    </select>
    <h1>{{ $t('welcome') }}</h1>
  </div>
</template>
