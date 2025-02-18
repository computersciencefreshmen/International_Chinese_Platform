<script setup>
import { ref } from 'vue'

const searchKeyword = ref('')
// const hotSearch = ref(['苹果', '华为', '小米'])
const historySearch = ref([])
const showHistory = ref(false) // 控制历史搜索的显示

const onSearch = () => {
  if (searchKeyword.value.trim() !== '') {
    historySearch.value.push(searchKeyword.value)
    console.log('搜索关键词：', searchKeyword.value)
    searchKeyword.value = '' // 清空输入框
  }
}

const onInput = () => {
  // 输入时可以做一些实时搜索的逻辑
}

const selectKeyword = (keyword) => {
  searchKeyword.value = keyword
  onSearch()
}
</script>

<template>
  <div class="search-container relative">
    <!-- 搜索框 -->
    <div class="flex items-center">
      <input
        type="text"
        v-model="searchKeyword"
        placeholder="输入你想查询的内容"
        class="w-full py-2 px-4 shadow-sm border-gray-300 rounded-full focus:outline-none focus:shadow-outline"
        @input="onInput"
        @keyup.enter="onSearch"
        @focus="showHistory = true"
        @blur="showHistory = false"
      />
      <button
        class="absolute right-0 top-0 mt-1 mr-2 hover:bg-blue-100 rounded-full transition-all duration-800 ease-in-out"
        @click="onSearch"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-6 h-6 text-gray-600 m-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    </div>

    <!-- 历史搜索 -->
    <Transition name="fade">
      <div
        v-if="showHistory && historySearch.length > 0"
        class="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-2"
      >
        <h4 class="px-4 py-2 text-sm font-bold">历史搜索</h4>
        <ul class="px-4 py-2">
          <li
            v-for="item in historySearch"
            :key="item"
            class="mb-2 cursor-pointer hover:text-blue-500"
            @click="selectKeyword(item)"
          >
            {{ item }}
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 添加动画 */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.5s,
    transform 0.5s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
