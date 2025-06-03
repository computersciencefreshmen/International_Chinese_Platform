<script setup>
import { ref } from 'vue' // 引入vue
import CreateChatTurn from '../chatTurn/components/CreateChatTurn.vue'
import MyButton from '@/components/basic/MyButton.vue'
import { ElMessage } from 'element-plus'
//引入路由
import { useRouter } from 'vue-router'
const router = useRouter()

//定义预约的时间
const appointmentTime = ref('')

// 禁用当前时间之前的所有日期
const disabledDate = (time) => {
  return time.getTime() < Date.now() // 禁用当前时间之前的所有日期
}

// 提交预约
const handleSubmit = () => {
  if (!appointmentTime.value) {
    ElMessage.warning('请选择预约时间') // 提示用户选择预约时间
    return
  }
  // 提交预约逻辑
  console.log('预约时间:', appointmentTime.value)
  ElMessage.success('预约成功') // 提示用户预约成功
  //返回上一个页面
  router.back()
}
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="rounded-lg px-4 flex flex-col">
      <!-- 生成新话轮 -->
      <CreateChatTurn />
      <!-- 预约的时段和老师 -->
      <div class="bg-blue-50 rounded-lg p-4 flex justify-between">
        <div class="flex items-center space-x-2">
          <p>预约上课日期和时段</p>
          <!-- 时间 -->
          <el-date-picker
            v-model="appointmentTime"
            type="datetime"
            placeholder="请选择预约时间"
            :disabled-date="disabledDate"
          />
        </div>
        <!-- 老师 -->
        <div class="flex items-center space-x-2">
          <p>预约老师</p>
          <input
            type="text"
            placeholder="请输入老师名称"
            class="outline-none hover:border-blue-300 border-blue-50 rounded-md px-2 border-2"
          />
        </div>
        <!-- 确认预约 -->
        <MyButton
          type="primary"
          class="py-1 px-2 !bg-blue-300"
          @click="handleSubmit"
          >确认预约</MyButton
        >
      </div>
    </div>
  </div>
</template>

<style scoped></style>
