<script setup>
import { ElMessage } from 'element-plus'
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { createCourse, submitCourse } from '@/api/platform'

const router = useRouter()
const courseFormRef = ref(null)
const isSubmitting = ref(false)
const coverFileList = ref([])
const coverPreviewUrl = ref('')

const form = ref({
  title: '',
  summary: '',
  description: '',
  category: '综合汉语',
  level: 'beginner',
  durationMinutes: 45,
  priceYuan: 99,
  capacity: 20
})

const rules = {
  title: [
    { required: true, message: '请输入课程名称', trigger: 'blur' },
    { max: 160, message: '课程名称不能超过 160 个字符', trigger: 'blur' }
  ],
  summary: [
    { required: true, message: '请用一句话说明课程价值', trigger: 'blur' },
    { max: 500, message: '课程简介不能超过 500 个字符', trigger: 'blur' }
  ],
  description: [{ required: true, message: '请填写课程详情', trigger: 'blur' }],
  category: [{ required: true, message: '请选择课程分类', trigger: 'change' }],
  level: [{ required: true, message: '请选择适用级别', trigger: 'change' }],
  durationMinutes: [
    { required: true, message: '请输入课时长度', trigger: 'change' }
  ],
  priceYuan: [{ required: true, message: '请输入课程价格', trigger: 'change' }],
  capacity: [{ required: true, message: '请输入班级容量', trigger: 'change' }]
}

const revokeCoverPreview = () => {
  if (!coverPreviewUrl.value) return

  URL.revokeObjectURL(coverPreviewUrl.value)
  coverPreviewUrl.value = ''
}

const handleCoverChange = (uploadFile, uploadFiles) => {
  const rawFile = uploadFile.raw
  if (!rawFile) return

  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(
    rawFile.type
  )
  const isWithinLimit = rawFile.size <= 2 * 1024 * 1024

  if (!isImage || !isWithinLimit) {
    coverFileList.value = uploadFiles.filter(
      (file) => file.uid !== uploadFile.uid
    )
    ElMessage.error(
      isImage ? '封面不能超过 2MB' : '仅支持 JPG、PNG 或 WebP 封面'
    )
    return
  }

  coverFileList.value = uploadFiles
  revokeCoverPreview()
  coverPreviewUrl.value = URL.createObjectURL(rawFile)
}

const handleCoverRemove = () => {
  revokeCoverPreview()
}

const handleExceed = () => {
  ElMessage.warning('仅保留一张封面，请先移除当前文件')
}

const buildPayload = () => ({
  title: form.value.title.trim(),
  summary: form.value.summary.trim(),
  description: form.value.description.trim(),
  category: form.value.category,
  level: form.value.level,
  coverUrl: null,
  durationMinutes: Number(form.value.durationMinutes),
  priceCents: Math.round(Number(form.value.priceYuan) * 100),
  capacity: Number(form.value.capacity)
})

const saveCourse = async (shouldSubmit) => {
  const isValid = await courseFormRef.value?.validate().catch(() => false)
  if (!isValid) {
    ElMessage.warning('请先完善课程信息')
    return
  }

  isSubmitting.value = true
  let createdCourse = null

  try {
    createdCourse = await createCourse(buildPayload())
    const result = shouldSubmit
      ? await submitCourse(createdCourse.id)
      : createdCourse

    ElMessage.success(shouldSubmit ? '课程已提交审核' : '课程草稿已保存')
    await router.replace({
      path: '/teacher/courseDetails',
      query: { id: result.id }
    })
  } catch (error) {
    if (createdCourse) {
      ElMessage.warning('草稿已保存，但提交审核失败；你可以在详情页重新提交')
      await router.replace({
        path: '/teacher/courseDetails',
        query: { id: createdCourse.id }
      })
      return
    }

    if (!error?.messageShown) {
      ElMessage.error(
        shouldSubmit ? '提交失败，请稍后重试' : '保存失败，请稍后重试'
      )
    }
  } finally {
    isSubmitting.value = false
  }
}

onUnmounted(revokeCoverPreview)
</script>

