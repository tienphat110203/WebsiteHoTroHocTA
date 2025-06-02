// routes/userAiRoutes.js
const express = require("express")
const router = express.Router()
const auth = require("../middleware/auth")
const userAiController = require("../controllers/userAiController")

// Middleware to check user role
const checkUserRole = (req, res, next) => {
  console.log("Checking user role in middleware:", req.user?.role)
  if (req.user && (req.user.role === "student" || req.user.role === "admin" || req.user.role === "instructor")) {
    return next()
  }
  return res.status(403).json({ error: "Access denied. Student, instructor or admin privileges required." })
}

// Apply auth middleware to all routes
router.use(auth)

// Apply checkUserRole middleware to all routes
router.use(checkUserRole)

// Get all conversations
router.get("/conversations", userAiController.getConversations)

// Create a new conversation
router.post("/conversations", userAiController.createConversation)

// Send a message and get AI response
router.post("/messages", userAiController.sendMessage)

// Get messages of a conversation
router.get("/conversations/:conversationId", userAiController.getConversationMessages)

// Update conversation name
router.put("/conversations/:conversationId", userAiController.updateConversation)

// Delete a conversation
router.delete("/conversations/:conversationId", userAiController.deleteConversation)

// Rate a conversation
router.post("/conversations/:conversationId/rate", userAiController.rateConversation)

module.exports = router
