<script setup>
import { ref } from 'vue'
import MyButton from '@/components/basic/MyButton.vue'
import InputComponent from '@/components/basic/InputComponent.vue'

// 定义文件上传对象
const fileInput = ref(null)
const avatarError = ref(false)

// 点击头像触发input的点击事件
const triggerInput = () => {
  fileInput.value.click()
}

const avatarUrl = ref('@/assets/student/avatar.png') // 默认头像路径

// 处理文件上传
const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(file.type)) {
    alert('请上传有效的图片文件 (JPEG, PNG, GIF, WebP)')
    return
  }
  
  // 检查文件大小 (最大5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过5MB！')
    return
  }
  
  // 创建图片预览
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      // 创建canvas来压缩图片
      const canvas = document.createElement('canvas')
      const maxSize = 300 // 最大尺寸
      let width = img.width
      let height = img.height
      
      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height
          height = maxSize
        }
      }
      
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      
      // 转换为base64
      avatarUrl.value = canvas.toDataURL('image/jpeg', 0.8)
      avatarError.value = false
    }
    img.onerror = () => {
      avatarError.value = true
      alert('图片加载失败，请重试')
    }
    img.src = e.target.result
  }
  reader.onerror = () => {
    avatarError.value = true
    alert('文件读取失败，请重试')
  }
  reader.readAsDataURL(file)
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
      <div class="flex flex-col sm:flex-row items-center my-6 gap-4">
        <p class="text-lg font-medium text-gray-700 w-24 flex-shrink-0">修改头像</p>
        <div class="relative group">
          <div class="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md">
            <img 
              :src="avatarUrl || '/avatar.png'" 
              alt="User Avatar"
              class="w-full h-full object-cover"
              @error="avatarError = true"
            >
            <div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-full cursor-pointer"
                 @click="triggerInput"
                 title="点击更换头像">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
          </div>
          <input
            type="file"
            class="hidden"
            ref="fileInput"
            accept="image/*"
            @change="handleFileChange"
          />
          <p class="text-xs text-gray-500 mt-2 text-center">支持 JPG, PNG, GIF, WebP 格式，小于5MB</p>
        </div>
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

<style scoped>
/* 添加平滑过渡效果 */
.avatar-upload {
  transition: all 0.3s ease;
}

.avatar-upload:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

/* 响应式调整 */
@media (max-width: 640px) {
  .avatar-container {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .avatar-upload {
    margin-top: 0.5rem;
  }
}
</style>
