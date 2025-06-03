<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

// 查看当前的路由
const route = useRoute()
onMounted(() => {
  console.log(route)
})
</script>

<template>
  <div class="HomeContainer">
    <!-- 头部区域 -->
    <div
      class="FirstContainer pt-36 pb-8 px-24 rounded-3xl flex items-center justify-between bg-primary"
    >
      <!-- 左侧 -->
      <div class="LeftFirstContainer mr-12 flex items-center">
        <!-- 头像框 -->
        <div class="AvatarContainer mr-5 xl:mr-8 2xl:mr-12">
          <img
            class="h-24 w-24 xl:h-28 xl:w-28 2xl:w-32 2xl:h-32 rounded-full"
            src="/src/assets/student/avatar.png"
            alt=""
          />
        </div>
        <!-- 教师名称职称 -->
        <div class="TeacherInfoContainer flex flex-col items-center">
          <div class="Name mb-3 text-2xl xl:text-3xl 2xl:text-5xl font-bold">
            <span>Sandy</span>
          </div>
          <div class="JobTitle py-3 px-12 text-2xl bg-yellow-300 rounded-3xl">
            <span>教师</span>
          </div>
        </div>
      </div>
      <!-- 右侧 -->
      <div class="RightFirstContainer flex-1 grid grid-cols-5 gap-x-8">
        <div class="bg-white rounded-2xl h-36"></div>
        <div class="bg-white rounded-2xl h-36"></div>
        <div class="bg-white rounded-2xl h-36"></div>
        <div class="bg-white rounded-2xl h-36"></div>
        <div class="bg-white rounded-2xl h-36"></div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.HomeContainer {
  margin: 0 auto;
  max-width: 2000px;
}
</style>
