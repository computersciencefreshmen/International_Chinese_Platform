import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('@/views/login/loginPage.vue') },
    {
      // 学生端架子模块
      path: '/student',
      component: () =>
        import('@/views/student/studentLayout/studentLayout.vue'),
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
          component: () =>
            import('@/views/student/personalCenter/personalCenter.vue')
        }
      ]
    },
    {
      path: '/teacher',
      component: () =>
        import('@/views/teacher/teacherHomePage/teacherHomePage.vue')
    }
  ]
})

// 全局前置守卫
// router.beforeEach((to, from, next) => {
//   // 假设有一个全局的用户状态
//   const userRole = localStorage.getItem('userRole'); // 从本地存储或其他地方获取用户角色

//   // 根据用户角色跳转到对应页面
//   if (!userRole) {
//     // 如果没有用户角色，跳转到登录页
//     next({ path: '/' });
//   } else if (userRole === 'student') {
//     // 如果是学生角色，跳转到学生端
//     next({ path: '/student' });
//   } else if (userRole === 'teacher') {
//     // 如果是老师角色，跳转到老师端
//     next({ path: '/teacher' });
//   } else {
//     // 如果角色未知，跳转到登录页
//     next({ path: '/' });
//   }
// });

export default router
