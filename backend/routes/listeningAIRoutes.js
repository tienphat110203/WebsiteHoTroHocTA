const express = require("express")
const router = express.Router()
const auth = require("../middleware/auth")
const {
  upload,
  getListeningContent,
  startListeningSession,
  submitListeningAnswers,
  processAudioSTT,
  recognizeAccent,
  generateSubtitles,
  getUserListeningProgress,
} = require("../controllers/listeningAIController")

// Public routes
router.get("/content", getListeningContent)

// Protected routes
router.post("/sessions/start", auth, startListeningSession)
router.post("/sessions/submit", auth, submitListeningAnswers)
router.get("/progress", auth, getUserListeningProgress)

// ML processing routes
router.post("/stt", upload.single("audio"), processAudioSTT)
router.post("/accent-recognition", upload.single("audio"), recognizeAccent)
router.post("/subtitles/:contentId", auth, generateSubtitles)

// Advanced features
router.post("/analyze-comprehension", async (req, res) => {
  try {
    const { transcript, userAnswers, questions } = req.body

    if (!transcript || !userAnswers || !questions) {
      return res.status(400).json({
        error: "Transcript, user answers, and questions are required",
      })
    }

    // Import the controller class
    const { ListeningAIController } = require("../controllers/listeningAIController")
    const listeningAI = new ListeningAIController()

    const analysis = await listeningAI.analyzeComprehension(transcript, userAnswers, questions)

    res.json({
      success: true,
      analysis: analysis,
    })
  } catch (error) {
    console.error("Comprehension analysis error:", error)
    res.status(500).json({ error: "Failed to analyze comprehension" })
  }
})

router.post("/enhance-audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" })
    }

    const options = {
      noise_reduction: req.body.noise_reduction === "true",
      speed_adjustment: Number.parseFloat(req.body.speed_adjustment) || 1.0,
      clarity_enhancement: req.body.clarity_enhancement === "true",
      volume_normalization: req.body.volume_normalization === "true",
    }

    const { ListeningAIController } = require("../controllers/listeningAIController")
    const listeningAI = new ListeningAIController()

    const result = await listeningAI.enhanceAudio(req.file.path, options)

    res.json({
      success: true,
      result: result,
    })
  } catch (error) {
    console.error("Audio enhancement error:", error)
    res.status(500).json({ error: "Failed to enhance audio" })
  }
})

// Get listening statistics
router.get("/statistics", async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" })
    }

    const db = require("../db")

    // Get comprehensive statistics
    const stats = await db.query(
      `
      SELECT 
        COUNT(DISTINCT ls.session_id) as total_sessions,
        SUM(ls.duration_listened_seconds) as total_listening_time,
        AVG(
          CASE 
            WHEN lua.session_id IS NOT NULL THEN 
              (SELECT COUNT(*) FROM listening_user_answers lua2 
               WHERE lua2.session_id = ls.session_id AND lua2.is_correct = true) * 100.0 / 
              (SELECT COUNT(*) FROM listening_user_answers lua3 
               WHERE lua3.session_id = ls.session_id)
            ELSE NULL 
          END
        ) as average_score,
        COUNT(DISTINCT lc.difficulty_level) as levels_practiced,
        COUNT(DISTINCT lc.accent_type) as accents_practiced
      FROM listening_sessions ls
      LEFT JOIN listening_content lc ON ls.content_id = lc.content_id
      LEFT JOIN listening_user_answers lua ON ls.session_id = lua.session_id
      WHERE ls.user_id = $1 AND ls.end_time IS NOT NULL
    `,
      [userId],
    )

    // Get progress by difficulty level
    const progressByLevel = await db.query(
      `
      SELECT 
        lc.difficulty_level,
        COUNT(ls.session_id) as sessions,
        AVG(
          CASE 
            WHEN lua.session_id IS NOT NULL THEN 
              (SELECT COUNT(*) FROM listening_user_answers lua2 
               WHERE lua2.session_id = ls.session_id AND lua2.is_correct = true) * 100.0 / 
              (SELECT COUNT(*) FROM listening_user_answers lua3 
               WHERE lua3.session_id = ls.session_id)
            ELSE NULL 
          END
        ) as average_score
      FROM listening_sessions ls
      JOIN listening_content lc ON ls.content_id = lc.content_id
      LEFT JOIN listening_user_answers lua ON ls.session_id = lua.session_id
      WHERE ls.user_id = $1 AND ls.end_time IS NOT NULL
      GROUP BY lc.difficulty_level
      ORDER BY 
        CASE lc.difficulty_level 
          WHEN 'beginner' THEN 1 
          WHEN 'intermediate' THEN 2 
          WHEN 'advanced' THEN 3 
        END
    `,
      [userId],
    )

    res.json({
      success: true,
      statistics: {
        overall: stats.rows[0],
        by_level: progressByLevel.rows,
      },
    })
  } catch (error) {
    console.error("Error fetching statistics:", error)
    res.status(500).json({ error: "Failed to fetch statistics" })
  }
})

// Get ML model information
router.get("/models", async (req, res) => {
  try {
    const db = require("../db")

    const models = await db.query(`
      SELECT model_name, model_type, model_version, accuracy_metrics, is_active
      FROM listening_ml_models
      WHERE is_active = true
      ORDER BY model_type, model_name
    `)

    res.json({
      success: true,
      models: models.rows,
    })
  } catch (error) {
    console.error("Error fetching models:", error)
    res.status(500).json({ error: "Failed to fetch model information" })
  }
})

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "listening-ai",
    timestamp: new Date().toISOString(),
  })
})

module.exports = router
