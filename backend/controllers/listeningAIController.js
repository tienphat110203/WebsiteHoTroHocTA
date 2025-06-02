// Optional TensorFlow.js import - only load if available
let tf = null
try {
  tf = require("@tensorflow/tfjs-node")
} catch (error) {
  console.log("TensorFlow.js not available - ML features will be disabled")
}

const fs = require("fs")
const path = require("path")
const multer = require("multer")
const { spawn } = require("child_process")
const db = require("../db")

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/listening")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, `listening-${uniqueSuffix}.wav`)
  },
})

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true)
    } else {
      cb(new Error("Only audio files are allowed!"), false)
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
})

class ListeningAIController {
  constructor() {
    this.sttModel = null
    this.accentModel = null
    this.comprehensionModel = null
    this.questionGenModel = null
    this.initializeModels()
  }

  async initializeModels() {
    try {
      console.log("Initializing Listening AI models...")

      if (!tf) {
        console.log("TensorFlow.js not available - using mock models")
        this.sttModel = { predict: () => null }
        this.accentModel = { predict: () => null }
        this.comprehensionModel = { predict: () => null }
        return
      }

      // Initialize Speech-to-Text model (Whisper-like architecture)
      this.sttModel = this.createSTTModel()

      // Initialize Accent Recognition model
      this.accentModel = this.createAccentModel()

      // Initialize Comprehension Analysis model
      this.comprehensionModel = this.createComprehensionModel()

      console.log("Listening AI models initialized successfully")
    } catch (error) {
      console.error("Error initializing Listening AI models:", error)
    }
  }

  createSTTModel() {
    if (!tf) return { predict: () => null }

    // Simplified Transformer-based STT model
    const model = tf.sequential({
      layers: [
        // Audio feature extraction layers
        tf.layers.conv1d({
          filters: 64,
          kernelSize: 3,
          activation: "relu",
          inputShape: [null, 80], // 80 mel-spectrogram features
        }),
        tf.layers.conv1d({
          filters: 128,
          kernelSize: 3,
          activation: "relu",
        }),
        tf.layers.maxPooling1d({ poolSize: 2 }),
        tf.layers.dropout({ rate: 0.3 }),

        // Transformer-like attention layers
        tf.layers.lstm({
          units: 256,
          returnSequences: true,
          dropout: 0.3,
          recurrentDropout: 0.3,
        }),
        tf.layers.lstm({
          units: 256,
          returnSequences: true,
          dropout: 0.3,
          recurrentDropout: 0.3,
        }),

        // Output layers for character/token prediction
        tf.layers.dense({
          units: 512,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({
          units: 1000, // Vocabulary size
          activation: "softmax",
        }),
      ],
    })

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "sparseCategoricalCrossentropy",
      metrics: ["accuracy"],
    })

    return model
  }

