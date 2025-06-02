const db = require("../db")
const { validationResult } = require("express-validator")

// User Management
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", role = "all" } = req.query
    const offset = (page - 1) * limit

    let query = `
      SELECT user_id, username, email, first_name, last_name, 
             profile_picture, created_at, last_login, is_active, 
             is_verified, role
      FROM users
      WHERE 1=1
    `

    const queryParams = []

    if (search) {
      query += ` AND (username ILIKE $${queryParams.length + 1} 
                OR email ILIKE $${queryParams.length + 1}
                OR first_name ILIKE $${queryParams.length + 1}
                OR last_name ILIKE $${queryParams.length + 1})`
      queryParams.push(`%${search}%`)
    }

    if (role !== "all") {
      query += ` AND role = $${queryParams.length + 1}`
      queryParams.push(role)
    }

    // Count total users for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count`
    const countResult = await db.query(countQuery, queryParams)
    const totalUsers = Number.parseInt(countResult.rows[0].count)

    // Add pagination to the main query
    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    res.json({
      users: result.rows,
      pagination: {
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: Number.parseInt(page),
        limit: Number.parseInt(limit),
      },
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    res.status(500).json({ error: "Failed to fetch users" })
  }
}

const getUserById = async (req, res) => {
  try {
    const { id } = req.params

    const userQuery = `
      SELECT user_id, username, email, first_name, last_name, 
             profile_picture, created_at, last_login, 
             is_active, is_verified, role
      FROM users
      WHERE user_id = $1
    `

    const userResult = await db.query(userQuery, [id])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = userResult.rows[0]

    // Get user's enrolled courses
    const coursesQuery = `
      SELECT c.course_id, c.title, c.thumbnail_url, 
             uc.enrollment_date, uc.progress_percentage, uc.is_completed
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.course_id
      WHERE uc.user_id = $1
      ORDER BY uc.enrollment_date DESC
    `

    const coursesResult = await db.query(coursesQuery, [id])
    user.enrolled_courses = coursesResult.rows

    res.json({ user })
  } catch (error) {
    console.error("Error fetching user:", error)
    res.status(500).json({ error: "Failed to fetch user details" })
  }
}

const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { username, email, first_name, last_name, is_active, role } = req.body

    // Check if user exists
    const checkUser = await db.query("SELECT * FROM users WHERE user_id = $1", [id])
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    // Update user
    const query = `
      UPDATE users
      SET username = $1, email = $2, first_name = $3, last_name = $4,
          is_active = $5, role = $6, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $7
      RETURNING user_id, username, email, first_name, last_name, is_active, role
    `

    const result = await db.query(query, [username, email, first_name, last_name, is_active, role, id])

    res.json({ user: result.rows[0], message: "User updated successfully" })
  } catch (error) {
    console.error("Error updating user:", error)
    res.status(500).json({ error: "Failed to update user" })
  }
}

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    // Check if user exists
    const checkUser = await db.query("SELECT * FROM users WHERE user_id = $1", [id])
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    // Delete user
    await db.query("DELETE FROM users WHERE user_id = $1", [id])

    res.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    res.status(500).json({ error: "Failed to delete user" })
  }
}

const createUser = async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, role } = req.body

    // Check if username or email already exists
    const checkExisting = await db.query("SELECT * FROM users WHERE username = $1 OR email = $2", [username, email])

    if (checkExisting.rows.length > 0) {
      return res.status(400).json({
        error: "Username or email already exists",
      })
    }

    // Hash password
    const bcrypt = require("bcrypt")
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create user
    const query = `
      INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, true, true)
      RETURNING user_id, username, email, first_name, last_name, role
    `

    const result = await db.query(query, [username, email, hashedPassword, first_name, last_name, role])

    res.status(201).json({
      user: result.rows[0],
      message: "User created successfully",
    })
  } catch (error) {
    console.error("Error creating user:", error)
    res.status(500).json({ error: "Failed to create user" })
  }
}

