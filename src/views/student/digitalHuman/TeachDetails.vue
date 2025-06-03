<template>
  <div id="app" style="display: flex; flex-direction: column; min-height: 100vh;">
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
      <router-link to="/student/teach">返回</router-link>
      <div style="margin-left: 20px;">
        <el-button
          type="primary"
          @click="connectDigitalHuman"
          :disabled="isDigitalHumanConnected">
          {{ isDigitalHumanConnected ? '数字人已连接' : '连接数字人' }}
        </el-button>
      </div>
    </div>

    <div style="display: flex; flex: 1; overflow: hidden;">
      <div style="flex: 1; overflow-y: auto; padding-right: 20px;">
        <el-card class="box-card" v-if="!loading">
          <div slot="header" class="clearfix">
            <span>基本信息</span>
          </div>
          <div>
            <p><strong>创建教师:</strong> {{ teachingPlanDetail.teacher_name }}</p>
            <p><strong>关键词1:</strong> {{ teachingPlanDetail.keyword1 }}</p>
            <p><strong>关键词2:</strong> {{ teachingPlanDetail.keyword2 }}</p>
            <p><strong>关键词3:</strong> {{ teachingPlanDetail.keyword3 }}</p>
            <p><strong>话轮:</strong>
              <div v-if="teachingPlanDetail.conversation" class="pre-with-break" >
                <el-button @click="speakText(teachingPlanDetail.conversation)">播放语音</el-button><br />
                <span v-for="(word,index) in spiltwords"
                :key="index"
                :style="{color:getColor(index)}"> {{ word }}
                <el-button @click="speakText(word)">播放</el-button>
                <el-button @click="startRecording(index)">录音</el-button>
                <el-button @click="compareAudio(index)">对比</el-button>
                <el-button
                  @click="digitalHumanSpeak(word)"
                  :disabled="!isDigitalHumanConnected"
                  type="success">
                  数字人朗读
                </el-button>
             <br /><br />
               </span>
              </div>
            </p>
          </div>
        </el-card>

        <el-card class="box-card" v-if="!loading">
          <div slot="header" class="clearfix">
            <span>生词</span>
          </div>
          <div>
            <el-table :data="words" style="width: 100%">
              <el-table-column prop="new_word_name" label="生词名"></el-table-column>
              <el-table-column prop="spelling" label="拼音"></el-table-column>
              <el-table-column prop="translate" label="英文翻译"></el-table-column>
              <el-table-column prop="chinese_interpretation" label="中文释义"></el-table-column>
              <el-table-column prop="foreign_language_interpretation" label="英文释义"></el-table-column>
            </el-table>
          </div>
        </el-card>

        <el-card class="box-card" v-if="!loading">
          <div slot="header" class="clearfix">
            <span>语法</span>
          </div>
          <div>
            <el-collapse v-model="activeNames">
              <el-collapse-item v-for="(grammar, index) in grammarData" :key="index" :title="grammar?.grammar_name" :name="index.toString()">
                <p><strong>语法名称:</strong> {{ grammar?.grammar_name }}</p>
                <p><strong>语法意义及功能:</strong> {{ grammar?.meaning_and_function }}</p>
                <p><strong>练习与测试:</strong> {{ grammar?.exercises_and_tests }}</p>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </div>

      <div style="width: 320px; position: relative;">
        <div class="digital-human-video" style="position: sticky; top: 20px;" v-show="isDigitalHumanConnected">
          <video ref="digitalHumanVideo" id="video" autoplay playsinline muted style="width: 100%; height: auto;"></video>
          <audio ref="digitalHumanAudio" id="audio" autoplay></audio>
        </div>
      </div>
    </div>

    <el-dialog v-if="errorMessage" title="错误" @close="errorMessage = ''">
      <p>{{ errorMessage }}</p>
    </el-dialog>
    <el-dialog v-if="loading" title="加载中...">
      <p>请稍候...</p>
    </el-dialog>
  </div>
</template>