  createAccentModel() {
    if (!tf) return { predict: () => null }

    // CNN + RNN model for accent classification
    const model = tf.sequential({
      layers: [
        // Convolutional layers for feature extraction
        tf.layers.conv2d({
          filters: 32,
          kernelSize: [3, 3],
          activation: "relu",
          inputShape: [null, 80, 1], // Mel-spectrogram input
        }),
        tf.layers.maxPooling2d({ poolSize: [2, 2] }),
        tf.layers.conv2d({
          filters: 64,
          kernelSize: [3, 3],
          activation: "relu",
        }),
        tf.layers.maxPooling2d({ poolSize: [2, 2] }),
        tf.layers.conv2d({
          filters: 128,
          kernelSize: [3, 3],
          activation: "relu",
        }),
        tf.layers.globalAveragePooling2d(),

        // Dense layers for classification
        tf.layers.dense({
          units: 256,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: 128,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 10, // Number of accent classes
          activation: "softmax",
        }),
      ],
    })

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    })

    return model
  }

  createComprehensionModel() {
    if (!tf) return { predict: () => null }

    // BERT-like model for comprehension analysis
    const model = tf.sequential({
      layers: [
        // Embedding layer
        tf.layers.embedding({
          inputDim: 30000, // Vocabulary size
          outputDim: 768,
          inputShape: [512], // Max sequence length
        }),

        // Transformer blocks (simplified)
        tf.layers.lstm({
          units: 768,
          returnSequences: true,
          dropout: 0.1,
        }),
        tf.layers.lstm({
          units: 768,
          returnSequences: true,
          dropout: 0.1,
        }),

        // Classification head
        tf.layers.globalAveragePooling1d(),
        tf.layers.dense({
          units: 512,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 256,
          activation: "relu",
        }),
        tf.layers.dense({
          units: 1,
          activation: "sigmoid", // Comprehension score 0-1
        }),
      ],
    })

    model.compile({
      optimizer: tf.train.adam(0.0001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    })

    return model
  }

  // Speech-to-Text processing
  async processSTT(audioFilePath, language = "en") {
    try {
      // Extract audio features
      const audioFeatures = await this.extractAudioFeatures(audioFilePath)

      // Use external STT service (Whisper) for better accuracy
      const transcription = await this.whisperSTT(audioFilePath, language)

      // Analyze transcription quality
      const analysis = await this.analyzeTranscriptionQuality(transcription, audioFeatures)

      return {
        transcription: transcription.text,
        confidence: transcription.confidence,
        word_timestamps: transcription.word_timestamps,
        analysis: analysis,
        processing_time: transcription.processing_time,
      }
    } catch (error) {
      console.error("STT processing error:", error)
      throw error
    }
  }

  async whisperSTT(audioFilePath, language) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, "../ml_scripts/whisper_stt.py")
      const python = spawn("python3", [pythonScript, audioFilePath, language])

      let dataString = ""
      let errorString = ""

      python.stdout.on("data", (data) => {
        dataString += data.toString()
      })

      python.stderr.on("data", (data) => {
        errorString += data.toString()
      })

      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(dataString)
            resolve(result)
          } catch (error) {
            reject(new Error("Failed to parse STT result: " + error.message))
          }
        } else {
          reject(new Error("STT processing failed: " + errorString))
        }
      })
    })
  }

  async extractAudioFeatures(audioFilePath) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, "../ml_scripts/extract_audio_features.py")
      const python = spawn("python3", [pythonScript, audioFilePath])

      let dataString = ""
      let errorString = ""

      python.stdout.on("data", (data) => {
        dataString += data.toString()
      })

      python.stderr.on("data", (data) => {
        errorString += data.toString()
      })

      python.on("close", (code) => {
        if (code === 0) {
          try {
            const features = JSON.parse(dataString)
            resolve(features)
          } catch (error) {
            reject(new Error("Failed to parse audio features: " + error.message))
          }
        } else {
          reject(new Error("Feature extraction failed: " + errorString))
        }
      })
    })
  }

  // Accent Recognition
  async recognizeAccent(audioFilePath) {
    try {
      const audioFeatures = await this.extractAudioFeatures(audioFilePath)

      // Prepare input tensor
      const inputTensor = tf.tensor4d([audioFeatures.mel_spectrogram])

      // Get accent prediction
      const prediction = this.accentModel.predict(inputTensor)
      const predictionData = await prediction.data()

      // Process results
      const accentClasses = [
        "american",
        "british",
        "australian",
        "canadian",
        "indian",
        "south_african",
        "irish",
        "scottish",
        "new_zealand",
        "other",
      ]

      const maxIndex = predictionData.indexOf(Math.max(...predictionData))
      const confidence = predictionData[maxIndex]

      const result = {
        detected_accent: accentClasses[maxIndex],
        confidence: confidence,
        all_probabilities: accentClasses.map((accent, index) => ({
          accent: accent,
          probability: predictionData[index],
        })),
        features: {
          fundamental_frequency: audioFeatures.f0_mean,
          formant_frequencies: audioFeatures.formants,
          speech_rate: audioFeatures.speech_rate,
          vowel_space: audioFeatures.vowel_space,
        },
      }

      // Clean up tensors
      inputTensor.dispose()
      prediction.dispose()

      return result
    } catch (error) {
      console.error("Accent recognition error:", error)
      throw error
    }
  }

  // Comprehension Analysis
  async analyzeComprehension(transcript, userAnswers, questions) {
    try {
      const analysis = {
        overall_score: 0,
        detailed_analysis: [],
        comprehension_level: "beginner",
        strengths: [],
        weaknesses: [],
        suggestions: [],
      }

      let totalScore = 0
      let correctAnswers = 0

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]
        const userAnswer = userAnswers[i]

        const questionAnalysis = await this.analyzeQuestionResponse(transcript, question, userAnswer)

        analysis.detailed_analysis.push(questionAnalysis)
        totalScore += questionAnalysis.score

        if (questionAnalysis.is_correct) {
          correctAnswers++
        }
      }

      analysis.overall_score = Math.round((totalScore / questions.length) * 100)
      analysis.accuracy_percentage = Math.round((correctAnswers / questions.length) * 100)

      // Determine comprehension level
      if (analysis.overall_score >= 85) {
        analysis.comprehension_level = "advanced"
      } else if (analysis.overall_score >= 70) {
        analysis.comprehension_level = "intermediate"
      } else {
        analysis.comprehension_level = "beginner"
      }

      // Generate insights
      analysis.strengths = this.identifyStrengths(analysis.detailed_analysis)
      analysis.weaknesses = this.identifyWeaknesses(analysis.detailed_analysis)
      analysis.suggestions = this.generateSuggestions(analysis)

      return analysis
    } catch (error) {
      console.error("Comprehension analysis error:", error)
      throw error
    }
  }

  async analyzeQuestionResponse(transcript, question, userAnswer) {
    // Simplified analysis - in production, use more sophisticated NLP
    const isCorrect = this.compareAnswers(question.correct_answer, userAnswer)

    return {
      question_id: question.question_id,
      question_type: question.question_type,
      is_correct: isCorrect,
      score: isCorrect ? 100 : 0,
      user_answer: userAnswer,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      difficulty: question.difficulty_level,
      time_reference: question.time_reference,
    }
  }

  compareAnswers(correctAnswer, userAnswer) {
    // Normalize answers for comparison
    const normalize = (text) =>
      text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, "")

    const normalizedCorrect = normalize(correctAnswer)
    const normalizedUser = normalize(userAnswer)

    // Exact match
    if (normalizedCorrect === normalizedUser) {
      return true
    }

    // Partial match for fill-in-the-blank questions
    if (normalizedCorrect.includes(normalizedUser) || normalizedUser.includes(normalizedCorrect)) {
      return true
    }

    // Similarity check (simplified)
    const similarity = this.calculateSimilarity(normalizedCorrect, normalizedUser)
    return similarity > 0.8
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  levenshteinDistance(str1, str2) {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  // Auto-generate subtitles
  async generateSubtitles(audioFilePath, contentId) {
    try {
      const sttResult = await this.processSTT(audioFilePath)
      const subtitles = []

      if (sttResult.word_timestamps) {
        let currentSubtitle = {
          start_time: 0,
          end_time: 0,
          text: "",
          words: [],
        }

        for (const wordData of sttResult.word_timestamps) {
          // Group words into subtitle segments (max 10 words or 5 seconds)
          if (currentSubtitle.words.length >= 10 || wordData.start - currentSubtitle.start_time >= 5) {
            if (currentSubtitle.words.length > 0) {
              currentSubtitle.end_time = currentSubtitle.words[currentSubtitle.words.length - 1].end
              currentSubtitle.text = currentSubtitle.words.map((w) => w.word).join(" ")
              subtitles.push({ ...currentSubtitle })
            }

            currentSubtitle = {
              start_time: wordData.start,
              end_time: wordData.end,
              text: "",
              words: [wordData],
            }
          } else {
            currentSubtitle.words.push(wordData)
            if (currentSubtitle.start_time === 0) {
              currentSubtitle.start_time = wordData.start
            }
          }
        }

        // Add the last subtitle
        if (currentSubtitle.words.length > 0) {
          currentSubtitle.end_time = currentSubtitle.words[currentSubtitle.words.length - 1].end
          currentSubtitle.text = currentSubtitle.words.map((w) => w.word).join(" ")
          subtitles.push(currentSubtitle)
        }
      }

      // Save subtitles to database
      for (const subtitle of subtitles) {
        await db.query(
          `INSERT INTO listening_subtitles (content_id, start_time, end_time, text, confidence_score, is_auto_generated)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [contentId, subtitle.start_time, subtitle.end_time, subtitle.text, sttResult.confidence, true],
        )
      }

      return {
        subtitles: subtitles,
        total_segments: subtitles.length,
        confidence: sttResult.confidence,
      }
    } catch (error) {
      console.error("Subtitle generation error:", error)
      throw error
    }
  }

  // Audio enhancement and processing
  async enhanceAudio(audioFilePath, options = {}) {
    try {
      const {
        noise_reduction = true,
        speed_adjustment = 1.0,
        clarity_enhancement = true,
        volume_normalization = true,
      } = options

      const outputPath = audioFilePath.replace(".wav", "_enhanced.wav")

      const enhancementResult = await this.processAudioEnhancement(audioFilePath, outputPath, {
        noise_reduction,
        speed_adjustment,
        clarity_enhancement,
        volume_normalization,
      })

      return {
        enhanced_audio_url: outputPath,
        processing_details: enhancementResult,
        original_duration: enhancementResult.original_duration,
        enhanced_duration: enhancementResult.enhanced_duration,
      }
    } catch (error) {
      console.error("Audio enhancement error:", error)
      throw error
    }
  }

  async processAudioEnhancement(inputPath, outputPath, options) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, "../ml_scripts/audio_enhancement.py")
      const python = spawn("python3", [pythonScript, inputPath, outputPath, JSON.stringify(options)])

      let dataString = ""
      let errorString = ""

      python.stdout.on("data", (data) => {
        dataString += data.toString()
      })

      python.stderr.on("data", (data) => {
        errorString += data.toString()
      })

      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(dataString)
            resolve(result)
          } catch (error) {
            reject(new Error("Failed to parse enhancement result: " + error.message))
          }
        } else {
          reject(new Error("Audio enhancement failed: " + errorString))
        }
      })
    })
  }

  identifyStrengths(detailedAnalysis) {
    const strengths = []
    const correctByType = {}
    const totalByType = {}

    detailedAnalysis.forEach((analysis) => {
      const type = analysis.question_type
      if (!totalByType[type]) {
        totalByType[type] = 0
        correctByType[type] = 0
      }
      totalByType[type]++
      if (analysis.is_correct) {
        correctByType[type]++
      }
    })

    Object.keys(totalByType).forEach((type) => {
      const accuracy = correctByType[type] / totalByType[type]
      if (accuracy >= 0.8) {
        strengths.push(`Strong performance in ${type.replace("_", " ")} questions`)
      }
    })

    return strengths
  }

  identifyWeaknesses(detailedAnalysis) {
    const weaknesses = []
    const correctByType = {}
    const totalByType = {}

    detailedAnalysis.forEach((analysis) => {
      const type = analysis.question_type
      if (!totalByType[type]) {
        totalByType[type] = 0
        correctByType[type] = 0
      }
      totalByType[type]++
      if (analysis.is_correct) {
        correctByType[type]++
      }
    })

    Object.keys(totalByType).forEach((type) => {
      const accuracy = correctByType[type] / totalByType[type]
      if (accuracy < 0.6) {
        weaknesses.push(`Needs improvement in ${type.replace("_", " ")} questions`)
      }
    })

    return weaknesses
  }

  generateSuggestions(analysis) {
    const suggestions = []

    if (analysis.overall_score < 70) {
      suggestions.push("Practice with easier content to build confidence")
      suggestions.push("Focus on key vocabulary before listening")
      suggestions.push("Use subtitles initially, then try without them")
    } else if (analysis.overall_score < 85) {
      suggestions.push("Try listening at normal speed without subtitles")
      suggestions.push("Practice note-taking while listening")
      suggestions.push("Focus on understanding main ideas and details")
    } else {
      suggestions.push("Challenge yourself with advanced content")
      suggestions.push("Practice with different accents and speaking speeds")
      suggestions.push("Try listening to authentic materials like podcasts")
    }

    return suggestions
  }
}

// API Controllers
const listeningAI = new ListeningAIController()

// Get listening content
const getListeningContent = async (req, res) => {
  try {
    const { difficulty, category, accent, limit = 10, offset = 0 } = req.query

    let query = `
      SELECT lc.*, 
             COUNT(lq.question_id) as question_count,
             AVG(lcf.rating) as average_rating
      FROM listening_content lc
      LEFT JOIN listening_questions lq ON lc.content_id = lq.content_id
      LEFT JOIN listening_content_feedback lcf ON lc.content_id = lcf.content_id
      WHERE lc.is_active = true
    `

    const params = []
    let paramIndex = 1

    if (difficulty) {
      query += ` AND lc.difficulty_level = $${paramIndex}`
      params.push(difficulty)
      paramIndex++
    }

    if (category) {
      query += ` AND lc.category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    if (accent) {
      query += ` AND lc.accent_type = $${paramIndex}`
      params.push(accent)
      paramIndex++
    }

    query += `
      GROUP BY lc.content_id
      ORDER BY lc.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const result = await db.query(query, params)

    res.json({
      success: true,
      content: result.rows,
      total: result.rows.length,
    })
  } catch (error) {
    console.error("Error fetching listening content:", error)
    res.status(500).json({ error: "Failed to fetch listening content" })
  }
}

// Start listening session
const startListeningSession = async (req, res) => {
  try {
    const userId = req.user?.id
    const { contentId, playbackSpeed = 1.0, subtitleEnabled = false } = req.body

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" })
    }

    const sessionResult = await db.query(
      `INSERT INTO listening_sessions (user_id, content_id, playback_speed, subtitle_enabled)
       VALUES ($1, $2, $3, $4) RETURNING session_id`,
      [userId, contentId, playbackSpeed, subtitleEnabled],
    )

    const sessionId = sessionResult.rows[0].session_id

    // Get content details
    const contentResult = await db.query(`SELECT * FROM listening_content WHERE content_id = $1`, [contentId])

    // Get questions
    const questionsResult = await db.query(
      `SELECT lq.*, array_agg(
         json_build_object(
           'option_id', lqo.option_id,
           'option_text', lqo.option_text,
           'position', lqo.position
         ) ORDER BY lqo.position
       ) as options
       FROM listening_questions lq
       LEFT JOIN listening_question_options lqo ON lq.question_id = lqo.question_id
       WHERE lq.content_id = $1
       GROUP BY lq.question_id
       ORDER BY lq.question_id`,
      [contentId],
    )

    res.json({
      success: true,
      session_id: sessionId,
      content: contentResult.rows[0],
      questions: questionsResult.rows,
    })
  } catch (error) {
    console.error("Error starting listening session:", error)
    res.status(500).json({ error: "Failed to start listening session" })
  }
}

// Submit listening answers
const submitListeningAnswers = async (req, res) => {
  try {
    const { sessionId, answers, timeSpent } = req.body

    if (!sessionId || !answers) {
      return res.status(400).json({ error: "Session ID and answers are required" })
    }

    // Get session and content details
    const sessionResult = await db.query(
      `SELECT ls.*, lc.transcript, lc.title
       FROM listening_sessions ls
       JOIN listening_content lc ON ls.content_id = lc.content_id
       WHERE ls.session_id = $1`,
      [sessionId],
    )

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" })
    }

    const session = sessionResult.rows[0]

    // Get questions
    const questionsResult = await db.query(`SELECT * FROM listening_questions WHERE content_id = $1`, [
      session.content_id,
    ])

    const questions = questionsResult.rows

    // Save user answers
    for (const answer of answers) {
      await db.query(
        `INSERT INTO listening_user_answers (session_id, question_id, user_answer, time_taken_seconds)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, answer.question_id, answer.answer, answer.time_taken || 0],
      )
    }

    // Analyze comprehension
    const comprehensionAnalysis = await listeningAI.analyzeComprehension(
      session.transcript,
      answers.map((a) => a.answer),
      questions,
    )

    // Update session
    await db.query(
      `UPDATE listening_sessions 
       SET end_time = CURRENT_TIMESTAMP, 
           duration_listened_seconds = $1,
           completion_percentage = 100
       WHERE session_id = $2`,
      [timeSpent, sessionId],
    )

    // Update user progress
    await updateUserProgress(session.user_id, comprehensionAnalysis)

    res.json({
      success: true,
      analysis: comprehensionAnalysis,
      session_completed: true,
    })
  } catch (error) {
    console.error("Error submitting listening answers:", error)
    res.status(500).json({ error: "Failed to submit answers" })
  }
}

