const express = require("express")
const router = express.Router()
const auth = require("../middleware/auth")
const {
  getWritingPrompts,
  analyzeWriting,
  getWritingProgress,
  getSampleEssays,
  getWritingTips,
} = require("../controllers/writingAIController")

// Middleware to check user authentication
router.use(auth)

// Get writing prompts
router.get("/prompts", getWritingPrompts)

// Analyze essay - ensure this route is properly configured
router.post("/analyze", analyzeWriting)

// Get user progress
router.get("/progress", getWritingProgress)

// Get writing tips
router.get("/tips", getWritingTips)

// Get sample essays
router.get("/samples", getSampleEssays)

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "writing-ai",
    timestamp: new Date().toISOString(),
  })
})

module.exports = router