// Course Management
const getCourses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      difficulty_level = "all",
      language_skill = "all",
      minPrice = "",
      maxPrice = "",
    } = req.query

    const offset = (page - 1) * limit

    let query = `
      SELECT c.course_id, c.title, c.description, c.price, 
             c.thumbnail_url as thumbnail, c.is_published,
             c.created_at, c.updated_at, c.duration_minutes,
             u.username as instructor_name, u.profile_picture as instructor_avatar,
             c.difficulty_level,
             c.language_skill,
             (SELECT COUNT(*) FROM user_courses WHERE course_id = c.course_id) as enrollments_count,
             (SELECT COALESCE(AVG(rating), 0) FROM course_reviews WHERE course_id = c.course_id) as average_rating,
             (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.course_id) as ratings_count
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      WHERE 1=1
    `

    const queryParams = []

    if (search) {
      query += ` AND (c.title ILIKE $${queryParams.length + 1} OR c.description ILIKE $${queryParams.length + 1})`
      queryParams.push(`%${search}%`)
    }

    if (difficulty_level !== "all") {
      query += ` AND c.difficulty_level = $${queryParams.length + 1}`
      queryParams.push(difficulty_level)
    }

    if (language_skill !== "all") {
      query += ` AND c.language_skill = $${queryParams.length + 1}`
      queryParams.push(language_skill)
    }

    if (minPrice) {
      query += ` AND c.price >= $${queryParams.length + 1}`
      queryParams.push(minPrice)
    }

    if (maxPrice) {
      query += ` AND c.price <= $${queryParams.length + 1}`
      queryParams.push(maxPrice)
    }

    // Count total courses for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count`
    const countResult = await db.query(countQuery, queryParams)
    const totalCourses = Number.parseInt(countResult.rows[0].count)

    // Add pagination to the main query
    query += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    res.json({
      courses: result.rows,
      pagination: {
        totalCourses,
        totalPages: Math.ceil(totalCourses / limit),
        currentPage: Number.parseInt(page),
        limit: Number.parseInt(limit),
      },
    })
  } catch (error) {
    console.error("Error fetching courses:", error)
    res.status(500).json({ error: "Failed to fetch courses" })
  }
}

const getCourseById = async (req, res) => {
  try {
    const { id } = req.params

    const courseQuery = `
      SELECT c.course_id, c.title, c.description, c.price, 
             c.thumbnail_url, c.is_published,
             c.created_at, c.updated_at, c.duration_minutes,
             c.difficulty_level as level,
             c.language_skill,
             u.username as instructor_name, u.profile_picture as instructor_avatar,
             u.bio as instructor_bio,
             (SELECT COUNT(*) FROM user_courses WHERE course_id = c.course_id) as enrollments_count,
             (SELECT COALESCE(AVG(rating), 0) FROM course_reviews WHERE course_id = c.course_id) as average_rating,
             (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.course_id) as ratings_count
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      WHERE c.course_id = $1
    `

    const courseResult = await db.query(courseQuery, [id])

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" })
    }

    const course = courseResult.rows[0]

    // Get course lessons
    const lessonsQuery = `
      SELECT l.lesson_id, l.title, l.description, l.duration_minutes as duration,
             CASE 
               WHEN l.video_url IS NOT NULL THEN 'video'
               ELSE 'text'
             END as type
      FROM lessons l
      JOIN modules m ON l.module_id = m.module_id
      WHERE m.course_id = $1
      ORDER BY m.position, l.position
    `

    const lessonsResult = await db.query(lessonsQuery, [id])
    course.lessons = lessonsResult.rows
    course.lessons_count = lessonsResult.rows.length

    res.json({ course })
  } catch (error) {
    console.error("Error fetching course:", error)
    res.status(500).json({ error: "Failed to fetch course details" })
  }
}

const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params

    // Check if course exists
    const checkCourse = await db.query("SELECT * FROM courses WHERE course_id = $1", [id])
    if (checkCourse.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" })
    }

    // Delete course
    await db.query("DELETE FROM courses WHERE course_id = $1", [id])

    res.json({ message: "Course deleted successfully" })
  } catch (error) {
    console.error("Error deleting course:", error)
    res.status(500).json({ error: "Failed to delete course" })
  }
}