<script setup>
import apiRequest from '@/utils/request';
import { onMounted, computed, ref, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';

const route = useRoute();
const words = ref([]);
const teachingPlanId = ref(route.query.id || null);
const teachingPlanDetail = ref({
  name: '',
  keyword1: '',
  keyword2: '',
  keyword3: '',
  conversation: '',
  teacher_name: ''
});
const grammarData = ref([]);
const loading = ref(false);
const errorMessage = ref('');
const activeNames = ref(['0']);

// 数字人相关状态
const isDigitalHumanConnected = ref(false);
const digitalHumanVideo = ref(null);
const digitalHumanAudio = ref(null);
const peerConnection = ref(null);
const sessionId = ref(null);
const speaking = ref(false);

// 数字人服务相关配置
const digitalHumanConfig = ref({
  baseUrl: 'http://127.0.0.1:8010',
  offerEndpoint: '/offer',
  humanEndpoint: '/human'
});

// 获取数据
const fetchData = async () => {
  if (!teachingPlanId.value) {
    errorMessage.value = '缺少教学计划ID';
    return;
  }

  loading.value = true;
  try {
    await Promise.all([fetchWords(), fetchDetail(), fetchGrammars()]);
  } catch (error) {
    errorMessage.value = '获取数据失败，请稍后再试。';
    console.error('获取数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const fetchWords = async () => {
  try {
    const response = await apiRequest.get('/student/get_new_words', { teachingPlanId: teachingPlanId.value });
    words.value = response.data;
  } catch (error) {
    console.error('获取生词数据失败:', error);
    throw error;
  }
};

const fetchDetail = async () => {
  try {
    const response = await apiRequest.get('/student/plan_detail', { teachingPlanId: teachingPlanId.value });
    teachingPlanDetail.value = response.data;
  } catch (error) {
    console.error('获取教学计划详情失败:', error);
    throw error;
  }
};

const fetchGrammars = async () => {
  try {
    const response = await apiRequest.get('/student/get_grammar', { teachingPlanId: teachingPlanId.value });
    grammarData.value = response.data;
  } catch (error) {
    console.error('获取语法点数据失败:', error);
    throw error;
  }
};

const spiltwords = computed(() => {
  return teachingPlanDetail.value.conversation?.split('\n') || [];
});

const getColor = (index) => {
  const colors = ['red', 'black'];
  return colors[index % 2];
};

const speakText = (textToSpeak) => {
  if (textToSpeak?.trim()) {
    speaking.value = true;
    const msg = new SpeechSynthesisUtterance(textToSpeak);
    msg.lang = 'zh-CN';
    msg.onend = () => {
      speaking.value = false;
    };
    speechSynthesis.speak(msg);
  }
};

const startRecording = (index) => {
  console.log(`开始录音: ${index}`);
  // 这里可以添加录音逻辑
  ElMessage.info('开始录音功能待实现');
};

const compareAudio = (index) => {
  console.log(`对比音频: ${index}`);
  const score = Math.floor(Math.random() * 101);
  ElMessage.success(`评分: ${score}`);
};

// 初始化WebRTC连接
const initWebRTC = async () => {
  try {
    // 创建RTCPeerConnection对象
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    // 先关闭之前的连接
    closeWebRTC();

    peerConnection.value = new RTCPeerConnection(configuration);

    // 添加事件监听
    peerConnection.value.oniceconnectionstatechange = (e) => {
      console.log('ICE连接状态变化:', peerConnection.value.iceConnectionState);
      if (['failed', 'disconnected'].includes(peerConnection.value.iceConnectionState)) {
        console.error('ICE连接失败或断开');
        errorMessage.value = 'WebRTC连接失败，请刷新页面重试';
        isDigitalHumanConnected.value = false;
      }
    };

    // 设置远程视频流处理
    peerConnection.value.ontrack = (event) => {
      console.log('收到媒体轨道:', event.track.kind);

      if (event.track.kind === 'video') {
        console.log('设置视频源');
        setTimeout(() => {
          if (digitalHumanVideo.value) {
            digitalHumanVideo.value.srcObject = event.streams[0];
            digitalHumanVideo.value.onloadedmetadata = () => {
              console.log('视频元数据已加载');
            };
            digitalHumanVideo.value.onplay = () => {
              console.log('视频开始播放');
            };
            digitalHumanVideo.value.play().catch(err => {
              console.error('视频播放失败:', err);
              digitalHumanVideo.value.muted = true;
              digitalHumanVideo.value.play().catch(e => console.error('即使静音也无法播放视频:', e));
            });
          }
        }, 100);
      } else if (event.track.kind === 'audio') {
        console.log('设置音频源');
        if (digitalHumanAudio.value) {
          digitalHumanAudio.value.srcObject = event.streams[0];
          digitalHumanAudio.value.play().catch(console.error);
        }
      }
    };

    // 创建视频和音频接收轨道
    peerConnection.value.addTransceiver('video', { direction: 'recvonly' });
    peerConnection.value.addTransceiver('audio', { direction: 'recvonly' });

    // 创建offer
    const offer = await peerConnection.value.createOffer();
    await peerConnection.value.setLocalDescription(offer);

    // 等待ICE收集完成
    await new Promise((resolve) => {
      if (peerConnection.value.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (peerConnection.value.iceGatheringState === 'complete') {
            peerConnection.value.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        peerConnection.value.addEventListener('icegatheringstatechange', checkState);
      }
    });

    // 发送offer到服务器
    const response = await fetch(`${digitalHumanConfig.value.baseUrl}${digitalHumanConfig.value.offerEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sdp: peerConnection.value.localDescription.sdp,
        type: 'offer'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 处理服务器返回的answer
    const answerData = await response.json();

    if (answerData.sdp && answerData.type === 'answer' && answerData.sessionid !== undefined) {
      const remoteDesc = new RTCSessionDescription({
        sdp: answerData.sdp,
        type: answerData.type
      });

      await peerConnection.value.setRemoteDescription(remoteDesc);
      sessionId.value = answerData.sessionid;
      isDigitalHumanConnected.value = true;
      ElMessage.success('数字人连接成功');
    } else {
      throw new Error('建立WebRTC连接失败：服务器返回的数据格式不正确');
    }
  } catch (error) {
    errorMessage.value = '连接数字人失败，请稍后重试';
    console.error('连接数字人失败:', error);
    closeWebRTC();
    throw error;
  }
};

// 关闭WebRTC连接
const closeWebRTC = () => {
  if (peerConnection.value) {
    peerConnection.value.close();
    peerConnection.value = null;
  }

  if (digitalHumanVideo.value?.srcObject) {
    const tracks = digitalHumanVideo.value.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    digitalHumanVideo.value.srcObject = null;
  }

  sessionId.value = null;
  isDigitalHumanConnected.value = false;
};

// 连接数字人
const connectDigitalHuman = async () => {
  if (isDigitalHumanConnected.value) return;

  try {
    loading.value = true;
    await initWebRTC();
  } catch (error) {
    errorMessage.value = '连接数字人失败，请稍后重试';
    console.error('连接数字人失败:', error);
    ElMessage.error('连接数字人失败: ' + (error.message || '未知错误'));
  } finally {
    loading.value = false;
  }
};

// 数字人朗读文本
const digitalHumanSpeak = async (text) => {
  if (!isDigitalHumanConnected.value || !sessionId.value) {
    errorMessage.value = '请先连接数字人';
    ElMessage.warning('请先连接数字人');
    return;
  }

  if (!text?.trim()) {
    return;
  }

  try {
    const response = await fetch(`${digitalHumanConfig.value.baseUrl}${digitalHumanConfig.value.humanEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        type: 'echo',
        interrupt: true,
        sessionid: sessionId.value
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('数字人朗读请求已发送');
    ElMessage.success('已发送朗读请求');
  } catch (error) {
    console.error('数字人朗读失败:', error);
    ElMessage.error('数字人朗读失败: ' + (error.message || '未知错误'));
  }
};

// 组件挂载时加载数据
onMounted(() => {
  fetchData();
});

// 组件卸载时清理资源
onUnmounted(() => {
  closeWebRTC();
  // 停止所有语音合成
  if (speaking.value) {
    speechSynthesis.cancel();
  }
});
</script>

<style scoped>
/* 确保页面占满整个高度 */
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

#app {
  min-height: 100vh;
  padding: 20px;
}

.box-card {
  margin-bottom: 20px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.el-table {
  width: 100%;
}

.el-collapse {
  margin-top: 20px;
}

.pre-with-break {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 2;
}

/* 数字人视频容器 */
.digital-human-video {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.2);
  margin-bottom: 20px;
  width: 100%;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
}

.digital-human-video video {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
}

/* 按钮样式优化 */
.el-button {
  margin: 2px;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .digital-human-video {
    width: 100%;
    margin-top: 20px;
  }
  
  #app {
    flex-direction: column;
  }
  
  .el-card {
    margin-bottom: 15px;
  }
}
</style>
