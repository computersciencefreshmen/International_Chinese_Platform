<script setup>
import { ref } from 'vue'
const historyRecords = ref([
  {
    date: '2025.2.11',
    topic: '舌尖上的中国',
    keywords: '美食、菜系、中国',
    selectedRound: '话轮2',
    content: '李明：安娜，我刚来中国，……'
  },
  {
    date: '2025.2.10',
    topic: '春节下的中国',
    keywords: '春节、鞭炮、年夜饭',
    selectedRound: '话轮1',
    content: 'A: 你知道春节有哪些传统习俗吗？……'
  },
  {
    date: '2025.2.09',
    topic: '故宫旅游',
    keywords: '北京、名胜古迹、旅游',
    selectedRound: '话轮2',
    content: 'A: 你去过北京吗……'
  },
  {
    date: '2025.2.01',
    topic: '出租车对话',
    keywords: '出租车、目的地、价格',
    selectedRound: '话轮1',
    content: 'balabalabala'
  },
  {
    date: '2025.1.23',
    topic: '巴士乘坐',
    keywords: '巴士、购票、路线',
    selectedRound: '话轮3',
    content: 'balabalabala'
  },
  {
    date: '2025.1.23',
    topic: '地铁乘坐',
    keywords: '地铁、购票、路线',
    selectedRound: '话轮2',
    content: 'balabalabala'
  },
  {
    date: '2025.1.18',
    topic: '酒店入住',
    keywords: '入住、酒店、旅游',
    selectedRound: '话轮1',
    content: 'balabalabala'
  },
  {
    date: '2025.1.08',
    topic: '购物对话',
    keywords: '购物、商场、买单',
    selectedRound: '话轮1',
    content: 'balabalabala'
  }
])

//定义历史记录标题
const historyTitle = ref(['时间', '话题', '关键词', '选择话轮', '话轮内容'])
</script>
<template>
  <div class="bg-blue-50 p-4 rounded-lg">
    <!-- 标题 -->
    <div class="flex items-center mb-4">
      <h1 class="font-semibold py-1 px-2 bg-yellow-300 rounded-lg">历史记录</h1>
    </div>
    <!-- 网格布局列表 -->
    <!-- 表格标题 -->
    <div class="grid grid-cols-5 font-semibold text-center gap-4">
      <span v-for="title in historyTitle" :key="title">{{ title }}</span>
    </div>
    <!-- 表格内容 -->
    <div
      v-for="(record, index) in historyRecords"
      :key="index"
      class="grid grid-cols-5 text-center cursor-pointer hover:bg-blue-200 my-2 rounded-lg transition-all duration-300 ease-in-out py-2"
    >
      <span>{{ record.date }}</span>
      <span>{{ record.topic }}</span>
      <span>{{ record.keywords }}</span>
      <span>{{ record.selectedRound }}</span>
      <span class="text-ellipsis">{{ record.content }}</span>
    </div>
  </div>
</template>

<style scoped>
/* 单行隐藏 */
.text-ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 100%; /* 或者设置一个固定宽度 */
}
</style>
