const express = require("express")
const router = express.Router()
const adminController = require("../controllers/adminController")
const courseStructureController = require("../controllers/courseStructureController")
const adminAuth = require("../middleware/adminAuth")

// User Management
router.get("/users", adminAuth, adminController.getUsers)
router.get("/users/:id", adminAuth, adminController.getUserById)
router.put("/users/:id", adminAuth, adminController.updateUser)
router.delete("/users/:id", adminAuth, adminController.deleteUser)
router.post("/users", adminAuth, adminController.createUser)

// Course Management
router.get("/courses", adminAuth, adminController.getCourses)
router.get("/courses/:id", adminAuth, adminController.getCourseById)
router.post("/courses", adminAuth, adminController.createCourse)
router.put("/courses/:id", adminAuth, adminController.updateCourse)
router.delete("/courses/:id", adminAuth, adminController.deleteCourse)

// Course Structure Management
router.get("/courses/:courseId/structure", adminAuth, courseStructureController.getCourseStructure)
router.post("/courses/:courseId/modules", adminAuth, courseStructureController.createModule)
router.put("/modules/:moduleId", adminAuth, courseStructureController.updateModule)
router.delete("/modules/:moduleId", adminAuth, courseStructureController.deleteModule)
router.post("/modules/:moduleId/lessons", adminAuth, courseStructureController.createLesson)
router.put("/lessons/:lessonId", adminAuth, courseStructureController.updateLesson)
router.delete("/lessons/:lessonId", adminAuth, courseStructureController.deleteLesson)
router.post("/lessons/:lessonId/resources", adminAuth, courseStructureController.createResource)
router.put("/resources/:resourceId", adminAuth, courseStructureController.updateResource)
router.delete("/resources/:resourceId", adminAuth, courseStructureController.deleteResource)
router.put("/courses/:courseId/modules/reorder", adminAuth, courseStructureController.reorderModules)
router.put("/modules/:moduleId/lessons/reorder", adminAuth, courseStructureController.reorderLessons)

// Course Assignments
router.get("/courses/:courseId/assignments", adminAuth, courseStructureController.getCourseAssignments)
router.post("/courses/:courseId/assignments", adminAuth, courseStructureController.createAssignment)
router.put("/assignments/:assignmentId", adminAuth, courseStructureController.updateAssignment)
router.delete("/assignments/:assignmentId", adminAuth, courseStructureController.deleteAssignment)
router.post("/assignments/:assignmentId/questions", adminAuth, courseStructureController.createQuestion)
router.put("/questions/:questionId", adminAuth, courseStructureController.updateQuestion)
router.delete("/questions/:questionId", adminAuth, courseStructureController.deleteQuestion)
router.get("/assignments", adminAuth, courseStructureController.getAllAssignments)

// Statistics
router.get("/statistics/users", adminAuth, adminController.getUserStats)
router.get("/statistics/courses", adminAuth, adminController.getCourseStats)
router.get("/statistics/revenue", adminAuth, adminController.getRevenueStats)

// System Configuration
router.get("/settings", adminAuth, adminController.getSystemSettings)
router.put("/settings", adminAuth, adminController.updateSystemSettings)

// Student Performance
router.get("/submissions", adminAuth, adminController.getSubmissions)
router.get("/performance-analytics", adminAuth, adminController.getPerformanceAnalytics)

// AI Conversation Management
router.get("/ai/conversations", adminAuth, adminController.getAIConversations)
router.get("/ai/conversations/:id", adminAuth, adminController.getAIConversationById)
router.post("/ai/sample-data", adminAuth, adminController.createSampleAIConversations)

module.exports = router
