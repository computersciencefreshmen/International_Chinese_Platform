import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/modules/user'

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
      component: () => import('@/views/student/studentLayout/studentLayout.vue'),
      meta: { requiresAuth: true },
      redirect: '/student/home', // 重定向到首页
      children: [
        // 子路由配置
        {
          // 学生首页模块
          path: 'home', // 子路由路径
          name: 'studentHome',
          component: () => import('@/views/student/studentHomePage/studentHomePage.vue')
        },
        {
          // 学生预约老师模块
          path: 'order',
          name: 'orderTeacher',
          component: () =>
            import('@/views/student/orderTeacher/orderTeacher.vue')
        },
        {
          // 学生发布预约模块
          path: 'publish',
          name: 'publishOrder',
          component: () =>
            import('@/views/student/publishOrder/publishOrder.vue')
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
              // 会员信息模块
              path: 'vip',
              name: 'vipInfo',
              component: () =>
                import('@/views/student/personalCenter/vipInfo.vue')
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
          //创建新的话轮并预约老师
          path: 'createNewChat',
          name: 'createNewChat',
          component: () =>
            import('@/views/student/orderTeacher/createNewChat.vue')
        },
        {
          // 创建新的发布预约
          path: 'createNewPublish',
          name: 'createNewPublish',
          component: () =>
            import('@/views/student/publishOrder/CreateNewPublish.vue')
        },
        {
          path: 'liveClass',
          name: 'liveClass',
          component: () => import('@/views/liveClass/liveClass.vue')
        },
        {
          // 数字人页面
          path: 'digitalHuman',
          name: 'digitalHuman',
          component: () => import('@/views/student/digitalHuman/TeachDetails.vue')
        }
      ]
    },
    {
      path: '/teacher',
      component: () =>
        import('@/views/teacher/teacherHomePage/teacherHomePage.vue')
    },
    {
      path: '/teacher/onlineCourses',
      component: () =>
        import('@/views/teacher/OnlineCoursesPage/OnlineCoursesPage.vue')
    },
    {
      path: '/teacher/courseDetails',
      component: () =>
        import('@/views/teacher/CourseDetailsPage/CourseDetailsPage.vue')
    },
    {
      path: '/teacher/layout',
      component: () =>
        import('@/views/teacher/LayoutPage/LayoutPage.vue')
    },
    {
      path: '/teacher/teachingDocking',
      component: () =>
        import('@/views/teacher/TeachingDockingPage/TeachingDockingPage.vue')
    },
    {
      path: '/teacher/uploadCourses',
      component: () =>
        import('@/views/teacher/UploadCoursesPage/UploadCoursesPage.vue')
    },
    {
      path: '/teacher/user',
      component: () =>
        import('@/views/teacher/UserPage/UserPage.vue')
    },
    {
      path: '/administrator',
      component: () =>
        import(
          '@/views/administrator/administratorLayout/administratorLayout.vue'
        ),
      meta: { requiresAuth: true },
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
          redirect: '/administrator/center/changePasswordAdmin', // 重定向到个人信息模块
          component: () =>
            import('@/views/administrator/personalCenter/personalCenter.vue'),
          // 个人中心子路由
          children: [
            {
              // 修改密码模块
              path: 'changePasswordAdmin',
              name: 'changePasswordAdmin',
              component: () =>
                import(
                  '@/views/administrator/personalCenter/changePassword.vue'
                )
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
    }
  ]
})

// 修改路由守卫，取消教师端的登录限制
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const hasToken = userStore.token
  const whiteList = ['/login', '/']
  
  // 如果目标路由是登录页或主页，直接放行
  if (whiteList.includes(to.path)) {
    next()
    return
  }
  
  if (to.path.startsWith('/teacher')) {
    // 教师端直接放行，无需登录
    next()
  } else if (hasToken) {
    if (userStore.role) {
      // 根据用户角色判断是否可以访问
      if (userStore.role === 'student' && to.path.startsWith('/student')) {
        next()
      } else if (userStore.role === 'administrator' && to.path.startsWith('/administrator')) {
        next()
      } else {
        // 如果角色和目标路由不匹配，重定向到对应角色首页
        if (userStore.role === 'student') {
          next('/student/home')
        } else {
          next('/administrator/home')
        }
      }
    } else {
      try {
        await userStore.getUserInfo()
        next({ ...to, replace: true })
      } catch {
        userStore.clearToken()
        next('/login')
      }
    }
  } else {
    // 如果没有 token，直接跳转到登录页，不显示提示
    next('/login')
  }
})

export default router
