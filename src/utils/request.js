import axios from 'axios'
import { ElMessage } from 'element-plus'
import { API_BASE_URL } from '@/config/runtime'

const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
})

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {}
    config.headers['Content-Type'] = 'application/json'

    if (typeof config.url === 'string') {
      if (/^https?:\/\//i.test(config.url)) {
        config.baseURL = undefined
      } else {
        if (!config.url.startsWith('/')) {
          config.url = '/' + config.url
        }
        config.baseURL = API_BASE_URL
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// 统一错误处理
function handleErrorResponse(error) {
  const responseData = error?.response?.data ?? error?.data
  const errorCode =
    responseData?.code ?? error?.response?.status ?? error?.status

  if (Number(errorCode) === 400) {
    const message = responseData?.msg || responseData?.message || '服务异常'
    ElMessage.error(String(message))
  }

  return Promise.reject(error)
}

// 统一成功响应处理
function handleSuccessResponse(response) {
  if (response.status >= 200 && response.status < 300) {
    return response
  }

  return handleErrorResponse(response)
}

// 响应拦截器
instance.interceptors.response.use(
  (response) => handleSuccessResponse(response),
  (error) => {
    return handleErrorResponse(error)
  }
)

export default instance
