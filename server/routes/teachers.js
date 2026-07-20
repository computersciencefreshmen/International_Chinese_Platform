import { z } from 'zod'

const teacherListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(100).optional(),
  specialty: z.string().trim().max(80).optional(),
  minRating: z.coerce.number().min(0).max(5).optional()
})

function responseData(reply, data, message = '操作成功', statusCode = 200) {
  return reply.code(statusCode).send({
    code: 0,
    msg: message,
    data
  })
}

function responseError(reply, statusCode, message, data = null) {
  return reply.code(statusCode).send({
    code: statusCode,
    msg: message,
    data
  })
}

function validationError(reply, result) {
  return responseError(reply, 400, '请求参数不正确', {
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }))
  })
}

function parseJsonArray(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function teacherData(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? null,
    country: row.country ?? null,
    region: row.region ?? null,
    bio: row.bio ?? '',
    school: row.school ?? '',
    title: row.title ?? '',
    experienceYears: Number(row.experience_years ?? 0),
    rating: Number(row.rating ?? 5),
    hourlyRateCents: Number(row.hourly_rate_cents ?? 0),
    specialties: parseJsonArray(row.specialties_json),
    certificates: parseJsonArray(row.certificates_json),
    teachingStyle: parseJsonArray(row.teaching_style_json),
    languages: parseJsonArray(row.languages_json),
    verified: Boolean(row.verified_at),
    verifiedAt: row.verified_at ?? null,
    publishedCourseCount: Number(row.published_course_count ?? 0)
  }
}

function courseData(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    level: row.level,
    category: row.category,
    coverUrl: row.cover_url ?? null,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    capacity: row.capacity,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const teacherSelect = `
  SELECT
    u.id,
    u.display_name,
    u.avatar_url,
    u.country,
    u.region,
    u.bio,
    tp.school,
    tp.title,
    tp.experience_years,
    tp.rating,
    tp.hourly_rate_cents,
    tp.specialties_json,
    tp.certificates_json,
    tp.teaching_style_json,
    tp.languages_json,
    tp.verified_at,
    COUNT(c.id) AS published_course_count
  FROM users AS u
  LEFT JOIN teacher_profiles AS tp ON tp.user_id = u.id
  LEFT JOIN courses AS c
    ON c.teacher_id = u.id
   AND c.status = 'published'
`

export async function teacherRoutes(app) {
  const db = app.db
  if (!db) {
    throw new Error('teacherRoutes requires app.db')
  }

  app.get('/api/v1/teachers', async (request, reply) => {
    const result = teacherListQuerySchema.safeParse(request.query ?? {})
    if (!result.success) {
      return validationError(reply, result)
    }

    const { page, pageSize, search, specialty, minRating } = result.data
    const conditions = [
      "u.role = 'teacher'",
      "u.status = 'active'",
      'tp.verified_at IS NOT NULL'
    ]
    const parameters = []

    if (search) {
      const pattern = `%${search}%`
      conditions.push(`(
        u.display_name LIKE ?
        OR COALESCE(u.bio, '') LIKE ?
        OR COALESCE(tp.school, '') LIKE ?
        OR COALESCE(tp.title, '') LIKE ?
      )`)
      parameters.push(pattern, pattern, pattern, pattern)
    }

    if (specialty) {
      conditions.push("COALESCE(tp.specialties_json, '[]') LIKE ?")
      parameters.push(`%${specialty}%`)
    }

    if (minRating !== undefined) {
      conditions.push('COALESCE(tp.rating, 5) >= ?')
      parameters.push(minRating)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const total = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM users AS u
         LEFT JOIN teacher_profiles AS tp ON tp.user_id = u.id
         ${where}`
      )
      .get(...parameters).count
    const offset = (page - 1) * pageSize
    const rows = db
      .prepare(
        `${teacherSelect}
         ${where}
         GROUP BY u.id
         ORDER BY
           COALESCE(tp.rating, 5) DESC,
           COALESCE(tp.experience_years, 0) DESC,
           u.display_name COLLATE NOCASE ASC,
           u.id ASC
         LIMIT ? OFFSET ?`
      )
      .all(...parameters, pageSize, offset)

    return responseData(reply, {
      items: rows.map(teacherData),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
      }
    })
  })

  app.get('/api/v1/teachers/:id', async (request, reply) => {
    const teacher = db
      .prepare(
        `${teacherSelect}
         WHERE u.id = ?
           AND u.role = 'teacher'
           AND u.status = 'active'
           AND tp.verified_at IS NOT NULL
         GROUP BY u.id
         LIMIT 1`
      )
      .get(request.params.id)

    if (!teacher) {
      return responseError(reply, 404, '教师不存在')
    }

    const courses = db
      .prepare(
        `SELECT
          id, title, summary, description, level, category, cover_url,
          duration_minutes, price_cents, capacity, published_at,
          created_at, updated_at
        FROM courses
        WHERE teacher_id = ? AND status = 'published'
        ORDER BY published_at DESC, created_at DESC, id ASC`
      )
      .all(teacher.id)

    return responseData(reply, {
      ...teacherData(teacher),
      courses: courses.map(courseData)
    })
  })
}

export default teacherRoutes
