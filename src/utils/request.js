import axios from 'axios'
// import { useUserStore } from '@/stores'
import { ElMessage } from 'element-plus'

// const userStore = useUserStore() //引入仓库

const baseURL = 'http://8.138.110.206:7070' // 后端接口地址

// let loadingInstance // 定义一个变量在外部作用域

const instance = axios.create({
  baseURL,
  timeout: 10000
})

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 设置 Content-Type 请求头
    config.headers['Content-Type'] = 'application/json';

    // 如果 userStore.basicUser.token 存在，则在请求头部添加 token
    // if (userStore.basicUser.token) {
    //   config.headers.Authorization = `Bearer ${userStore.basicUser.token}`;
    // }
    return config;
  },
  (error) => {
    // 如果请求发生错误，返回一个拒绝的 Promise
    return Promise.reject(error);
  }
);

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
  if (response.data.code >= 200 && response.data.code < 300) {
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
