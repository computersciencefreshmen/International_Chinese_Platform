<script setup>
import { onUnmounted, ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

const router = useRouter()
const courseFormRef = ref(null)

const form = ref({
  title: '',
  category: '',
  desc: '',
  questionType: '',
  homeworkContent: ''
})

const rules = {
  title: [{ required: true, message: '请输入课程标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择课程分类', trigger: 'change' }],
  desc: [{ required: true, message: '请输入课程简介', trigger: 'blur' }]
}

const coverFileList = ref([])
const videoFileList = ref([])
const copyFileList = ref([])
const coverPreviewUrl = ref('')
const isSubmitting = ref(false)
const homeworkConfirmed = ref(false)
const submissionSummary = ref(null)

const revokeCoverPreview = () => {
  if (coverPreviewUrl.value) {
    URL.revokeObjectURL(coverPreviewUrl.value)
    coverPreviewUrl.value = ''
  }
}

const removeInvalidFile = (fileList, uploadFile) => {
  fileList.value = fileList.value.filter((file) => file.uid !== uploadFile.uid)
}

const validateFile = (uploadFile, fileList, options) => {
  const rawFile = uploadFile.raw
  if (!rawFile) return false

  const fileName = rawFile.name.toLowerCase()
  const typeAccepted =
    options.mimeTypes.some((type) => rawFile.type.startsWith(type)) ||
    options.extensions.some((extension) => fileName.endsWith(extension))

  if (!typeAccepted) {
    removeInvalidFile(fileList, uploadFile)
    ElMessage.error(`${options.label}格式不受支持`)
    return false
  }

  if (rawFile.size > options.maxSize) {
    removeInvalidFile(fileList, uploadFile)
    ElMessage.error(`${options.label}大小不能超过 ${options.maxSizeLabel}`)
    return false
  }

  return true
}

const handleCoverChange = (uploadFile, uploadFiles) => {
  coverFileList.value = uploadFiles
  const isValid = validateFile(uploadFile, coverFileList, {
    label: '封面',
    mimeTypes: ['image/jpeg', 'image/png'],
    extensions: ['.jpg', '.jpeg', '.png'],
    maxSize: 500 * 1024,
    maxSizeLabel: '500KB'
  })

  if (!isValid) return

  revokeCoverPreview()
  coverPreviewUrl.value = URL.createObjectURL(uploadFile.raw)
}

const handleVideoChange = (uploadFile, uploadFiles) => {
  videoFileList.value = uploadFiles
  validateFile(uploadFile, videoFileList, {
    label: '视频',
    mimeTypes: ['video/'],
    extensions: ['.mp4', '.webm', '.mov'],
    maxSize: 10 * 1024 * 1024,
    maxSizeLabel: '10MB'
  })
}

const handleCopyChange = (uploadFile, uploadFiles) => {
  copyFileList.value = uploadFiles
  validateFile(uploadFile, copyFileList, {
    label: '课程文案',
    mimeTypes: ['text/plain', 'application/pdf', 'application/msword'],
    extensions: ['.txt', '.pdf', '.doc', '.docx'],
    maxSize: 5 * 1024 * 1024,
    maxSizeLabel: '5MB'
  })
}

const handleCoverRemove = () => {
  revokeCoverPreview()
}

const handlePreview = (uploadFile) => {
  ElMessage.info(`${uploadFile.name} 仅保留在当前浏览器，尚未上传服务器`)
}

const handleExceed = () => {
  ElMessage.warning('每类材料仅可选择 1 个文件，请先移除原文件')
}

const confirmHomework = () => {
  if (!form.value.questionType || !form.value.homeworkContent.trim()) {
    ElMessage.warning('请先选择题型并填写作业内容')
    return
  }

  homeworkConfirmed.value = true
  ElMessage.success('课后作业已加入当前课程草稿')
}

const handleSubmit = async () => {
  const isValid = await courseFormRef.value?.validate().catch(() => false)
  if (!isValid) {
    ElMessage.warning('请完善课程基本信息')
    return
  }

  if (coverFileList.value.length === 0 || videoFileList.value.length === 0) {
    ElMessage.warning('请选择课程封面和课程视频')
    return
  }

  isSubmitting.value = true

  try {
    submissionSummary.value = {
      title: form.value.title,
      category: form.value.category,
      files: [
        coverFileList.value[0]?.name,
        videoFileList.value[0]?.name,
        copyFileList.value[0]?.name
      ].filter(Boolean)
    }

    ElMessage.success('课程原型草稿已生成，所选文件尚未上传服务器')
  } finally {
    isSubmitting.value = false
  }
}

onUnmounted(revokeCoverPreview)
</script>

<template>
  <div class="mt-36 mx-auto py-3 px-5 max-w-[2000px] bg-primary rounded-3xl">
    <!-- 头部区域 -->
    <div class="flex items-center mb-5">
      <button
        type="button"
        class="mr-8 rounded-lg p-2 hover:bg-white"
        aria-label="返回上一页"
        @click="router.go(-1)"
      >
        <img class="w-8 h-8" src="@/assets/icon/left-arrow-key.svg" alt="" />
      </button>
      <div
        class="flex-1 flex items-center justify-center h-16 text-3xl font-bold rounded-2xl bg-white text-gray-500"
      >
        上传课程
      </div>
    </div>
    <!-- 设置课程相关内容区域 -->
    <div class="pl-16 pr-5 py-5 mb-5 bg-white rounded-3xl">
      <div class="flex flex-col gap-8 xl:flex-row">
        <!-- 左侧 -->
        <div class="basis-1/2 rounded-2xl overflow-hidden">
          <img
            v-if="coverPreviewUrl"
            class="w-full h-[520px]"
            :src="coverPreviewUrl"
            alt="已选择的课程封面预览"
          />
          <img
            v-else
            class="w-full h-[520px] object-cover"
            src="@/assets/student/onlineCourses/旅游.png"
            alt="课程封面占位图"
          />
        </div>
        <!-- 右侧 -->
        <div class="basis-1/2">
          <el-form
            ref="courseFormRef"
            :model="form"
            :rules="rules"
            label-width="88px"
          >
            <el-form-item label="课程标题" prop="title">
              <el-input v-model="form.title" />
            </el-form-item>
            <el-form-item label="课程分类" prop="category">
              <el-select v-model="form.category" placeholder="请选择课程分类">
                <el-option label="口语" value="speaking" />
                <el-option label="语法" value="grammar" />
                <el-option label="中华文化" value="culture" />
                <el-option label="HSK 备考" value="hsk" />
              </el-select>
            </el-form-item>
            <el-form-item label="上传封面">
              <el-upload
                v-model:file-list="coverFileList"
                class="upload-demo"
                :auto-upload="false"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                :on-change="handleCoverChange"
                :on-preview="handlePreview"
                :on-remove="handleCoverRemove"
                :limit="1"
                :on-exceed="handleExceed"
              >
                <el-button>上传封面</el-button>
                <template #tip>
                  <div class="el-upload__tip">
                    JPG/PNG，最大 500KB；文件仅在本地预览
                  </div>
                </template>
              </el-upload>
            </el-form-item>
            <el-form-item label="上传视频">
              <el-upload
                v-model:file-list="videoFileList"
                class="upload-demo"
                :auto-upload="false"
                accept="video/*,.mp4,.webm,.mov"
                :on-change="handleVideoChange"
                :on-preview="handlePreview"
                :limit="1"
                :on-exceed="handleExceed"
              >
                <el-button type="primary">上传视频</el-button>
                <template #tip>
                  <div class="el-upload__tip">
                    MP4/WebM/MOV，最大 10MB；不会自动上传
                  </div>
                </template>
              </el-upload>
            </el-form-item>
            <el-form-item label="上传文案">
              <el-upload
                v-model:file-list="copyFileList"
                class="upload-demo w-full"
                drag
                :auto-upload="false"
                accept=".txt,.pdf,.doc,.docx"
                :on-change="handleCopyChange"
                :on-preview="handlePreview"
                :limit="1"
                :on-exceed="handleExceed"
              >
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text">
                  拖拽文案到这里，或<em>点击选择</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    TXT/PDF/DOC/DOCX，最大 5MB；不会自动上传
                  </div>
                </template>
              </el-upload>
            </el-form-item>
            <el-form-item label="课程简介" prop="desc">
              <el-input v-model="form.desc" type="textarea" />
            </el-form-item>
            <el-form-item>
              <el-button
                type="success"
                :loading="isSubmitting"
                @click="handleSubmit"
              >
                生成课程草稿
              </el-button>
            </el-form-item>
          </el-form>
          <div
            v-if="submissionSummary"
            class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
            role="status"
          >
            <p class="font-semibold">
              “{{ submissionSummary.title }}”草稿已就绪
            </p>
            <p>分类：{{ submissionSummary.category }}</p>
            <p>本地文件：{{ submissionSummary.files.join('、') }}</p>
            <p class="mt-1">当前为前端原型，文件未发送到任何服务器。</p>
          </div>
        </div>
      </div>
    </div>
    <!-- 设置课后作业的区域 -->
    <div class="pl-16 pr-5 py-5 mb-5 bg-white rounded-3xl">
      <!-- 头部区域 -->
      <div class="flex items-center mb-5">
        <div
          class="mr-5 bg-primary text-gray-500 font-bold text-2xl rounded-2xl px-3 py-2"
        >
          设置课后作业
        </div>
        <div class="p-3 bg-primary rounded-full" aria-hidden="true">
          <img class="w-5 h-5" src="@/assets/icon/add.svg" alt="" />
        </div>
      </div>
      <!-- 内容区域 -->
      <div class="px-5 py-10 bg-gray-100 rounded-3xl">
        <el-form>
          <el-form-item label="选择题型">
            <el-select
              :style="{ width: '240px' }"
              v-model="form.questionType"
              placeholder="请选择题型"
            >
              <el-option label="选择题" value="choice" />
              <el-option label="填空题" value="fill" />
              <el-option label="简答题" value="short-answer" />
            </el-select>
          </el-form-item>
          <el-form-item label="作业内容">
            <el-input
              v-model="form.homeworkContent"
              type="textarea"
              :style="{ width: '480px' }"
              :rows="4"
              placeholder="请输入题目、选项或作答要求"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="confirmHomework">
              {{ homeworkConfirmed ? '已确认' : '确认加入草稿' }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
