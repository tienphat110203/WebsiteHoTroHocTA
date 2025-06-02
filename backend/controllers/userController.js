// controllers/userController.js
const db = require("../db")
const bcrypt = require("bcryptjs")
const { validationResult } = require("express-validator")
const fs = require("fs")
const path = require("path")
const multer = require("multer")
const { v4: uuidv4 } = require("uuid")

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/profile_pictures")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"]
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG and GIF are allowed."), false)
  }
}

exports.upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
})

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.bio, u.profile_picture, 
        u.role, u.is_active, u.is_verified, u.last_login, u.created_at,
        (SELECT COUNT(*) FROM user_courses WHERE user_id = u.user_id) as enrolled_courses,
        (SELECT COUNT(*) FROM user_lessons WHERE user_id = u.user_id AND is_completed = true) as completed_lessons,
        (SELECT COUNT(*) FROM certificates WHERE user_id = u.user_id) as certificates_count
      FROM users u
      WHERE u.user_id = $1`,
      [req.user.id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    // Format the response
    const profile = result.rows[0]

    // Combine first_name and last_name for display purposes
    profile.full_name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim()

    res.json({ profile })
  } catch (err) {
    console.error("Error in getProfile:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { first_name, last_name, bio } = req.body
    let profilePicturePath = null

    // Check if user exists
    const userCheck = await db.query("SELECT * FROM users WHERE user_id = $1", [req.user.id])

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    // Handle profile picture upload if file exists
    if (req.file) {
      // Delete old profile picture if exists
      if (userCheck.rows[0].profile_picture) {
        const oldPicturePath = path.join(
          __dirname,
          "../uploads/profile_pictures",
          path.basename(userCheck.rows[0].profile_picture),
        )
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath)
        }
      }

      // Set new profile picture path
      profilePicturePath = `/uploads/profile_pictures/${req.file.filename}`
    }

    // Update user profile
    const updateFields = []
    const updateValues = []
    let valueIndex = 1

    if (first_name !== undefined) {
      updateFields.push(`first_name = $${valueIndex}`)
      updateValues.push(first_name)
      valueIndex++
    }

    if (last_name !== undefined) {
      updateFields.push(`last_name = $${valueIndex}`)
      updateValues.push(last_name)
      valueIndex++
    }

    if (bio !== undefined) {
      updateFields.push(`bio = $${valueIndex}`)
      updateValues.push(bio)
      valueIndex++
    }

    if (profilePicturePath) {
      updateFields.push(`profile_picture = $${valueIndex}`)
      updateValues.push(profilePicturePath)
      valueIndex++
    }

    updateFields.push(`updated_at = NOW()`)

    // Add user_id as the last parameter
    updateValues.push(req.user.id)

    const result = await db.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE user_id = $${valueIndex} 
       RETURNING user_id, username, email, first_name, last_name, bio, profile_picture, role, is_active, is_verified`,
      updateValues,
    )

    // Format the response
    const user = result.rows[0]

    // Combine first_name and last_name for display purposes
    user.full_name = `${user.first_name || ""} ${user.last_name || ""}`.trim()

    res.json({
      message: "Profile updated successfully",
      user,
    })
  } catch (err) {
    console.error("Error in updateProfile:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Change password
exports.changePassword = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { current_password, new_password } = req.body

    // Check if user exists
    const result = await db.query("SELECT * FROM users WHERE user_id = $1", [req.user.id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = result.rows[0]

    // Check current password
    const isMatch = await bcrypt.compare(current_password, user.password_hash)
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(new_password, salt)

    // Update password
    await db.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2", [
      hashedPassword,
      req.user.id,
    ])

    // Record user activity (if you have an activity tracking table)
    try {
      await db.query("INSERT INTO user_verification (user_id, token, type, expires_at) VALUES ($1, $2, $3, $4)", [
        req.user.id,
        uuidv4(),
        "password_reset",
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      ])
    } catch (activityErr) {
      console.error("Error recording password change activity:", activityErr)
      // Continue execution even if activity recording fails
    }

    res.json({ message: "Password changed successfully" })
  } catch (err) {
    console.error("Error in changePassword:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Get user dashboard data
exports.getDashboard = async (req, res) => {
  try {
    // Get user courses with progress
    const coursesResult = await db.query(
      `SELECT uc.course_id, uc.enrollment_date, uc.completion_date, uc.progress_percentage, uc.is_completed,
        c.title, c.description, c.thumbnail_url, c.difficulty_level, c.language_skill,
        u.username as instructor_username, u.first_name as instructor_first_name, u.last_name as instructor_last_name,
        (SELECT COUNT(*) FROM lessons l JOIN modules m ON l.module_id = m.module_id WHERE m.course_id = c.course_id) as total_lessons,
        (SELECT COUNT(*) FROM user_lessons ul JOIN lessons l ON ul.lesson_id = l.lesson_id 
         JOIN modules m ON l.module_id = m.module_id 
         WHERE ul.user_id = $1 AND m.course_id = c.course_id AND ul.is_completed = true) as completed_lessons
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.course_id
      JOIN users u ON c.instructor_id = u.user_id
      WHERE uc.user_id = $1
      ORDER BY uc.last_accessed_at DESC NULLS LAST, uc.enrollment_date DESC`,
      [req.user.id],
    )

    // Get recent activities
    let activitiesResult = { rows: [] }
    try {
      activitiesResult = await db.query(
        `SELECT ul.lesson_id, ul.last_accessed_at, ul.is_completed, 
          l.title as lesson_title,
          m.title as module_title,
          c.title as course_title,
          c.course_id
        FROM user_lessons ul
        JOIN lessons l ON ul.lesson_id = l.lesson_id
        JOIN modules m ON l.module_id = m.module_id
        JOIN courses c ON m.course_id = c.course_id
        WHERE ul.user_id = $1
        ORDER BY ul.last_accessed_at DESC NULLS LAST
        LIMIT 10`,
        [req.user.id],
      )
    } catch (activityErr) {
      console.error("Error fetching user activities:", activityErr)
      // Continue execution even if activity fetch fails
    }

    // Get user certificates - Check if certificates table exists
    let certificatesResult = { rows: [] }
    try {
      // Check if certificates table exists
      certificatesResult = await db.query(
        `SELECT cert.certificate_id, cert.issue_date, cert.verification_code,
          c.title as course_title, c.course_id,
          ct.name as template_name
        FROM certificates cert
        JOIN courses c ON cert.course_id = c.course_id
        JOIN certificate_templates ct ON cert.template_id = ct.template_id
        WHERE cert.user_id = $1
        ORDER BY cert.issue_date DESC`,
        [req.user.id],
      )
    } catch (certErr) {
      console.error("Error fetching certificates (table might not exist):", certErr)
      // Continue execution even if certificates table doesn't exist
    }

    // Get user badges - Check if badges table exists
    let badgesResult = { rows: [] }
    try {
      // Check if the skill_badges and user_badges tables exist
      const checkBadgesTable = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'skill_badges'
        )`,
      )

      if (checkBadgesTable.rows[0].exists) {
        badgesResult = await db.query(
          `SELECT sb.badge_id, sb.name, sb.description, sb.icon_url, ub.earned_at
          FROM user_badges ub
          JOIN skill_badges sb ON ub.badge_id = sb.badge_id
          WHERE ub.user_id = $1
          ORDER BY ub.earned_at DESC`,
          [req.user.id],
        )
      }
    } catch (badgeErr) {
      console.error("Error fetching badges (table might not exist):", badgeErr)
      // Continue execution even if badges table doesn't exist
    }

    // Get upcoming assignments
    let assignmentsResult = { rows: [] }
    try {
      assignmentsResult = await db.query(
        `SELECT a.assignment_id, a.title, a.description, a.due_date, a.points_possible, a.assignment_type,
          l.title as lesson_title, l.lesson_id,
          m.title as module_title,
          c.title as course_title, c.course_id,
          us.submission_id, us.submitted_at, us.score, us.is_graded
        FROM assignments a
        JOIN lessons l ON a.lesson_id = l.lesson_id
        JOIN modules m ON l.module_id = m.module_id
        JOIN courses c ON m.course_id = c.course_id
        JOIN user_courses uc ON c.course_id = uc.course_id
        LEFT JOIN user_submissions us ON a.assignment_id = us.assignment_id AND us.user_id = $1
        WHERE uc.user_id = $1 AND (us.submission_id IS NULL OR us.is_graded = false)
        ORDER BY a.due_date ASC NULLS LAST
        LIMIT 5`,
        [req.user.id],
      )
    } catch (assignErr) {
      console.error("Error fetching assignments:", assignErr)
      // Continue execution even if assignment fetch fails
    }

    // Get user goals - Check if user_goals table exists
    let goalsResult = { rows: [] }
    try {
      // Check if the user_goals table exists
      const checkGoalsTable = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_goals'
        )`,
      )

      if (checkGoalsTable.rows[0].exists) {
        goalsResult = await db.query(
          `SELECT goal_id, title, description, target_date, is_completed, created_at, updated_at
          FROM user_goals
          WHERE user_id = $1
          ORDER BY target_date ASC NULLS LAST`,
          [req.user.id],
        )
      }
    } catch (goalErr) {
      console.error("Error fetching goals (table might not exist):", goalErr)
      // Continue execution even if goals table doesn't exist
    }

    // Calculate overall progress
    const totalCourses = coursesResult.rows.length
    const completedCourses = coursesResult.rows.filter((course) => course.is_completed).length

    let totalLessons = 0
    let completedLessons = 0

    coursesResult.rows.forEach((course) => {
      totalLessons += Number.parseInt(course.total_lessons || 0)
      completedLessons += Number.parseInt(course.completed_lessons || 0)
    })

    const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    // Format instructor names
    coursesResult.rows.forEach((course) => {
      course.instructor_name =
        `${course.instructor_first_name || ""} ${course.instructor_last_name || ""}`.trim() ||
        course.instructor_username
    })

    res.json({
      courses: coursesResult.rows,
      activities: activitiesResult.rows,
      certificates: certificatesResult.rows,
      badges: badgesResult.rows,
      assignments: assignmentsResult.rows,
      goals: goalsResult.rows,
      stats: {
        enrolledCourses: totalCourses,
        completedCourses,
        completedLessons,
        totalLessons,
        overallProgress,
        certificatesCount: certificatesResult.rows.length,
        badgesCount: badgesResult.rows.length,
      },
    })
  } catch (err) {
    console.error("Error in getDashboard:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Get user learning history
exports.getLearningHistory = async (req, res) => {
  try {
    // Get lesson progress with details
    const result = await db.query(
      `SELECT ul.lesson_id, ul.is_completed, ul.progress_percentage, ul.last_accessed_at, ul.notes,
        l.title as lesson_title, 
        m.title as module_title, m.module_id,
        c.title as course_title, c.course_id, c.thumbnail_url
      FROM user_lessons ul
      JOIN lessons l ON ul.lesson_id = l.lesson_id
      JOIN modules m ON l.module_id = m.module_id
      JOIN courses c ON m.course_id = c.course_id
      WHERE ul.user_id = $1
      ORDER BY ul.last_accessed_at DESC NULLS LAST`,
      [req.user.id],
    )

    // Get course progress
    const courseProgressResult = await db.query(
      `SELECT uc.course_id, uc.enrollment_date, uc.completion_date, uc.progress_percentage, uc.is_completed,
        c.title, c.thumbnail_url, c.difficulty_level
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.course_id
      WHERE uc.user_id = $1
      ORDER BY uc.last_accessed_at DESC NULLS LAST, uc.enrollment_date DESC`,
      [req.user.id],
    )

    // Get assignment submissions
    const submissionsResult = await db.query(
      `SELECT us.submission_id, us.submitted_at, us.score, us.is_graded, us.feedback,
        a.title as assignment_title, a.assignment_id, a.assignment_type, a.points_possible,
        l.title as lesson_title, l.lesson_id,
        c.title as course_title, c.course_id
      FROM user_submissions us
      JOIN assignments a ON us.assignment_id = a.assignment_id
      JOIN lessons l ON a.lesson_id = l.lesson_id
      JOIN modules m ON l.module_id = m.module_id
      JOIN courses c ON m.course_id = c.course_id
      WHERE us.user_id = $1
      ORDER BY us.submitted_at DESC`,
      [req.user.id],
    )

    res.json({
      lessons: result.rows,
      courses: courseProgressResult.rows,
      submissions: submissionsResult.rows,
    })
  } catch (err) {
    console.error("Error in getLearningHistory:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Get notification settings
exports.getNotificationSettings = async (req, res) => {
  try {
    // Check if we have a user_reminders table
    let reminderResult = { rows: [] }
    try {
      // Check if the user_reminders table exists
      const checkRemindersTable = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_reminders'
        )`,
      )

      if (checkRemindersTable.rows[0].exists) {
        reminderResult = await db.query("SELECT * FROM user_reminders WHERE user_id = $1 LIMIT 1", [req.user.id])
      }
    } catch (err) {
      console.error("Error checking user_reminders table:", err)
      // Continue with default settings
    }

    // Default settings if none found
    const settings = {
      email_notifications: true,
      push_notifications: true,
      course_updates: true,
      assignment_reminders: true,
      forum_activity: true,
      promotional_emails: false,
    }

    // If we have settings, use them
    if (reminderResult.rows.length > 0) {
      const reminder = reminderResult.rows[0]

      // Extract settings from the reminder or its description
      try {
        const reminderSettings = JSON.parse(reminder.description || "{}")
        settings.email_notifications = reminderSettings.email_notifications ?? settings.email_notifications
        settings.push_notifications = reminderSettings.push_notifications ?? settings.push_notifications
        settings.course_updates = reminderSettings.course_updates ?? settings.course_updates
        settings.assignment_reminders = reminderSettings.assignment_reminders ?? settings.assignment_reminders
        settings.forum_activity = reminderSettings.forum_activity ?? settings.forum_activity
        settings.promotional_emails = reminderSettings.promotional_emails ?? settings.promotional_emails
      } catch (e) {
        console.error("Error parsing reminder settings:", e)
        // Continue with default settings
      }
    }

    res.json({ settings })
  } catch (err) {
    console.error("Error in getNotificationSettings:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Update notification settings
exports.updateNotificationSettings = async (req, res) => {
  try {
    const {
      email_notifications,
      push_notifications,
      course_updates,
      assignment_reminders,
      forum_activity,
      promotional_emails,
    } = req.body

    // Create settings object
    const settingsObject = {
      email_notifications,
      push_notifications,
      course_updates,
      assignment_reminders,
      forum_activity,
      promotional_emails,
    }

    // Check if user_reminders table exists
    try {
      // Check if the user_reminders table exists
      const checkRemindersTable = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_reminders'
        )`,
      )

      if (checkRemindersTable.rows[0].exists) {
        // Check if we already have a reminder for this user
        const existingReminder = await db.query("SELECT * FROM user_reminders WHERE user_id = $1 AND title = $2", [
          req.user.id,
          "Notification Settings",
        ])

        if (existingReminder.rows.length > 0) {
          // Update existing reminder
          await db.query(
            `UPDATE user_reminders 
             SET description = $1, updated_at = NOW() 
             WHERE user_id = $2 AND title = $3`,
            [JSON.stringify(settingsObject), req.user.id, "Notification Settings"],
          )
        } else {
          // Create new reminder
          await db.query(
            `INSERT INTO user_reminders 
             (user_id, title, description, reminder_time, is_recurring) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              req.user.id,
              "Notification Settings",
              JSON.stringify(settingsObject),
              new Date(), // Current time
              false, // Not a recurring reminder
            ],
          )
        }
      } else {
        // If user_reminders table doesn't exist, store settings in user_preferences table if it exists
        const checkPreferencesTable = await db.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'user_preferences'
          )`,
        )

        if (checkPreferencesTable.rows[0].exists) {
          // Check if we already have preferences for this user
          const existingPreferences = await db.query("SELECT * FROM user_preferences WHERE user_id = $1", [req.user.id])

          if (existingPreferences.rows.length > 0) {
            // Update existing preferences
            await db.query(
              `UPDATE user_preferences 
               SET preferences = $1, updated_at = NOW() 
               WHERE user_id = $2`,
              [JSON.stringify(settingsObject), req.user.id],
            )
          } else {
            // Create new preferences
            await db.query(
              `INSERT INTO user_preferences 
               (user_id, preferences, created_at) 
               VALUES ($1, $2, $3)`,
              [
                req.user.id,
                JSON.stringify(settingsObject),
                new Date(), // Current time
              ],
            )
          }
        }
      }
    } catch (err) {
      console.error("Error updating notification settings in database:", err)
      // Continue and just return the settings object without storing it
    }

    res.json({
      message: "Notification settings updated successfully",
      settings: settingsObject,
    })
  } catch (err) {
    console.error("Error in updateNotificationSettings:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Thêm hàm mới vào userController.js để xử lý thông báo

// Lấy thông báo của người dùng
exports.getUserNotifications = async (req, res) => {
  try {
    // Lấy thông báo của người dùng từ database
    const query = `
      SELECT un.user_notification_id, un.is_read, un.read_at, un.created_at,
             sn.title, sn.content, sn.notification_id, sn.target_role, sn.expires_at
      FROM user_notifications un
      JOIN system_notifications sn ON un.notification_id = sn.notification_id
      WHERE un.user_id = $1
      ORDER BY un.created_at DESC
      LIMIT 20
    `

    const result = await db.query(query, [req.user.id])

    // Xử lý dữ liệu để thêm thông tin về loại thông báo
    const notifications = result.rows.map((notification) => {
      // Xác định loại thông báo dựa vào nội dung hoặc tiêu đề
      let type = "system"

      const title = notification.title.toLowerCase()
      const content = (notification.content || "").toLowerCase()

      if (
        title.includes("bài học") ||
        content.includes("bài học") ||
        title.includes("khóa học") ||
        content.includes("khóa học")
      ) {
        type = "course_update"
      } else if (
        title.includes("bài tập") ||
        content.includes("bài tập") ||
        title.includes("assignment") ||
        content.includes("assignment")
      ) {
        type = "assignment"
      } else if (
        title.includes("deadline") ||
        content.includes("deadline") ||
        title.includes("hạn chót") ||
        content.includes("hạn chót")
      ) {
        type = "deadline"
      } else if (
        title.includes("phản hồi") ||
        content.includes("phản hồi") ||
        title.includes("feedback") ||
        content.includes("feedback")
      ) {
        type = "feedback"
      } else if (
        title.includes("chúc mừng") ||
        content.includes("chúc mừng") ||
        title.includes("thành tích") ||
        content.includes("thành tích") ||
        title.includes("achievement") ||
        content.includes("achievement")
      ) {
        type = "achievement"
      } else if (
        title.includes("nhắc nhở") ||
        content.includes("nhắc nhở") ||
        title.includes("reminder") ||
        content.includes("reminder")
      ) {
        type = "reminder"
      } else if (
        title.includes("cảnh báo") ||
        content.includes("cảnh báo") ||
        title.includes("warning") ||
        content.includes("warning")
      ) {
        type = "warning"
      } else if (
        title.includes("thành công") ||
        content.includes("thành công") ||
        title.includes("success") ||
        content.includes("success")
      ) {
        type = "success"
      }

      return {
        ...notification,
        type,
      }
    })

    // Đếm số thông báo chưa đọc
    const unreadCountQuery = `
      SELECT COUNT(*) as unread_count
      FROM user_notifications
      WHERE user_id = $1 AND is_read = false
    `

    const unreadResult = await db.query(unreadCountQuery, [req.user.id])
    const unreadCount = Number.parseInt(unreadResult.rows[0].unread_count || 0)

    res.json({
      notifications,
      unreadCount,
    })
  } catch (err) {
    console.error("Error in getUserNotifications:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Đánh dấu thông báo đã đọc
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params

    // Kiểm tra xem thông báo có thuộc về người dùng không
    const checkQuery = `
      SELECT * FROM user_notifications
      WHERE user_notification_id = $1 AND user_id = $2
    `

    const checkResult = await db.query(checkQuery, [id, req.user.id])

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Thông báo không tồn tại" })
    }

    // Cập nhật trạng thái đã đọc
    const updateQuery = `
      UPDATE user_notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE user_notification_id = $1
      RETURNING *
    `

    await db.query(updateQuery, [id])

    res.json({ message: "Đã đánh dấu thông báo là đã đọc" })
  } catch (err) {
    console.error("Error in markNotificationAsRead:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Đánh dấu tất cả thông báo đã đọc
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const updateQuery = `
      UPDATE user_notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false
    `

    await db.query(updateQuery, [req.user.id])

    res.json({ message: "Đã đánh dấu tất cả thông báo là đã đọc" })
  } catch (err) {
    console.error("Error in markAllNotificationsAsRead:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}
