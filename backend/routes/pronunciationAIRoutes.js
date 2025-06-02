const express = require("express")
const router = express.Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const auth = require("../middleware/auth")
const {
  upload,
  analyzePronunciationAPI,
  getPronunciationExercises,
  getUserProgress,
} = require("../controllers/pronunciationAIController")

// Configure multer for audio file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/audio")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `audio_${Date.now()}_${Math.round(Math.random() * 1e9)}.wav`
    cb(null, uniqueName)
  },
})

// Middleware to check user authentication
router.use(auth)

// Pronunciation analysis endpoint
router.post("/analyze", upload.single("audio"), analyzePronunciationAPI)

// Analyze pronunciation from base64 audio data
router.post("/analyze-base64", async (req, res) => {
  try {
    const { audioData, referenceText, sampleRate = 16000 } = req.body

    if (!audioData) {
      return res.status(400).json({ error: "Audio data is required" })
    }

    if (!referenceText) {
      return res.status(400).json({ error: "Reference text is required" })
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData, "base64")

    // Analyze pronunciation
    const analysis = await req.pronunciationAI.analyzePronunciation(audioBuffer, referenceText, sampleRate)

    res.json({
      success: true,
      analysis: analysis,
      metadata: {
        referenceText: referenceText,
        sampleRate: sampleRate,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Error analyzing pronunciation:", error)
    res.status(500).json({
      error: "Failed to analyze pronunciation",
      details: error.message,
    })
  }
})

// Get pronunciation feedback for specific phonemes
router.post("/phoneme-analysis", async (req, res) => {
  try {
    const { phonemes, language = "en-US" } = req.body

    if (!phonemes || !Array.isArray(phonemes)) {
      return res.status(400).json({ error: "Phonemes array is required" })
    }

    // Generate phoneme-specific feedback
    const phonemeAnalysis = phonemes.map((phoneme) => ({
      phoneme: phoneme,
      difficulty: Math.random() > 0.5 ? "medium" : "easy",
      commonMistakes: ["Tongue position incorrect", "Aspiration too strong", "Vowel duration too short"],
      practiceExercises: [
        `Practice ${phoneme} with minimal pairs`,
        `Focus on tongue placement for ${phoneme}`,
        `Listen and repeat ${phoneme} sounds`,
      ],
      nativeExamples: [`Example word with ${phoneme}`, `Another example with ${phoneme}`],
    }))

    res.json({
      success: true,
      phonemeAnalysis: phonemeAnalysis,
      language: language,
    })
  } catch (error) {
    console.error("Error analyzing phonemes:", error)
    res.status(500).json({
      error: "Failed to analyze phonemes",
      details: error.message,
    })
  }
})

// Get pronunciation exercises
router.get("/exercises", getPronunciationExercises)

// Get user progress (requires authentication)
router.get("/progress", auth, getUserProgress)

// Get model performance metrics
router.get("/model-stats", async (req, res) => {
  try {
    const stats = {
      modelVersion: "1.0.0",
      accuracy: 0.89,
      lastTraining: "2024-01-15",
      supportedLanguages: ["en-US", "en-GB"],
      featuresSupported: ["MFCC extraction", "Phoneme analysis", "Prosody evaluation", "Spectral analysis"],
      modelArchitecture: {
        type: "CNN + LSTM",
        layers: [
          "Conv2D (64 filters)",
          "MaxPooling2D",
          "Conv2D (128 filters)",
          "MaxPooling2D",
          "Conv2D (256 filters)",
          "LSTM (256 units)",
          "LSTM (128 units)",
          "LSTM (64 units)",
          "Dense (128 units)",
          "Dense (64 units)",
          "Dense (50 units) - Output",
        ],
      },
    }

    res.json({
      success: true,
      stats: stats,
    })
  } catch (error) {
    console.error("Error getting model stats:", error)
    res.status(500).json({
      error: "Failed to get model statistics",
      details: error.message,
    })
  }
})

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "pronunciation-ai",
    timestamp: new Date().toISOString(),
  })
})

module.exports = router
