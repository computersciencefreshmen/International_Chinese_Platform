<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'text'
  },
  placeholder: String,
  modelValue: String,
  label: String,
  error: String,
  id: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="mb-6 flex">
    <label :for="props.id" class="block mx-2 mt-2 text-gray-700">{{
      props.label
    }}</label>
    <div class="flex-1 relative">
      <input
        :type="props.type"
        :placeholder="props.placeholder"
        :value="props.modelValue"
        @input="emit('update:modelValue', $event.target.value)"
        class="w-full rounded-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500"
        :class="{ 'border-red-500': props.error }"
        :id="id"
      />
      <transition name="fade">
        <p
          v-if="props.error"
          class="text-red-500 text-sm absolute top-10.5 left-4"
        >
          {{ props.error }}
        </p>
      </transition>
    </div>
  </div>
</template>

<style scoped>
/* 添加动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
