const express = require("express")
const router = express.Router()
const courseController = require("../controllers/courseController")
const authMiddleware = require("../middleware/auth")
const { check } = require("express-validator")

// Các route công khai
router.get("/courses", courseController.getAllCourses)
router.get("/courses/categories", courseController.getCourseCategories)

// Các route cần xác thực
router.get("/courses/recommended", authMiddleware, courseController.getRecommendedCourses) // Move this before /courses/:courseId
router.get("/courses/user/enrolled", authMiddleware, courseController.getUserEnrolledCourses)

// Route for course details (should come after more specific routes like /recommended)
router.get("/courses/:courseId", courseController.getCourseDetails)
// In courseRoutes.js
router.get("/courses/:courseId/learn", authMiddleware, courseController.getCourseLearnDetails)
// In courseRoutes.js
router.get("/courses/:courseId/lessons/:lessonId/resources", authMiddleware, courseController.getLessonResources)
router.get("/courses/:courseId/lessons/:lessonId/notes", authMiddleware, courseController.getLessonNotes)
router.post("/courses/:courseId/lessons/:lessonId/notes", authMiddleware, courseController.saveLessonNote)
router.delete("/courses/:courseId/lessons/:lessonId/notes/:noteId", authMiddleware, courseController.deleteLessonNote)
router.get("/courses/:courseId/lessons/:lessonId/assignments", authMiddleware, courseController.getLessonAssignments)
router.post("/courses/:courseId/assignments/:assignmentId/submit", authMiddleware, courseController.submitAssignment)
router.get("/courses/assignments/history", authMiddleware, courseController.getUserAssignmentHistory)
router.post(
  "/courses/:courseId/assignments/:assignmentId/test/complete",
  authMiddleware,
  courseController.markTestComplete,
)
router.post(
  "/courses/:courseId/enroll",
  [
    authMiddleware,
    check("payment_method")
      .optional()
      .isIn(["vnpay", "momo", "credit_card", "bank_transfer"])
      .withMessage("Phương thức thanh toán không hợp lệ"),
  ],
  courseController.enrollCourse,
)

module.exports = router
