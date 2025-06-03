import request from '@/utils/request'

//[C001C]注册邮箱发送邮箱验证码
export const sendEmail = (email) => {
  return request({
    url: '/common/sendRegisterEmailCode',
    method: 'POST',
    data: {
      data: {
        email
      }
    }
  })
}

// 管理员登录
export const adminLogin = (email, password) => {
  return request({
    url: '/admin/login',
    method: 'POST',
    data: {
      data: {
        email,
        password
      }
    }
  })
}