const updateCourse = async (req, res) => {
  try {
    const { id } = req.params
    const {
      title,
      description,
      price,
      thumbnail_url,
      difficulty_level,
      language_skill,
      is_published,
      duration_minutes,
      instructor_id,
    } = req.body

    // Check if course exists
    const checkCourse = await db.query("SELECT * FROM courses WHERE course_id = $1", [id])
    if (checkCourse.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" })
    }

    // Update course in the database
    const updateQuery = `
      UPDATE courses
      SET title = $1,
           description = $2,
           price = $3,
           thumbnail_url = $4,
           difficulty_level = $5,
           language_skill = $6,
           is_published = $7,
           duration_minutes = $8,
           instructor_id = $9,
           updated_at = CURRENT_TIMESTAMP
      WHERE course_id = $10
      RETURNING course_id, title, description, price, thumbnail_url,
                difficulty_level, language_skill, is_published, updated_at, instructor_id
    `

    const result = await db.query(updateQuery, [
      title,
      description,
      price,
      thumbnail_url,
      difficulty_level,
      language_skill,
      is_published,
      duration_minutes,
      instructor_id,
      id,
    ])

    res.json({
      course: result.rows[0],
      message: "Course updated successfully",
    })
  } catch (error) {
    console.error("Error updating course:", error)
    res.status(500).json({ error: "Failed to update course" })
  }
}

const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      thumbnail_url,
      difficulty_level,
      language_skill,
      instructor_id,
      is_published,
      duration_minutes,
    } = req.body

    // Validate required fields
    if (!title || !description || !instructor_id) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Create course in the database
    const insertQuery = `
      INSERT INTO courses (
        title, 
        description, 
        price, 
        thumbnail_url, 
        difficulty_level, 
        language_skill,
        instructor_id, 
        is_published, 
        duration_minutes,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING course_id, title, description, price, thumbnail_url, 
               difficulty_level, language_skill, is_published, created_at
    `

    const result = await db.query(insertQuery, [
      title,
      description,
      price,
      thumbnail_url,
      difficulty_level,
      language_skill,
      instructor_id,
      is_published,
      duration_minutes,
    ])

    res.status(201).json({
      course: result.rows[0],
      message: "Course created successfully",
    })
  } catch (error) {
    console.error("Error creating course:", error)
    res.status(500).json({ error: "Failed to create course" })
  }
}

// Statistics
const getUserStats = async (req, res) => {
  try {
    // Get total users count
    const totalUsersQuery = "SELECT COUNT(*) FROM users"

    // Get new users in last 30 days
    const newUsersQuery = `
      SELECT COUNT(*) 
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `

    // Get users by role
    const usersByRoleQuery = `
      SELECT role, COUNT(*) 
      FROM users 
      GROUP BY role
    `

    // Get active users in last 7 days
    const activeUsersQuery = `
      SELECT COUNT(DISTINCT user_id) 
      FROM users 
      WHERE last_login >= NOW() - INTERVAL '7 days'
    `

    const [totalUsersResult, newUsersResult, usersByRoleResult, activeUsersResult] = await Promise.all([
      db.query(totalUsersQuery),
      db.query(newUsersQuery),
      db.query(usersByRoleQuery),
      db.query(activeUsersQuery),
    ])

    // Format role data for chart
    const roleData = usersByRoleResult.rows.reduce((acc, { role, count }) => {
      acc[role] = Number.parseInt(count)
      return acc
    }, {})

    res.json({
      totalUsers: Number.parseInt(totalUsersResult.rows[0].count),
      newUsers: Number.parseInt(newUsersResult.rows[0].count),
      activeUsers: Number.parseInt(activeUsersResult.rows[0].count),
      usersByRole: roleData,
    })
  } catch (error) {
    console.error("Error fetching user statistics:", error)
    res.status(500).json({ error: "Failed to fetch user statistics" })
  }
}

