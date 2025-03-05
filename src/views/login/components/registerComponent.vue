<script setup>
import optionsCp from './optionsCp.vue' //引入自定义选项组件
import InputComponent from '@/components/basic/InputComponent.vue' //引入自定义输入框组件
import MyButton from '@/components/basic/MyButton.vue' //引入自定义按钮组件
import logoComponent from '@/components/service/logoComponent.vue' //引入自定义logo组件
import { ref } from 'vue'
import { useRouter } from 'vue-router' //引入路由

const router = useRouter() //路由

const isRegisterActive = ref(null) //是学生还是老师注册

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

  //
  if (!isRegisterActive.value) {
    //提示用户选择注册身份
    alert('请选择注册身份')
    return
  }

  //执行注册逻辑

  //获取个人信息
  step.value.initial = false //隐藏注册的初始化界面
  step.value.memberInfo = true //显示个人信息获取界面
}

//给步骤添加状态
const step = ref({
  initial: true, //初始状态
  // 共同步骤，个人信息获取
  memberInfo: false,
  //学生注册步骤
  stepStudent: false,
  //老师注册步骤
  stepTeacher: false,
  // 共同步骤，进入平台
  enterPlatform: false
})

// 收集个人信息
const getMemberInfo = ref({
  name: '',
  //国籍
  nationality: '',
  // 地区
  region: '',
  // 年龄
  age: ''
})

// 个人信息校验错误信息
const MemberError = ref({
  name: '',
  //国籍
  nationality: '',
  // 地区
  region: '',
  // 年龄
  age: ''
})

// 检验学生信息
const verifyMemberInfo = () => {
  // 校验姓名
  if (!getMemberInfo.value.name) {
    MemberError.value.name = '姓名不能为空'
    return false
  }

  // 校验国籍
  if (!getMemberInfo.value.nationality) {
    MemberError.value.national = '国籍不能为空'
    return false
  }

  // 校验地区
  if (!getMemberInfo.value.region) {
    MemberError.value.region = '地区不能为空'
    return false
  }

  // 校验年龄不能为空且只能为大于0的数字
  if (
    !getMemberInfo.value.age ||
    isNaN(getMemberInfo.value.age) ||
    getMemberInfo.value.age <= 0
  ) {
    MemberError.value.age = '年龄不能为空且只能为大于0的数字'
    return false
  }

  return true
}

// 处理学生信息
const handleMemberInfo = () => {
  //校验学生信息
  if (!verifyMemberInfo()) {
    return
  }

  step.value.memberInfo = false // 隐藏个人信息获取界面

  //执行学生信息逻辑
  if (isRegisterActive.value === '我是学生') {
    step.value.stepStudent = true // 显示学生注册
  } else if (isRegisterActive.value === '我是老师') {
    step.value.stepTeacher = true // 显示老师注册
  }
}

//学生汉语水平高亮序号
const isActiveStudentLevel = ref(null)

//学生汉语水平列表
const studentChineseLevel = ref([
  {
    id: 1,
    level: 'HSK1',
    description: '掌握150个汉字'
  },
  {
    id: 2,
    level: 'HSK2',
    description: '掌握300个汉字'
  },
  {
    id: 3,
    level: 'HSK3',
    description: '掌握600个汉字'
  },
  {
    id: 4,
    level: 'HSK4',
    description: '掌握1200个汉字'
  },
  {
    id: 5,
    level: 'HSK5',
    description: '掌握2500个汉字'
  },
  {
    id: 6,
    level: 'HSK6',
    description: '掌握5000个汉字'
  }
])

//处理学生汉语水平
const handleStudentChineseLevel = () => {
  //校验学生汉语水平
  if (isActiveStudentLevel.value === null) {
    alert('请选择你现在的汉语水平')
    return
  }

  //执行学生汉语水平逻辑
  step.value.stepStudent = false // 隐藏学生注册
  step.value.enterPlatform = true // 显示进入平台
}

