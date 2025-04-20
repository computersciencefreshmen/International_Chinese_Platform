import request from '@/utils/request'

//[C001C]注册邮箱发送邮箱验证码
export const sendEmail = (email) => {
  return request({
    url: '/common/sendRegisterEmailCode',
    method: 'POST',
    data: {
      data: {
        // 关键修复：按照API要求嵌套在data对象中
        email
      }
    }
  })
}
