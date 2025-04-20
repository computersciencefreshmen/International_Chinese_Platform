import request from '@/utils/request'

//通用的获取房间号码接口
export const getSenderId = (token, cursor, appointmentCourseId) => {
  return request({
    url: `/chat/msg/appointCoursePage?token=${token}`,
    method: 'POST',
    data: {
      data: {
        pageSize: 10,
        cursor,
        appointmentCourseId
      }
    }
  })
}
