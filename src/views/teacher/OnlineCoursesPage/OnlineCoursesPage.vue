<script setup>
import { Search } from '@element-plus/icons-vue'
import { ref } from 'vue'

// 记录当前tabs
const currentTabs = ref(0)
const ChangeTabs = (tabs) => {
  currentTabs.value = tabs
  console.log(2)
}

// 搜索框输入内容
const SearchInput = ref('')

// 总页数
const total = ref(1000)
// 当前页
const currentPage = ref(1)
// 每页条数
const pageSize = ref(10)
// 分页器相关函数
const handleSizeChange = (e) => {
  console.log(e)
}
const handleCurrentChange = (e) => {
  console.log(e)
}
</script>

<template>
  <div
    class="OnlineCoursesPageContainer mt-36 mx-auto px-5 py-8 bg-primary rounded-t-3xl"
  >
    <!-- 头部区域 -->
    <div class="OnlineCoursesHeader mb-5 flex items-center justify-between">
      <!-- 左侧 -->
      <div class="flex items-center">
        <!-- tab栏 -->
        <div class="TabsContainer mr-8 flex items-center">
          <div
            class="mr-5 px-5 py-3 rounded-2xl text-3xl font-bold"
            :class="{ 'bg-sky-200': currentTabs === 0 }"
            @click="ChangeTabs(0)"
          >
            口语
          </div>
          <div
            class="px-5 py-3 rounded-2xl text-3xl font-bold"
            :class="{ 'bg-sky-200': currentTabs === 1 }"
            @click="ChangeTabs(1)"
          >
            语法
          </div>
        </div>
        <!-- 搜索框 -->
        <div class="SearchContainer">
          <el-input
            v-model="SearchInput"
            style="width: 360px"
            size="large"
            placeholder="输入您想查询的内容"
            :suffix-icon="Search"
          />
        </div>
      </div>
      <!-- 右侧 -->
      <div>
        <!-- 上传课程 -->
        <div class="UploadLessonContainer flex items-center">
          <!-- 文字 -->
          <div class="Text mr-5 text-xl font-thin">上传课程</div>
          <!-- 上传图标 -->
          <div
            class="UploadIcon bg-sky-200 rounded-full p-3 duration-500 hover:ring-2 ring-blue-500/50 cursor-pointer"
          >
            <img class="w-8 h-8" src="/src/assets/icon/add.svg" alt="" />
          </div>
        </div>
      </div>
    </div>
    <!-- 主题内容 -->
    <div class="OnlineCoursesContent">
      <div class="CoursesListContainer mb-12 grid grid-cols-5 gap-8">
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/戏曲文化.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/旅游.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/时态.jpg"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/春节.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/看病课程.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/紧急情况.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/紧急情况.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/老师2.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/语法.jpeg"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/戏曲文化.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/戏曲文化.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
        <div class="flex flex-col h-96 bg-white rounded-2xl overflow-hidden">
          <!-- 课程图片 -->
          <div class="LessonImg h-56 w-full">
            <img
              class="h-full w-full"
              src="/src/assets/student/onlineCourses/戏曲文化.png"
              alt=""
            />
          </div>
          <!-- 课程介绍 -->
          <div class="LessonIntro px-3 py-2 w-full">
            <div class="text-xl font-bold mb-2">购物对话学习</div>
            <div>
              当你来到一个商场，想尽情购物的时候，应该怎么和售货员沟通呢？
            </div>
          </div>
          <!-- 进入学习 -->
          <div
            class="EnterLesson flex-1 bg-sky-200 flex items-center justify-center text-xl font-bold"
          >
            进入学习
          </div>
        </div>
      </div>
      <!-- 分页器 -->
      <div class="PaginationContainer flex justify-center">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          background
          layout="prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.OnlineCoursesPageContainer {
  max-width: 2000px;
  // height: 100vh;
}
</style>