const getCourseStats = async (req, res) => {
  try {
    // Get total courses count
    const totalCoursesQuery = "SELECT COUNT(*) FROM courses"

    // Get new courses in last 30 days
    const newCoursesQuery = `
      SELECT COUNT(*) 
      FROM courses 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `

    // Get courses by difficulty level
    const coursesByDifficultyQuery = `
      SELECT difficulty_level, COUNT(course_id) 
      FROM courses
      GROUP BY difficulty_level
    `

    // Get courses by language skill
    const coursesByLanguageSkillQuery = `
      SELECT language_skill, COUNT(course_id) 
      FROM courses
      GROUP BY language_skill
    `

    // Get total enrollments
    const totalEnrollmentsQuery = "SELECT COUNT(*) FROM user_courses"

    const [
      totalCoursesResult,
      newCoursesResult,
      coursesByDifficultyResult,
      coursesByLanguageSkillResult,
      totalEnrollmentsResult,
    ] = await Promise.all([
      db.query(totalCoursesQuery),
      db.query(newCoursesQuery),
      db.query(coursesByDifficultyQuery),
      db.query(coursesByLanguageSkillQuery),
      db.query(totalEnrollmentsQuery),
    ])

    // Format difficulty data for chart
    const difficultyData = coursesByDifficultyResult.rows.reduce((acc, { difficulty_level, count }) => {
      acc[difficulty_level] = Number.parseInt(count)
      return acc
    }, {})

    // Format language skill data for chart
    const languageSkillData = coursesByLanguageSkillResult.rows.reduce((acc, { language_skill, count }) => {
      acc[language_skill] = Number.parseInt(count)
      return acc
    }, {})

    res.json({
      totalCourses: Number.parseInt(totalCoursesResult.rows[0].count),
      newCourses: Number.parseInt(newCoursesResult.rows[0].count),
      totalEnrollments: Number.parseInt(totalEnrollmentsResult.rows[0].count),
      coursesByDifficulty: difficultyData,
      coursesByLanguageSkill: languageSkillData,
    })
  } catch (error) {
    console.error("Error fetching course statistics:", error)
    res.status(500).json({ error: "Failed to fetch course statistics" })
  }
}

