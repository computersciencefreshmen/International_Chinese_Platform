<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import defaultAvatar from '@/assets/student/avatar.png'
import {
  deleteFile,
  getProfile,
  updateProfile,
  uploadFile
} from '@/api/platform'
import { useUserStore } from '@/stores'

const userStore = useUserStore()
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const fileInput = ref(null)
const pendingAvatar = ref(null)
const previewUrl = ref('')

const form = reactive({
  displayName: '',
  email: '',
  avatarUrl: '',
  country: '',
  region: '',
  age: null,
  chineseLevel: null,
  bio: '',
  teacherProfile: {
    school: '',
    title: '',
    experienceYears: 0,
    hourlyRateYuan: 0,
    specialties: '',
    certificates: '',
    teachingStyle: '',
    languages: ''
  }
})

const isTeacher = computed(() => userStore.role === 'teacher')
const avatar = computed(
  () => previewUrl.value || form.avatarUrl || defaultAvatar
)

function joinTags(values) {
  return Array.isArray(values) ? values.join('、') : ''
}

function splitTags(value) {
  return String(value || '')
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, values) => values.indexOf(item) === index)
}

function applyProfile(profile) {
  form.displayName = profile.displayName || ''
  form.email = profile.email || ''
  form.avatarUrl = profile.avatarUrl || ''
  form.country = profile.country || ''
  form.region = profile.region || ''
  form.age = profile.age ?? null
  form.chineseLevel = profile.chineseLevel ?? null
  form.bio = profile.bio || ''

  const teacher = profile.teacherProfile
  if (teacher) {
    form.teacherProfile.school = teacher.school || ''
    form.teacherProfile.title = teacher.title || ''
    form.teacherProfile.experienceYears = teacher.experienceYears || 0
    form.teacherProfile.hourlyRateYuan = (teacher.hourlyRateCents || 0) / 100
    form.teacherProfile.specialties = joinTags(teacher.specialties)
    form.teacherProfile.certificates = joinTags(teacher.certificates)
    form.teacherProfile.teachingStyle = joinTags(teacher.teachingStyle)
    form.teacherProfile.languages = joinTags(teacher.languages)
  }
}

async function loadProfile() {
  loading.value = true
  errorMessage.value = ''
  try {
    const profile = await getProfile()
    applyProfile(profile)
    userStore.setSession(profile)
  } catch (error) {
    errorMessage.value = error?.response?.data?.msg || '个人资料加载失败'
  } finally {
    loading.value = false
  }
}

function chooseAvatar() {
  fileInput.value?.click()
}

function selectAvatar(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    ElMessage.warning('头像仅支持 JPG、PNG 或 WebP')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('头像不能超过 5MB')
    return
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  pendingAvatar.value = file
  previewUrl.value = URL.createObjectURL(file)
}

function teacherPayload() {
  return {
    school: form.teacherProfile.school,
    title: form.teacherProfile.title,
    experienceYears: form.teacherProfile.experienceYears,
    hourlyRateCents: Math.round(
      Number(form.teacherProfile.hourlyRateYuan || 0) * 100
    ),
    specialties: splitTags(form.teacherProfile.specialties),
    certificates: splitTags(form.teacherProfile.certificates),
    teachingStyle: splitTags(form.teacherProfile.teachingStyle),
    languages: splitTags(form.teacherProfile.languages)
  }
}

