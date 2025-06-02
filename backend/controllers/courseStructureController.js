const db = require("../db")

// Get course structure with modules, lessons, and resources
exports.getCourseStructure = async (req, res) => {
  try {
    const { courseId } = req.params

    // Get course details
    const courseResult = await db.query("SELECT * FROM courses WHERE course_id = $1", [courseId])

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" })
    }

    const course = courseResult.rows[0]

    // Get modules with lessons and resources
    const modulesResult = await db.query(
      `SELECT m.* 
       FROM modules m
       WHERE m.course_id = $1
       ORDER BY m.position`,
      [courseId],
    )

    const modules = modulesResult.rows

    // Get lessons for all modules
    if (modules.length > 0) {
      const moduleIds = modules.map((module) => module.module_id)

      const lessonsResult = await db.query(
        `SELECT l.* 
         FROM lessons l
         WHERE l.module_id = ANY($1::int[])
         ORDER BY l.module_id, l.position`,
        [moduleIds],
      )

      const lessons = lessonsResult.rows

      // Get resources for all lessons
      if (lessons.length > 0) {
        const lessonIds = lessons.map((lesson) => lesson.lesson_id)

        const resourcesResult = await db.query(
          `SELECT r.* 
           FROM resources r
           WHERE r.lesson_id = ANY($1::int[])
           ORDER BY r.lesson_id, r.resource_id`,
          [lessonIds],
        )

        const resources = resourcesResult.rows

        // Group resources by lesson_id
        const resourcesByLesson = {}
        resources.forEach((resource) => {
          if (!resourcesByLesson[resource.lesson_id]) {
            resourcesByLesson[resource.lesson_id] = []
          }
          resourcesByLesson[resource.lesson_id].push(resource)
        })

        // Add resources to lessons
        lessons.forEach((lesson) => {
          lesson.resources = resourcesByLesson[lesson.lesson_id] || []
        })
      }

      // Group lessons by module_id
      const lessonsByModule = {}
      lessons.forEach((lesson) => {
        if (!lessonsByModule[lesson.module_id]) {
          lessonsByModule[lesson.module_id] = []
        }
        lessonsByModule[lesson.module_id].push(lesson)
      })

      // Add lessons to modules
      modules.forEach((module) => {
        module.lessons = lessonsByModule[module.module_id] || []
      })
    }

    return res.json({
      course,
      modules,
    })
  } catch (err) {
    console.error("Error in getCourseStructure:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Module operations
exports.createModule = async (req, res) => {
  try {
    const { courseId } = req.params
    const { title, description, position } = req.body

    // Validate input
    if (!title) {
      return res.status(400).json({ error: "Module title is required" })
    }

    // Check if course exists
    const courseCheck = await db.query("SELECT * FROM courses WHERE course_id = $1", [courseId])

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" })
    }

    // Create module
    const result = await db.query(
      `INSERT INTO modules (course_id, title, description, position, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [courseId, title, description, position],
    )

    return res.status(201).json({
      message: "Module created successfully",
      module: result.rows[0],
    })
  } catch (err) {
    console.error("Error in createModule:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.updateModule = async (req, res) => {
  try {
    const { moduleId } = req.params
    const { title, description } = req.body

    // Validate input
    if (!title) {
      return res.status(400).json({ error: "Module title is required" })
    }

    // Check if module exists
    const moduleCheck = await db.query("SELECT * FROM modules WHERE module_id = $1", [moduleId])

    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({ error: "Module not found" })
    }

    // Update module
    const result = await db.query(
      `UPDATE modules 
       SET title = $1, description = $2, updated_at = NOW()
       WHERE module_id = $3
       RETURNING *`,
      [title, description, moduleId],
    )

    return res.json({
      message: "Module updated successfully",
      module: result.rows[0],
    })
  } catch (err) {
    console.error("Error in updateModule:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.deleteModule = async (req, res) => {
  try {
    const { moduleId } = req.params

    // Check if module exists
    const moduleCheck = await db.query("SELECT * FROM modules WHERE module_id = $1", [moduleId])

    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({ error: "Module not found" })
    }

    // Delete module (cascade will delete lessons and resources)
    await db.query("DELETE FROM modules WHERE module_id = $1", [moduleId])

    return res.json({
      message: "Module deleted successfully",
    })
  } catch (err) {
    console.error("Error in deleteModule:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Lesson operations
exports.createLesson = async (req, res) => {
  try {
    const { moduleId } = req.params
    const { title, description, content, video_url, duration_minutes, position } = req.body

    // Validate input
    if (!title) {
      return res.status(400).json({ error: "Lesson title is required" })
    }

    // Check if module exists
    const moduleCheck = await db.query("SELECT * FROM modules WHERE module_id = $1", [moduleId])

    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({ error: "Module not found" })
    }

    // Create lesson
    const result = await db.query(
      `INSERT INTO lessons (module_id, title, description, content, video_url, duration_minutes, position, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [moduleId, title, description, content, video_url, duration_minutes, position],
    )

    return res.status(201).json({
      message: "Lesson created successfully",
      lesson: result.rows[0],
    })
  } catch (err) {
    console.error("Error in createLesson:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params
    const { title, description, content, video_url, duration_minutes } = req.body

    // Validate input
    if (!title) {
      return res.status(400).json({ error: "Lesson title is required" })
    }

    // Check if lesson exists
    const lessonCheck = await db.query("SELECT * FROM lessons WHERE lesson_id = $1", [lessonId])

    if (lessonCheck.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    // Update lesson
    const result = await db.query(
      `UPDATE lessons 
       SET title = $1, description = $2, content = $3, video_url = $4, duration_minutes = $5, updated_at = NOW()
       WHERE lesson_id = $6
       RETURNING *`,
      [title, description, content, video_url, duration_minutes, lessonId],
    )

    return res.json({
      message: "Lesson updated successfully",
      lesson: result.rows[0],
    })
  } catch (err) {
    console.error("Error in updateLesson:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params

    // Check if lesson exists
    const lessonCheck = await db.query("SELECT * FROM lessons WHERE lesson_id = $1", [lessonId])

    if (lessonCheck.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    // Delete lesson (cascade will delete resources)
    await db.query("DELETE FROM lessons WHERE lesson_id = $1", [lessonId])

    return res.json({
      message: "Lesson deleted successfully",
    })
  } catch (err) {
    console.error("Error in deleteLesson:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Resource operations
exports.createResource = async (req, res) => {
  try {
    const { lessonId } = req.params
    const { title, description, file_url, file_type } = req.body

    // Validate input
    if (!title || !file_url) {
      return res.status(400).json({ error: "Resource title and file URL are required" })
    }

    // Check if lesson exists
    const lessonCheck = await db.query("SELECT * FROM lessons WHERE lesson_id = $1", [lessonId])

    if (lessonCheck.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    // Create resource
    const result = await db.query(
      `INSERT INTO resources (lesson_id, title, description, file_url, file_type, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [lessonId, title, description, file_url, file_type],
    )

    return res.status(201).json({
      message: "Resource created successfully",
      resource: result.rows[0],
    })
  } catch (err) {
    console.error("Error in createResource:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.updateResource = async (req, res) => {
  try {
    const { resourceId } = req.params
    const { title, description, file_url, file_type } = req.body

    // Validate input
    if (!title || !file_url) {
      return res.status(400).json({ error: "Resource title and file URL are required" })
    }

    // Check if resource exists
    const resourceCheck = await db.query("SELECT * FROM resources WHERE resource_id = $1", [resourceId])

    if (resourceCheck.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found" })
    }

    // Update resource
    const result = await db.query(
      `UPDATE resources 
       SET title = $1, description = $2, file_url = $3, file_type = $4
       WHERE resource_id = $5
       RETURNING *`,
      [title, description, file_url, file_type, resourceId],
    )

    return res.json({
      message: "Resource updated successfully",
      resource: result.rows[0],
    })
  } catch (err) {
    console.error("Error in updateResource:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.deleteResource = async (req, res) => {
  try {
    const { resourceId } = req.params

    // Check if resource exists
    const resourceCheck = await db.query("SELECT * FROM resources WHERE resource_id = $1", [resourceId])

    if (resourceCheck.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found" })
    }

    // Delete resource
    await db.query("DELETE FROM resources WHERE resource_id = $1", [resourceId])

    return res.json({
      message: "Resource deleted successfully",
    })
  } catch (err) {
    console.error("Error in deleteResource:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Reordering operations
exports.reorderModules = async (req, res) => {
  try {
    const { courseId } = req.params
    const { moduleOrder } = req.body

    if (!Array.isArray(moduleOrder)) {
      return res.status(400).json({ error: "Module order must be an array" })
    }

    // Update each module's position
    const updatePromises = moduleOrder.map((moduleId, index) => {
      return db.query("UPDATE modules SET position = $1 WHERE module_id = $2 AND course_id = $3", [
        index + 1,
        moduleId,
        courseId,
      ])
    })

    await Promise.all(updatePromises)

    return res.json({
      message: "Modules reordered successfully",
    })
  } catch (err) {
    console.error("Error in reorderModules:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.reorderLessons = async (req, res) => {
  try {
    const { moduleId } = req.params
    const { lessonOrder } = req.body

    if (!Array.isArray(lessonOrder)) {
      return res.status(400).json({ error: "Lesson order must be an array" })
    }

    // Update each lesson's position
    const updatePromises = lessonOrder.map((lessonId, index) => {
      return db.query("UPDATE lessons SET position = $1 WHERE lesson_id = $2 AND module_id = $3", [
        index + 1,
        lessonId,
        moduleId,
      ])
    })

    await Promise.all(updatePromises)

    return res.json({
      message: "Lessons reordered successfully",
    })
  } catch (err) {
    console.error("Error in reorderLessons:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Get assignments for a course
exports.getCourseAssignments = async (req, res) => {
  try {
    const { courseId } = req.params

    // Check if course exists
    const courseCheck = await db.query("SELECT * FROM courses WHERE course_id = $1", [courseId])

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" })
    }

    // Get all modules for the course
    const modulesResult = await db.query("SELECT module_id FROM modules WHERE course_id = $1", [courseId])

    const moduleIds = modulesResult.rows.map((module) => module.module_id)

    if (moduleIds.length === 0) {
      return res.json({ assignments: [] })
    }

    // Get all lessons for these modules
    const lessonsResult = await db.query("SELECT lesson_id FROM lessons WHERE module_id = ANY($1::int[])", [moduleIds])

    const lessonIds = lessonsResult.rows.map((lesson) => lesson.lesson_id)

    if (lessonIds.length === 0) {
      return res.json({ assignments: [] })
    }

    // Get all assignments for these lessons
    const assignmentsResult = await db.query(
      `SELECT a.*, l.title as lesson_title, m.title as module_title
       FROM assignments a
       JOIN lessons l ON a.lesson_id = l.lesson_id
       JOIN modules m ON l.module_id = m.module_id
       WHERE a.lesson_id = ANY($1::int[])
       ORDER BY m.position, l.position, a.assignment_id`,
      [lessonIds],
    )

    const assignments = assignmentsResult.rows

    // Get questions for each assignment
    if (assignments.length > 0) {
      const assignmentIds = assignments.map((assignment) => assignment.assignment_id)

      const questionsResult = await db.query(
        `SELECT q.*, a.assignment_id
         FROM questions q
         JOIN assignments a ON q.assignment_id = a.assignment_id
         WHERE q.assignment_id = ANY($1::int[])
         ORDER BY q.position, q.question_id`,
        [assignmentIds],
      )

      const questions = questionsResult.rows

      // Get answers for each question
      if (questions.length > 0) {
        const questionIds = questions.map((question) => question.question_id)

        const answersResult = await db.query(
          `SELECT * FROM answers
           WHERE question_id = ANY($1::int[])
           ORDER BY answer_id`,
          [questionIds],
        )

        const answers = answersResult.rows

        // Group answers by question_id
        const answersByQuestion = {}
        answers.forEach((answer) => {
          if (!answersByQuestion[answer.question_id]) {
            answersByQuestion[answer.question_id] = []
          }
          answersByQuestion[answer.question_id].push(answer)
        })

        // Add answers to questions
        questions.forEach((question) => {
          question.answers = answersByQuestion[question.question_id] || []
        })
      }

      // Group questions by assignment_id
      const questionsByAssignment = {}
      questions.forEach((question) => {
        if (!questionsByAssignment[question.assignment_id]) {
          questionsByAssignment[question.assignment_id] = []
        }
        questionsByAssignment[question.assignment_id].push(question)
      })

      // Add questions to assignments
      assignments.forEach((assignment) => {
        assignment.questions = questionsByAssignment[assignment.assignment_id] || []
      })
    }

    return res.json({ assignments })
  } catch (err) {
    console.error("Error in getCourseAssignments:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Create assignment
const createAssignment = async (req, res) => {
  try {
    const { courseId } = req.params
    const { title, description, instructions, due_date, points_possible, assignment_type, is_auto_graded, lesson_id } =
      req.body

    console.log("Creating assignment with data:", {
      courseId,
      title,
      description,
      instructions,
      due_date,
      points_possible,
      assignment_type,
      is_auto_graded,
      lesson_id,
    })

    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: "Assignment title is required" })
    }

    // If lesson_id is empty, try to find the first lesson in the course
    let finalLessonId = lesson_id

    if (!finalLessonId || finalLessonId === "") {
      console.log("No lesson_id provided, attempting to find the first lesson in the course")

      // Get the first module in the course
      const moduleResult = await db.query(
        `SELECT module_id FROM modules 
         WHERE course_id = $1 
         ORDER BY position ASC LIMIT 1`,
        [courseId],
      )

      if (moduleResult.rows.length === 0) {
        return res.status(400).json({
          error: "Cannot create assignment - no modules found in this course. Please create a module and lesson first.",
        })
      }

      const firstModuleId = moduleResult.rows[0].module_id

      // Get the first lesson in that module
      const lessonResult = await db.query(
        `SELECT lesson_id FROM lessons 
         WHERE module_id = $1 
         ORDER BY position ASC LIMIT 1`,
        [firstModuleId],
      )

      if (lessonResult.rows.length === 0) {
        return res.status(400).json({
          error: "Cannot create assignment - no lessons found in this course. Please create a lesson first.",
        })
      }

      finalLessonId = lessonResult.rows[0].lesson_id
      console.log(`Found first lesson in course: ${finalLessonId}`)
    }

    // Create assignment in the database
    const query = `
      INSERT INTO assignments (
        title, 
        description, 
        instructions, 
        due_date, 
        points_possible, 
        assignment_type, 
        is_auto_graded, 
        lesson_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING assignment_id, title, description, instructions, due_date, 
               points_possible, assignment_type, is_auto_graded, lesson_id
    `

    const values = [
      title,
      description || null,
      instructions || null,
      due_date || null,
      points_possible || 0,
      assignment_type || "quiz",
      is_auto_graded || false,
      finalLessonId,
    ]

    console.log("Executing query with values:", values)
    const result = await db.query(query, values)
    console.log("Assignment created successfully:", result.rows[0])

    res.status(201).json({
      assignment: result.rows[0],
      message: "Assignment created successfully",
    })
  } catch (error) {
    console.error("Error creating assignment:", error)
    res.status(500).json({
      error: "Failed to create assignment",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
}

exports.updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params
    const { title, description, instructions, due_date, points_possible, assignment_type, is_auto_graded } = req.body

    // Validate input
    if (!title) {
      return res.status(400).json({ error: "Assignment title is required" })
    }

    // Check if assignment exists
    const assignmentCheck = await db.query("SELECT * FROM assignments WHERE assignment_id = $1", [assignmentId])

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" })
    }

    // Update assignment
    const result = await db.query(
      `UPDATE assignments 
       SET title = $1, description = $2, instructions = $3, due_date = $4,
           points_possible = $5, assignment_type = $6, is_auto_graded = $7,
           updated_at = NOW()
       WHERE assignment_id = $8
       RETURNING *`,
      [title, description, instructions, due_date, points_possible, assignment_type, is_auto_graded, assignmentId],
    )

    return res.json({
      message: "Assignment updated successfully",
      assignment: result.rows[0],
    })
  } catch (err) {
    console.error("Error in updateAssignment:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params

    // Check if assignment exists
    const assignmentCheck = await db.query("SELECT * FROM assignments WHERE assignment_id = $1", [assignmentId])

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" })
    }

    // Delete assignment (cascade will delete questions and answers)
    await db.query("DELETE FROM assignments WHERE assignment_id = $1", [assignmentId])

    return res.json({
      message: "Assignment deleted successfully",
    })
  } catch (err) {
    console.error("Error in deleteAssignment:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Question operations
exports.createQuestion = async (req, res) => {
  try {
    const { assignmentId } = req.params
    const { question_text, question_type, points, position, answers } = req.body

    // Validate input
    if (!question_text || !question_type) {
      return res.status(400).json({ error: "Question text and type are required" })
    }

    // Check if assignment exists
    const assignmentCheck = await db.query("SELECT * FROM assignments WHERE assignment_id = $1", [assignmentId])

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" })
    }

    // Start a transaction
    await db.query("BEGIN")

    try {
      // Create question
      const questionResult = await db.query(
        `INSERT INTO questions (assignment_id, question_text, question_type, points, position)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [assignmentId, question_text, question_type, points, position],
      )

      const question = questionResult.rows[0]

      // Create answers if provided
      if (answers && Array.isArray(answers) && answers.length > 0) {
        const answerPromises = answers.map((answer) => {
          return db.query(
            `INSERT INTO answers (question_id, answer_text, is_correct, explanation)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [question.question_id, answer.answer_text, answer.is_correct, answer.explanation],
          )
        })

        const answerResults = await Promise.all(answerPromises)
        question.answers = answerResults.map((result) => result.rows[0])
      }

      // Commit the transaction
      await db.query("COMMIT")

      return res.status(201).json({
        message: "Question created successfully",
        question,
      })
    } catch (err) {
      // Rollback the transaction in case of error
      await db.query("ROLLBACK")
      throw err
    }
  } catch (err) {
    console.error("Error in createQuestion:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params
    const { question_text, question_type, points, position, answers } = req.body

    // Validate input
    if (!question_text || !question_type) {
      return res.status(400).json({ error: "Question text and type are required" })
    }

    // Check if question exists
    const questionCheck = await db.query("SELECT * FROM questions WHERE question_id = $1", [questionId])

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" })
    }

    // Start a transaction
    await db.query("BEGIN")

    try {
      // Update question
      const questionResult = await db.query(
        `UPDATE questions 
         SET question_text = $1, question_type = $2, points = $3, position = $4
         WHERE question_id = $5
         RETURNING *`,
        [question_text, question_type, points, position, questionId],
      )

      const question = questionResult.rows[0]

      // Update answers if provided
      if (answers && Array.isArray(answers)) {
        // Delete existing answers
        await db.query("DELETE FROM answers WHERE question_id = $1", [questionId])

        // Create new answers
        if (answers.length > 0) {
          const answerPromises = answers.map((answer) => {
            return db.query(
              `INSERT INTO answers (question_id, answer_text, is_correct, explanation)
               VALUES ($1, $2, $3, $4)
               RETURNING *`,
              [questionId, answer.answer_text, answer.is_correct, answer.explanation],
            )
          })

          const answerResults = await Promise.all(answerPromises)
          question.answers = answerResults.map((result) => result.rows[0])
        }
      }

      // Commit the transaction
      await db.query("COMMIT")

      return res.json({
        message: "Question updated successfully",
        question,
      })
    } catch (err) {
      // Rollback the transaction in case of error
      await db.query("ROLLBACK")
      throw err
    }
  } catch (err) {
    console.error("Error in updateQuestion:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

exports.deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params

    // Check if question exists
    const questionCheck = await db.query("SELECT * FROM questions WHERE question_id = $1", [questionId])

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" })
    }

    // Delete question (cascade will delete answers)
    await db.query("DELETE FROM questions WHERE question_id = $1", [questionId])

    return res.json({
      message: "Question deleted successfully",
    })
  } catch (err) {
    console.error("Error in deleteQuestion:", err)
    return res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Add this new function to get all assignments across all courses
const getAllAssignments = async (req, res) => {
  try {
    const { search = "", course_id = "" } = req.query

    let query = `
      SELECT 
        a.assignment_id, a.title, a.description, a.instructions,
        a.due_date, a.points_possible, a.assignment_type, a.is_auto_graded,
        a.created_at, a.updated_at,
        l.title as lesson_title, l.lesson_id,
        m.title as module_title, m.module_id,
        c.title as course_title, c.course_id,
        (SELECT COUNT(*) FROM user_submissions WHERE assignment_id = a.assignment_id) as submissions_count,
        (SELECT COUNT(*) FROM user_submissions WHERE assignment_id = a.assignment_id AND is_graded = true) as graded_count,
        (SELECT COALESCE(AVG(score), 0) FROM user_submissions WHERE assignment_id = a.assignment_id AND is_graded = true) as average_score
      FROM assignments a
      JOIN lessons l ON a.lesson_id = l.lesson_id
      JOIN modules m ON l.module_id = m.module_id
      JOIN courses c ON m.course_id = c.course_id
      WHERE 1=1
    `

    const queryParams = []

    // Apply search filter
    if (search) {
      query += ` AND (
        a.title ILIKE $${queryParams.length + 1} OR
        a.description ILIKE $${queryParams.length + 1} OR
        c.title ILIKE $${queryParams.length + 1}
      )`
      queryParams.push(`%${search}%`)
    }

    // Filter by course
    if (course_id) {
      query += ` AND c.course_id = $${queryParams.length + 1}`
      queryParams.push(course_id)
    }

    query += ` ORDER BY a.created_at DESC`

    const result = await db.query(query, queryParams)

    res.json({
      assignments: result.rows,
    })
  } catch (error) {
    console.error("Error fetching all assignments:", error)
    res.status(500).json({ error: "Failed to fetch assignments" })
  }
}

module.exports = {
  getCourseStructure: exports.getCourseStructure,
  createModule: exports.createModule,
  updateModule: exports.updateModule,
  deleteModule: exports.deleteModule,
  createLesson: exports.createLesson,
  updateLesson: exports.updateLesson,
  deleteLesson: exports.deleteLesson,
  createResource: exports.createResource,
  updateResource: exports.updateResource,
  deleteResource: exports.deleteResource,
  reorderModules: exports.reorderModules,
  reorderLessons: exports.reorderLessons,
  getCourseAssignments: exports.getCourseAssignments,
  createAssignment,
  updateAssignment: exports.updateAssignment,
  deleteAssignment: exports.deleteAssignment,
  createQuestion: exports.createQuestion,
  updateQuestion: exports.updateQuestion,
  deleteQuestion: exports.deleteQuestion,
  getAllAssignments,
}
