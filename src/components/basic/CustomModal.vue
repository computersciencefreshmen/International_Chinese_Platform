<script setup>
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <Transition name="slide-down" mode="out-in">
    <div
      v-if="props.isVisible"
      class="fixed inset-0 flex items-center justify-center z-50"
    >
      <!-- 遮罩层 -->
      <div
        class="fixed inset-0 bg-black bg-opacity-25"
        @click="emit('close')"
      ></div>

      <!-- 模态框内容 -->
      <div class="bg-white p-6 rounded-lg shadow-lg z-10">
        <!-- 标题 -->
        <h2 class="text-lg font-semibold mb-4">
          <slot name="title">系统提示</slot>
        </h2>
        <!-- 内容 -->
        <div class="m-8">
          <slot name="content"></slot>
        </div>
        <div class="flex justify-end mt-4">
          <button
            @click="emit('close')"
            class="mr-2 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            取消
          </button>
          <button
            @click="$emit('confirm')"
            class="bg-red-400 text-white px-4 py-2 rounded hover:bg-red-500"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 向下滑动 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
