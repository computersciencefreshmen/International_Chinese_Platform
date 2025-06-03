import axios from 'axios'
import { ElMessage } from 'element-plus'

// 获取token的函数
const getAuthorizationToken = () => {
  // 从localStorage获取token
  return localStorage.getItem('token') || ''
}

const baseURL = 'http://8.134.62.173:7777' // 后端接口地址

const instance = axios.create({
  baseURL,
  timeout: 30000, // 增加超时时间到30秒
  withCredentials: true, // 允许跨域携带cookie
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthorizationToken()}`,
    'Accept': 'application/json'
  },
  // 添加代理配置
  proxy: {
    host: '8.134.62.173',
    port: 7777
  }
})

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 添加token到请求头
    const token = getAuthorizationToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 处理URL - 如果不是http开头的，拼接基地址
    if (!config.url.startsWith('http')) {
      // 确保URL以斜杠开头
      if (!config.url.startsWith('/')) {
        config.url = '/' + config.url
      }
      // 使用axios实例的baseURL
      config.baseURL = baseURL
    } else {
      // 如果是http开头的URL，清除baseURL
      config.baseURL = undefined
    }

    console.log('Request URL:', config.url)
    console.log('Request Headers:', config.headers)
    console.log('Request Data:', config.data)
    return config
  },
  (error) => {
    console.error('Request error:', error)
    ElMessage.error('请求失败，请检查网络连接')
    return Promise.reject(error)
  }
)

// 统一错误处理
function handleErrorResponse(error) {
  if (error.response) {
    // 服务器响应错误
    const { status, data } = error.response
    switch (status) {
      case 401:
        // 未授权
        ElMessage({
          message: '未授权，请重新登录',
          type: 'error'
        })
        break
      case 403:
        // 禁止访问
        ElMessage({
          message: '禁止访问',
          type: 'error'
        })
        break
      case 404:
        // 资源不存在
        ElMessage({
          message: '请求的资源不存在',
          type: 'error'
        })
        break
      default:
        // 其他错误
        ElMessage({
          message: data?.message || '服务器错误',
          type: 'error'
        })
    }
  } else {
    // 请求错误
    ElMessage({
      message: error.message || '请求失败，请检查网络连接',
      type: 'error'
    })
  }
  return Promise.reject(error)
}

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    console.log('Response data:', response.data)
    // 如果接口返回的数据格式是 { code: 0, data: {...} }
    if (response.data && response.data.code === 0) {
      return response.data
    }
    throw new Error(response.data?.message || '请求失败')
  },
  (error) => {
    return handleErrorResponse(error)
  }
)

export default instance
