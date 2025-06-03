<script setup>
// 用户信息
const userInfo = {
  name: 'Kimberly',
  points: 5000,
  level: 'ICEP会员'
}

// 会员套餐
const plans = [
  {
    id: 1,
    name: '月度会员',
    price: '¥99',
    period: '月月',
    originalPrice: '',
    benefits: [
      '课程折扣: 所有积分课程8折',
      '专属内容: 每月解锁20个会员网络课程',
      '基础功能: 无限次观看直播回放(仅限已购买的课程)',
      '每月2课时免费线上课服务',
      '每月2课时免费vip线上课服务',
      '赠送50积分'
    ]
  },
  {
    id: 2,
    name: '季度会员',
    price: '¥249',
    period: '/季度',
    originalPrice: '¥294',
    benefits: [
      '课程折扣: 所有积分课程7折',
      '专属内容: 每月解锁10个会员网络课程',
      '基础功能: 无限次观看直播回放(仅限已购买的课程)',
      '每月3课时免费普通线上课服务',
      '每月1课时免费vip线上课服务',
      '赠送100积分'
    ]
  },
  {
    id: 3,
    name: '年度会员',
    price: '¥899',
    period: '1年度',
    originalPrice: '¥1176',
    benefits: [
      '课程折扣: 所有积分课程6折',
      '专属内容: 每月解锁30个会员网络课程',
      '基础功能: 无限次观看直播回放(仅限已购买的课程)',
      '每月4课时免费普通线上课服务',
      '每月2课时免费vip线上课服务',
      '赠送300积分'
    ]
  },
  {
    id: 4,
    name: '连续包月',
    price: '¥79',
    period: '月',
    originalPrice: '',
    benefits: [
      '课程折扣: 所有积分课程8折',
      '专属内容: 每月解锁15个会员网络课程',
      '基础功能: 无限次观看直播回放(仅限已购买的课程)',
      '每月2课时免费线上课服务',
      '连续包月三次后赠送100积分'
    ]
  }
]
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-6xl mx-auto">
      <!-- 用户信息栏 -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div class="flex items-center gap-4">
          <!-- 头像 -->
          <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md">
            <img 
              src="@/assets/student/avatar.png" 
              alt="User Avatar"
              class="w-full h-full object-cover"
              @error="$event.target.src='@/assets/student/avatar.png'"
            >
          </div>
          <div>
            <h1 class="text-2xl font-bold text-gray-800">{{ userInfo.name }}</h1>
          </div>
        </div>
        
        <div class="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
          <!-- 积分框 -->
          <div class="relative bg-white border border-gray-300 rounded-2xl px-6 py-3 w-full md:w-auto flex items-center justify-between">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v1.5a.5.5 0 01-1 0V8a7 7 0 1114 0v1.5a.5.5 0 01-1 0V8a6 6 0 00-6-6z" />
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-1a7 7 0 100-14 7 7 0 000 14z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-500">我的积分</p>
              <p class="text-xl font-bold text-gray-800">{{ userInfo.points }}<span class="text-sm font-normal text-gray-500 ml-1">分</span></p>
            </div>
          </div>
          
          <!-- 会员等级 -->
          <div class="relative bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl px-6 py-3 w-full md:w-auto">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span class="font-semibold">{{ userInfo.level }}</span>
            </div>
          </div>
          
          <!-- 积分充值按钮 -->
          <button class="w-full md:w-auto bg-blue-100 hover:bg-blue-200 text-blue-600 font-medium rounded-xl px-6 py-3 transition-colors flex items-center justify-center gap-2">
            <span>ICEP积分充值</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- 会员套餐 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          v-for="plan in plans" 
          :key="plan.id"
          class="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300"
          :class="{ 'border-2 border-blue-500 transform scale-105': plan.name === '月度会员' }"
        >
          <div class="flex justify-between items-start mb-4">
            <h3 class="text-xl font-bold text-gray-800">{{ plan.name }}</h3>
            <div class="text-right">
              <div class="text-2xl font-bold text-blue-600">{{ plan.price }}</div>
              <div class="text-sm text-gray-500">{{ plan.period }}</div>
              <div v-if="plan.originalPrice" class="text-xs text-gray-400 line-through">原价{{ plan.originalPrice }}</div>
            </div>
          </div>
          
          <ul class="space-y-3 mb-6">
            <li 
              v-for="(benefit, index) in plan.benefits" 
              :key="index"
              class="text-sm text-gray-700 flex items-start"
            >
              <span class="text-blue-500 mr-2">·</span>
              <span>{{ benefit }}</span>
            </li>
          </ul>
          
          <button 
            class="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors"
            :class="{ 'bg-blue-600': plan.name === '月度会员' }"
          >
            立即开通
          </button>
        </div>
      </div>
      
      <!-- 会员说明 -->
      <div class="mt-12 p-6 rounded-2xl bg-white shadow-md">
        <h2 class="text-xl font-bold text-gray-800 mb-4">会员说明</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="font-semibold text-gray-700 mb-2">会员特权</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-start">
                <span class="text-blue-500 mr-2">·</span>
                <span>课程折扣：会员专享课程折扣，最低可享6折优惠</span>
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-2">·</span>
                <span>专属内容：海量会员专属课程内容任您学习</span>
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-2">·</span>
                <span>免费课时：每月赠送免费线上课程，随时预约学习</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 class="font-semibold text-gray-700 mb-2">常见问题</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-start">
                <span class="text-blue-500 mr-2">·</span>
                <span>会员服务为虚拟商品，购买后不支持退款</span>
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-2">·</span>
                <span>会员服务自动续费可随时取消</span>
              </li>
              <li class="flex items-start">
                <span class="text-blue-500 mr-2">·</span>
                <span>如有任何问题，请联系客服咨询</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 动画效果 */
.hover-scale {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.hover-scale:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

/* 响应式调整 */
@media (max-width: 640px) {
  .plan-card {
    margin: 0 auto;
    max-width: 100%;
  }
}
</style>
