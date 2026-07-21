import { createRouter, createWebHistory } from 'vue-router'
import { useStudentStore, useUserStore } from '@/stores'

const roleHome = {
  student: '/student/home',
  teacher: '/teacher/home',
  administrator: '/administrator/courseDocking'
}

const passwordResetRoute = {
  student: { path: '/student/center/changePassword' },
  teacher: { path: '/teacher/user', query: { tab: 'security' } },
  administrator: { path: '/administrator/center/changePasswordAdmin' }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      component: () => import('@/views/login/loginPage.vue')
    },
    {
      // 学生端架子模块
      path: '/student',
      component: () =>
        import('@/views/student/studentLayout/studentLayout.vue'),
      meta: { requiresAuth: true, role: 'student' },
      redirect: '/student/home', // 重定向到首页
      children: [
        // 子路由配置
        {
          // 学生首页模块
          path: 'home', // 子路由路径
          name: 'studentHome',
          component: () =>
            import('@/views/student/studentHomePage/studentHomePage.vue')
        },
        {
          // 学生预约老师模块
          path: 'order',
          name: 'orderTeacher',
          component: () =>
            import('@/views/student/orderTeacher/orderTeacher.vue')
        },
        {
          // 学生网络课程模块
          path: 'course',
          name: 'onlineCourse',
          component: () =>
            import('@/views/student/onlineCourses/onlineCourses.vue')
        },
        {
          // 学生个人中心模块
          path: 'center',
          name: 'personalCenter',
          redirect: '/student/center/info', // 重定向到个人信息模块
          component: () =>
            import('@/views/student/personalCenter/personalCenter.vue'),

          // 个人中心子路由
          children: [
            {
              // 个人信息模块
              path: 'info',
              name: 'personalInfo',
              component: () =>
                import('@/views/student/personalCenter/personalInfo.vue')
            },
            {
              // 修改密码模块
              path: 'changePassword',
              name: 'changePassword',
              component: () =>
                import('@/views/student/personalCenter/changePassword.vue')
            },
            {
              // 消息通知模块
              path: 'message',
              name: 'message',
              component: () =>
                import('@/views/student/personalCenter/messageNotice.vue')
            }
          ]
        },
        {
          //话轮页面
          path: 'chatTurn',
          name: 'chatTurn',
          component: () => import('@/views/student/chatTurn/chatTurn.vue')
        },
        {
          //作业页面
          path: 'homeWork',
          name: 'homeWork',
          component: () => import('@/views/student/homeWork/homeWork.vue')
        },
        {
          //老师详情页面
          path: 'teacherDetail',
          name: 'teacherDetail',
          component: () =>
            import('@/views/student/orderTeacher/teacherDetail.vue')
        },
        {
          path: 'liveClass',
          name: 'liveClass',
          component: () => import('@/views/liveClass/liveClass.vue')
        },
        {
          path: 'digitalHuman',
          name: 'digitalHuman',
          component: () =>
            import('@/views/student/digitalHuman/TeachDetails.vue')
        }
      ]
    },
    {
      path: '/teacher',
      component: () => import('@/views/teacher/LayoutPage/LayoutPage.vue'),
      meta: { requiresAuth: true, role: 'teacher' },
      redirect: '/teacher/home', // 重定向到首页
      children: [
        // 首页
        {
          path: 'home',
          name: 'home',
          component: () =>
            import('@/views/teacher/teacherHomePage/teacherHomePage.vue')
        },
        // 授课对接模块
        {
          path: 'teachingDocking',
          name: 'teachingDocking',
          component: () =>
            import('@/views/teacher/TeachingDockingPage/teachingDockingPage.vue')
        },
        // 网络课程模块
        {
          path: 'onlineCourses',
          name: 'onlineCourses',
          component: () =>
            import('@/views/teacher/OnlineCoursesPage/OnlineCoursesPage.vue'),
          children: []
        },
        // 个人中心模块
        {
          path: 'user',
          name: 'user',
          component: () => import('@/views/teacher/UserPage/UserPage.vue')
        },
        // 上传课程模块
        {
          path: 'uploadCourses',
          name: 'uploadCourses',
          component: () =>
            import('@/views/teacher/UploadCoursesPage/UploadCoursesPage.vue')
        },
        // 课程详情模块
        {
          path: 'courseDetails',
          name: 'courseDetails',
          component: () =>
            import('@/views/teacher/CourseDetailsPage/CourseDetailsPage.vue')
        },
        {
          path: 'liveClass',
          name: 'teacherLiveClass',
          component: () => import('@/views/liveClass/liveClass.vue')
        }
      ]
    },
    {
      path: '/administrator',
      component: () =>
        import('@/views/administrator/administratorLayout/administratorLayout.vue'),
      meta: { requiresAuth: true, role: 'administrator' },
      redirect: '/administrator/courseDocking', // 重定向到首页
      children: [
        // 子路由配置
        {
          //课程对接模块
          path: 'courseDocking', // 子路由路径
          name: 'courseDocking',
          component: () =>
            import('@/views/administrator/courseDocking/courseDocking.vue')
        },
        {
          //审核中心模块
          path: 'auditCenter',
          name: 'auditCenter',
          component: () =>
            import('@/views/administrator/auditCenter/auditCenter.vue')
        },
        {
          //数据中心模块
          path: 'dataCenter',
          name: 'dataCenter',
          component: () =>
            import('@/views/administrator/dataCenter/dataCenter.vue')
        },
        {
          //个人中心模块
          path: 'center',
          name: 'center',
          redirect: '/administrator/center/changePasswordAdmin',
          component: () =>
            import('@/views/administrator/personalCenter/personalCenter.vue'),
          // 个人中心子路由
          children: [
            {
              // 修改密码模块
              path: 'changePasswordAdmin',
              name: 'changePasswordAdmin',
              component: () =>
                import('@/views/administrator/personalCenter/changePassword.vue')
            },
            {
              // 消息通知模块
              path: 'AdminMessage',
              name: 'AdminMessage',
              component: () =>
                import('@/views/administrator/personalCenter/messageNotice.vue')
            }
          ]
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/login'
    }
  ]
})

