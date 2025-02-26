<script setup>
import { ref } from 'vue'
import MyButton from '@/components/basic/MyButton.vue'

//定义文件上传对象
const fileInput = ref(null)

//点击头像触发input的点击事件
const triggerInput = () => {
  // 触发input的点击事件
  fileInput.value.click()
}

const avatarUrl = ref('@/assets/student/avatar.png') // 默认头像路径

//处理文件上传
const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarUrl.value = e.target.result // 更新头像路径
    }
    reader.readAsDataURL(file) // 读取文件为 Data URL
  }
}

//修改列表
const reviseList = ref([
  {
    title: '修改昵称',
    placeholder: '请输入昵称'
  },
  {
    title: '修改国籍',
    placeholder: '请输入国籍'
  },
  {
    title: '修改地区',
    placeholder: '请输入地区'
  },
  {
    title: '修改年龄',
    placeholder: '请输入年龄'
  },
  {
    title: '修改出生年月',
    placeholder: '请输入出生年月'
  }
])

//处理修改事件
const handleReviseEvent = () => {
  console.log('修改成功')
}
</script>

<template>
  <div class="h-full px-4 bg-orange-100">
    <div class="flex flex-col rounded-lg p-4">
      <!-- 修改头像 -->
      <div class="flex items-center my-4">
        <p class="mr-12 text-lg font-thin">修改头像</p>
        <img
          :src="avatarUrl || '@/assets/student/avatar.png'"
          class="h-36 w-36 rounded-full border-2 border-gray-300 cursor-pointer"
          alt="用户头像"
          @click="triggerInput"
        />
        <input
          type="file"
          class="hidden"
          ref="fileInput"
          @change="handleFileChange"
        />
      </div>
      <!-- 其它 -->
      <div
        class="flex items-center mb-4"
        v-for="item in reviseList"
        :key="item.title"
      >
        <p class="mr-4 text-lg font-thin">{{ item.title }}</p>
        <input
          type="text"
          class="border-2 rounded-lg focus:outline-none px-4 py-2 flex-1"
          :placeholder="item.placeholder"
        />
      </div>
      <!-- 保存按钮 -->
      <MyButton
        type="primary"
        class="w-1/4 mx-auto py-2 mt-4"
        @click="handleReviseEvent"
      >
        保存
      </MyButton>
    </div>
  </div>
</template>

<style scoped></style>