async function saveProfile() {
  if (!form.displayName.trim()) {
    ElMessage.warning('请填写昵称')
    return
  }

  saving.value = true
  errorMessage.value = ''
  let uploadedFile = null
  try {
    if (pendingAvatar.value) {
      uploadedFile = await uploadFile(pendingAvatar.value, 'avatar')
    }
    const payload = {
      displayName: form.displayName,
      avatarUrl: uploadedFile?.url || form.avatarUrl || null,
      country: form.country || null,
      region: form.region || null,
      age: form.age === '' ? null : form.age,
      chineseLevel: form.chineseLevel || null,
      bio: form.bio
    }
    if (isTeacher.value) payload.teacherProfile = teacherPayload()

    const profile = await updateProfile(payload)
    applyProfile(profile)
    userStore.setSession(profile)
    pendingAvatar.value = null
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
    ElMessage.success('个人资料已保存')
  } catch (error) {
    if (uploadedFile?.id) await deleteFile(uploadedFile.id).catch(() => {})
    errorMessage.value = error?.response?.data?.msg || '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

onMounted(loadProfile)
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <section class="account-sheet" aria-labelledby="profile-title">
    <header class="sheet-header">
      <div>
        <p class="eyebrow">IDENTITY · 个人身份</p>
        <h1 id="profile-title">完善你的学习名片</h1>
        <p>这里的信息会用于课程、预约与课堂协作。</p>
      </div>
      <span class="role-seal">{{ isTeacher ? '师' : '学' }}</span>
    </header>

    <el-skeleton v-if="loading" :rows="8" animated />
    <el-alert
      v-else-if="errorMessage && !form.email"
      :title="errorMessage"
      type="error"
      show-icon
      :closable="false"
    >
      <template #default>
        <el-button link type="primary" @click="loadProfile">重新加载</el-button>
      </template>
    </el-alert>

    <el-form v-else label-position="top" @submit.prevent="saveProfile">
      <div class="profile-grid">
        <aside class="portrait-column">
          <button class="portrait-button" type="button" @click="chooseAvatar">
            <img :src="avatar" alt="个人头像" />
            <span>更换头像</span>
          </button>
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="selectAvatar"
          />
          <p>{{ form.email }}</p>
          <small>JPG / PNG / WebP，最大 5MB</small>
        </aside>

        <div class="fields-column">
          <div class="two-column">
            <el-form-item label="昵称">
              <el-input v-model="form.displayName" maxlength="80" />
            </el-form-item>
            <el-form-item label="中文水平">
              <el-select
                v-model="form.chineseLevel"
                clearable
                placeholder="请选择"
              >
                <el-option label="入门" value="beginner" />
                <el-option
                  v-for="level in 6"
                  :key="level"
                  :label="`HSK ${level}`"
                  :value="`HSK${level}`"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="国家 / 地区">
              <el-input v-model="form.country" maxlength="80" />
            </el-form-item>
            <el-form-item label="所在城市">
              <el-input v-model="form.region" maxlength="120" />
            </el-form-item>
            <el-form-item label="年龄">
              <el-input-number v-model="form.age" :min="6" :max="120" />
            </el-form-item>
          </div>
          <el-form-item label="个人简介">
            <el-input
              v-model="form.bio"
              type="textarea"
              :rows="4"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>

          <div v-if="isTeacher" class="teacher-fields">
            <div class="section-marker">
              <span>TEACHING PROFILE</span>
              <strong>专业教学资料</strong>
            </div>
            <div class="two-column">
              <el-form-item label="院校 / 机构">
                <el-input
                  v-model="form.teacherProfile.school"
                  maxlength="160"
                />
              </el-form-item>
              <el-form-item label="职称">
                <el-input v-model="form.teacherProfile.title" maxlength="120" />
              </el-form-item>
              <el-form-item label="教学年限">
                <el-input-number
                  v-model="form.teacherProfile.experienceYears"
                  :min="0"
                  :max="80"
                />
              </el-form-item>
              <el-form-item label="课时价格（元）">
                <el-input-number
                  v-model="form.teacherProfile.hourlyRateYuan"
                  :min="0"
                  :max="100000"
                  :precision="2"
                />
              </el-form-item>
            </div>
            <el-form-item label="教学专长（用顿号或逗号分隔）">
              <el-input v-model="form.teacherProfile.specialties" />
            </el-form-item>
            <el-form-item label="证书">
              <el-input v-model="form.teacherProfile.certificates" />
            </el-form-item>
            <div class="two-column">
              <el-form-item label="教学风格">
                <el-input v-model="form.teacherProfile.teachingStyle" />
              </el-form-item>
              <el-form-item label="授课语言">
                <el-input v-model="form.teacherProfile.languages" />
              </el-form-item>
            </div>
          </div>
        </div>
      </div>

      <el-alert
        v-if="errorMessage"
        class="form-error"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />
      <footer class="sheet-actions">
        <span>所有修改都保存到后端数据库</span>
        <el-button type="primary" native-type="submit" :loading="saving">
          保存资料
        </el-button>
      </footer>
    </el-form>
  </section>
</template>

<style scoped>
.account-sheet {
  --ink: #172c35;
  --paper: #fffdf7;
  --cinnabar: #bf3d2f;
  min-height: 100%;
  padding: clamp(24px, 4vw, 52px);
  color: var(--ink);
  background:
    linear-gradient(90deg, rgba(23, 44, 53, 0.035) 1px, transparent 1px) 0 0 /
      32px 32px,
    var(--paper);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

.sheet-header,
.sheet-actions,
.profile-grid,
.two-column,
.section-marker {
  display: flex;
}

.sheet-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 34px;
  border-bottom: 1px solid rgba(23, 44, 53, 0.16);
  padding-bottom: 24px;
}

.sheet-header h1 {
  margin: 4px 0 8px;
  font-size: clamp(28px, 4vw, 44px);
  letter-spacing: -0.04em;
}

.sheet-header p {
  margin: 0;
  color: #607078;
}

.eyebrow {
  color: var(--cinnabar) !important;
  font:
    700 11px/1.4 ui-monospace,
    monospace;
  letter-spacing: 0.18em;
}

.role-seal {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border: 2px solid var(--cinnabar);
  color: var(--cinnabar);
  font-size: 28px;
  transform: rotate(3deg);
}

.profile-grid {
  align-items: flex-start;
  gap: clamp(28px, 5vw, 72px);
}

.portrait-column {
  width: min(220px, 28vw);
  flex: 0 0 auto;
  text-align: center;
}

.portrait-button {
  position: relative;
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 2px;
  background: #e8ece9;
  cursor: pointer;
  aspect-ratio: 4 / 5;
}

.portrait-button img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.portrait-button span {
  position: absolute;
  inset: auto 0 0;
  padding: 12px;
  color: white;
  background: rgba(23, 44, 53, 0.86);
  transform: translateY(100%);
  transition: transform 0.25s ease;
}

.portrait-button:hover img,
.portrait-button:focus-visible img {
  transform: scale(1.035);
}

.portrait-button:hover span,
.portrait-button:focus-visible span {
  transform: translateY(0);
}

.portrait-column p {
  margin: 14px 0 4px;
  overflow-wrap: anywhere;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.portrait-column small {
  color: #7d898e;
}

.fields-column {
  min-width: 0;
  flex: 1;
}

.two-column {
  flex-wrap: wrap;
  gap: 0 22px;
}

.two-column > * {
  min-width: 220px;
  flex: 1 1 calc(50% - 11px);
}

.teacher-fields {
  margin-top: 30px;
  border-top: 1px solid rgba(23, 44, 53, 0.14);
  padding-top: 26px;
}

.section-marker {
  align-items: baseline;
  gap: 14px;
  margin-bottom: 22px;
}

.section-marker span {
  color: var(--cinnabar);
  font:
    700 10px ui-monospace,
    monospace;
  letter-spacing: 0.16em;
}

.section-marker strong {
  font-size: 20px;
}

.sheet-actions {
  align-items: center;
  justify-content: flex-end;
  gap: 22px;
  margin-top: 28px;
}

.sheet-actions span {
  color: #758087;
  font-size: 13px;
}

.sheet-actions :deep(.el-button--primary) {
  min-width: 140px;
  border-color: var(--ink);
  border-radius: 0;
  background: var(--ink);
}

.form-error {
  margin-top: 20px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@media (max-width: 760px) {
  .profile-grid {
    flex-direction: column;
  }

  .portrait-column {
    width: 160px;
  }

  .sheet-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
