<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { updatePassword } from '@/api/platform'
import { useUserStore } from '@/stores'

const userStore = useUserStore()
const saving = ref(false)
const errorMessage = ref('')
const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

async function submit() {
  errorMessage.value = ''
  if (form.newPassword !== form.confirmPassword) {
    errorMessage.value = '两次输入的新密码不一致'
    return
  }
  if (
    form.newPassword.length < 8 ||
    !/[A-Za-z]/.test(form.newPassword) ||
    !/\d/.test(form.newPassword)
  ) {
    errorMessage.value = '新密码至少 8 位，并同时包含字母和数字'
    return
  }

  saving.value = true
  try {
    const profile = await updatePassword(form)
    userStore.setSession(profile)
    form.currentPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    ElMessage.success('密码已更新，其他设备会话已退出')
  } catch (error) {
    errorMessage.value = error?.response?.data?.msg || '密码修改失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="password-page" aria-labelledby="password-title">
    <div class="security-card">
      <div class="security-index">02</div>
      <header>
        <p>SECURITY · 账号安全</p>
        <h1 id="password-title">更换登录密码</h1>
        <span>更新成功后，系统会撤销其他会话并为当前设备轮换安全会话。</span>
      </header>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="当前密码">
          <el-input
            v-model="form.currentPassword"
            type="password"
            autocomplete="current-password"
            show-password
          />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="form.newPassword"
            type="password"
            autocomplete="new-password"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            show-password
            @keyup.enter="submit"
          />
        </el-form-item>
        <div class="password-rule">
          <span>至少 8 位</span><span>包含字母</span><span>包含数字</span>
        </div>
        <el-alert
          v-if="errorMessage"
          :title="errorMessage"
          type="error"
          show-icon
          :closable="false"
        />
        <el-button type="primary" native-type="submit" :loading="saving">
          安全更新密码
        </el-button>
      </el-form>
    </div>
  </section>
</template>

<style scoped>
.password-page {
  min-height: 100%;
  padding: clamp(28px, 7vw, 88px) clamp(20px, 6vw, 72px);
  color: #172c35;
  background: #f1eee5;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

.security-card {
  position: relative;
  max-width: 720px;
  margin: 0 auto;
  border: 1px solid #172c35;
  padding: clamp(28px, 6vw, 68px);
  background: #fffdf7;
  box-shadow: 18px 18px 0 #d7d0bf;
}

.security-index {
  position: absolute;
  top: -18px;
  right: 22px;
  padding: 4px 12px;
  color: #fffdf7;
  background: #bf3d2f;
  font:
    700 12px ui-monospace,
    monospace;
  letter-spacing: 0.15em;
}

header {
  margin-bottom: 34px;
}

header p {
  margin: 0;
  color: #bf3d2f;
  font:
    700 11px ui-monospace,
    monospace;
  letter-spacing: 0.16em;
}

header h1 {
  margin: 10px 0;
  font-size: clamp(30px, 5vw, 48px);
  letter-spacing: -0.04em;
}

header span {
  color: #66757b;
  line-height: 1.8;
}

.password-rule {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: -4px 0 22px;
}

.password-rule span {
  border: 1px solid #9da7a5;
  padding: 4px 9px;
  color: #5a696e;
  font-size: 12px;
}

:deep(.el-button--primary) {
  width: 100%;
  height: 46px;
  margin-top: 22px;
  border-color: #172c35;
  border-radius: 0;
  background: #172c35;
  letter-spacing: 0.12em;
}
</style>