const getRevenueStats = async (req, res) => {
  try {
    // Get total revenue
    const totalRevenueQuery = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_status = 'completed'"

    // Get monthly revenue for the last 6 months
    const monthlyRevenueQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(amount), 0) AS revenue
      FROM transactions
      WHERE 
        transaction_status = 'completed' AND
        created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `

    // Get revenue by payment method
    const revenueByPaymentMethodQuery = `
      SELECT 
        payment_method, 
        COALESCE(SUM(amount), 0) AS revenue
      FROM transactions
      WHERE transaction_status = 'completed'
      GROUP BY payment_method
    `

    const [totalRevenueResult, monthlyRevenueResult, revenueByPaymentMethodResult] = await Promise.all([
      db.query(totalRevenueQuery),
      db.query(monthlyRevenueQuery),
      db.query(revenueByPaymentMethodQuery),
    ])

    // Format monthly revenue for chart
    const monthlyData = monthlyRevenueResult.rows.reduce((acc, { month, revenue }) => {
      acc[month] = Number.parseFloat(revenue)
      return acc
    }, {})

    // Format payment method revenue for chart
    const paymentMethodData = revenueByPaymentMethodResult.rows.reduce((acc, { payment_method, revenue }) => {
      acc[payment_method] = Number.parseFloat(revenue)
      return acc
    }, {})

    res.json({
      totalRevenue: Number.parseFloat(totalRevenueResult.rows[0].coalesce || 0),
      monthlyRevenue: monthlyData,
      revenueByPaymentMethod: paymentMethodData,
    })
  } catch (error) {
    console.error("Error fetching revenue statistics:", error)
    res.status(500).json({ error: "Failed to fetch revenue statistics" })
  }
}

// System Configuration
const getSystemSettings = async (req, res) => {
  try {
    const query = `
      SELECT setting_key, setting_value 
      FROM system_settings
    `

    const result = await db.query(query)

    // Format settings as key-value object
    const settings = result.rows.reduce((acc, { setting_key, setting_value }) => {
      acc[setting_key] = setting_value
      return acc
    }, {})

    res.json({ settings })
  } catch (error) {
    console.error("Error fetching system settings:", error)
    res.status(500).json({ error: "Failed to fetch system settings" })
  }
}

const updateSystemSettings = async (req, res) => {
  try {
    const { settings } = req.body

    // Update each setting
    const updatePromises = Object.entries(settings).map(([key, value]) => {
      return db.query(
        `INSERT INTO system_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3`,
        [key, value, req.user.user_id],
      )
    })

    await Promise.all(updatePromises)

    res.json({ message: "System settings updated successfully" })
  } catch (error) {
    console.error("Error updating system settings:", error)
    res.status(500).json({ error: "Failed to update system settings" })
  }
}

// Student Performance
const getSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", assignment_id = "", date_range = "all", score_range = "all" } = req.query

    const offset = (page - 1) * limit

    let query = `
      SELECT 
        us.submission_id, us.user_id, us.assignment_id, us.submitted_at, 
        us.score, us.feedback, us.is_graded, us.graded_at, us.submission_file_url,
        u.username, u.first_name, u.last_name, u.email, u.profile_picture,
        a.title as assignment_title, a.assignment_type, a.points_possible,
        l.title as lesson_title, m.title as module_title, c.title as course_title
      FROM user_submissions us
      JOIN users u ON us.user_id = u.user_id
      JOIN assignments a ON us.assignment_id = a.assignment_id
      JOIN lessons l ON a.lesson_id = l.lesson_id
      JOIN modules m ON l.module_id = m.module_id
      JOIN courses c ON m.course_id = c.course_id
      WHERE 1=1
    `

    const queryParams = []

    // Apply search filter
    if (search) {
      query += ` AND (
        u.username ILIKE $${queryParams.length + 1} OR
        u.first_name ILIKE $${queryParams.length + 1} OR
        u.last_name ILIKE $${queryParams.length + 1} OR
        u.email ILIKE $${queryParams.length + 1} OR
        a.title ILIKE $${queryParams.length + 1} OR
        c.title ILIKE $${queryParams.length + 1}
      )`
      queryParams.push(`%${search}%`)
    }

    // Filter by assignment
    if (assignment_id && assignment_id !== "all") {
      query += ` AND us.assignment_id = $${queryParams.length + 1}`
      queryParams.push(assignment_id)
    }

    // Filter by date range
    if (date_range && date_range !== "all") {
      let dateFilter

      switch (date_range) {
        case "today":
          dateFilter = "us.submitted_at >= CURRENT_DATE"
          break
        case "week":
          dateFilter = "us.submitted_at >= CURRENT_DATE - INTERVAL '7 days'"
          break
        case "month":
          dateFilter = "us.submitted_at >= CURRENT_DATE - INTERVAL '30 days'"
          break
        case "quarter":
          dateFilter = "us.submitted_at >= CURRENT_DATE - INTERVAL '90 days'"
          break
        default:
          dateFilter = null
      }

      if (dateFilter) {
        query += ` AND ${dateFilter}`
      }
    }

    // Filter by score range
    if (score_range && score_range !== "all") {
      let scoreFilter

      switch (score_range) {
        case "90-100":
          scoreFilter = "us.score >= 90 AND us.score <= 100"
          break
        case "80-89":
          scoreFilter = "us.score >= 80 AND us.score < 90"
          break
        case "70-79":
          scoreFilter = "us.score >= 70 AND us.score < 80"
          break
        case "60-69":
          scoreFilter = "us.score >= 60 AND us.score < 70"
          break
        case "below-60":
          scoreFilter = "us.score < 60"
          break
        case "ungraded":
          scoreFilter = "us.is_graded = false"
          break
        default:
          scoreFilter = null
      }

      if (scoreFilter) {
        query += ` AND ${scoreFilter}`
      }
    }

    // Count total submissions for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count`
    const countResult = await db.query(countQuery, queryParams)
    const totalSubmissions = Number.parseInt(countResult.rows[0].count)

    // Add pagination to the main query
    query += ` ORDER BY us.submitted_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Format the results
    const submissions = result.rows.map((row) => ({
      submission_id: row.submission_id,
      submitted_at: row.submitted_at,
      score: row.score,
      feedback: row.feedback,
      is_graded: row.is_graded,
      graded_at: row.graded_at,
      submission_file_url: row.submission_file_url,
      student: {
        user_id: row.user_id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        profile_picture: row.profile_picture,
      },
      assignment: {
        assignment_id: row.assignment_id,
        title: row.assignment_title,
        assignment_type: row.assignment_type,
        points_possible: row.points_possible,
        lesson_title: row.lesson_title,
        module_title: row.module_title,
        course_title: row.course_title,
      },
    }))

    res.json({
      submissions,
      pagination: {
        totalSubmissions,
        totalPages: Math.ceil(totalSubmissions / limit),
        currentPage: Number.parseInt(page),
        limit: Number.parseInt(limit),
      },
    })
  } catch (error) {
    console.error("Error fetching submissions:", error)
    res.status(500).json({ error: "Failed to fetch submissions" })
  }
}

const getPerformanceAnalytics = async (req, res) => {
  try {
    // Get total submissions
    const totalSubmissionsQuery = "SELECT COUNT(*) FROM user_submissions"

    // Get average score
    const averageScoreQuery = `
      SELECT COALESCE(AVG(score), 0) as average_score 
      FROM user_submissions 
      WHERE is_graded = true
    `

    // Get completion rate
    const completionRateQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_graded = true THEN 1 END) as graded
      FROM user_submissions
    `

    // Get score distribution
    const scoreDistributionQuery = `
      SELECT
        COUNT(CASE WHEN score >= 90 AND score <= 100 THEN 1 END) as range_90_100,
        COUNT(CASE WHEN score >= 80 AND score < 90 THEN 1 END) as range_80_89,
        COUNT(CASE WHEN score >= 70 AND score < 80 THEN 1 END) as range_70_79,
        COUNT(CASE WHEN score >= 60 AND score < 70 THEN 1 END) as range_60_69,
        COUNT(CASE WHEN score < 60 THEN 1 END) as range_below_60
      FROM user_submissions
      WHERE is_graded = true
    `

    // Execute all queries in parallel
    const [totalSubmissionsResult, averageScoreResult, completionRateResult, scoreDistributionResult] =
      await Promise.all([
        db.query(totalSubmissionsQuery),
        db.query(averageScoreQuery),
        db.query(completionRateQuery),
        db.query(scoreDistributionQuery),
      ])

    // Format the results
    const totalSubmissions = Number.parseInt(totalSubmissionsResult.rows[0].count)
    const averageScore = Number.parseFloat(averageScoreResult.rows[0].average_score).toFixed(1)

    const completionRate =
      completionRateResult.rows[0].total > 0
        ? ((completionRateResult.rows[0].graded * 100) / completionRateResult.rows[0].total).toFixed(1)
        : 0

    const scoreDistribution = {
      "90-100": Number.parseInt(scoreDistributionResult.rows[0].range_90_100),
      "80-89": Number.parseInt(scoreDistributionResult.rows[0].range_80_89),
      "70-79": Number.parseInt(scoreDistributionResult.rows[0].range_70_79),
      "60-69": Number.parseInt(scoreDistributionResult.rows[0].range_60_69),
      "Below 60": Number.parseInt(scoreDistributionResult.rows[0].range_below_60),
    }

    res.json({
      totalSubmissions,
      averageScore,
      completionRate,
      scoreDistribution,
    })
  } catch (error) {
    console.error("Error fetching performance analytics:", error)
    res.status(500).json({ error: "Failed to fetch performance analytics" })
  }
}

