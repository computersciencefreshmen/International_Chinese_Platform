<script setup>
import { ref } from 'vue' //引入vue的计算属性
import MyButton from '@/components/basic/MyButton.vue' //引入自定义按钮组件
import MySearchBox from '@/components/basic/MySearchBox.vue' //引入自定义搜索框组件
import optionsCp from './components/optionsCp.vue' //引入自定义选项组件
import InputComponent from '@/components/basic/InputComponent.vue' //引入自定义输入框组件
import registerComponent from './components/registerComponent.vue' //引入自定义注册组件
import logoComponent from '@/components/service/logoComponent.vue' //引入自定义logo组件
import LanguageToggle from '@/components/service/LanguageToggle.vue' //引入自定义语言切换组件

//是否登录
const isLogin = ref(true)

//处理登录还是注册的点击事件
const handleClick = (event) => {
  //判断点击的是登录还是注册
  if (event.target.innerText === '登录') {
    //点击的是登录
    isLogin.value = true
  } else {
    //点击的是注册
    isLogin.value = false
  }
}

//高亮身份
const isActive = ref(null)

//处理选择身份的点击事件
const handleIsActive = (event) => {
  isActive.value = event.target.innerText || event.target.alt
}

// 收集登录输入框信息
const formData = ref({
  email: '',
  password: ''
})

const errors = ref({
  email: '',
  password: ''
})

const handleLogin = () => {
  // 清空之前的错误信息
  errors.value.email = ''
  errors.value.password = ''

  // 校验逻辑
  if (!formData.value.email) {
    errors.value.email = '邮箱不能为空'
  }

  if (!formData.value.password) {
    errors.value.password = '密码不能为空'
  }

  // 如果没有错误，执行登录逻辑
  if (!errors.value.username && !errors.value.password) {
    console.log('登录成功', formData.value)
    // 这里可以发送请求到后端
  }
}
</script>

<template>
  <div class="flex flex-col min-h-screen bg-image">
    <!-- 头部导航栏填写 -->
    <header
      class="flex flex-row justify-between bg-primary bg-primary1 px-4 py-2"
    >
      <logoComponent></logoComponent>
      <div class="flex flex-row items-center md:basis-6/12">
        <div>
          <LanguageToggle />
        </div>
        <!-- 搜索框 -->
        <div class="mx-4 hidden md:block basis-2/3">
          <MySearchBox />
        </div>
        <!-- 登录按钮 -->
        <MyButton
          type="primary"
          class="text-black"
          size="large"
          @click="handleClick"
          >登录</MyButton
        >
        <!-- 注册按钮 -->
        <MyButton type="danger" size="large" @click="handleClick"
          >注册</MyButton
        >
      </div>
    </header>
    <!-- 主体内容填写 -->
    <main class="flex-1 flex justify-center items-center overflow-hidden">
      <!-- 登录主体内容填写 -->
      <transition name="slide" mode="out-in">
        <div v-if="isLogin" class="px-6 bg-primary rounded-2xl min-w-min py-4">
          <div class="ml-6 mb-2 mt-6">
            <p class="tracking-wide text-black text-3xl font-semibold">
              欢迎登陆
            </p>
            <p class="tracking-wide text-black text-3xl font-semibold mt-2">
              国际中文教育平台
            </p>
          </div>
          <div class="flex flex-col items-center justify-center">
            <div class="flex items-center mt-4 w-full">
              <optionsCp
                text="我是学生"
                :isActive="isActive === '我是学生'"
                @click="handleIsActive"
              >
                <img
                  class="w-10 h-10"
                  src="@/assets/icon/student.png"
                  alt="我是学生"
                />
              </optionsCp>
              <optionsCp
                text="我是老师"
                @click="handleIsActive"
                :isActive="isActive === '我是老师'"
              >
                <img
                  class="w-12 h-12"
                  src="@/assets/icon/teacher.png"
                  alt="我是老师"
                />
              </optionsCp>
              <optionsCp
                text="我是管理员"
                @click="handleIsActive"
                :isActive="isActive === '我是管理员'"
              >
                <img
                  class="w-10 h-10"
                  src="@/assets/icon/admin.png"
                  alt="我是管理员"
                />
              </optionsCp>
            </div>
            <div class="w-11/12 rounded-md mt-4 flex flex-col items-center">
              <form @submit.prevent="handleLogin" class="w-full">
                <!-- 账号输入框 -->
                <InputComponent
                  v-model="formData.email"
                  placeholder="请输入邮箱"
                  id="email"
                  label="邮箱"
                  :error="errors.email"
                />

                <!-- 密码输入框 -->
                <InputComponent
                  type="password"
                  placeholder="请输入密码"
                  label="密码"
                  v-model="formData.password"
                  :error="errors.password"
                  id="password"
                />
              </form>
              <!-- 忘记密码 -->
              <a href="#" class="text-black text-sm">忘记密码？</a>
              <!-- 我已同意 -->
              <div class="flex items-center mt-2">
                <input type="checkbox" class="mr-2" />
                <p class="text-sm">我已阅读并同意</p>
                <a href="#" class="text-blue-500 text-sm">《用户服务协议》</a>
                <p class="text-sm">和</p>
                <a href="#" class="text-blue-500 text-sm">《隐私协议》</a>
              </div>
              <MyButton
                type="primary"
                class="mt-4 w-36 py-2 text-black"
                @click="handleLogin"
                >登录</MyButton
              >
              <!-- 没有账号，点击注册 -->
              <a
                href="#"
                @click="isLogin = false"
                class="text-black text-sm mt-4 underline"
                >没有账号？点击注册</a
              >
              <p class="text-sm font-thin mt-4">GCEP V1.0</p>
            </div>
          </div>
        </div>
        <!-- 注册主体填写 -->
        <registerComponent v-else></registerComponent>
      </transition>
    </main>
  </div>
</template>

<style scoped>
.bg-image {
  background-image: url('@/assets/icon/back.png');
  background-size: cover;
  background-position: center;
}

.bg-primary1 {
  background-color: rgba(223, 242, 255, 0.5); /* 半透明背景 */
  backdrop-filter: blur(10px); /* 毛玻璃效果 */
}

/* 定义滑出和滑入的过渡样式 */
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(100%); /* 从右边滑出 */
}

.slide-enter-to {
  opacity: 1;
}

.slide-leave-from {
  opacity: 1;
  transform: translateX(0%); /* 初始状态，不需要移动 */
}
</style>
