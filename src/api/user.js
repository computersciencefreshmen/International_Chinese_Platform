import request from '@/utils/request'

export const loginByRole = (role, email, password) => {
  return request({
    url: '/auth/login',
    method: 'POST',
    data: {
      email,
      password,
      role
    }
  })
}

export const registerByRole = (registration) => {
  return request({
    url: '/auth/register',
    method: 'POST',
    data: registration
  })
}

export const getSession = () => {
  return request({
    url: '/auth/session',
    method: 'GET'
  })
}

export const logoutSession = () => {
  return request({
    url: '/auth/logout',
    method: 'POST'
  })
}
