const db = require("../db")
const { validationResult } = require("express-validator")

exports.getAllCourses = async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      level = "",
      skill = "",
      price_min = 0,
      price_max = 10000000,
      sort = "newest",
      page = 1,
      limit = 12,
    } = req.query

    const offset = (page - 1) * limit

    let query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_picture as instructor_picture,
      COUNT(DISTINCT ucr.user_id) as student_count,
      COALESCE(AVG(cr.rating), 0) as average_rating,
      COUNT(DISTINCT cr.review_id) as review_count
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      LEFT JOIN user_courses ucr ON c.course_id = ucr.course_id
      LEFT JOIN course_reviews cr ON c.course_id = cr.course_id
    `

    if (category) {
      query += `
        JOIN course_category_mappings ccm ON c.course_id = ccm.course_id
        JOIN course_categories cc ON ccm.category_id = cc.category_id
      `
    }

    const conditions = ["c.is_published = true"]
    const queryParams = []

    if (search) {
      conditions.push("(c.title ILIKE $1 OR c.description ILIKE $1)")
      queryParams.push(`%${search}%`)
    }

    if (category) {
      conditions.push("cc.category_id = $" + (queryParams.length + 1))
      queryParams.push(category)
    }

    if (level) {
      conditions.push("c.difficulty_level = $" + (queryParams.length + 1))
      queryParams.push(level)
    }

    if (skill) {
      conditions.push("c.language_skill = $" + (queryParams.length + 1))
      queryParams.push(skill)
    }

    conditions.push("c.price >= $" + (queryParams.length + 1))
    queryParams.push(price_min)

    conditions.push("c.price <= $" + (queryParams.length + 1))
    queryParams.push(price_max)

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ")
    }

    query += " GROUP BY c.course_id, u.user_id"

    switch (sort) {
      case "newest":
        query += " ORDER BY c.created_at DESC"
        break
      case "price_low":
        query += " ORDER BY c.price ASC"
        break
      case "price_high":
        query += " ORDER BY c.price DESC"
        break
      case "popular":
        query += " ORDER BY student_count DESC"
        break
      case "rating":
        query += " ORDER BY average_rating DESC"
        break
      default:
        query += " ORDER BY c.created_at DESC"
    }

    query += ` LIMIT ${limit} OFFSET ${offset}`

    const { rows: courses } = await db.query(query, queryParams)

    // Chuyển đổi price và các trường số khác
    const formattedCourses = courses.map((course) => ({
      ...course,
      price: Number.parseFloat(course.price), // Chuyển price thành số
      average_rating: Number.parseFloat(course.average_rating),
      student_count: Number.parseInt(course.student_count),
    }))

    let countQuery = `
      SELECT COUNT(DISTINCT c.course_id) as total_count
      FROM courses c
    `

    if (category) {
      countQuery += `
        JOIN course_category_mappings ccm ON c.course_id = ccm.course_id
        JOIN course_categories cc ON ccm.category_id = cc.category_id
      `
    }

    if (conditions.length > 0) {
      countQuery += " WHERE " + conditions.join(" AND ")
    }

    const { rows: countResult } = await db.query(countQuery, queryParams)
    const total = Number.parseInt(countResult[0].total_count)

    return res.status(200).json({
      success: true,
      courses: formattedCourses,
      pagination: {
        total,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total_pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching courses:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải danh sách khóa học",
    })
  }
}

// Lấy chi tiết khóa học
exports.getCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.params

    // Validate courseId
    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "ID khóa học không được để trống.",
      })
    }

    // Clean and validate courseId
    const cleanCourseId = courseId.toString().replace(/[^0-9]/g, "")

    if (!cleanCourseId || isNaN(Number.parseInt(cleanCourseId))) {
      return res.status(400).json({
        success: false,
        message: "ID khóa học không hợp lệ. Vui lòng cung cấp một số nguyên.",
      })
    }

    console.log("Getting course details for ID:", cleanCourseId)

    const courseQuery = `
      SELECT c.*, 
        u.first_name, u.last_name, u.profile_picture as instructor_picture, u.bio as instructor_bio,
        COUNT(DISTINCT ucr.user_id) as student_count,
        COALESCE(AVG(cr.rating), 0) as average_rating,
        COUNT(DISTINCT cr.review_id) as review_count
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      LEFT JOIN user_courses ucr ON c.course_id = ucr.course_id
      LEFT JOIN course_reviews cr ON c.course_id = cr.course_id
      WHERE c.course_id = $1 AND c.is_published = true
      GROUP BY c.course_id, u.user_id
    `

    const { rows: courseData } = await db.query(courseQuery, [cleanCourseId])

    if (courseData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khóa học hoặc khóa học chưa được xuất bản",
      })
    }

    const course = courseData[0]
    console.log("Course data in getCourseDetails:", course)

    const modulesQuery = `
      SELECT m.*, COUNT(l.lesson_id) as lesson_count
      FROM modules m
      LEFT JOIN lessons l ON m.module_id = l.module_id
      WHERE m.course_id = $1
      GROUP BY m.module_id
      ORDER BY m.position
    `

    const { rows: modules } = await db.query(modulesQuery, [cleanCourseId])

    for (const module of modules) {
      const lessonsQuery = `
        SELECT lesson_id, title, description, duration_minutes, position
        FROM lessons
        WHERE module_id = $1
        ORDER BY position
      `

      const { rows: lessons } = await db.query(lessonsQuery, [module.module_id])
      module.lessons = lessons
    }

    const categoriesQuery = `
      SELECT cc.category_id, cc.name, cc.description
      FROM course_categories cc
      JOIN course_category_mappings ccm ON cc.category_id = ccm.category_id
      WHERE ccm.course_id = $1
    `

    const { rows: categories } = await db.query(categoriesQuery, [cleanCourseId])

    const reviewsQuery = `
      SELECT cr.*, u.first_name, u.last_name, u.profile_picture
      FROM course_reviews cr
      JOIN users u ON cr.user_id = u.user_id
      WHERE cr.course_id = $1
      ORDER BY cr.created_at DESC
      LIMIT 10
    `

    const { rows: reviews } = await db.query(reviewsQuery, [cleanCourseId])

    let isEnrolled = false
    if (req.user) {
      const enrollmentQuery = `
        SELECT * FROM user_courses
        WHERE user_id = $1 AND course_id = $2
      `

      const { rows: enrollment } = await db.query(enrollmentQuery, [req.user.user_id, cleanCourseId])
      isEnrolled = enrollment.length > 0
    }

    return res.status(200).json({
      success: true,
      course: {
        ...course,
        price: Number.parseFloat(course.price),
        average_rating: Number.parseFloat(course.average_rating),
        student_count: Number.parseInt(course.student_count),
        modules,
        categories,
        reviews,
        isEnrolled,
      },
    })
  } catch (error) {
    console.error("Error fetching course details:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải thông tin khóa học",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// In courseController.js

exports.getCourseLearnDetails = async (req, res) => {
  try {
    const { courseId } = req.params
    const userId = req.user.user_id

    // Validate courseId
    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: "ID khóa học không hợp lệ. Vui lòng cung cấp một số nguyên.",
      })
    }

    // Fetch course details
    const courseQuery = `
      SELECT c.*, 
        u.first_name, u.last_name, u.profile_picture as instructor_picture,
        COUNT(DISTINCT ucr.user_id) as student_count,
        COALESCE(AVG(cr.rating), 0) as average_rating,
        COUNT(DISTINCT cr.review_id) as review_count
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      LEFT JOIN user_courses ucr ON c.course_id = ucr.course_id
      LEFT JOIN course_reviews cr ON c.course_id = cr.course_id
      WHERE c.course_id = $1 AND c.is_published = true
      GROUP BY c.course_id, u.user_id
    `
    const { rows: courseData } = await db.query(courseQuery, [courseId])

    if (courseData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khóa học hoặc khóa học chưa được xuất bản",
      })
    }

    const course = courseData[0]

    // Fetch modules and lessons
    const modulesQuery = `
      SELECT m.*, COUNT(l.lesson_id) as lesson_count
      FROM modules m
      LEFT JOIN lessons l ON m.module_id = l.module_id
      WHERE m.course_id = $1
      GROUP BY m.module_id
      ORDER BY m.position
    `
    const { rows: modules } = await db.query(modulesQuery, [courseId])

    for (const module of modules) {
      const lessonsQuery = `
        SELECT l.*, 
          ul.is_completed, 
          ul.progress_percentage, 
          ul.last_accessed_at, 
          ul.notes
        FROM lessons l
        LEFT JOIN user_lessons ul ON l.lesson_id = ul.lesson_id AND ul.user_id = $2
        WHERE l.module_id = $1
        ORDER BY l.position
      `
      const { rows: lessons } = await db.query(lessonsQuery, [module.module_id, userId])
      module.lessons = lessons
    }

    // Fetch user progress for the course
    const progressQuery = `
      SELECT progress_percentage, last_accessed_at, is_completed
      FROM user_courses
      WHERE user_id = $1 AND course_id = $2
    `
    const { rows: progressData } = await db.query(progressQuery, [userId, courseId])

    if (progressData.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Bạn chưa đăng ký khóa học này",
      })
    }

    return res.status(200).json({
      success: true,
      course: {
        ...course,
        price: Number.parseFloat(course.price),
        average_rating: Number.parseFloat(course.average_rating),
        student_count: Number.parseInt(course.student_count),
        modules,
        progress_percentage: Number.parseFloat(progressData[0].progress_percentage),
        last_accessed_at: progressData[0].last_accessed_at,
        is_completed: progressData[0].is_completed,
      },
    })
  } catch (error) {
    console.error("Error fetching course learn details:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải thông tin khóa học để học",
    })
  }
}

// In courseController.js

// Fetch lesson resources
exports.getLessonResources = async (req, res) => {
  try {
    const { lessonId } = req.params

    const resourcesQuery = `
      SELECT * FROM resources
      WHERE lesson_id = $1
      ORDER BY created_at
    `
    const { rows: resources } = await db.query(resourcesQuery, [lessonId])

    return res.status(200).json({
      success: true,
      resources,
    })
  } catch (error) {
    console.error("Error fetching lesson resources:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải tài nguyên bài học",
    })
  }
}

// Fetch lesson notes
exports.getLessonNotes = async (req, res) => {
  try {
    const { lessonId } = req.params
    const userId = req.user.user_id

    // Notes are stored in the user_lessons table
    const notesQuery = `
      SELECT notes
      FROM user_lessons
      WHERE lesson_id = $1 AND user_id = $2
    `
    const { rows: notesData } = await db.query(notesQuery, [lessonId, userId])

    const notes = notesData[0]?.notes ? JSON.parse(notesData[0].notes) : []

    return res.status(200).json({
      success: true,
      notes,
    })
  } catch (error) {
    console.error("Error fetching lesson notes:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải ghi chú bài học",
    })
  }
}

// Save lesson note
exports.saveLessonNote = async (req, res) => {
  try {
    const { lessonId } = req.params
    const userId = req.user.user_id
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nội dung ghi chú không được để trống",
      })
    }

    // Fetch existing notes
    const existingNotesQuery = `
      SELECT notes
      FROM user_lessons
      WHERE lesson_id = $1 AND user_id = $2
    `
    const { rows: existingNotesData } = await db.query(existingNotesQuery, [lessonId, userId])

    let notesArray = []
    if (existingNotesData.length > 0 && existingNotesData[0].notes) {
      notesArray = JSON.parse(existingNotesData[0].notes)
    }

    const newNote = {
      note_id: Date.now(), // Simple ID generation; consider using a proper UUID in production
      content,
      created_at: new Date().toISOString(),
    }
    notesArray.push(newNote)

    // Update or insert notes
    const upsertNotesQuery = `
      INSERT INTO user_lessons (user_id, lesson_id, notes)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET notes = $3
      RETURNING *
    `
    await db.query(upsertNotesQuery, [userId, lessonId, JSON.stringify(notesArray)])

    return res.status(200).json({
      success: true,
      note: newNote,
    })
  } catch (error) {
    console.error("Error saving lesson note:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi lưu ghi chú",
    })
  }
}

// Delete lesson note
exports.deleteLessonNote = async (req, res) => {
  try {
    const { lessonId, noteId } = req.params
    const userId = req.user.user_id

    // Fetch existing notes
    const existingNotesQuery = `
      SELECT notes
      FROM user_lessons
      WHERE lesson_id = $1 AND user_id = $2
    `
    const { rows: existingNotesData } = await db.query(existingNotesQuery, [lessonId, userId])

    if (existingNotesData.length === 0 || !existingNotesData[0].notes) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy ghi chú",
      })
    }

    let notesArray = JSON.parse(existingNotesData[0].notes)
    notesArray = notesArray.filter((note) => note.note_id !== Number.parseInt(noteId))

    // Update notes
    const updateNotesQuery = `
      UPDATE user_lessons
      SET notes = $3
      WHERE lesson_id = $1 AND user_id = $2
    `
    await db.query(updateNotesQuery, [lessonId, userId, JSON.stringify(notesArray)])

    return res.status(200).json({
      success: true,
      message: "Đã xóa ghi chú thành công",
    })
  } catch (error) {
    console.error("Error deleting lesson note:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi xóa ghi chú",
    })
  }
}

// Lấy danh sách bài tập của một lesson
exports.getLessonAssignments = async (req, res) => {
  try {
    const { lessonId } = req.params

    const assignmentsQuery = `
      SELECT a.*, 
             COUNT(q.question_id) as question_count,
             us.submission_id,
             us.score,
             us.feedback,
             us.submitted_at,
             us.is_graded
      FROM assignments a
      LEFT JOIN questions q ON a.assignment_id = q.assignment_id
      LEFT JOIN user_submissions us ON a.assignment_id = us.assignment_id AND us.user_id = $2
      WHERE a.lesson_id = $1
      GROUP BY a.assignment_id, us.submission_id
      ORDER BY a.created_at
    `
    const { rows: assignments } = await db.query(assignmentsQuery, [lessonId, req.user.user_id])

    for (const assignment of assignments) {
      if (assignment.assignment_type === "quiz") {
        const questionsQuery = `
          SELECT q.*, json_agg(
            json_build_object(
              'answer_id', a.answer_id,
              'answer_text', a.answer_text,
              'is_correct', a.is_correct,
              'explanation', a.explanation
            )
          ) as answers
          FROM questions q
          LEFT JOIN answers a ON q.question_id = a.question_id
          WHERE q.assignment_id = $1
          GROUP BY q.question_id
          ORDER BY q.position
        `
        const { rows: questions } = await db.query(questionsQuery, [assignment.assignment_id])
        assignment.questions = questions
      }
    }

    return res.status(200).json({
      success: true,
      assignments,
    })
  } catch (error) {
    console.error("Error fetching assignments:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải danh sách bài tập",
    })
  }
}

// Nộp bài tập
// Cập nhật submitAssignment để hỗ trợ bài kiểm tra rõ ràng hơn
exports.submitAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params
    const userId = req.user.user_id
    const { answers, file_url, audio_url, text_content } = req.body

    const assignmentQuery = `
      SELECT * FROM assignments WHERE assignment_id = $1
    `
    const { rows: assignmentData } = await db.query(assignmentQuery, [assignmentId])
    if (assignmentData.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài kiểm tra hoặc bài tập" })
    }
    const assignment = assignmentData[0]

    let score = null
    let isGraded = false

    // Xử lý bài kiểm tra hoặc trắc nghiệm tự động chấm điểm
    if (assignment.is_auto_graded && (assignment.assignment_type === "quiz" || assignment.assignment_type === "test")) {
      const correctAnswersQuery = `
        SELECT q.question_id, a.answer_id, a.is_correct
        FROM questions q
        LEFT JOIN answers a ON q.question_id = a.question_id
        WHERE q.assignment_id = $1 AND a.is_correct = true
      `
      const { rows: correctAnswers } = await db.query(correctAnswersQuery, [assignmentId])

      let totalPoints = 0
      let earnedPoints = 0
      correctAnswers.forEach((correct) => {
        totalPoints += 1 // Mỗi câu 1 điểm
        if (answers[correct.question_id] === correct.answer_id) {
          earnedPoints += 1
        }
      })
      score = (earnedPoints / totalPoints) * assignment.points_possible
      isGraded = true
    }

    const submissionQuery = `
      INSERT INTO user_submissions (user_id, assignment_id, score, is_graded, submission_file_url, audio_url, submission_type, feedback)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `
    const submissionType = file_url ? "file" : audio_url ? "audio" : text_content ? "text" : "mixed"
    const feedback = score !== null ? `Điểm tự động: ${score}/${assignment.points_possible}` : "Đang chờ chấm điểm"
    const { rows: submission } = await db.query(submissionQuery, [
      userId,
      assignmentId,
      score,
      isGraded,
      file_url || null,
      audio_url || null,
      submissionType,
      feedback,
    ])

    return res.status(200).json({
      success: true,
      submission,
      message: assignment.assignment_type === "test" ? "Nộp bài kiểm tra thành công" : "Nộp bài tập thành công",
    })
  } catch (error) {
    console.error("Error submitting assignment/test:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi nộp bài kiểm tra hoặc bài tập",
    })
  }
}

// Đánh dấu bài kiểm tra hoàn thành (dành cho trường hợp chấm điểm thủ công)
exports.markTestComplete = async (req, res) => {
  try {
    const { assignmentId } = req.params
    const userId = req.user.user_id

    const updateQuery = `
      UPDATE user_submissions
      SET is_graded = true, graded_at = CURRENT_TIMESTAMP
      WHERE assignment_id = $1 AND user_id = $2 AND is_graded = false
      RETURNING *
    `
    const { rows: updated } = await db.query(updateQuery, [assignmentId, userId])

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài kiểm tra để đánh dấu hoàn thành",
      })
    }

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu bài kiểm tra hoàn thành",
    })
  } catch (error) {
    console.error("Error marking test complete:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi đánh dấu hoàn thành",
    })
  }
}

// Lấy lịch sử bài tập của user
exports.getUserAssignmentHistory = async (req, res) => {
  try {
    const userId = req.user.user_id

    const historyQuery = `
      SELECT us.*, a.title, a.assignment_type, a.points_possible, l.title as lesson_title, c.title as course_title
      FROM user_submissions us
      JOIN assignments a ON us.assignment_id = a.assignment_id
      JOIN lessons l ON a.lesson_id = l.lesson_id
      JOIN modules m ON l.module_id = m.module_id
      JOIN courses c ON m.course_id = c.course_id
      WHERE us.user_id = $1
      ORDER BY us.submitted_at DESC
    `
    const { rows: history } = await db.query(historyQuery, [userId])

    return res.status(200).json({
      success: true,
      history,
    })
  } catch (error) {
    console.error("Error fetching assignment history:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải lịch sử bài tập",
    })
  }
}

// Đánh dấu bài tập hoàn thành (cho bài kiểm tra)
exports.markAssignmentComplete = async (req, res) => {
  try {
    const { assignmentId } = req.params
    const userId = req.user.user_id

    const updateQuery = `
      UPDATE user_submissions
      SET is_graded = true, graded_at = CURRENT_TIMESTAMP
      WHERE assignment_id = $1 AND user_id = $2
      RETURNING *
    `
    const { rows: updated } = await db.query(updateQuery, [assignmentId, userId])

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài nộp để đánh dấu hoàn thành",
      })
    }

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu bài tập hoàn thành",
    })
  } catch (error) {
    console.error("Error marking assignment complete:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi đánh dấu hoàn thành",
    })
  }
}
// Lấy danh sách danh mục khóa học
exports.getCourseCategories = async (req, res) => {
  try {
    const query = `
      SELECT cc.*, COUNT(ccm.course_id) as course_count
      FROM course_categories cc
      LEFT JOIN course_category_mappings ccm ON cc.category_id = ccm.category_id
      LEFT JOIN courses c ON ccm.course_id = c.course_id AND c.is_published = true
      GROUP BY cc.category_id
      ORDER BY cc.name
    `

    const { rows: categories } = await db.query(query)

    return res.status(200).json({
      success: true,
      categories,
    })
  } catch (error) {
    console.error("Error fetching course categories:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải danh mục khóa học",
    })
  }
}

// Đăng ký khóa học
exports.enrollCourse = async (req, res) => {
  try {
    const { courseId } = req.params
    const userId = req.user.user_id
    const { payment_method = "vnpay" } = req.body

    const courseQuery = `
      SELECT * FROM courses
      WHERE course_id = $1 AND is_published = true
    `
    const { rows: courses } = await db.query(courseQuery, [courseId])
    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khóa học hoặc khóa học chưa được xuất bản",
      })
    }
    const course = courses[0]
    console.log("Course data in enrollCourse:", course) // Debug

    const enrollmentQuery = `
      SELECT * FROM user_courses
      WHERE user_id = $1 AND course_id = $2
    `
    const { rows: enrollment } = await db.query(enrollmentQuery, [userId, courseId])
    if (enrollment.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đăng ký khóa học này rồi",
      })
    }

    // Chuyển đổi price thành số
    const price = Number.parseFloat(course.price)
    console.log("Parsed price in enrollCourse:", price) // Debug

    // Xử lý khóa học miễn phí
    if (isNaN(price) || price === 0) {
      const enrollQuery = `
        INSERT INTO user_courses (user_id, course_id, enrollment_date, progress_percentage)
        VALUES ($1, $2, CURRENT_TIMESTAMP, 0)
        ON CONFLICT DO NOTHING
        RETURNING *
      `
      await db.query(enrollQuery, [userId, courseId])
      return res.status(200).json({
        success: true,
        requiresPayment: false,
        message: "Đăng ký khóa học miễn phí thành công",
      })
    }

    // Tạo giao dịch cho khóa học có phí
    const transactionQuery = `
      INSERT INTO transactions (user_id, course_id, amount, currency, payment_method, transaction_status)
      VALUES ($1, $2, $3, 'VND', $4, 'pending')
      RETURNING transaction_id
    `
    const { rows: transactionResult } = await db.query(transactionQuery, [userId, courseId, price, payment_method])

    if (!transactionResult[0]) {
      throw new Error("Không thể tạo giao dịch")
    }

    return res.status(200).json({
      success: true,
      requiresPayment: true,
      transactionId: transactionResult[0].transaction_id,
      course,
    })
  } catch (error) {
    console.error("Lỗi khi đăng ký khóa học:", error)
    return res.status(500).json({
      success: false,
      message: error.message || "Đã xảy ra lỗi khi đăng ký khóa học",
    })
  }
}

// In courseController.js
exports.getUserEnrolledCourses = async (req, res) => {
  try {
    const userId = req.user.user_id

    const query = `
      SELECT c.*, 
        u.first_name, u.last_name, u.profile_picture as instructor_picture,
        uc.progress_percentage, uc.last_accessed_at,
        COUNT(DISTINCT l.lesson_id) as total_lessons,
        COUNT(DISTINCT ul.lesson_id) as completed_lessons,
        (CASE WHEN uc.progress_percentage = 100 THEN true ELSE false END) as is_completed
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.course_id
      LEFT JOIN users u ON c.instructor_id = u.user_id
      LEFT JOIN modules m ON c.course_id = m.course_id
      LEFT JOIN lessons l ON m.module_id = l.module_id
      LEFT JOIN user_lessons ul ON l.lesson_id = ul.lesson_id AND ul.user_id = $1 AND ul.is_completed = true
      WHERE uc.user_id = $1 AND c.is_published = true
      GROUP BY c.course_id, u.user_id, uc.progress_percentage, uc.last_accessed_at
      ORDER BY uc.last_accessed_at DESC
    `

    const { rows: courses } = await db.query(query, [userId])

    return res.status(200).json({
      success: true,
      courses,
    })
  } catch (error) {
    console.error("Error fetching user enrolled courses:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải danh sách khóa học đã đăng ký",
    })
  }
}
// In courseController.js, replace getRecommendedCourses with this enhanced version
exports.getRecommendedCourses = async (req, res) => {
  try {
    const userId = req.user.user_id

    // Get enrolled courses
    const enrolledQuery = `
      SELECT course_id, progress_percentage
      FROM user_courses
      WHERE user_id = $1
    `
    const { rows: enrolled } = await db.query(enrolledQuery, [userId])
    const enrolledIds = enrolled.map((row) => row.course_id)

    // If no enrolled courses, recommend popular courses
    if (enrolledIds.length === 0) {
      const popularQuery = `
        SELECT c.*, u.first_name, u.last_name, u.profile_picture as instructor_picture,
        COUNT(DISTINCT ucr.user_id) as student_count,
        COALESCE(AVG(cr.rating), 0) as average_rating,
        COUNT(DISTINCT cr.review_id) as review_count
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.user_id
        LEFT JOIN user_courses ucr ON c.course_id = ucr.course_id
        LEFT JOIN course_reviews cr ON c.course_id = cr.course_id
        WHERE c.is_published = true
        GROUP BY c.course_id, u.user_id
        ORDER BY student_count DESC, average_rating DESC
        LIMIT 8
      `
      const { rows: popularCourses } = await db.query(popularQuery)

      // Format average_rating to number
      const formattedPopularCourses = popularCourses.map((course) => ({
        ...course,
        average_rating: Number.parseFloat(course.average_rating),
      }))

      return res.status(200).json({
        success: true,
        recommendedCourses: formattedPopularCourses,
        recommendationType: "popular",
      })
    }

    // Get categories of enrolled courses
    const categoryQuery = `
      SELECT DISTINCT cc.category_id, cc.name
      FROM course_categories cc
      JOIN course_category_mappings ccm ON cc.category_id = ccm.category_id
      WHERE ccm.course_id = ANY($1::int[])
    `
    const { rows: categories } = await db.query(categoryQuery, [enrolledIds])
    const categoryIds = categories.map((row) => row.category_id)

    // If no categories found, fallback to popular courses
    if (categoryIds.length === 0) {
      const popularQuery = `
        SELECT c.*, u.first_name, u.last_name, u.profile_picture as instructor_picture,
        COUNT(DISTINCT ucr.user_id) as student_count,
        COALESCE(AVG(cr.rating), 0) as average_rating,
        COUNT(DISTINCT cr.review_id) as review_count
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.user_id
        LEFT JOIN user_courses ucr ON c.course_id = ucr.course_id
        LEFT JOIN course_reviews cr ON c.course_id = cr.course_id
        WHERE c.is_published = true
        GROUP BY c.course_id, u.user_id
        ORDER BY student_count DESC, average_rating DESC
        LIMIT 8
      `
      const { rows: popularCourses } = await db.query(popularQuery)

      const formattedPopularCourses = popularCourses.map((course) => ({
        ...course,
        average_rating: Number.parseFloat(course.average_rating),
      }))

      return res.status(200).json({
        success: true,
        recommendedCourses: formattedPopularCourses,
        recommendationType: "popular",
      })
    }

    // Get user’s preferred skills and difficulty level based on progress
    const userPreferencesQuery = `
      SELECT c.language_skill, c.difficulty_level, AVG(uc.progress_percentage) as avg_progress
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.course_id
      WHERE uc.user_id = $1
      GROUP BY c.language_skill, c.difficulty_level
      ORDER BY avg_progress DESC
      LIMIT 1
    `
    const { rows: preferences } = await db.query(userPreferencesQuery, [userId])
    const preferredSkill = preferences[0]?.language_skill || "all"
    const preferredLevel = preferences[0]?.difficulty_level || "all-levels"

    // Recommend courses based on categories, skill, and level
    const recommendedQuery = `
      SELECT c.*, u.first_name, u.last_name, u.profile_picture as instructor_picture,
      COUNT(DISTINCT ucr.user_id) as student_count,
      COALESCE(AVG(cr.rating), 0) as average_rating,
      COUNT(DISTINCT cr.review_id) as review_count
      FROM courses c
      JOIN course_category_mappings ccm ON c.course_id = ccm.course_id
      LEFT JOIN users u ON c.instructor_id = u.user_id
      LEFT JOIN user_courses ucr ON c.course_id = ucr.course_id
      LEFT JOIN course_reviews cr ON c.course_id = cr.course_id
      WHERE c.is_published = true
      AND c.course_id != ALL($1::int[])
      AND ccm.category_id = ANY($2::int[])
      AND (c.language_skill = $3 OR $3 = 'all')
      AND (c.difficulty_level = $4 OR $4 = 'all-levels')
      GROUP BY c.course_id, u.user_id
      ORDER BY average_rating DESC, student_count DESC
      LIMIT 8
    `
    const { rows: recommendedCourses } = await db.query(recommendedQuery, [
      enrolledIds,
      categoryIds,
      preferredSkill,
      preferredLevel,
    ])

    // Format average_rating to number
    const formattedRecommendedCourses = recommendedCourses.map((course) => ({
      ...course,
      average_rating: Number.parseFloat(course.average_rating),
    }))

    // Fallback to broader recommendations if not enough results
    if (formattedRecommendedCourses.length < 4) {
      const fallbackQuery = `
        SELECT c.*, u.first_name, u.last_name, u.profile_picture as instructor_picture,
        COUNT(DISTINCT ucr.user_id) as student_count,
        COALESCE(AVG(cr.rating), 0) as average_rating,
        COUNT(DISTINCT cr.review_id) as review_count
        FROM courses c
        JOIN course_category_mappings ccm ON c.course_id = ccm.course_id
        LEFT JOIN users u ON c.instructor_id = u.user_id
        LEFT JOIN user_courses ucr ON c.course_id = ucr.course_id
        LEFT JOIN course_reviews cr ON c.course_id = cr.course_id
        WHERE c.is_published = true
        AND c.course_id != ALL($1::int[])
        AND ccm.category_id = ANY($2::int[])
        GROUP BY c.course_id, u.user_id
        ORDER BY average_rating DESC, student_count DESC
        LIMIT 8
      `
      const { rows: fallbackCourses } = await db.query(fallbackQuery, [enrolledIds, categoryIds])

      const formattedFallbackCourses = fallbackCourses.map((course) => ({
        ...course,
        average_rating: Number.parseFloat(course.average_rating),
      }))

      return res.status(200).json({
        success: true,
        recommendedCourses: formattedFallbackCourses,
        recommendationType: "category-based",
      })
    }

    return res.status(200).json({
      success: true,
      recommendedCourses: formattedRecommendedCourses,
      recommendationType: "personalized",
    })
  } catch (error) {
    console.error("Error fetching recommended courses:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tải khóa học đề xuất",
    })
  }
}