// Process audio for STT analysis
const processAudioSTT = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" })
    }

    const { language = "en" } = req.body
    const audioFilePath = req.file.path

    // Process STT
    const sttResult = await listeningAI.processSTT(audioFilePath, language)

    // Clean up uploaded file
    setTimeout(() => {
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath)
      }
    }, 5000)

    res.json({
      success: true,
      result: sttResult,
    })
  } catch (error) {
    console.error("STT processing error:", error)
    res.status(500).json({ error: "Failed to process audio" })
  }
}

// Recognize accent from audio
const recognizeAccent = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" })
    }

    const audioFilePath = req.file.path

    // Recognize accent
    const accentResult = await listeningAI.recognizeAccent(audioFilePath)

    // Clean up uploaded file
    setTimeout(() => {
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath)
      }
    }, 5000)

    res.json({
      success: true,
      result: accentResult,
    })
  } catch (error) {
    console.error("Accent recognition error:", error)
    res.status(500).json({ error: "Failed to recognize accent" })
  }
}

// Generate subtitles for content
const generateSubtitles = async (req, res) => {
  try {
    const { contentId } = req.params

    // Get content details
    const contentResult = await db.query(`SELECT * FROM listening_content WHERE content_id = $1`, [contentId])

    if (contentResult.rows.length === 0) {
      return res.status(404).json({ error: "Content not found" })
    }

    const content = contentResult.rows[0]

    // For demo purposes, we'll simulate subtitle generation
    // In production, you would download the audio file and process it
    const mockAudioPath = "/tmp/mock_audio.wav"

    const subtitleResult = await listeningAI.generateSubtitles(mockAudioPath, contentId)

    res.json({
      success: true,
      result: subtitleResult,
    })
  } catch (error) {
    console.error("Subtitle generation error:", error)
    res.status(500).json({ error: "Failed to generate subtitles" })
  }
}