<template>
  <main class="course-create mt-36 mx-auto overflow-hidden rounded-[28px]">
    <header class="create-header">
      <button
        type="button"
        class="back-button"
        aria-label="返回课程列表"
        @click="router.push('/teacher/onlineCourses')"
      >
        ←
      </button>
      <div>
        <p class="eyebrow">NEW COURSE · 新建课程</p>
        <h1>从一个明确的学习成果开始。</h1>
        <p>保存后生成真实草稿；准备就绪时，可直接进入管理员审核队列。</p>
      </div>
      <span class="draft-mark">DRAFT 01</span>
    </header>

    <section class="create-body">
      <aside class="preview-column">
        <div class="cover-preview">
          <img
            v-if="coverPreviewUrl"
            :src="coverPreviewUrl"
            alt="当前课程封面预览"
          />
          <div v-else class="cover-placeholder">
            <small>INTERNATIONAL CHINESE</small>
            <strong>{{ form.title || '课程封面' }}</strong>
            <span>{{ form.category }} · {{ form.durationMinutes }} 分钟</span>
          </div>
        </div>

        <div class="preview-note">
          <span class="note-index">01</span>
          <div>
            <h2>封面是可选项</h2>
            <p>
              当前版本只做本地预览，不上传文件；不选择封面也能完整创建并提交课程。
            </p>
          </div>
        </div>

        <el-upload
          v-model:file-list="coverFileList"
          class="cover-uploader"
          :auto-upload="false"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          :on-change="handleCoverChange"
          :on-remove="handleCoverRemove"
          :limit="1"
          :on-exceed="handleExceed"
        >
          <el-button>选择本地封面</el-button>
          <template #tip>
            <div class="el-upload__tip">
              JPG / PNG / WebP，最大 2MB，仅用于本页预览。
            </div>
          </template>
        </el-upload>
      </aside>

      <section class="form-column">
        <div class="section-heading">
          <span>课程信息</span>
          <small>带 * 的字段需要完整填写</small>
        </div>

        <el-form
          ref="courseFormRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
        >
          <div class="form-grid">
            <el-form-item class="span-two" label="课程名称" prop="title">
              <el-input
                v-model="form.title"
                maxlength="160"
                show-word-limit
                placeholder="例如：城市生活中文 · 问路与交通"
              />
            </el-form-item>

            <el-form-item class="span-two" label="一句话简介" prop="summary">
              <el-input
                v-model="form.summary"
                maxlength="500"
                show-word-limit
                placeholder="告诉学习者：学完这门课可以做到什么"
              />
            </el-form-item>

            <el-form-item label="课程分类" prop="category">
              <el-select v-model="form.category" class="w-full">
                <el-option label="综合汉语" value="综合汉语" />
                <el-option label="生活口语" value="生活口语" />
                <el-option label="文化口语" value="文化口语" />
                <el-option label="语法精讲" value="语法精讲" />
                <el-option label="HSK 备考" value="HSK 备考" />
              </el-select>
            </el-form-item>

            <el-form-item label="适用级别" prop="level">
              <el-select v-model="form.level" class="w-full">
                <el-option label="入门" value="beginner" />
                <el-option label="初级" value="elementary" />
                <el-option label="中级" value="intermediate" />
                <el-option label="高级" value="advanced" />
                <el-option label="全级别" value="all" />
              </el-select>
            </el-form-item>

            <el-form-item label="单课时长（分钟）" prop="durationMinutes">
              <el-input-number
                v-model="form.durationMinutes"
                :min="1"
                :max="1440"
                controls-position="right"
                class="number-input"
              />
            </el-form-item>

            <el-form-item label="课程价格（元）" prop="priceYuan">
              <el-input-number
                v-model="form.priceYuan"
                :min="0"
                :max="1000000"
                :precision="2"
                controls-position="right"
                class="number-input"
              />
            </el-form-item>

            <el-form-item label="班级容量（人）" prop="capacity">
              <el-input-number
                v-model="form.capacity"
                :min="1"
                :max="10000"
                controls-position="right"
                class="number-input"
              />
            </el-form-item>

            <div class="process-card">
              <strong>发布流程</strong>
              <span>草稿 → 待审核 → 已发布</span>
            </div>

            <el-form-item class="span-two" label="课程详情" prop="description">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="8"
                maxlength="30000"
                show-word-limit
                placeholder="建议包含：学习目标、教学内容、课堂活动、适合人群和学习材料。"
              />
            </el-form-item>
          </div>
        </el-form>

        <div class="action-bar">
          <p>“保存草稿”可继续编辑；“保存并提交”后，在审核完成前不可修改。</p>
          <div class="action-buttons">
            <el-button
              size="large"
              :disabled="isSubmitting"
              @click="saveCourse(false)"
            >
              保存草稿
            </el-button>
            <el-button
              type="primary"
              size="large"
              :loading="isSubmitting"
              @click="saveCourse(true)"
            >
              保存并提交审核
            </el-button>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<style lang="scss" scoped>
.course-create {
  --ink: #173247;
  --muted: #657d8d;
  max-width: 1720px;
  color: var(--ink);
  background: #edf8fb;
  box-shadow: 0 28px 70px rgba(32, 87, 107, 0.15);
}

