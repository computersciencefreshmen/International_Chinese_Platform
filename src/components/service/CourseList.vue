<script setup>
import MyButton from '@/components/basic/MyButton.vue'
import { ref, nextTick, onMounted } from 'vue'

//接收传过来的数据列表
const props = defineProps({
  courseList: {
    type: Array,
    require: true // 必传
  }
})

//定义传给父组件的事件
const emit = defineEmits(['enterClass', 'preview', 'finishWork'])

//未上课列表是否展开
const showMore = ref(false) // 控制展开和收起状态
const contentRef = ref(null) // 获取内容容器的引用
const contentHeight = ref(0) // 动态计算的内容高度

const toggleShowMore = () => {
  showMore.value = !showMore.value // 切换展开和收起状态
  if (showMore.value) {
    nextTick(() => {
      contentHeight.value = contentRef.value.scrollHeight // 动态获取内容的实际高度
    })
  }
}

onMounted(() => {
  nextTick(() => {
    contentHeight.value = contentRef.value.scrollHeight // 初始化内容高度
  })
})
</script>

<template>
  <!-- 未上课列表 -->
  <div class="bg-white p-4 rounded-lg mt-4">
    <!-- 首行标题和下拉按钮 -->
    <div class="flex justify-between items-center mb-2">
      <p class="text-lg font-bold"><slot></slot></p>
      <!-- 展开/收起按钮 -->
      <button
        v-if="props.courseList.length > 1"
        @click="toggleShowMore"
        class="text-gray-400 text-sm cursor-pointer"
      >
        {{ showMore ? '收起' : '展开更多' }}
      </button>
    </div>
    <!-- 列表 -->
    <div
      v-if="props.courseList.length"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-center p-2 rounded-lg border-2 border-blue-100 cursor-pointer hover:border-blue-300 transition-all duration-300 ease-in-out"
    >
      <!-- 话题 -->
      <p class="font-semibold">{{ props.courseList[0].title }}</p>
      <!-- 课程时间 -->
      <p>{{ props.courseList[0].time }}</p>
      <!-- 课程老师 -->
      <p>{{ props.courseList[0].teacher }}</p>
      <div class="flex-1 grid grid-cols-3 gap-4">
        <MyButton
          type="primary"
          @click="emit('enterClass', props.courseList[0].id)"
          >进入课堂</MyButton
        >
        <MyButton
          type="primary"
          @click="emit('preview', props.courseList[0].id)"
          >预习</MyButton
        >
        <MyButton
          type="primary"
          @click="emit('finishWork', props.courseList[0].id)"
          >完成作业</MyButton
        >
      </div>
    </div>
    <div class="text-gray-500" v-else>暂无课程哦，赶紧去学习课程吧！</div>

    <!-- 其余项 -->
    <div
      ref="contentRef"
      class="overflow-hidden transition-all duration-300 ease-in-out"
      :style="{
        maxHeight: showMore ? contentHeight + 'px' : '0px'
      }"
    >
      <div
        v-for="item in props.courseList.slice(1)"
        :key="item.id"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-center p-2 rounded-lg border-2 border-blue-100 cursor-pointer hover:border-blue-300 transition-all duration-300 ease-in-out my-2"
      >
        <!-- 话题 -->
        <p class="font-semibold">{{ item.title }}</p>
        <!-- 课程时间 -->
        <p>{{ item.time }}</p>
        <!-- 课程老师 -->
        <p>{{ item.teacher }}</p>
        <div class="flex-1 grid grid-cols-3 gap-4">
          <MyButton type="primary" @click="emit('enterClass', item.id)"
            >进入课堂</MyButton
          >
          <MyButton type="primary" @click="emit('preview', item.id)"
            >预习</MyButton
          >
          <MyButton type="primary" @click="emit('finishWork', item.id)"
            >完成作业</MyButton
          >
        </div>
      </div>
    </div>
  </div>
</template>
