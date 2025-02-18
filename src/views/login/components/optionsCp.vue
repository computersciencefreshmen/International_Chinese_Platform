<script setup>
import { defineProps, defineEmits } from 'vue'
const props = defineProps({
  text: String,
  isActive: Boolean
})

const emit = defineEmits(['click'])

//给组件定义一个click事件
const handleActive = (event) => {
  emit('click', event)
}
</script>
<template>
  <div
    @click="handleActive"
    :class="{ 'bg-blue-400': props.isActive }"
    class="flex items-center justify-between px-3 cursor-pointer h-16 mx-2 rounded-lg hover:bg-blue-400 bg-secondary transition-all duration-300 ease-in-out"
  >
    <slot></slot>
    <text class="font-semibold text-l ml-2"> {{ props.text }}</text>
  </div>
</template>