//教师证书列表
const teacherCertificate = ref([
  {
    id: 1,
    name: '国际中文教师证书',
    // 是否有等级
    isAgree: false
  },
  {
    id: 2,
    name: '对外汉语教师资格证',
    isAgree: true,
    isShowAgree: false,
    //等级
    levels: ['初级', '中级', '高级'],
    isSelectedAgree: false
  },
  {
    id: 3,
    name: '汉语作为外语教学能力证书',
    isAgree: true,
    isShowAgree: false,
    //等级
    levels: ['初级', '中级', '高级'],
    isSelectedAgree: false
  },
  {
    id: 4,
    name: '普通话水平测试证书',
    isAgree: true,
    isShowAgree: false,
    //等级
    levels: ['一级甲等', '一级乙等', '二级甲等', '二级乙等'],

    //等级高亮
    isActiveAgree: null,

    //是否确认选中等级
    isSelectedAgree: false
  }
])

//处理教师注册时的证书
const handleTeacherCertificate = () => {
  //校验教师注册时的证书
  // for (let item of teacherCertificate.value) {
  //   if (item.isAgree) {
  //     if (item.isActiveAgree === null) {
  //       alert('请选择你拥有的汉语教学资格证书')
  //       return
  //     }
  //   }
  // }

  //执行教师注册时的证书逻辑
  step.value.stepTeacher = false // 隐藏教师注册
  step.value.enterPlatform = true // 显示进入平台
}

