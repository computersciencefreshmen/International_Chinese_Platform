<script setup>
import { ref } from 'vue' // 引入vue
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useStudentPersonStore } from '@/stores/modules/studentPerson'
import CreateChatTurn from '../chatTurn/components/CreateChatTurn.vue'
import MyButton from '@/components/basic/MyButton.vue'

const router = useRouter()
const studentPersonStore = useStudentPersonStore()

//定义预约的时间
const appointmentTime = ref('')
const teacherName = ref('')

// 禁用当前时间之前的所有日期
const disabledDate = (time) => {
  return time.getTime() < Date.now() // 禁用当前时间之前的所有日期
}

const handleSubmit = () => {
  if (!appointmentTime.value || !teacherName.value.trim()) {
    ElMessage.warning('请选择预约时间并填写老师名称')
    return
  }

  studentPersonStore.addAppointment({
    topic: '个性化中文课程',
    keywords: '待课堂确认',
    selectedRound: '预约教师',
    appointmentTime: appointmentTime.value,
    teacherName: teacherName.value.trim(),
    createdAt: new Date().toISOString()
  })
  ElMessage.success('预约已保存')
  router.push('/student/home')
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
            v-model="teacherName"
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
