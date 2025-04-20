import request from '@/utils/request'

//学生用户登录
export const studentLogin = (email, password) => {
  return request({
    url: '/student/login',
    method: 'POST',
    data: {
      data: {
        email,
        password
      }
    }
  })
}

//学生用户注册
export const studentRegister = (email, verificationCode, password) => {
  return request({
    url: '/student/register',
    method: 'POST',
    data: {
      data: {
        email,
        verificationCode,
        password
      }
    }
  })
}

//获取网课课程列表
export const getOnlineCoursesList = (
  token,
  currentPage,
  pageSize,
  courseCategory,
  title
) => {
  return request({
    url: '/student/getOnlineCourseList',
    headers: { token },
    method: 'POST',
    data: {
      data: {
        currentPage,
        pageSize,
        courseCategory,
        title
      }
    }
  })
}

//获取网络课程详情页
export const getOnlineCoursesDetail = (token, onlineCourseId) => {
  return request({
    url: `/student/getOnlineCourseDetail/${onlineCourseId}`,
    headers: { token },
    method: 'GET'
  })
}

//修改个人信息
export const updateStudentInfo = (name, country, region, age, level) => {
  return request({
    url: '/student/update',
    method: 'POST',
    data: {
      data: {
        name,
        country,
        region,
        age,
        level
      }
    }
  })
}

//获取学生作业
export const getStudentHomework = (courseType, courseId, token) => {
  return request({
    url: `/student/homework/${courseType}/${courseId}`,
    headers: { token },
    method: 'GET'
  })
}

//提交作业
export const submitHomework = (courseType, courseId, token, homework) => {
  return request({
    url: `/student/homework/${courseType}/${courseId}`,
    headers: { token },
    method: 'POST',
    data: {
      data: {
        homework
      }
    }
  })
}

//获取老师列表
export const getTeacherList = (
  token,
  currentPage,
  minScore,
  minExperience,
  expertise
) => {
  return request({
    url: '/student/teacherList',
    headers: { token },
    method: 'POST',
    data: {
      data: {
        currentPage,
        pageSize: 10,
        minScore,
        minExperience,
        expertise
      }
    }
  })
}

//搜索老师
export const searchTeacher = (token, currentPage, teacherName) => {
  return request({
    url: '/student/teacherName',
    headers: { token },
    method: 'POST',
    data: {
      data: {
        currentPage,
        pageSize: 10,
        teacherName
      }
    }
  })
}

//预约老师
export const bookTeacher = (token, teacherId) => {
  return request({
    url: `/student/book/${teacherId}`,
    headers: { token },
    method: 'POST'
  })
}

//获取话论
export const getForum = (words) => {
  return request({
    url: 'http://10.173.40.205:5002/process_words',
    method: 'POST',
    data: {
      words
    }
  })
}
