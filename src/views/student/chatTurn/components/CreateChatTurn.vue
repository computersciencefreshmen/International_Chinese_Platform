<script setup>
import { useRouter } from 'vue-router' //引入路由
import MyButton from '@/components/basic/MyButton.vue'

const router = useRouter() //路由
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
        />
        <input
          type="text"
          class="p-2 mx-4 rounded-lg border-2 border-blue-300 outline-none"
        />
        <input
          type="text"
          class="p-2 mx-4 rounded-lg border-2 border-blue-300 outline-none"
        />
      </div>
      <!-- 提交按钮 -->
      <MyButton type="primary" class="py-1 px-4 !bg-blue-300 mx-4"
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
      <h2 class="font-semibold text-lg py-1 px-2 rounded-lg mb-2">话轮一</h2>
      <!-- 话轮内容 -->
      <textarea
        class="scrollBar w-full p-4 text-lg rounded-lg border-2 border-blue-300 outline-none mb-2"
        name=""
        id="1"
        rows="4"
        cols="50"
        placeholder="提交关键词才有话轮内容哦~"
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