.create-header {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 22px;
  padding: 42px 48px;
  overflow: hidden;
  color: #f6fdff;
  background:
    radial-gradient(
      circle at 84% 10%,
      rgba(120, 221, 230, 0.36),
      transparent 28%
    ),
    #123f58;
}

.create-header::after {
  position: absolute;
  right: -40px;
  bottom: -92px;
  width: 290px;
  height: 180px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  content: '';
  transform: rotate(-12deg);
}

.back-button {
  display: grid;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  place-items: center;
  font-size: 22px;
  transition:
    background 160ms ease,
    transform 160ms ease;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: translateX(-2px);
}

.eyebrow {
  margin: 0 0 9px;
  color: #8cd6e4;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.create-header h1 {
  margin: 0;
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(32px, 3vw, 48px);
  line-height: 1.2;
}

.create-header p:last-child {
  margin: 12px 0 0;
  color: rgba(238, 250, 255, 0.72);
}

.draft-mark {
  z-index: 1;
  padding: 7px 12px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  color: #bcecf3;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.create-body {
  display: grid;
  grid-template-columns: minmax(300px, 0.72fr) minmax(560px, 1.28fr);
  gap: 42px;
  padding: 42px 48px 52px;
}

.preview-column {
  position: sticky;
  top: 130px;
  align-self: start;
}

.cover-preview {
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border: 10px solid #fff;
  border-radius: 5px;
  background: #b8e3eb;
  box-shadow: 18px 22px 0 rgba(29, 96, 119, 0.1);
  transform: rotate(-1.1deg);
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  text-align: center;
  background:
    repeating-linear-gradient(
      135deg,
      transparent 0 24px,
      rgba(17, 76, 98, 0.07) 24px 25px
    ),
    linear-gradient(145deg, #dff5f7, #8dcbd9);
}

.cover-placeholder small {
  margin-bottom: 24px;
  color: #397b91;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.cover-placeholder strong {
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: clamp(34px, 4vw, 54px);
  line-height: 1.12;
}

.cover-placeholder span {
  margin-top: 22px;
  color: #456f80;
  font-size: 13px;
}

.preview-note {
  display: flex;
  gap: 15px;
  margin: 34px 0 22px;
  padding: 18px;
  border-left: 3px solid #2b819d;
  background: rgba(255, 255, 255, 0.64);
}

.note-index {
  color: #4f9cb3;
  font-family: Georgia, serif;
  font-size: 28px;
}

.preview-note h2 {
  margin: 2px 0 5px;
  font-size: 16px;
}
.preview-note p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.cover-uploader {
  padding-left: 18px;
}

.form-column {
  padding: 30px 34px;
  border: 1px solid rgba(25, 79, 100, 0.1);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 40px rgba(32, 87, 107, 0.08);
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 26px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(35, 91, 111, 0.12);
}

.section-heading span {
  font-family: 'STKaiti', 'KaiTi', serif;
  font-size: 28px;
  font-weight: 800;
}
.section-heading small {
  color: #8395a0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 22px;
}

.span-two {
  grid-column: span 2;
}
.number-input {
  width: 100%;
}

.process-card {
  display: flex;
  min-height: 72px;
  flex-direction: column;
  justify-content: center;
  margin-top: 30px;
  padding: 10px 16px;
  border-radius: 12px;
  color: #2e6579;
  background: #e8f6f8;
}

.process-card strong {
  font-size: 13px;
}
.process-card span {
  margin-top: 4px;
  font-size: 12px;
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: 14px;
  padding-top: 24px;
  border-top: 1px solid rgba(35, 91, 111, 0.12);
}

.action-bar p {
  max-width: 430px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.action-buttons {
  display: flex;
  flex: 0 0 auto;
}

@media (max-width: 1180px) {
  .create-body {
    grid-template-columns: 1fr;
  }
  .preview-column {
    position: static;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .cover-uploader {
    grid-column: 2;
    padding-left: 0;
  }
}

@media (max-width: 760px) {
  .create-header {
    grid-template-columns: auto 1fr;
    padding: 34px 22px;
  }
  .draft-mark {
    display: none;
  }
  .create-body {
    padding: 26px 18px 36px;
  }
  .preview-column {
    display: block;
  }
  .form-column {
    padding: 24px 18px;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .span-two {
    grid-column: auto;
  }
  .action-bar {
    align-items: stretch;
    flex-direction: column;
  }
  .action-buttons {
    justify-content: flex-end;
  }
}
</style>
