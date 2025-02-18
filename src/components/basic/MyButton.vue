<script setup>
import { defineProps, defineEmits, computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'default',
    validator: (val) => {
      return ['default', 'primary', 'success', 'warning', 'danger'].includes(
        val
      )
    }
  },
  size: {
    type: String,
    default: 'medium',
    validator: (val) => {
      return ['small', 'medium', 'large'].includes(val)
    }
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const buttonClass = computed(() => {
  const baseClass = 'mx-1 rounded-full transition-all duration-300 ease-in-out'
  const typeClass = {
    default:
      'bg-gray-500 text-white hover:ring hover:ring-gray-800 hover:ring-opacity-50',
    primary:
      'bg-blue-200 text-white hover:ring hover:ring-blue-800 hover:ring-opacity-50',
    success:
      'bg-green-500 text-white hover:ring hover:ring-green-800 hover:ring-opacity-50',
    warning:
      'bg-yellow-500 text-white hover:ring hover:ring-yellow-800 hover:ring-opacity-50',
    danger:
      'bg-red-300 text-white hover:ring hover:ring-red-800 hover:ring-opacity-50'
  }[props.type]

  const sizeClass = {
    small: 'w-12 h-6',
    medium: 'text-base',
    large: 'w-16 h-8'
  }[props.size]

  return `${baseClass} ${typeClass} ${sizeClass} ${
    props.disabled ? 'cursor-not-allowed opacity-50' : ''
  }`
})

//给组件定义一个click事件
const emit = defineEmits(['click'])

const handleClick = (event) => {
  if (props.disabled || props.loading) {
    return
  }
  emit('click', event)
}
</script>
<template>
  <button :class="buttonClass" :disabled="disabled" @click="handleClick">
    <slot v-if="!loading"></slot>
    <span v-else class="loading-spinner"></span>
  </button>
</template>

<style scoped>
.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 3px solid transparent;
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.5s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
