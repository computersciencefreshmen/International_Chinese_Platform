<script setup>
import { useRouter } from 'vue-router' //引入路由
const router = useRouter()
const props = defineProps({
  title: {
    type: String,
    default: '直播课堂'
  },
  count: {
    type: Number,
    default: 0
  }
})
</script>

<template>
  <div class="header-bar">
    <div class="left-section">
      <img
        class="h-6 w-6 cursor-pointer"
        src="@/assets/student/back.png"
        @click="router.go(-1)"
        alt="返回图标"
      />
      <div class="live-status">
        <span class="status-dot"></span>
        <span>直播中</span>
      </div>
      <h2 class="title">{{ props.title }}</h2>
    </div>

    <div class="right-section">
      <div class="online-count">
        <span>2人在线</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  background: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  z-index: 10;
  border-radius: 8px;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.live-status {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #f44336;
  font-size: 14px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f44336;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.right-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.online-count {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  color: #666;
}

.icon-button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #666;
}

.icon-button:hover {
  background: #f5f5f5;
}

.settings-container {
  position: relative;
}

.settings-dropdown {
  position: absolute;
  right: 0;
  top: 40px;
  width: 200px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 10px;
  z-index: 100;
}

.settings-item {
  margin-bottom: 10px;
}

.settings-item label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.settings-item select {
  width: 100%;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}
</style>
