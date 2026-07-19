import request from '@/utils/request'

async function dataRequest(config) {
  const response = await request(config)
  return response.data?.data
}

export const getCourses = (params = {}) =>
  dataRequest({ method: 'GET', url: '/courses', params })

export const getCourse = (courseId) =>
  dataRequest({ method: 'GET', url: `/courses/${courseId}` })

export const createCourse = (payload) =>
  dataRequest({ method: 'POST', url: '/courses', data: payload })

export const updateCourse = (courseId, payload) =>
  dataRequest({ method: 'PATCH', url: `/courses/${courseId}`, data: payload })

export const submitCourse = (courseId) =>
  dataRequest({ method: 'POST', url: `/courses/${courseId}/submit` })

export const getCourseReviewQueue = (params = {}) =>
  dataRequest({ method: 'GET', url: '/admin/course-reviews', params })

export const reviewCourse = (courseId, payload) =>
  dataRequest({
    method: 'POST',
    url: `/admin/course-reviews/${courseId}`,
    data: payload
  })

export const getAdminMetrics = () =>
  dataRequest({ method: 'GET', url: '/admin/metrics' })

export const getTeachers = (params = {}) =>
  dataRequest({ method: 'GET', url: '/teachers', params })

export const getTeacher = (teacherId) =>
  dataRequest({ method: 'GET', url: `/teachers/${teacherId}` })

export const createAppointment = (payload) =>
  dataRequest({ method: 'POST', url: '/appointments', data: payload })

export const getAppointments = (params = {}) =>
  dataRequest({ method: 'GET', url: '/appointments', params })

export const respondToAppointment = (appointmentId, payload) =>
  dataRequest({
    method: 'PATCH',
    url: `/appointments/${appointmentId}/respond`,
    data: payload
  })

export const cancelAppointment = (appointmentId) =>
  dataRequest({
    method: 'PATCH',
    url: `/appointments/${appointmentId}/cancel`
  })

export const getClassroomJoinInfo = (classroomId) =>
  dataRequest({
    method: 'GET',
    url: `/classrooms/${classroomId}/join-info`
  })

export const createClassroomTicket = (classroomId) =>
  dataRequest({
    method: 'POST',
    url: `/classrooms/${classroomId}/ticket`
  })

export const getClassroomMessages = (classroomId, params = {}) =>
  dataRequest({
    method: 'GET',
    url: `/classrooms/${classroomId}/messages`,
    params
  })

export const completeClassroom = (classroomId) =>
  dataRequest({
    method: 'POST',
    url: `/classrooms/${classroomId}/complete`
  })

export const getCourseAssignments = (courseId) =>
  dataRequest({ method: 'GET', url: `/courses/${courseId}/assignments` })

export const createAssignment = (courseId, payload) =>
  dataRequest({
    method: 'POST',
    url: `/courses/${courseId}/assignments`,
    data: payload
  })

export const updateAssignment = (assignmentId, payload) =>
  dataRequest({
    method: 'PATCH',
    url: `/assignments/${assignmentId}`,
    data: payload
  })

export const publishAssignment = (assignmentId) =>
  dataRequest({
    method: 'POST',
    url: `/assignments/${assignmentId}/publish`
  })

export const closeAssignment = (assignmentId) =>
  dataRequest({
    method: 'POST',
    url: `/assignments/${assignmentId}/close`
  })

export const getAssignment = (assignmentId) =>
  dataRequest({ method: 'GET', url: `/assignments/${assignmentId}` })

export const saveSubmission = (assignmentId, payload) =>
  dataRequest({
    method: 'POST',
    url: `/assignments/${assignmentId}/submissions`,
    data: payload
  })

export const getMySubmissions = (params = {}) =>
  dataRequest({ method: 'GET', url: '/me/submissions', params })

export const getAssignmentSubmissions = (assignmentId, params = {}) =>
  dataRequest({
    method: 'GET',
    url: `/assignments/${assignmentId}/submissions`,
    params
  })

export const gradeSubmission = (submissionId, payload) =>
  dataRequest({
    method: 'PATCH',
    url: `/submissions/${submissionId}/grade`,
    data: payload
  })

export const getNotifications = (params = {}) =>
  dataRequest({ method: 'GET', url: '/notifications', params })

export const readNotification = (notificationId) =>
  dataRequest({
    method: 'PATCH',
    url: `/notifications/${notificationId}/read`
  })

export const readAllNotifications = () =>
  dataRequest({ method: 'POST', url: '/notifications/read-all' })

export async function uploadFile(file, category, onUploadProgress) {
  const formData = new FormData()
  formData.append('file', file)
  return dataRequest({
    method: 'POST',
    url: '/files',
    params: { category },
    data: formData,
    onUploadProgress
  })
}

export const deleteFile = (fileId) =>
  dataRequest({ method: 'DELETE', url: `/files/${fileId}` })

export const getDialogues = (params = {}) =>
  dataRequest({ method: 'GET', url: '/dialogues', params })

export const createDialogue = (payload) =>
  dataRequest({ method: 'POST', url: '/dialogues', data: payload })

export const getDialogue = (dialogueId) =>
  dataRequest({ method: 'GET', url: `/dialogues/${dialogueId}` })

export const sendDialogueMessage = (dialogueId, message) =>
  dataRequest({
    method: 'POST',
    url: `/dialogues/${dialogueId}/messages`,
    data: { message }
  })

export const getProfile = () => dataRequest({ method: 'GET', url: '/me' })

export const updateProfile = (payload) =>
  dataRequest({ method: 'PATCH', url: '/me', data: payload })

export const updatePassword = (payload) =>
  dataRequest({ method: 'PATCH', url: '/me/password', data: payload })

export { dataRequest }
