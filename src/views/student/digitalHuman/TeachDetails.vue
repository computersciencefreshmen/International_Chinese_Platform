<template>
  <div class="digital-human-page">
    <!-- 顶部栏 -->
    <div class="header-bar">
      <router-link to="/student/home" class="back-btn">返回首页</router-link>
      <div class="user-info">
        <img src="@/assets/student/avatar.png" class="user-avatar" />
        <span class="user-name">Kimberly</span>
      </div>
    </div>
    <!-- 数字人问答对话区 -->
    <div class="qa-dialog-area">
      <div class="qa-dialog-list">
        <div v-for="(item, idx) in qaHistory" :key="idx" class="qa-dialog-item">
          <div class="qa-bubble user-bubble">
            <img src="@/assets/student/avatar.png" class="bubble-avatar" />
            <span>{{ item.q }}</span>
          </div>
          <div class="qa-bubble digital-bubble">
            <img src="@/assets/icon/teacher.png" class="bubble-avatar" />
            <span>{{ item.a }}</span>
          </div>
        </div>
      </div>
      <div class="qa-input-bar">
        <el-input v-model="qaInput" placeholder="向数字人提问..." class="qa-input" @keyup.enter="askDigitalHuman" />
        <el-button class="qa-btn" type="primary" @click="askDigitalHuman">
          <span class="btn-gradient-text">提问</span>
        </el-button>
      </div>
    </div>
    <div class="main-content">
      <!-- 左侧内容区 -->
      <div class="left-content">
        <el-card class="box-card">
          <template #header>
            <span>数字人学习课堂</span>
          </template>
          <div class="lesson-title">点餐用语对话</div>
          <div class="dialog-content">
            <div v-for="(line, idx) in dialogLines" :key="idx" class="dialog-line">
              <span @click="digitalHumanRead(line)" class="dialog-clickable">{{ line }}</span>
            </div>
          </div>
        </el-card>
        <el-card class="box-card">
          <template #header>
            <span>生词表</span>
          </template>
          <el-table :data="words" style="width: 100%">
            <el-table-column prop="word" label="生词名"></el-table-column>
            <el-table-column prop="pinyin" label="拼音"></el-table-column>
            <el-table-column prop="en" label="英文翻译"></el-table-column>
            <el-table-column prop="zh" label="中文释义"></el-table-column>
          </el-table>
        </el-card>
        <el-card class="box-card">
          <template #header>
            <span>语法点</span>
          </template>
          <el-collapse v-model="activeNames">
            <el-collapse-item v-for="(grammar, index) in grammarData" :key="index" :title="grammar.name" :name="index.toString()">
              <p><strong>语法名称:</strong> {{ grammar.name }}</p>
              <p><strong>语法意义及功能:</strong> {{ grammar.meaning }}</p>
              <p><strong>练习与测试:</strong> {{ grammar.practice }}</p>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </div>
      <!-- 右侧数字人区 -->
      <div class="right-panel">
        <div class="digital-human-card" @click="showDigitalDialog = true">
          <img src="@/assets/icon/teacher.png" class="digital-human-avatar" />
          <div class="digital-human-role">数字人</div>
          <div class="digital-human-name">ICE数字助教</div>
        </div>
        <div class="student-card">
          <img src="@/assets/student/avatar.png" class="student-avatar" />
          <div class="student-role">我</div>
          <div class="student-name">Kimberly</div>
        </div>
      </div>
    </div>
    <el-dialog v-model="showDigitalDialog" title="数字人语音对话" width="320px">
      <div style="text-align:center;">
        <img src="@/assets/icon/teacher.png" style="width:60px;height:60px;border-radius:50%;margin-bottom:10px;" />
        <div style="font-size:16px;color:#333;">你好，我是ICE数字助教，有什么可以帮你？</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const dialogLines = [
  'A：我们来模拟餐厅点餐。',
  'B：好呀，你想当顾客还是服务员？',
  'A：我当顾客。',
  'B：您好，请问几位？',
  'A：一位。',
  'B：请来这边坐。要喝点什么？',
  'A：给我一杯水，谢谢。',
  'B：好的，马上就到。'
]
const words = ref([
  { word: '点餐', pinyin: 'diǎn cān', en: 'order food', zh: '在餐厅点食物' },
  { word: '顾客', pinyin: 'gù kè', en: 'customer', zh: '消费的人' },
  { word: '服务员', pinyin: 'fú wù yuán', en: 'waiter/waitress', zh: '提供服务的人' },
  { word: '请问', pinyin: 'qǐng wèn', en: 'may I ask', zh: '礼貌提问' },
  { word: '一位', pinyin: 'yí wèi', en: 'one person', zh: '一个人' }
])
const grammarData = ref([
  { name: '请问', meaning: '用于礼貌提问', practice: '请问，这道菜怎么做？' },
  { name: '要', meaning: '表示需要', practice: '我要一杯水。' }
])
const activeNames = ref(['0'])
const showDigitalDialog = ref(false)

// 数字人朗读对话
function digitalHumanRead(line) {
  window.$message?.success?.('数字人正在朗读：' + line) || alert('数字人正在朗读：' + line)
}

