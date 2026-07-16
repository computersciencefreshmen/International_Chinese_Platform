import { defineStore } from 'pinia'
import { ref } from 'vue'

//用户登录模块
export const useStudentStore = defineStore(
  'student-store',
  () => {
    // 定义个人中心高亮tab栏的下标
    const isTabActive = ref(0)

    //定义用户信息
    const userInfo = ref(null)

    //设置用户信息
    const setUserInfo = (user) => {
      userInfo.value = user
    }

    //获取用户信息
    const getUserInfo = () => {
      return userInfo.value
    }

    // 添加清除方法
    const clearUserInfo = () => {
      userInfo.value = null
    }

    return {
      isTabActive,
      userInfo,
      setUserInfo,
      getUserInfo,
      clearUserInfo
    }
  },
  //持久化个人信息
  {
    persist: true
  }
)

export const useStudentPersonStore = defineStore(
  'student-person-store',
  () => {
    const appointmentList = ref([])

    const addAppointment = (appointment) => {
      appointmentList.value.push(appointment)
    }

    const clearAppointments = () => {
      appointmentList.value = []
    }

    return {
      appointmentList,
      addAppointment,
      clearAppointments
    }
  },
  {
    persist: true
  }
)
