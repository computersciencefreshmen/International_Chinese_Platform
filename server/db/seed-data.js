import { Buffer } from 'node:buffer'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_N = 2 ** 14
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024

export const DEMO_PASSWORD = 'Demo123!'

export const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({
    id: '00000000-0000-4000-8000-000000000001',
    email: 'student@example.com',
    role: 'student',
    displayName: '林晓雨'
  }),
  Object.freeze({
    id: '00000000-0000-4000-8000-000000000002',
    email: 'teacher@example.com',
    role: 'teacher',
    displayName: '王老师'
  }),
  Object.freeze({
    id: '00000000-0000-4000-8000-000000000003',
    email: 'admin@example.com',
    role: 'administrator',
    displayName: '平台管理员'
  })
])

export const DEMO_IDS = Object.freeze({
  publishedCourse: '10000000-0000-4000-8000-000000000001',
  pendingCourse: '10000000-0000-4000-8000-000000000002',
  review: '20000000-0000-4000-8000-000000000001',
  acceptedAppointment: '30000000-0000-4000-8000-000000000001',
  pendingAppointment: '30000000-0000-4000-8000-000000000002',
  classroom: '40000000-0000-4000-8000-000000000001',
  assignment: '50000000-0000-4000-8000-000000000001',
  questionChoice: '60000000-0000-4000-8000-000000000001',
  questionText: '60000000-0000-4000-8000-000000000002',
  submission: '70000000-0000-4000-8000-000000000001',
  message: '80000000-0000-4000-8000-000000000001',
  studentNotification: '90000000-0000-4000-8000-000000000001',
  teacherNotification: '90000000-0000-4000-8000-000000000002',
  auditLog: 'a0000000-0000-4000-8000-000000000001'
})

/**
 * Create a self-describing scrypt password hash.
 *
 * Format: scrypt$N$r$p$keyLength$base64url(salt)$base64url(digest)
 */
export function hashPassword(password, salt = randomBytes(16)) {
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new TypeError('Password must contain between 8 and 128 characters')
  }

  const digest = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY
  })

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    SCRYPT_KEY_LENGTH,
    salt.toString('base64url'),
    digest.toString('base64url')
  ].join('$')
}

