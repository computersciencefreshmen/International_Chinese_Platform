<script setup>
import { ref } from 'vue'
import MyButton from '@/components/basic/MyButton.vue'
import InputComponent from '@/components/basic/InputComponent.vue'

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
  if (file.size > 10 * 1024 * 1024) {
    // 限制文件大小不超过10MB
    alert('文件大小不能超过10MB！')
    return
  }
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
    placeholder: '请输入昵称',
    value: 'nickname'
  },
  {
    title: '修改国籍',
    placeholder: '请输入国籍',
    value: 'nationality'
  },
  {
    title: '修改地区',
    placeholder: '请输入地区',
    value: 'region'
  },
  {
    title: '修改年龄',
    placeholder: '请输入年龄',
    value: 'age'
  },
  {
    title: '修改出生年月',
    placeholder: '请输入出生年月',
    value: 'birthDate'
  }
])

//定义修改参数
const reviseParams = ref({
  nickname: '',
  nationality: '',
  region: '',
  age: '',
  birthDate: ''
})

//处理修改事件
const handleReviseEvent = () => {
  console.log('修改成功')
}
</script>

<template>
  <div class="h-full px-4 bg-blue-50">
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
      <!-- 其它修改 -->
      <div v-for="item in reviseList" :key="item.title">
        <InputComponent
          :id="item.title"
          roundedLg
          :placeholder="item.placeholder"
          :innerLabel="false"
          v-model="reviseParams[item.value]"
          :label="item.title"
        ></InputComponent>
      </div>
      <!-- 保存按钮 -->
      <MyButton
        type="primary"
        class="w-1/4 mx-auto py-2"
        @click="handleReviseEvent"
      >
        保存
      </MyButton>
    </div>
  </div>
</template>

<style scoped></style>
