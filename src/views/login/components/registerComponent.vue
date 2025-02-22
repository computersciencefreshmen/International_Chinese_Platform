<script setup>
import optionsCp from './optionsCp.vue' //引入自定义选项组件
import InputComponent from '@/components/basic/InputComponent.vue' //引入自定义输入框组件
import MyButton from '@/components/basic/MyButton.vue' //引入自定义按钮组件
import logoComponent from '@/components/service/logoComponent.vue' //引入自定义logo组件
import { ref } from 'vue'

const isRegisterActive = ref('我是学生') //是学生还是老师注册

//是否同意用户协议
const isAgreeList = ref(false)

const handleIsRegisterActive = (event) => {
  isRegisterActive.value = event.target.innerText || event.target.alt
}

const RegisterFormData = ref({
  email: '',
  code: '',
  password: '',
  rePassword: ''
})

// 输入框校验错误信息
const errors = ref({
  email: '',
  //验证码
  code: '',
  password: '',
  rePassword: ''
})

// 提交校验并注册信息
const verifyInput = () => {
  // 校验邮箱
  if (!RegisterFormData.value.email) {
    errors.value.email = '邮箱不能为空'
  } else if (emailType.value === '') {
    errors.value.email = '请选择邮箱域名'
  } else {
    errors.value.email = ''
  }

  // 校验验证码
  if (!RegisterFormData.value.code) {
    errors.value.code = '验证码不能为空'
  } else {
    errors.value.code = ''
  }

  // 校验密码
  if (!RegisterFormData.value.password) {
    errors.value.password = '密码不能为空'
  } else {
    errors.value.password = ''
  }

  // 校验确认密码
  if (!RegisterFormData.value.rePassword) {
    errors.value.rePassword = '确认密码不能为空'
  } else if (
    RegisterFormData.value.password !== RegisterFormData.value.rePassword
  ) {
    errors.value.rePassword = '两次密码输入不一致'
  } else {
    errors.value.rePassword = ''
  }

  // 如果没有错误,返回true
  if (
    !errors.value.email &&
    !errors.value.code &&
    !errors.value.password &&
    !errors.value.rePassword
  ) {
    return true
  }

  return false
}

const emailType = ref('') // 当前选择的邮箱类型

// 自定义邮箱类型
const emailOptions = [
  { value: '@qq.com', label: 'QQ 邮箱' },
  { value: '@163.com', label: '163 邮箱' },
  { value: '@126.com', label: '126 邮箱' },
  { value: '@Gmail.com', label: 'Gmail' },
  { value: '@Foxmail.com', label: 'Foxmail' },
  { value: '@Outlook.com', label: 'Outlook' },
  { value: '@iCloud.com', label: 'iCloud' }
]

// 注册事件处理
const handleRegister = () => {
  //校验输入框是否符合要求
  if (!verifyInput()) {
    return
  }
  //是否同意用户协议
  if (!isAgreeList.value) {
    alert('请同意用户协议')
    return
  }

  //如果是学生注册，则执行学生注册逻辑
  if (isRegisterActive.value === '我是学生') {
    //执行学生注册逻辑
    step.value.initial = false // 隐藏注册初始化页面
    step.value.stepStudent.stepOne = true // 显示学生注册第一步
  } else if (isRegisterActive.value === '我是老师') {
    //执行老师注册逻辑
    step.value.initial = false // 隐藏注册初始化页面
    step.value.stepTeacher.stepOne = true // 显示老师注册第一步
  } else {
    //提示用户选择注册身份
    alert('请选择注册身份')
  }
}

//给步骤添加状态
const step = ref({
  initial: true, //初始状态
  //学生注册步骤
  stepStudent: {
    stepOne: false,
    stepTwo: false,
    stepThree: false
  },
  //老师注册步骤
  stepTeacher: {
    stepOne: false,
    stepTwo: false
  }
})

// 收集学生个人信息
const studentInfo = ref({
  name: '',
  //国籍
  nationality: '',
  // 地区
  region: '',
  // 年龄
  age: ''
})

// 学生信息校验错误信息
const studentError = ref({
  name: '',
  //国籍
  nationality: '',
  // 地区
  region: '',
  // 年龄
  age: ''
})

// 检验学生信息
const verifyStudentInfo = () => {
  // 校验姓名
  if (!studentInfo.value.name) {
    studentError.value.name = '姓名不能为空'
    return false
  }

  // 校验国籍
  if (!studentInfo.value) {
    studentError.value.national = '国籍不能为空'
    return false
  }

  // 校验地区
  if (!studentInfo.value.region) {
    studentError.value.region = '地区不能为空'
    return false
  }

  // 校验年龄不能为空且只能为大于0的数字
  if (
    !studentInfo.value.age ||
    isNaN(studentInfo.value.age) ||
    studentInfo.value.age <= 0
  ) {
    studentError.value.age = '年龄不能为空且只能为大于0的数字'
    return false
  }

  return true
}