export function verifyPasswordHash(password, encodedHash) {
  if (typeof password !== 'string' || typeof encodedHash !== 'string') {
    return false
  }

  const [algorithm, n, r, p, keyLength, saltValue, digestValue, extra] =
    encodedHash.split('$')
  const parameters = [n, r, p, keyLength].map(Number)

  if (
    algorithm !== 'scrypt' ||
    extra !== undefined ||
    parameters.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    parameters[0] > SCRYPT_N ||
    parameters[1] > SCRYPT_R ||
    parameters[2] > SCRYPT_P ||
    parameters[3] > SCRYPT_KEY_LENGTH
  ) {
    return false
  }

  try {
    const salt = Buffer.from(saltValue, 'base64url')
    const expected = Buffer.from(digestValue, 'base64url')

    if (salt.length < 16 || expected.length !== parameters[3]) {
      return false
    }

    const actual = scryptSync(password, salt, parameters[3], {
      N: parameters[0],
      r: parameters[1],
      p: parameters[2],
      maxmem: SCRYPT_MAX_MEMORY
    })

    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

async function insertUsers(database) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO users (
      id, email, password_hash, role, display_name, country, region, age,
      chinese_level, bio, status, created_at, updated_at
    ) VALUES (
      @id, @email, @passwordHash, @role, @displayName, @country, @region, @age,
      @chineseLevel, @bio, 'active', @createdAt, @updatedAt
    )
  `)

  const profiles = {
    student: {
      country: 'France',
      region: 'Île-de-France',
      age: 22,
      chineseLevel: 'HSK 3',
      bio: '热爱旅行和中国文化的中文学习者。'
    },
    teacher: {
      country: 'China',
      region: 'Beijing',
      age: 34,
      chineseLevel: '母语',
      bio: '专注国际中文教育与跨文化口语教学。'
    },
    administrator: {
      country: 'China',
      region: 'Shanghai',
      age: 30,
      chineseLevel: '母语',
      bio: '负责课程质量审核与平台运营。'
    }
  }

  for (const account of DEMO_ACCOUNTS) {
    await insert.run({
      ...account,
      ...profiles[account.role],
      passwordHash: hashPassword(DEMO_PASSWORD),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z'
    })
  }

  const userIds = {}
  for (const account of DEMO_ACCOUNTS) {
    const row = await database
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(account.email)
    if (!row) {
      throw new Error(`Unable to resolve seeded account: ${account.email}`)
    }
    userIds[account.role] = row.id
  }
  return userIds
}

async function insertCourses(database, userIds) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO courses (
      id, teacher_id, title, summary, description, level, category, cover_url,
      duration_minutes, price_cents, capacity, status, rejection_reason,
      published_at, created_at, updated_at
    ) VALUES (
      @id, @teacherId, @title, @summary, @description, @level, @category, NULL,
      @durationMinutes, @priceCents, @capacity, @status, NULL,
      @publishedAt, @createdAt, @updatedAt
    )
  `)

  await insert.run({
    id: DEMO_IDS.publishedCourse,
    teacherId: userIds.teacher,
    title: '生活汉语入门',
    summary: '从真实生活场景开始，自信完成问候、点餐、购物与出行对话。',
    description:
      '面向初学者的结构化课程，包含情景会话、发音训练、文化提示与课后练习。',
    level: 'beginner',
    category: '综合汉语',
    durationMinutes: 45,
    priceCents: 9900,
    capacity: 20,
    status: 'published',
    publishedAt: '2026-04-08T09:30:00.000Z',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-08T09:30:00.000Z'
  })

  await insert.run({
    id: DEMO_IDS.pendingCourse,
    teacherId: userIds.teacher,
    title: '中国文化与口语表达',
    summary: '围绕节日、饮食与城市生活开展中级口语讨论。',
    description: '通过主题材料和课堂任务训练观点表达、追问与跨文化沟通。',
    level: 'intermediate',
    category: '文化口语',
    durationMinutes: 60,
    priceCents: 12900,
    capacity: 16,
    status: 'pending',
    publishedAt: null,
    createdAt: '2026-07-10T03:00:00.000Z',
    updatedAt: '2026-07-15T05:00:00.000Z'
  })

  await database
    .prepare(
      `
      INSERT OR IGNORE INTO course_reviews (
        id, course_id, reviewer_id, decision, review_note, created_at
      ) VALUES (?, ?, ?, 'approved', ?, ?)
    `
    )
    .run(
      DEMO_IDS.review,
      DEMO_IDS.publishedCourse,
      userIds.administrator,
      '课程目标、内容结构和演示材料完整，同意发布。',
      '2026-04-08T09:30:00.000Z'
    )
}

