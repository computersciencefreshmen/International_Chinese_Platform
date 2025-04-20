import axios from 'axios'
// import { useUserStore } from '@/stores'
import { ElMessage } from 'element-plus'

// const userStore = useUserStore() //引入仓库

const baseURL = 'https://42.194.183.7:7777' // 后端接口地址
// const baseURL = 'https://localhost:7777' // 后端接口地址

// let loadingInstance // 定义一个变量在外部作用域

const instance = axios.create({
  baseURL,
  timeout: 10000
})

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // console.log(config.headers)
    // 设置 Content-Type 请求头
    config.headers['Content-Type'] = 'application/json'

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

    console.log(config.url)

    // // 如果 userStore.basicUser.token 存在，则在请求头部添加 token
    // if (userStore.basicUser.token) {
    //   config.headers.Authorization = `Bearer ${userStore.basicUser.token}`
    // }
    return config
  },
  (error) => {
    // 如果请求发生错误，返回一个拒绝的 Promise
    return Promise.reject(error)
  }
)

// 统一错误处理
function handleErrorResponse(error) {
  if (error.data.code === 400) {
    const message = error.data.msg || '服务异常'
    ElMessage.error(message)
  }
  return Promise.reject(error)
}

// 统一成功响应处理
function handleSuccessResponse(response) {
  // endLoading() // 处理成功响应时关闭loading
  if (response.status >= 200 && response.status < 300) {
    return response
  } else {
    return handleErrorResponse(response)
  }
}

// 响应拦截器
instance.interceptors.response.use(
  (response) => handleSuccessResponse(response),
  (error) => {
    return handleErrorResponse(error)
  }
)

export default instance