// 进入平台
const handleMemberEnter = () => {
  //执行进入平台逻辑
  if (isRegisterActive.value === '我是学生') {
    //执行学生注册逻辑
    // 跳转到学生页面
    router.push('/student')
  } else if (isRegisterActive.value === '我是老师') {
    //执行老师注册逻辑
    // 跳转到老师页面
    router.push('/teacher')
  }
}
</script>
<template>
  <div
    class="shadow-lg bg-primary rounded-2xl py-2 flex items-center justify-center w-2/3 overflow-hidden transition-all ease-in-out duration-500"
  >
    <transition name="slide" mode="out-in">
      <!-- 注册的初始化界面。-->
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
      <!-- 个人信息填写界面  -->
      <div v-else-if="step.memberInfo" key="memberInfo">
        <logoComponent class="scale-75 -ml-28"></logoComponent>
        <p class="font-semibold text-xl">
          欢迎大宝贝<br />为了更好的进行中文学习，现在需要您完善个人信息
        </p>
        <div class="flex flex-col items-center justify-center pt-8">
          <InputComponent
            v-model="getMemberInfo.name"
            placeholder="请输入姓名"
            id="name"
            label="姓名"
            :error="MemberError.name"
          />
          <InputComponent
            v-model="getMemberInfo.nationality"
            placeholder="请输入国籍"
            id="nationality"
            label="国籍"
            :error="MemberError.national"
          />
          <InputComponent
            v-model="getMemberInfo.region"
            placeholder="请输入地区"
            id="region"
            label="地区"
            :error="MemberError.region"
          />
          <InputComponent
            v-model="getMemberInfo.age"
            placeholder="请输入年龄"
            id="age"
            label="年龄"
            :error="MemberError.age"
          />
          <MyButton
            type="primary"
            class="mt-2 w-36 py-2 text-black"
            @click="handleMemberInfo"
            >下一步</MyButton
          >
          <p class="text-sm font-thin mt-2">GCEP V1.0</p>
        </div>
      </div>
      <!-- 学生注册页面 -->
      <div
        v-else-if="isRegisterActive === '我是学生' && step.stepStudent"
        key="step-student"
      >
        <logoComponent class="scale-75 -ml-28"></logoComponent>
        <p class="font-semibold text-xl mb-4">请选择你现在的汉语水平</p>
        <div class="grid grid-cols-3 gap-6">
          <div
            class="flex flex-col justify-center items-center rounded-lg bg-white hover:bg-red-400 p-4 cursor-pointer"
            v-for="(item, index) in studentChineseLevel"
            :key="item.id"
            @click="isActiveStudentLevel = index"
            :class="{
              'bg-red-400': isActiveStudentLevel === index
            }"
          >
            <img
              class="w-16"
              src="@/assets/icon/agree.png"
              alt="汉语等级图标"
            />
            <p class="text-blue-500 text-sm">
              {{ item.description }}
            </p>
            <p class="font-semibold">{{ item.level }}</p>
          </div>
        </div>
        <div class="flex flex-col items-center justify-center mt-4">
          <span
            @click="isActiveStudentLevel = 6"
            class="rounded-full bg-blue-100 hover:bg-blue-300 cursor-pointer py-2 px-4"
            :class="{ '!bg-blue-300': isActiveStudentLevel === 6 }"
          >
            我是初学者，对汉语基本没有了解
          </span>
          <MyButton
            type="primary"
            class="mt-2 w-36 py-2 text-black"
            @click="handleStudentChineseLevel"
            >下一步</MyButton
          >
          <p class="text-sm font-thin mt-2">GCEP V1.0</p>
        </div>
      </div>
      <!-- 老师注册页面 -->
      <div
        v-else-if="isRegisterActive === '我是老师' && step.stepTeacher"
        key="step-teacher"
        class="py-4 px-6"
      >
        <logoComponent class="scale-75 -ml-28"></logoComponent>
        <p class="font-semibold text-xl mb-4">请选择你拥有的汉语教学资格证书</p>
        <div class="grid grid-cols-4 gap-8">
          <div
            class="flex flex-col items-center justify-center cursor-pointer overflow-hidden"
            v-for="item in teacherCertificate"
            :key="item.id"
          >
            <div
              class="rounded-lg relative flex flex-col items-center justify-center bg-white p-4"
              @mouseenter="
                () => {
                  if (item.isAgree) {
                    item.isShowAgree = true
                  }
                }
              "
            >
              <img src="@/assets/icon/证书.png" alt="老师证书图片" />
              <p class="my-2 text-sm">
                {{ item.name }}
              </p>
              <div
                v-if="item.isShowAgree"
                class="flex flex-col items-center justify-center bg-blue-500 opacity-75 rounded-lg p-4 absolute inset-0 m-4"
              >
                <div
                  v-for="(level, index) in item.levels"
                  :key="index"
                  class="bg-gray-800 text-white px-4 rounded-full my-2 transition-colors duration-200 ease-linear cursor-pointer"
                  :class="{ 'bg-red-500': item.isActiveAgree === index }"
                  @click="
                    item.isActiveAgree === index
                      ? (item.isActiveAgree = null)
                      : (item.isActiveAgree = index)
                  "
                >
                  {{ level }}
                </div>
              </div>
            </div>
            <label
              class="mt-4 w-full text-center inline-block bg-white text-black px-4 py-2 rounded-lg hover:bg-blue-300 transition-colors duration-200 ease-linear cursor-pointer"
            >
              上传证明材料
              <input type="file" class="hidden" />
            </label>
          </div>
        </div>
        <div class="flex flex-col items-center justify-center mt-4">
          <MyButton
            type="primary"
            class="mt-2 w-36 py-2 text-black"
            @click="handleTeacherCertificate"
            >下一步</MyButton
          >
          <p class="text-sm font-thin mt-2">GCEP V1.0</p>
        </div>
      </div>
      <!-- 共同进入平台页面 -->
      <div v-else-if="step.enterPlatform" key="step-enterPlatform">
        <logoComponent class="scale-75 -ml-28"></logoComponent>
        <div class="my-20 text-3xl text-center font-sans">
          <p class="leading-relaxed">Kimberly，欢迎你</p>
          <p class="leading-relaxed">海内存知己，天涯若比邻</p>
          <p class="leading-relaxed">
            无论您身处何地，这里都是您学习中文、探索文化的家园
          </p>
          <p class="leading-relaxed">让我们一起开启这段美妙的语言之旅吧!</p>
        </div>
        <div class="flex flex-col justify-center items-center">
          <MyButton
            type="primary"
            class="mt-2 px-4 py-2 text-black"
            @click="handleMemberEnter"
            >进入国际中文教育平台</MyButton
          >
          <p class="text-sm font-thin mt-2">GCEP V1.0</p>
        </div>
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
