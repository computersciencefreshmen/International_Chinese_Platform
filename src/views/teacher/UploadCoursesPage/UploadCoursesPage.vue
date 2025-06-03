<script setup>
import { ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
const form = ref({
  title: '',
  category: '',
  desc: ''
})
</script>

<template>
  <div class="mt-36 mx-auto py-3 px-5 max-w-[2000px] bg-primary rounded-3xl">
    <!-- 头部区域 -->
    <div class="flex items-center mb-5">
      <div class="mr-8">
        <img class="w-8 h-8" src="/src/assets/icon/left-arrow-key.svg" alt="" />
      </div>
      <div
        class="flex-1 flex items-center justify-center h-16 text-3xl font-bold rounded-2xl bg-white text-gray-500"
      >
        上传课程
      </div>
    </div>
    <!-- 设置课程相关内容区域 -->
    <div class="pl-16 pr-5 py-5 mb-5 bg-white rounded-3xl">
      <div class="flex">
        <!-- 左侧 -->
        <div class="basis-1/2 mr-12 rounded-2xl overflow-hidden">
          <img
            class="w-full h-[520px]"
            src="/src/assets/student/onlineCourses/旅游.png"
            alt=""
          />
        </div>
        <!-- 右侧 -->
        <div class="basis-1/2">
          <el-form>
            <el-form-item label="课程标题">
              <el-input v-model="form.title" />
            </el-form-item>
            <el-form-item label="课程分类">
              <el-select v-model="form.category" placeholder="请选择课程分类">
                <el-option label="日语" value="Japanese" />
                <el-option label="英语" value="English" />
              </el-select>
            </el-form-item>
            <el-form-item label="上传封面">
              <el-upload
                v-model:file-list="fileList"
                class="upload-demo"
                action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15"
                multiple
                :on-preview="handlePreview"
                :on-remove="handleRemove"
                :before-remove="beforeRemove"
                :limit="3"
                :on-exceed="handleExceed"
              >
                <el-button>上传封面</el-button>
                <template #tip>
                  <div class="el-upload__tip">jpg/png文件大小不应大于500KB</div>
                </template>
              </el-upload>
            </el-form-item>
            <el-form-item label="上传视频">
              <el-upload
                v-model:file-list="fileList"
                class="upload-demo"
                action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15"
                multiple
                :on-preview="handlePreview"
                :on-remove="handleRemove"
                :before-remove="beforeRemove"
                :limit="3"
                :on-exceed="handleExceed"
              >
                <el-button type="primary">上传视频</el-button>
                <template #tip>
                  <div class="el-upload__tip">视频文件大小不应大于10MB</div>
                </template>
              </el-upload>
            </el-form-item>
            <el-form-item label="上传文案">
              <el-upload
                class="upload-demo w-full"
                drag
                action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15"
                multiple
              >
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text">
                  Drop file here or <em>click to upload</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    jpg/png files with a size less than 500kb
                  </div>
                </template>
              </el-upload>
            </el-form-item>
            <el-form-item label="课程简介">
              <el-input v-model="form.desc" type="textarea" />
            </el-form-item>
            <el-form-item>
              <el-button type="success">提交</el-button>
            </el-form-item>
          </el-form>
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
        <div class="p-3 bg-primary rounded-full">
          <img class="w-5 h-5" src="/src/assets/icon/add.svg" alt="" />
        </div>
      </div>
      <!-- 内容区域 -->
      <div class="px-5 py-10 bg-gray-100 rounded-3xl">
        <el-form>
          <el-form-item label="选择题型">
            <el-select
              :style="{ width: '240px' }"
              v-model="form.region"
              placeholder="please select your zone"
            >
              <el-option label="Zone one" value="shanghai" />
              <el-option label="Zone two" value="beijing" />
            </el-select>
          </el-form-item>
          <el-form-item label="上传图片">
            <el-input
              v-model="form.name"
              type="textarea"
              :style="{ width: '480px' }"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary">确认</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
