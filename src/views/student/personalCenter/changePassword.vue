<script setup>
import { ref } from 'vue'
import MyButton from '@/components/basic/MyButton.vue'
import InputComponent from '@/components/basic/InputComponent.vue'

// 定义密码表单参数
const formData = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 处理修改密码事件
const handleReviseEvent = () => {
  console.log('修改密码')
}
</script>

<template>
  <!-- 架子 -->
  <div class="h-full p-4 bg-blue-50">
    <!-- 修改密码盒子 -->
    <div class="flex flex-col rounded-lg p-4">
      <InputComponent
        v-model="formData.oldPassword"
        type="password"
        :innerLabel="false"
        :rounded-lg="true"
        id="原密码"
        label="原密码"
        placeholder="请输入原密码"
      />
      <InputComponent
        v-model="formData.newPassword"
        :innerLabel="false"
        :rounded-lg="true"
        id="新密码"
        label="新密码"
        type="password"
        placeholder="请输入新密码"
      />
      <InputComponent
        v-model="formData.confirmPassword"
        :innerLabel="false"
        :rounded-lg="true"
        id="确认密码"
        label="确认密码"
        type="password"
        placeholder="请再次输入新密码"
      />
      <MyButton
        type="primary"
        class="w-1/4 mx-auto py-2"
        @click="handleReviseEvent"
        >确认修改</MyButton
      >
    </div>
  </div>
</template>

<style scoped></style>