// AI Conversation Management
const getAIConversations = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", dateRange = "all", resolved = "all" } = req.query
    const offset = (page - 1) * limit

    let query = `
      SELECT 
        ac.conversation_id, ac.user_id, ac.start_time, ac.end_time, 
        ac.duration_seconds, ac.message_count, ac.satisfaction_rating, 
        ac.topic, ac.is_resolved, ac.created_at,
        u.username, u.first_name, u.last_name, u.email, u.profile_picture
      FROM ai_conversations ac
      LEFT JOIN users u ON ac.user_id = u.user_id
      WHERE 1=1
    `

    const queryParams = []

    // Apply search filter
    if (search) {
      query += ` AND (
        u.username ILIKE $${queryParams.length + 1} OR
        u.first_name ILIKE $${queryParams.length + 1} OR
        u.last_name ILIKE $${queryParams.length + 1} OR
        ac.topic ILIKE $${queryParams.length + 1}
      )`
      queryParams.push(`%${search}%`)
    }

    // Filter by resolved status
    if (resolved !== "all") {
      query += ` AND ac.is_resolved = $${queryParams.length + 1}`
      queryParams.push(resolved === "true")
    }

    // Filter by date range
    if (dateRange !== "all") {
      let dateFilter
      switch (dateRange) {
        case "today":
          dateFilter = "ac.created_at >= CURRENT_DATE"
          break
        case "week":
          dateFilter = "ac.created_at >= CURRENT_DATE - INTERVAL '7 days'"
          break
        case "month":
          dateFilter = "ac.created_at >= CURRENT_DATE - INTERVAL '30 days'"
          break
        default:
          dateFilter = null
      }
      if (dateFilter) {
        query += ` AND ${dateFilter}`
      }
    }

    // Count total conversations for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count`
    const countResult = await db.query(countQuery, queryParams)
    const totalConversations = Number.parseInt(countResult.rows[0].count)

    // Add pagination to the main query
    query += ` ORDER BY ac.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Format the conversations
    const conversations = result.rows.map((row) => ({
      conversation_id: row.conversation_id,
      user_id: row.user_id,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_seconds: row.duration_seconds || 0,
      message_count: row.message_count || 0,
      satisfaction_rating: row.satisfaction_rating,
      topic: row.topic,
      is_resolved: row.is_resolved,
      created_at: row.created_at,
      user: row.user_id
        ? {
            user_id: row.user_id,
            username: row.username,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            profile_picture: row.profile_picture,
          }
        : null,
    }))

    res.json({
      conversations,
      pagination: {
        totalConversations,
        totalPages: Math.ceil(totalConversations / limit),
        currentPage: Number.parseInt(page),
        limit: Number.parseInt(limit),
      },
      debug: {
        totalCount: totalConversations,
        tableExists: true,
      },
    })
  } catch (error) {
    console.error("Error fetching AI conversations:", error)
    res.status(500).json({
      error: "Failed to fetch AI conversations",
      conversations: [],
      pagination: { totalConversations: 0, totalPages: 0, currentPage: 1, limit: 10 },
      debug: {
        error: error.message,
        totalCount: 0,
        tableExists: false,
      },
    })
  }
}

const getAIConversationById = async (req, res) => {
  try {
    const { id } = req.params

    // Get conversation details
    const conversationQuery = `
      SELECT 
        ac.conversation_id, ac.user_id, ac.start_time, ac.end_time, 
        ac.duration_seconds, ac.message_count, ac.satisfaction_rating, 
        ac.topic, ac.is_resolved, ac.created_at,
        u.username, u.first_name, u.last_name, u.email, u.profile_picture
      FROM ai_conversations ac
      LEFT JOIN users u ON ac.user_id = u.user_id
      WHERE ac.conversation_id = $1
    `

    const conversationResult = await db.query(conversationQuery, [id])

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    const conversation = conversationResult.rows[0]

    // Get messages for this conversation
    const messagesQuery = `
      SELECT message_id, sender, content, timestamp
      FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY timestamp ASC
    `

    const messagesResult = await db.query(messagesQuery, [id])

    const formattedConversation = {
      conversation_id: conversation.conversation_id,
      user_id: conversation.user_id,
      start_time: conversation.start_time,
      end_time: conversation.end_time,
      duration_seconds: conversation.duration_seconds || 0,
      message_count: conversation.message_count || 0,
      satisfaction_rating: conversation.satisfaction_rating,
      topic: conversation.topic,
      is_resolved: conversation.is_resolved,
      created_at: conversation.created_at,
      user: conversation.user_id
        ? {
            user_id: conversation.user_id,
            username: conversation.username,
            first_name: conversation.first_name,
            last_name: conversation.last_name,
            email: conversation.email,
            profile_picture: conversation.profile_picture,
          }
        : null,
      messages: messagesResult.rows,
    }

    res.json({ conversation: formattedConversation })
  } catch (error) {
    console.error("Error fetching AI conversation:", error)
    res.status(500).json({ error: "Failed to fetch conversation details" })
  }
}

const createSampleAIConversations = async (req, res) => {
  try {
    // First, check if we have any users
    const usersResult = await db.query("SELECT user_id FROM users LIMIT 5")

    if (usersResult.rows.length === 0) {
      return res.status(400).json({ error: "No users found. Please create some users first." })
    }

    const userIds = usersResult.rows.map((row) => row.user_id)

    // Create sample conversations
    const sampleConversations = [
      {
        user_id: userIds[0],
        topic: "English Grammar Practice",
        message_count: 15,
        duration_seconds: 1200,
        satisfaction_rating: "positive",
        is_resolved: true,
      },
      {
        user_id: userIds[1] || userIds[0],
        topic: "Vocabulary Building",
        message_count: 8,
        duration_seconds: 600,
        satisfaction_rating: "neutral",
        is_resolved: false,
      },
      {
        user_id: userIds[2] || userIds[0],
        topic: "Pronunciation Help",
        message_count: 12,
        duration_seconds: 900,
        satisfaction_rating: "positive",
        is_resolved: true,
      },
    ]

    for (const conv of sampleConversations) {
      // Insert conversation
      const conversationResult = await db.query(
        `
        INSERT INTO ai_conversations (user_id, topic, message_count, duration_seconds, satisfaction_rating, is_resolved, start_time, end_time)
        VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '${conv.duration_seconds} seconds')
        RETURNING conversation_id
      `,
        [
          conv.user_id,
          conv.topic,
          conv.message_count,
          conv.duration_seconds,
          conv.satisfaction_rating,
          conv.is_resolved,
        ],
      )

      const conversationId = conversationResult.rows[0].conversation_id

      // Insert sample messages
      const sampleMessages = [
        { sender: "user", content: "Hello, I need help with English" },
        {
          sender: "ai",
          content: "Hello! I'd be happy to help you with English. What specific area would you like to work on?",
        },
        { sender: "user", content: `I want to practice ${conv.topic.toLowerCase()}` },
        { sender: "ai", content: `Great choice! Let's start with some ${conv.topic.toLowerCase()} exercises.` },
      ]

      for (let i = 0; i < sampleMessages.length; i++) {
        await db.query(
          `
          INSERT INTO ai_messages (conversation_id, sender, content, timestamp)
          VALUES ($1, $2, $3, NOW() - INTERVAL '1 day' + INTERVAL '${i * 30} seconds')
        `,
          [conversationId, sampleMessages[i].sender, sampleMessages[i].content],
        )
      }
    }

    res.json({ message: "Sample AI conversations created successfully!" })
  } catch (error) {
    console.error("Error creating sample conversations:", error)
    res.status(500).json({ error: "Failed to create sample conversations" })
  }
}

module.exports = {
  // User Management
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,

  // Course Management
  getCourses,
  getCourseById,
  deleteCourse,
  createCourse,
  updateCourse,

  // Statistics
  getUserStats,
  getCourseStats,
  getRevenueStats,

  // System Configuration
  getSystemSettings,
  updateSystemSettings,

  // Student Performance
  getSubmissions,
  getPerformanceAnalytics,

  // AI Conversation Management
  getAIConversations,
  getAIConversationById,
  createSampleAIConversations,
}
