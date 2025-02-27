<script setup>
import { ref } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'text'
  },
  placeholder: String,
  modelValue: String,
  label: String,
  error: String,
  // 是否显示有弧度的圆角
  roundedLg: {
    type: Boolean,
    default: false
  },
  // 是否标签显示在输入框内部
  innerLabel: {
    type: Boolean,
    default: true
  },
  id: {
    type: String,
    required: true
  },
  emailOptions: {
    type: Array,
    default: () => [
      { value: '@qq.com', label: 'QQ 邮箱' },
      { value: '@gmail.com', label: 'Gmail' },
      { value: '@outlook.com', label: 'Outlook' }
    ]
  },
  showEmailTypeSelector: {
    type: Boolean,
    default: false // 默认不显示选择器
  },
  showCountdown: {
    type: Boolean,
    default: false // 默认不显示倒计时
  },
  countdownTime: {
    type: Number,
    default: 60 // 默认倒计时时间（秒）
  }
})

const emit = defineEmits(['update:modelValue', 'update:emailType'])

const emailType = ref('') // 当前选择的邮箱类型
// const throttleTimeout = ref(null) // 用于节流的定时器
const countdown = ref(props.countdownTime) // 倒计时秒数
const isCounting = ref(false) // 是否正在倒计时

// 节流函数
// const handleVerificationCodeInput = (event) => {
//   const value = event.target.value

//   // 清除之前的定时器
//   if (throttleTimeout.value) {
//     clearTimeout(throttleTimeout.value)
//   }

//   // 设置新的定时器
//   throttleTimeout.value = setTimeout(() => {
//     emit('update:verificationCode', value)
//   }, 500) // 500ms 内只触发一次
// }

// 倒计时逻辑
const startCountdown = () => {
  if (isCounting.value) return // 如果已经在倒计时，直接返回
  isCounting.value = true
  countdown.value = props.countdownTime

  const interval = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    } else {
      clearInterval(interval)
      isCounting.value = false
    }
  }, 1000)
}
</script>
<template>
  <div class="mb-6 flex justify-center items-center w-full">
    <label
      v-if="!props.innerLabel"
      :for="props.id"
      class="flex items-center text-gray-700 mr-6 font-sans font-thin text-lg"
      >{{ props.label }}</label
    >
    <div class="relative flex-1">
      <label
        v-if="props.innerLabel"
        :for="props.id"
        class="flex items-center text-gray-700 absolute inset-y-0 left-0 ml-6"
        >{{ props.label }}</label
      >
      <input
        :type="props.type"
        :placeholder="props.placeholder"
        :value="props.modelValue"
        @input="emit('update:modelValue', $event.target.value)"
        class="w-full rounded-full px-24 py-2 border border-gray-300 focus:outline-none focus:border-blue-500"
        :class="{
          'border-red-500': props.error,
          '!rounded-lg': roundedLg,
          'px-6': !props.innerLabel
        }"
        :id="props.id"
      />

      <!-- 邮箱类型选择器（可选） -->
      <div
        v-if="props.showEmailTypeSelector"
        class="absolute inset-y-0 right-0 flex items-center pr-3 border-l-2"
      >
        <select
          v-model="emailType"
          @change="emit('update:emailType', emailType)"
          class="bg-transparent border-none focus:outline-none"
        >
          <option disabled value="">请选择邮箱域名</option>
          <option
            v-for="option in props.emailOptions"
            :key="option.value"
            :value="option.value"
            class="text-center"
          >
            {{ option.value }}
          </option>
        </select>
      </div>

      <!-- 倒计时（可选） -->
      <div
        v-if="props.showCountdown"
        class="absolute inset-y-0 right-0 flex items-center pr-3"
      >
        <button
          v-if="!isCounting"
          class="bg-transparent border-none text-blue-500 focus:outline-none"
          @click="startCountdown"
        >
          获取验证码
        </button>
        <span v-else class="text-gray-500 cursor-not-allowed"
          >{{ countdown }}s后重新获取</span
        >
      </div>
      <transition name="fade" class="absolute inset-y-9 left-0 ml-6">
        <p v-if="props.error" class="text-red-500 text-sm mt-2">
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