// 数字人问答模拟
const qaInput = ref('')
const qaHistory = ref([])
function askDigitalHuman() {
  if (!qaInput.value.trim()) return
  // 简单模拟数字人回复
  let answer = ''
  if (qaInput.value.includes('你好')) {
    answer = '你好，很高兴见到你！'
    addWord({ word: '你好', pinyin: 'nǐ hǎo', en: 'hello', zh: '打招呼用语' })
    addGrammar({ name: '你好', meaning: '打招呼', practice: '你好，老师。' })
  } else if (qaInput.value.includes('点餐')) {
    answer = '点餐时可以说"请问，可以点餐了吗？"'
    addWord({ word: '点餐', pinyin: 'diǎn cān', en: 'order food', zh: '在餐厅点食物' })
    addGrammar({ name: '可以', meaning: '表示许可', practice: '我可以点餐了吗？' })
  } else {
    answer = '这是数字人的模拟回答。'
  }
  qaHistory.value.push({ q: qaInput.value, a: answer })
  qaInput.value = ''
}
function addWord(wordObj) {
  if (!words.value.find(w => w.word === wordObj.word)) {
    words.value.push(wordObj)
  }
}
function addGrammar(grammarObj) {
  if (!grammarData.value.find(g => g.name === grammarObj.name)) {
    grammarData.value.push(grammarObj)
  }
}
</script>

<style scoped>
.digital-human-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #6a8dff 0%, #a084ee 100%);
  padding: 24px;
  display: flex;
  flex-direction: column;
}
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.back-btn {
  color: #fff;
  font-weight: bold;
  text-decoration: none;
  font-size: 16px;
  background: linear-gradient(90deg, #6a8dff 0%, #a084ee 100%);
  padding: 6px 18px;
  border-radius: 8px;
  box-shadow: 0 2px 8px 0 rgba(106,141,255,0.12);
  transition: background 0.3s;
}
.back-btn:hover {
  background: linear-gradient(90deg, #a084ee 0%, #6a8dff 100%);
}
.user-info {
  display: flex;
  align-items: center;
}
.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin-right: 8px;
  border: 2px solid #e0e7ef;
}
.user-name {
  font-size: 16px;
  color: #fff;
  font-weight: 500;
}
.qa-dialog-area {
  width: 100%;
  max-width: 900px;
  margin: 0 auto 32px auto;
  background: rgba(255,255,255,0.95);
  border-radius: 18px;
  box-shadow: 0 4px 24px 0 rgba(106,141,255,0.10);
  padding: 24px 32px 16px 32px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.qa-dialog-list {
  max-height: 220px;
  overflow-y: auto;
  margin-bottom: 18px;
}
.qa-dialog-item {
  margin-bottom: 12px;
}
.qa-bubble {
  display: flex;
  align-items: flex-end;
  margin-bottom: 4px;
}
.user-bubble {
  justify-content: flex-end;
}
.digital-bubble {
  justify-content: flex-start;
}
.user-bubble span, .digital-bubble span {
  display: inline-block;
  padding: 10px 18px;
  border-radius: 18px;
  font-size: 16px;
  max-width: 340px;
  word-break: break-all;
  box-shadow: 0 2px 8px 0 rgba(106,141,255,0.10);
}
.user-bubble span {
  background: linear-gradient(90deg, #6a8dff 0%, #a084ee 100%);
  color: #fff;
  margin-left: 8px;
}
.digital-bubble span {
  background: #f4f8ff;
  color: #6a8dff;
  margin-right: 8px;
}
.bubble-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-shadow: 0 2px 8px 0 rgba(160,132,238,0.10);
}
.qa-input-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.qa-input {
  flex: 1;
  border-radius: 12px;
  box-shadow: 0 2px 8px 0 rgba(160,132,238,0.08);
  border: none;
  font-size: 16px;
  padding: 8px 14px;
}
.qa-btn {
  background: linear-gradient(90deg, #6a8dff 0%, #a084ee 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-weight: bold;
  font-size: 16px;
  box-shadow: 0 2px 8px 0 rgba(106,141,255,0.15);
  padding: 8px 24px;
  transition: background 0.3s;
}
.qa-btn:hover {
  background: linear-gradient(90deg, #a084ee 0%, #6a8dff 100%);
}
.btn-gradient-text {
  background: linear-gradient(90deg, #fff 0%, #e0e7ef 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: bold;
}
.main-content {
  display: flex;
  flex: 1;
  gap: 24px;
}
.left-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.box-card {
  margin-bottom: 16px;
  border-radius: 16px;
  box-shadow: 0 4px 24px 0 rgba(106,141,255,0.10);
  border: none;
}
.lesson-title {
  font-size: 28px;
  font-weight: bold;
  color: #222;
  margin: 24px 0 16px 0;
  text-align: center;
}
.dialog-content {
  background: rgba(255,255,255,0.8);
  border-radius: 8px;
  padding: 24px;
  font-size: 18px;
  color: #222;
  min-height: 220px;
}
.dialog-line {
  margin-bottom: 8px;
}
.dialog-clickable {
  cursor: pointer;
  transition: color 0.2s;
}
.dialog-clickable:hover {
  color: #6a8dff;
  text-decoration: underline;
}
.right-panel {
  width: 240px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}
.digital-human-card, .student-card {
  background: linear-gradient(135deg, #e0e7ef 0%, #f4f8ff 100%);
  border-radius: 20px;
  box-shadow: 0 4px 24px 0 rgba(160,132,238,0.10);
  padding: 28px 16px 18px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  cursor: pointer;
  border: none;
}
.digital-human-avatar, .student-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  margin-bottom: 8px;
  border: 2px solid #6a8dff;
  background: #f0f6ff;
}
.digital-human-role, .student-role {
  font-size: 14px;
  color: #6a8dff;
  margin-bottom: 4px;
}
.digital-human-name, .student-name {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}
</style>

