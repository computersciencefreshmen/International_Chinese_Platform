import request from '@/utils/request'

// 注册邮箱验证码；本地开发环境会返回 developmentCode 方便演示。
export const sendEmail = (email, role = 'student') => {
  return request({
    url: '/auth/verification-code',
    method: 'POST',
    data: {
      email,
      role
    }
  })
}
