<script setup>
import { ref } from 'vue' //引入vue的计算属性
import { useRouter } from 'vue-router' //引入路由
import MyButton from '@/components/basic/MyButton.vue'
import { getForum } from '@/api/student.js'

const router = useRouter() //路由
const keyword1 = ref('') //关键词1
const keyword2 = ref('') //关键词2
const keyword3 = ref('') //关键词3

const words = ref([]) //关键词数组
const chatTurn = ref([]) //话轮数组

const getChatTurn = async (words) => {
  try {
    const response = await getForum(words) //获取话轮
    console.log('获取的响应:', response)
    chatTurn.value = response.data.ai_texts //将获取的结果赋值给话轮数组
  } catch (error) {
    console.error('获取话轮失败:', error)
  }
}

// const API_BASE_URL = 'http://192.168.0.217:5002'

// const getChatTurn = async () => {
//   try {
//     // 方法1：推荐使用JSON body（更规范）
//     const response = await fetch(`${API_BASE_URL}/process_words`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         words: words.value // 直接传递数组
//       })
//     })

//     // 方法2：如果必须用URL参数（需编码）
//     // const encodedWords = encodeURIComponent(words.value.join(','));
//     // const response = await fetch(
//     //   `${API_BASE_URL}/process_words?words=${encodedWords}`,
//     //   { method: 'POST' }
//     // );

//     if (!response.ok) {
//       const errorData = await response.json().catch(() => ({}))
//       throw new Error(errorData.message || `请求失败 (HTTP ${response.status})`)
//     }

//     const result = await response.json()

//     if (result.code === 200) {
//       console.log('获取的结果:', result.data)
//       return result.data // 返回数据以便后续使用
//     } else {
//       throw new Error(result.message || '服务器返回数据格式异常')
//     }
//   } catch (error) {
//     console.error('请求出错:', error)
//     // 实际项目中应更新UI错误状态（如使用Vue的errorMessage.value）
//     throw error // 重新抛出以便外部处理
//   }
// }

const handleChatTurnSubmit = () => {
  // 提交关键词
  if (keyword1.value && keyword2.value && keyword3.value) {
    words.value = [keyword1.value, keyword2.value, keyword3.value]
    console.log('提交的关键词:', words.value)
    // 调用获取话轮的函数
    getChatTurn(words.value)
    // 清空输入框
    keyword1.value = ''
    keyword2.value = ''
    keyword3.value = ''
  } else {
    alert('请输入完整的关键词')
  }
}
</script>

<template>
  <!-- 输入话轮 -->
  <div class="mb-4 bg-blue-50 p-6 rounded-lg">
    <!-- 标题和返回按钮 -->
    <div class="flex items-center mb-2">
      <img
        class="h-6 w-6 cursor-pointer"
        src="@/assets/student/back.png"
        @click="router.go(-1)"
        alt="返回图标"
      />
      <h1 class="font-semibold py-1 px-2 bg-blue-300 rounded-lg ml-2">
        历史话题
      </h1>
    </div>
    <!-- 输入话轮 -->
    <div class="flex items-center justify-between">
      <text class="font-semibold text-xl">请输入3个关键词</text>
      <!-- 输入框 -->
      <div class="flex items-center">
        <input
          type="text"
          class="p-2 mx-4 rounded-lg border-2 border-blue-300 outline-none"
          v-model="keyword1"
        />
        <input
          type="text"
          class="p-2 mx-4 rounded-lg border-2 border-blue-300 outline-none"
          v-model="keyword2"
        />
        <input
          type="text"
          class="p-2 mx-4 rounded-lg border-2 border-blue-300 outline-none"
          v-model="keyword3"
        />
      </div>
      <!-- 提交按钮 -->
      <MyButton
        type="primary"
        class="py-1 px-4 !bg-blue-300 mx-4"
        @click="handleChatTurnSubmit"
        >提交</MyButton
      >
    </div>
  </div>
  <!-- 生成话轮 -->
  <div class="bg-blue-50 p-4 rounded-lg mb-4">
    <div class="flex items-center mb-4">
      <h1 class="font-semibold py-1 px-2 bg-blue-300 rounded-lg">生成话轮</h1>
    </div>
    <!-- 话轮主体 -->
    <div class="flex flex-col items-start mb-2" v-for="index in 3" :key="index">
      <!-- 话轮标题 -->
      <h2 class="font-semibold text-lg py-1 px-2 rounded-lg mb-2">
        话轮{{ index }}
      </h2>
      <!-- 话轮内容 -->
      <textarea
        class="scrollBar w-full p-4 text-lg rounded-lg border-2 border-blue-300 outline-none mb-2"
        name=""
        id="1"
        rows="4"
        cols="50"
        placeholder="提交关键词才有话轮内容哦~"
        v-model="chatTurn[index - 1]"
      ></textarea>
      <!-- 选择按钮 -->
      <div class="flex items-center justify-end w-full">
        <MyButton type="primary" class="py-1 px-4 !bg-blue-300">选择</MyButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.scrollBar::-webkit-scrollbar {
  width: 6px; /* 滚动条的宽度 */
}
.scrollBar::-webkit-scrollbar-track {
  background: #f1f1f1; /* 滚动条轨道的背景颜色 */
  border-radius: 10px; /* 滚动条轨道的圆角 */
}

.scrollBar::-webkit-scrollbar-thumb {
  background: #888; /* 滚动条的背景颜色 */
  border-radius: 10px; /* 滚动条的圆角 */
}

.scrollBar::-webkit-scrollbar-thumb:hover {
  background: #6e6d6d; /* 滚动条悬停时的背景颜色 */
}
</style>