// Get user listening progress
const getUserListeningProgress = async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" })
    }

    const progressResult = await db.query(`SELECT * FROM listening_user_progress WHERE user_id = $1`, [userId])

    // Get recent sessions
    const sessionsResult = await db.query(
      `SELECT ls.*, lc.title, lc.difficulty_level
       FROM listening_sessions ls
       JOIN listening_content lc ON ls.content_id = lc.content_id
       WHERE ls.user_id = $1
       ORDER BY ls.start_time DESC
       LIMIT 10`,
      [userId],
    )

    res.json({
      success: true,
      progress: progressResult.rows,
      recent_sessions: sessionsResult.rows,
    })
  } catch (error) {
    console.error("Error fetching user progress:", error)
    res.status(500).json({ error: "Failed to fetch progress" })
  }
}

// Helper function to update user progress
const updateUserProgress = async (userId, analysis) => {
  try {
    const existingProgress = await db.query(`SELECT * FROM listening_user_progress WHERE user_id = $1`, [userId])

    if (existingProgress.rows.length === 0) {
      // Create new progress record
      await db.query(
        `INSERT INTO listening_user_progress 
         (user_id, sessions_completed, average_comprehension_score, best_comprehension_score, 
          strengths, weaknesses, last_session_date)
         VALUES ($1, 1, $2, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, analysis.overall_score, JSON.stringify(analysis.strengths), JSON.stringify(analysis.weaknesses)],
      )
    } else {
      // Update existing progress
      const current = existingProgress.rows[0]
      const newSessionCount = current.sessions_completed + 1
      const newAverage =
        (current.average_comprehension_score * current.sessions_completed + analysis.overall_score) / newSessionCount
      const newBest = Math.max(current.best_comprehension_score, analysis.overall_score)

      await db.query(
        `UPDATE listening_user_progress 
         SET sessions_completed = $1,
             average_comprehension_score = $2,
             best_comprehension_score = $3,
             strengths = $4,
             weaknesses = $5,
             last_session_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $6`,
        [
          newSessionCount,
          newAverage,
          newBest,
          JSON.stringify(analysis.strengths),
          JSON.stringify(analysis.weaknesses),
          userId,
        ],
      )
    }
  } catch (error) {
    console.error("Error updating user progress:", error)
  }
}

module.exports = {
  upload,
  ListeningAIController,
  getListeningContent,
  startListeningSession,
  submitListeningAnswers,
  processAudioSTT,
  recognizeAccent,
  generateSubtitles,
  getUserListeningProgress,
}