async function insertTeacherProfile(database, userIds) {
  await database
    .prepare(
      `
      INSERT OR IGNORE INTO teacher_profiles (
        user_id, school, title, experience_years, rating, hourly_rate_cents,
        specialties_json, certificates_json, teaching_style_json,
        languages_json, verified_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      userIds.teacher,
      '北京语言大学',
      '国际中文教育讲师',
      8,
      4.9,
      18800,
      JSON.stringify(['生活口语', 'HSK 备考', '中国文化']),
      JSON.stringify(['国际中文教师证书', '普通话一级乙等']),
      JSON.stringify(['耐心引导', '情景教学', '即时反馈']),
      JSON.stringify(['中文', '英语']),
      '2026-03-15T08:00:00.000Z',
      '2026-03-15T08:00:00.000Z',
      '2026-07-01T00:00:00.000Z'
    )
}

async function insertAppointments(database, userIds) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO appointments (
      id, student_id, teacher_id, course_id, scheduled_start, scheduled_end,
      topic, message, status, response_note, created_at, updated_at
    ) VALUES (
      @id, @studentId, @teacherId, @courseId, @scheduledStart, @scheduledEnd,
      @topic, @message, @status, @responseNote, @createdAt, @updatedAt
    )
  `)

  await insert.run({
    id: DEMO_IDS.acceptedAppointment,
    studentId: userIds.student,
    teacherId: userIds.teacher,
    courseId: DEMO_IDS.publishedCourse,
    scheduledStart: '2026-07-25T10:00:00.000Z',
    scheduledEnd: '2026-07-25T10:45:00.000Z',
    topic: '餐厅点餐情景练习',
    message: '希望重点练习忌口说明和结账表达。',
    status: 'accepted',
    responseNote: '已准备菜单图片和角色卡，课堂见。',
    createdAt: '2026-07-16T08:00:00.000Z',
    updatedAt: '2026-07-16T09:00:00.000Z'
  })

  await insert.run({
    id: DEMO_IDS.pendingAppointment,
    studentId: userIds.student,
    teacherId: userIds.teacher,
    courseId: DEMO_IDS.publishedCourse,
    scheduledStart: '2026-08-01T10:00:00.000Z',
    scheduledEnd: '2026-08-01T10:45:00.000Z',
    topic: '城市问路与交通',
    message: '想练习地铁换乘和向路人确认方向。',
    status: 'pending',
    responseNote: '',
    createdAt: '2026-07-18T08:00:00.000Z',
    updatedAt: '2026-07-18T08:00:00.000Z'
  })

  await database
    .prepare(
      `
      INSERT OR IGNORE INTO classrooms (
        id, appointment_id, room_code, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'scheduled', ?, ?)
    `
    )
    .run(
      DEMO_IDS.classroom,
      DEMO_IDS.acceptedAppointment,
      'demo-classroom-01',
      '2026-07-16T09:00:00.000Z',
      '2026-07-16T09:00:00.000Z'
    )
}