router.beforeEach(async (to) => {
  const userStore = useUserStore()
  const studentStore = useStudentStore()
  await userStore.restoreSession()

  const currentRole = userStore.role

  if (
    userStore.isAuthenticated &&
    currentRole &&
    userStore.profile?.mustResetPassword
  ) {
    const resetRoute = passwordResetRoute[currentRole]
    const onResetRoute =
      to.path === resetRoute.path &&
      (currentRole !== 'teacher' || to.query.tab === 'security')
    if (!onResetRoute) return resetRoute
  }

  if (userStore.isAuthenticated && currentRole === 'student') {
    studentStore.setUserInfo(userStore.profile)
  } else {
    studentStore.clearUserInfo()
  }

  if (to.path === '/login' && userStore.isAuthenticated && currentRole) {
    return roleHome[currentRole] || '/login'
  }

  const authRecord = to.matched.find((record) => record.meta.requiresAuth)
  if (!authRecord) {
    return true
  }

  if (!userStore.isAuthenticated || !currentRole) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }

  const expectedRole = authRecord.meta.role
  if (expectedRole && expectedRole !== currentRole) {
    return roleHome[currentRole] || '/login'
  }

  return true
})

let unauthorizedRedirectInProgress = false

if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', async () => {
    if (unauthorizedRedirectInProgress) return

    unauthorizedRedirectInProgress = true
    try {
      const userStore = useUserStore()
      const studentStore = useStudentStore()
      const currentRoute = router.currentRoute.value

      userStore.clearSession()
      studentStore.clearUserInfo()

      if (currentRoute.path !== '/login') {
        await router.replace({
          path: '/login',
          query: { redirect: currentRoute.fullPath }
        })
      }
    } finally {
      unauthorizedRedirectInProgress = false
    }
  })
}

export default router
