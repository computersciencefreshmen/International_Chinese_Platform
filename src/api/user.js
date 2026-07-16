import request from '@/utils/request'

const loginEndpoints = {
  teacher: '/teacher/login',
  administrator: '/administrator/login'
}

export const loginByRole = (role, email, password) => {
  const url = loginEndpoints[role]

  if (!url) {
    throw new Error(`Unsupported login role: ${role}`)
  }

  return request({
    url,
    method: 'POST',
    data: {
      data: {
        email,
        password
      }
    }
  })
}
