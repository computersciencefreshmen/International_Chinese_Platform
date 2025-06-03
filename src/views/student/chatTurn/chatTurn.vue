<script setup>
import CreateChatTurn from './components/CreateChatTurn.vue'
import ChatTurnRecord from './components/ChatTurnRecord.vue'
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="rounded-lg px-4 flex flex-col">
      <!-- 生成新话轮 -->
      <CreateChatTurn />
      <!-- 历史话轮记录 -->
      <ChatTurnRecord />
    </div>
  </div>
</template>

<style scoped></style>
