<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  modelValue: {
    type: [String, Number], // 支持多种类型
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

// 使用本地变量代理 modelValue
const localValue = ref(props.modelValue)

// 监听父组件传递的 modelValue，更新本地变量
watch(
  () => props.modelValue,
  (newValue) => {
    localValue.value = newValue
  }
)

// 监听本地变量的变化，通知父组件更新
const updateValue = (newValue) => {
  emit('update:modelValue', newValue)
}
</script>

<template>
  <div class="flex items-center mr-4">
    <p
      class="bg-blue-300 rounded-l-lg h-full flex justify-center items-center px-2"
    >
      {{ title }}
    </p>
    <!-- 下拉框 -->
    <el-select
      class="flex-1"
      v-model="localValue"
      :placeholder="placeholder"
      @update:modelValue="updateValue"
    >
      <el-option
        v-for="option in options"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      ></el-option>
    </el-select>
  </div>
</template>