async function insertAssignments(database, userIds) {
  await database
    .prepare(
      `
      INSERT OR IGNORE INTO assignments (
        id, course_id, teacher_id, title, instructions, due_at, max_score,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 100, 'published', ?, ?)
    `
    )
    .run(
      DEMO_IDS.assignment,
      DEMO_IDS.publishedCourse,
      userIds.teacher,
      '第一单元：生活场景表达',
      '完成选择题，并用两到三句话介绍一次点餐经历。',
      '2026-08-05T15:59:59.000Z',
      '2026-07-12T02:00:00.000Z',
      '2026-07-12T02:00:00.000Z'
    )

  const insertQuestion = database.prepare(`
    INSERT OR IGNORE INTO assignment_questions (
      id, assignment_id, position, question_type, prompt, options_json,
      correct_answer_json, points, explanation
    ) VALUES (
      @id, @assignmentId, @position, @questionType, @prompt, @optionsJson,
      @correctAnswerJson, @points, @explanation
    )
  `)

  await insertQuestion.run({
    id: DEMO_IDS.questionChoice,
    assignmentId: DEMO_IDS.assignment,
    position: 1,
    questionType: 'single_choice',
    prompt: '服务员问“您想喝点儿什么？”时，哪一个回答最自然？',
    optionsJson: JSON.stringify([
      '我喝了茶',
      '请给我一杯茶',
      '茶在桌子上',
      '他喜欢喝茶'
    ]),
    correctAnswerJson: JSON.stringify('请给我一杯茶'),
    points: 40,
    explanation: '“请给我……”可以礼貌地提出点单需求。'
  })

  await insertQuestion.run({
    id: DEMO_IDS.questionText,
    assignmentId: DEMO_IDS.assignment,
    position: 2,
    questionType: 'text',
    prompt: '请用两到三句话介绍一次点餐经历。',
    optionsJson: null,
    correctAnswerJson: null,
    points: 60,
    explanation: '注意使用时间、菜名和感受等信息。'
  })

  await database
    .prepare(
      `
      INSERT OR IGNORE INTO submissions (
        id, assignment_id, student_id, answers_json, status, submitted_at,
        score, feedback, graded_by, graded_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'graded', ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      DEMO_IDS.submission,
      DEMO_IDS.assignment,
      userIds.student,
      JSON.stringify({
        [DEMO_IDS.questionChoice]: '请给我一杯茶',
        [DEMO_IDS.questionText]:
          '上周我去了一家川菜馆。我点了鱼香肉丝，味道很好，但是有一点儿辣。'
      }),
      '2026-07-14T10:00:00.000Z',
      92,
      '表达完整自然；可以继续练习“少放辣椒”等具体要求。',
      userIds.teacher,
      '2026-07-15T08:30:00.000Z',
      '2026-07-14T09:45:00.000Z',
      '2026-07-15T08:30:00.000Z'
    )
}

async function insertSupportingData(database, userIds) {
  await database
    .prepare(
      `
      INSERT OR IGNORE INTO chat_messages (
        id, classroom_id, sender_id, message_type, content, metadata_json,
        client_message_id, created_at
      ) VALUES (?, ?, ?, 'text', ?, '{}', ?, ?)
    `
    )
    .run(
      DEMO_IDS.message,
      DEMO_IDS.classroom,
      userIds.teacher,
      '欢迎来到演示课堂，我们将先从菜单词汇开始。',
      'seed-welcome-message',
      '2026-07-16T09:01:00.000Z'
    )

  const insertNotification = database.prepare(`
    INSERT OR IGNORE INTO notifications (
      id, user_id, type, title, body, resource_type, resource_id, link,
      dedupe_key, created_at
    ) VALUES (
      @id, @userId, @type, @title, @body, @resourceType, @resourceId, @link,
      @dedupeKey, @createdAt
    )
  `)

  await insertNotification.run({
    id: DEMO_IDS.studentNotification,
    userId: userIds.student,
    type: 'appointment.accepted',
    title: '预约已接受',
    body: '王老师已接受“餐厅点餐情景练习”预约。',
    resourceType: 'appointment',
    resourceId: DEMO_IDS.acceptedAppointment,
    link: `/student/liveClass?classroomId=${DEMO_IDS.classroom}`,
    dedupeKey: `appointment:${DEMO_IDS.acceptedAppointment}:accepted:student`,
    createdAt: '2026-07-16T09:00:00.000Z'
  })

  await insertNotification.run({
    id: DEMO_IDS.teacherNotification,
    userId: userIds.teacher,
    type: 'appointment.requested',
    title: '新的课程预约',
    body: '林晓雨预约了“城市问路与交通”练习。',
    resourceType: 'appointment',
    resourceId: DEMO_IDS.pendingAppointment,
    link: '/teacher/teachingDocking',
    dedupeKey: `appointment:${DEMO_IDS.pendingAppointment}:requested:teacher`,
    createdAt: '2026-07-18T08:00:00.000Z'
  })

  await database
    .prepare(
      `
      INSERT OR IGNORE INTO audit_logs (
        id, actor_id, action, entity_type, entity_id, details_json, created_at
      ) VALUES (?, ?, 'course.approved', 'course', ?, ?, ?)
    `
    )
    .run(
      DEMO_IDS.auditLog,
      userIds.administrator,
      DEMO_IDS.publishedCourse,
      JSON.stringify({
        source: 'demo-seed',
        previousStatus: 'pending',
        nextStatus: 'published'
      }),
      '2026-04-08T09:30:00.000Z'
    )
}

export async function seedDatabase(database) {
  if (!database || typeof database.prepare !== 'function') {
    throw new TypeError('seedDatabase requires an open PostgreSQL database')
  }

  const seed = database.transaction(async () => {
    const userIds = await insertUsers(database)
    await insertTeacherProfile(database, userIds)
    await insertCourses(database, userIds)
    await insertAppointments(database, userIds)
    await insertAssignments(database, userIds)
    await insertSupportingData(database, userIds)
  })

  await seed()

  return {
    users: (await database.prepare('SELECT COUNT(*) AS count FROM users').get())
      .count,
    courses: (
      await database.prepare('SELECT COUNT(*) AS count FROM courses').get()
    ).count,
    appointments: (
      await database.prepare('SELECT COUNT(*) AS count FROM appointments').get()
    ).count,
    assignments: (
      await database.prepare('SELECT COUNT(*) AS count FROM assignments').get()
    ).count,
    submissions: (
      await database.prepare('SELECT COUNT(*) AS count FROM submissions').get()
    ).count
  }
}