// 处理学生信息
const handleStudentInfo = () => {
  //校验学生信息
  if (!verifyStudentInfo()) {
    return
  }

  //执行学生信息逻辑
  step.value.stepStudent.stepOne = false // 隐藏学生注册第一步
  step.value.stepStudent.stepTwo = true // 显示学生注册第二步
}
</script>
<template>
  <div
    class="bg-primary rounded-2xl py-4 flex items-center justify-center w-2/3 overflow-hidden"
  >
    <transition name="slide" mode="out-in">
      <div
        v-if="step.initial"
        key="initial"
        class="w-2/3 flex flex-col items-center justify-center"
      >
        <div class="flex items-center mt-4">
          <optionsCp
            text="我是学生"
            @click="handleIsRegisterActive"
            :isActive="isRegisterActive === '我是学生'"
          >
            <img
              class="w-10 h-10"
              src="@/assets/icon/student.png"
              alt="我是学生"
            />
          </optionsCp>
          <optionsCp
            text="我是老师"
            @click="handleIsRegisterActive"
            :isActive="isRegisterActive === '我是老师'"
          >
            <img
              class="w-12 h-12"
              src="@/assets/icon/teacher.png"
              alt="我是老师"
            />
          </optionsCp>
        </div>
        <div class="w-11/12 rounded-md mt-4 flex flex-col items-center">
          <form @submit.prevent="handleLogin" class="w-full">
            <!-- 账号输入框 -->
            <InputComponent
              v-model="RegisterFormData.email"
              placeholder="请输入邮箱"
              id="email"
              label="邮箱"
              :error="errors.email"
              :showEmailTypeSelector="true"
              :emailOptions="emailOptions"
              @update:emailType="emailType = $event"
            />

            <!-- 验证码输入框 -->
            <InputComponent
              v-model="RegisterFormData.code"
              placeholder="请输入验证码"
              id="code"
              label="验证码"
              :showCountdown="true"
              @update:emailType="emailType = $event"
              :error="errors.code"
            />

            <!-- 密码输入框 -->
            <InputComponent
              type="password"
              placeholder="请输入密码"
              label="密码"
              v-model="RegisterFormData.password"
              :error="errors.password"
              id="password"
            />

            <!-- 确认密码 -->
            <InputComponent
              type="password"
              placeholder="请再次输入密码"
              label="确认密码"
              v-model="RegisterFormData.rePassword"
              :error="errors.rePassword"
              id="rePassword"
            />
          </form>
          <!-- 我已同意 -->
          <div class="flex items -center mt-2">
            <input type="checkbox" class="mr-2" v-model="isAgreeList" />
            <p class="text-sm">我已阅读并同意</p>
            <a href="#" class="text-blue-500 text-sm">《用户服务协议》</a>
            <p class="text-sm">和</p>
            <a href="#" class="text-blue-500 text-sm">《隐私协议》</a>
          </div>
          <MyButton
            type="primary"
            class="mt-4 w-36 py-2 text-black"
            @click="handleRegister"
            >注册</MyButton
          >
          <p class="text-sm font-thin mt-4">GCEP V1.0</p>
        </div>
      </div>
      <div
        v-else-if="isRegisterActive === '我是学生' && step.stepStudent.stepOne"
        key="step-student-one"
      >
        <logoComponent class="scale-75 -ml-28"></logoComponent>
        <p class="font-semibold text-xl">
          欢迎大宝贝<br />为了更好的进行中文学习，现在需要您完善个人信息
        </p>
        <div class="flex flex-col items-center justify-center pt-8">
          <InputComponent
            v-model="studentInfo.name"
            placeholder="请输入姓名"
            id="name"
            label="姓名"
            :error="studentError.name"
          />
          <InputComponent
            v-model="studentInfo.nationality"
            placeholder="请输入国籍"
            id="nationality"
            label="国籍"
            :error="studentError.national"
          />
          <InputComponent
            v-model="studentInfo.region"
            placeholder="请输入地区"
            id="region"
            label="地区"
            :error="studentError.region"
          />
          <InputComponent
            v-model="studentInfo.age"
            placeholder="请输入年龄"
            id="age"
            label="年龄"
            :error="studentError.age"
          />
          <MyButton
            type="primary"
            class="mt-2 w-36 py-2 text-black"
            @click="handleStudentInfo"
            >下一步</MyButton
          >
          <p class="text-sm font-thin mt-2">GCEP V1.0</p>
        </div>
      </div>
      <div
        v-else-if="isRegisterActive === '我是老师' && step.stepTeacher.stepOne"
        key="step-teacher-one"
      >
        2
      </div>
    </transition>
  </div>
</template>
<style scoped>
/* 定义滑出和滑入的过渡样式 */
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(-100%); /* 从右边滑出 */
}

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
