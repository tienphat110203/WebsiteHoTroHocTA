const tf = require("@tensorflow/tfjs");
const fs = require("fs")
const path = require("path")
const wav = require("wav")
const { spawn } = require("child_process")
const multer = require("multer")

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/audio")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, `pronunciation-${uniqueSuffix}.wav`)
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

class PronunciationAIController {
  constructor() {
    this.model = null
    this.phonemeMapping = {
      AA: 0,
      AE: 1,
      AH: 2,
      AO: 3,
      AW: 4,
      AY: 5,
      B: 6,
      CH: 7,
      D: 8,
      DH: 9,
      EH: 10,
      ER: 11,
      EY: 12,
      F: 13,
      G: 14,
      HH: 15,
      IH: 16,
      IY: 17,
      JH: 18,
      K: 19,
      L: 20,
      M: 21,
      N: 22,
      NG: 23,
      OW: 24,
      OY: 25,
      P: 26,
      R: 27,
      S: 28,
      SH: 29,
      T: 30,
      TH: 31,
      UH: 32,
      UW: 33,
      V: 34,
      W: 35,
      Y: 36,
      Z: 37,
      ZH: 38,
    }
    this.initializeModel()
  }

  async initializeModel() {
    try {
      // Create a CNN + LSTM model for pronunciation analysis
      this.model = this.createPronunciationModel()
      console.log("Pronunciation AI model initialized successfully")
    } catch (error) {
      console.error("Error initializing pronunciation model:", error)
    }
  }

  createPronunciationModel() {
    // Input shape: [timesteps, features] where features = 13 MFCC coefficients
    const inputShape = [null, 13] // Variable length sequences

    const model = tf.sequential({
      layers: [
        // Reshape for CNN layers
        tf.layers.reshape({
          targetShape: [null, 13, 1],
          inputShape: inputShape,
        }),

        // CNN layers for feature extraction
        tf.layers.conv2d({
          filters: 64,
          kernelSize: [3, 3],
          activation: "relu",
          padding: "same",
        }),
        tf.layers.maxPooling2d({
          poolSize: [2, 1],
          padding: "same",
        }),
        tf.layers.dropout({ rate: 0.3 }),

        tf.layers.conv2d({
          filters: 128,
          kernelSize: [3, 3],
          activation: "relu",
          padding: "same",
        }),
        tf.layers.maxPooling2d({
          poolSize: [2, 1],
          padding: "same",
        }),
        tf.layers.dropout({ rate: 0.3 }),

        tf.layers.conv2d({
          filters: 256,
          kernelSize: [3, 3],
          activation: "relu",
          padding: "same",
        }),

        // Reshape for RNN layers
        tf.layers.reshape({
          targetShape: [-1, 256],
        }),

        // LSTM layers for temporal sequence modeling
        tf.layers.lstm({
          units: 256,
          returnSequences: true,
          dropout: 0.3,
          recurrentDropout: 0.3,
        }),
        tf.layers.lstm({
          units: 128,
          returnSequences: true,
          dropout: 0.3,
          recurrentDropout: 0.3,
        }),
        tf.layers.lstm({
          units: 64,
          returnSequences: false,
          dropout: 0.3,
        }),

        // Dense layers for final prediction
        tf.layers.dense({
          units: 128,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.5 }),

        tf.layers.dense({
          units: 64,
          activation: "relu",
        }),

        // Multi-task output
        tf.layers.dense({
          units: 50, // Combined output: pronunciation score + phoneme predictions
          activation: "sigmoid",
          name: "pronunciation_output",
        }),
      ],
    })

    // Compile the model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
      metrics: ["accuracy", "meanAbsoluteError"],
    })

    return model
  }

  // Extract MFCC features from audio buffer
  async extractMFCCFeatures(audioBuffer, sampleRate = 16000) {
    try {
      // Convert audio buffer to WAV format
      const wavFile = await this.convertToWav(audioBuffer, sampleRate)

      // Use Python script to extract MFCC features
      const mfccFeatures = await this.pythonExtractMFCC(wavFile)

      // Clean up temporary file
      fs.unlinkSync(wavFile)

      return mfccFeatures
    } catch (error) {
      console.error("Error extracting MFCC features:", error)
      throw error
    }
  }

  async convertToWav(audioBuffer, sampleRate) {
    const tempFile = path.join(__dirname, "../temp", `audio_${Date.now()}.wav`)

    // Ensure temp directory exists
    const tempDir = path.dirname(tempFile)
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    return new Promise((resolve, reject) => {
      const fileWriter = new wav.FileWriter(tempFile, {
        channels: 1,
        sampleRate: sampleRate,
        bitDepth: 16,
      })

      fileWriter.write(audioBuffer)
      fileWriter.end(() => {
        resolve(tempFile)
      })

      fileWriter.on("error", reject)
    })
  }

  async pythonExtractMFCC(wavFile) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, "../ml_scripts/extract_mfcc.py")
      const python = spawn("python3", [pythonScript, wavFile])

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
            const mfccData = JSON.parse(dataString)
            resolve(mfccData)
          } catch (error) {
            reject(new Error("Failed to parse MFCC data: " + error.message))
          }
        } else {
          reject(new Error("Python script failed: " + errorString))
        }
      })
    })
  }

  // Analyze pronunciation using the trained model
  async analyzePronunciation(audioBuffer, referenceText, sampleRate = 16000) {
    try {
      // Extract MFCC features from the audio
      const mfccFeatures = await this.extractMFCCFeatures(audioBuffer, sampleRate)

      // Prepare input tensor
      const inputTensor = tf.tensor3d([mfccFeatures])

      // Get model prediction
      const prediction = this.model.predict(inputTensor)
      const predictionData = await prediction.data()

      // Process the prediction results
      const analysis = this.processPredictionResults(predictionData, referenceText, mfccFeatures)

      // Clean up tensors
      inputTensor.dispose()
      prediction.dispose()

      return analysis
    } catch (error) {
      console.error("Error analyzing pronunciation:", error)
      throw error
    }
  }

  processPredictionResults(predictionData, referenceText, mfccFeatures) {
    // Extract different components from the prediction
    const pronunciationScore = Math.round(predictionData[0] * 100)
    const fluencyScore = Math.round(predictionData[1] * 100)
    const accuracyScore = Math.round(predictionData[2] * 100)

    // Phoneme-level analysis
    const phonemeScores = Array.from(predictionData.slice(3, 42)).map((score) => Math.round(score * 100))

    // Detailed analysis
    const detailedAnalysis = this.generateDetailedAnalysis(
      pronunciationScore,
      fluencyScore,
      accuracyScore,
      phonemeScores,
      referenceText,
      mfccFeatures,
    )

    return {
      overall: {
        pronunciation: Math.max(60, pronunciationScore), // Ensure minimum score
        fluency: Math.max(65, fluencyScore),
        accuracy: Math.max(70, accuracyScore),
        confidence: this.calculateConfidence(predictionData),
      },
      phonemeAnalysis: detailedAnalysis.phonemes,
      feedback: detailedAnalysis.feedback,
      suggestions: detailedAnalysis.suggestions,
      prosody: {
        rhythm: Math.round(Math.random() * 20 + 80),
        stress: Math.round(Math.random() * 15 + 85),
        intonation: Math.round(Math.random() * 25 + 75),
      },
      spectralAnalysis: {
        fundamentalFrequency: this.analyzeFundamentalFrequency(mfccFeatures),
        spectralCentroid: this.calculateSpectralCentroid(mfccFeatures),
        spectralRolloff: this.calculateSpectralRolloff(mfccFeatures),
      },
    }
  }

  generateDetailedAnalysis(pronunciation, fluency, accuracy, phonemeScores, referenceText, mfccFeatures) {
    const words = referenceText.toLowerCase().split(" ")
    const feedback = []
    const suggestions = []
    const phonemes = []

    // Generate word-level analysis
    words.forEach((word, index) => {
      const wordScore = phonemeScores[index % phonemeScores.length]
      phonemes.push({
        word: word,
        score: wordScore,
        issues: wordScore < 75 ? ["pronunciation"] : [],
        phonetic: this.getPhoneticTranscription(word),
      })

      if (wordScore < 70) {
        feedback.push({
          type: "error",
          text: `The word "${word}" needs improvement in pronunciation.`,
          severity: "high",
        })
        suggestions.push({
          type: "practice",
          text: `Practice the "${word}" sound by breaking it into syllables.`,
          exercises: [`Repeat "${word}" slowly 5 times`, `Focus on tongue position for "${word}"`],
        })
      } else if (wordScore < 85) {
        feedback.push({
          type: "warning",
          text: `The word "${word}" is almost correct, minor adjustments needed.`,
          severity: "medium",
        })
        suggestions.push({
          type: "refinement",
          text: `Fine-tune the pronunciation of "${word}".`,
          exercises: [`Listen to native speakers saying "${word}"`, `Record yourself saying "${word}" multiple times`],
        })
      }
    })

    // Overall feedback based on scores
    if (pronunciation >= 90) {
      feedback.push({
        type: "success",
        text: "Excellent pronunciation! Your speech is very clear and natural.",
        severity: "low",
      })
    } else if (pronunciation >= 75) {
      feedback.push({
        type: "info",
        text: "Good pronunciation with room for minor improvements.",
        severity: "medium",
      })
    } else {
      feedback.push({
        type: "warning",
        text: "Pronunciation needs significant improvement. Focus on clarity.",
        severity: "high",
      })
    }

    // Fluency feedback
    if (fluency < 70) {
      suggestions.push({
        type: "fluency",
        text: "Practice speaking at a consistent pace.",
        exercises: ["Read aloud for 10 minutes daily", "Practice with a metronome", "Focus on linking words smoothly"],
      })
    }

    return { phonemes, feedback, suggestions }
  }

  getPhoneticTranscription(word) {
    // Simple phonetic mapping (in real implementation, use a phonetic dictionary)
    const phoneticMap = {
      hello: "/həˈloʊ/",
      world: "/wɜːrld/",
      pronunciation: "/prəˌnʌnsiˈeɪʃən/",
      practice: "/ˈpræktɪs/",
      english: "/ˈɪŋɡlɪʃ/",
      learning: "/ˈlɜːrnɪŋ/",
      speaking: "/ˈspiːkɪŋ/",
      listening: "/ˈlɪsənɪŋ/",
      reading: "/ˈriːdɪŋ/",
      writing: "/ˈraɪtɪŋ/",
    }

    return phoneticMap[word.toLowerCase()] || `/${word}/`
  }

  calculateConfidence(predictionData) {
    // Calculate confidence based on prediction variance
    const variance =
      predictionData.reduce((sum, val, _, arr) => {
        const mean = arr.reduce((a, b) => a + b) / arr.length
        return sum + Math.pow(val - mean, 2)
      }, 0) / predictionData.length

    return Math.round((1 - Math.min(variance * 10, 1)) * 100)
  }

  analyzeFundamentalFrequency(mfccFeatures) {
    // Simulate F0 analysis
    const avgF0 = mfccFeatures.reduce((sum, frame) => sum + frame[0], 0) / mfccFeatures.length
    return {
      mean: Math.round(avgF0 * 100 + 150), // Simulate Hz
      std: Math.round(Math.random() * 50 + 20),
      range: [Math.round(avgF0 * 100 + 100), Math.round(avgF0 * 100 + 200)],
    }
  }

  calculateSpectralCentroid(mfccFeatures) {
    // Simulate spectral centroid calculation
    const centroid =
      mfccFeatures.reduce((sum, frame) => {
        return sum + frame.reduce((frameSum, coeff) => frameSum + Math.abs(coeff), 0)
      }, 0) / mfccFeatures.length

    return Math.round(centroid * 1000 + 2000) // Simulate Hz
  }

  calculateSpectralRolloff(mfccFeatures) {
    // Simulate spectral rolloff calculation
    const rolloff =
      mfccFeatures.reduce((sum, frame) => {
        const energy = frame.reduce((frameSum, coeff) => frameSum + coeff * coeff, 0)
        return sum + Math.sqrt(energy)
      }, 0) / mfccFeatures.length

    return Math.round(rolloff * 1500 + 3000) // Simulate Hz
  }

  // Train the model with pronunciation data
  async trainModel(trainingData) {
    try {
      const { inputs, targets } = this.prepareTrainingData(trainingData)

      const inputTensor = tf.tensor3d(inputs)
      const targetTensor = tf.tensor2d(targets)

      const history = await this.model.fit(inputTensor, targetTensor, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.accuracy.toFixed(4)}`)
          },
        },
      })

      // Clean up tensors
      inputTensor.dispose()
      targetTensor.dispose()

      return history
    } catch (error) {
      console.error("Error training model:", error)
      throw error
    }
  }

  prepareTrainingData(trainingData) {
    const inputs = []
    const targets = []

    trainingData.forEach((sample) => {
      inputs.push(sample.mfccFeatures)
      targets.push([
        sample.pronunciationScore / 100,
        sample.fluencyScore / 100,
        sample.accuracyScore / 100,
        ...sample.phonemeScores.map((score) => score / 100),
      ])
    })

    return { inputs, targets }
  }

  // Save the trained model
  async saveModel(modelPath) {
    try {
      await this.model.save(`file://${modelPath}`)
      console.log("Model saved successfully")
    } catch (error) {
      console.error("Error saving model:", error)
      throw error
    }
  }

  // Load a pre-trained model
  async loadModel(modelPath) {
    try {
      this.model = await tf.loadLayersModel(`file://${modelPath}`)
      console.log("Model loaded successfully")
    } catch (error) {
      console.error("Error loading model:", error)
      throw error
    }
  }
}

// Simple pronunciation analysis using Web Audio API features
const analyzePronunciation = async (audioFilePath, referenceText) => {
  try {
    // For now, we'll use a simplified analysis
    // In production, you would integrate with actual ML models

    const audioStats = fs.statSync(audioFilePath)
    const duration = audioStats.size / (16000 * 2) // Approximate duration for 16kHz 16-bit audio

    // Simulate AI analysis with realistic scoring
    const baseScore = Math.random() * 30 + 60 // 60-90 base score
    const lengthFactor = Math.min(duration / (referenceText.length * 0.1), 1.2)

    const pronunciationScore = Math.min(100, baseScore * lengthFactor)
    const fluencyScore = Math.max(50, pronunciationScore - Math.random() * 15)
    const accuracyScore = Math.max(55, pronunciationScore - Math.random() * 10)

    // Generate phoneme-level feedback
    const words = referenceText.toLowerCase().split(" ")
    const wordAnalysis = words.map((word) => ({
      word: word,
      score: Math.max(40, pronunciationScore + (Math.random() - 0.5) * 20),
      issues: Math.random() > 0.7 ? ["vowel_clarity"] : [],
      phonemes: generatePhonemeAnalysis(word),
    }))

    // Generate prosody analysis
    const prosodyAnalysis = {
      rhythm: Math.max(50, pronunciationScore - Math.random() * 15),
      stress: Math.max(55, pronunciationScore - Math.random() * 10),
      intonation: Math.max(60, pronunciationScore - Math.random() * 12),
    }

    // Generate spectral analysis (simulated)
    const spectralAnalysis = {
      f0_mean: 150 + Math.random() * 100,
      f0_std: 20 + Math.random() * 15,
      spectral_centroid: 2000 + Math.random() * 1000,
      spectral_rolloff: 4000 + Math.random() * 2000,
      zero_crossing_rate: 0.1 + Math.random() * 0.05,
    }

    return {
      overall_scores: {
        pronunciation: Math.round(pronunciationScore),
        fluency: Math.round(fluencyScore),
        accuracy: Math.round(accuracyScore),
      },
      word_analysis: wordAnalysis,
      prosody_analysis: prosodyAnalysis,
      spectral_analysis: spectralAnalysis,
      confidence_score: Math.max(0.7, Math.random() * 0.3 + 0.7),
      feedback: generateFeedback(pronunciationScore, wordAnalysis),
      suggestions: generateSuggestions(pronunciationScore, prosodyAnalysis),
    }
  } catch (error) {
    console.error("Error analyzing pronunciation:", error)
    throw error
  }
}

const generatePhonemeAnalysis = (word) => {
  // Simplified phoneme mapping
  const phonemeMap = {
    hello: ["/h/", "/ɛ/", "/l/", "/oʊ/"],
    world: ["/w/", "/ɜːr/", "/l/", "/d/"],
    practice: ["/p/", "/r/", "/æ/", "/k/", "/t/", "/ɪ/", "/s/"],
    pronunciation: ["/p/", "/r/", "/ə/", "/n/", "/ʌ/", "/n/", "/s/", "/i/", "/eɪ/", "/ʃ/", "/ə/", "/n/"],
  }

  const phonemes = phonemeMap[word] || word.split("").map((char) => `/${char}/`)

  return phonemes.map((phoneme) => ({
    phoneme: phoneme,
    score: Math.max(40, 70 + Math.random() * 25),
    issues: Math.random() > 0.8 ? ["unclear"] : [],
  }))
}

const generateFeedback = (score, wordAnalysis) => {
  const feedback = []

  if (score < 70) {
    feedback.push("Focus on clearer articulation of consonants")
    feedback.push("Practice vowel sounds more distinctly")
  } else if (score < 85) {
    feedback.push("Good pronunciation! Work on consistency")
    feedback.push("Pay attention to word stress patterns")
  } else {
    feedback.push("Excellent pronunciation!")
    feedback.push("Continue practicing to maintain this level")
  }

  // Add word-specific feedback
  const lowScoreWords = wordAnalysis.filter((w) => w.score < 70)
  if (lowScoreWords.length > 0) {
    feedback.push(`Focus on these words: ${lowScoreWords.map((w) => w.word).join(", ")}`)
  }

  return feedback
}

const generateSuggestions = (score, prosodyAnalysis) => {
  const suggestions = []

  if (prosodyAnalysis.rhythm < 70) {
    suggestions.push({
      type: "rhythm",
      title: "Improve Speech Rhythm",
      description: "Practice with a metronome to develop consistent timing",
      exercises: ["Clap while speaking", "Read with musical beats"],
    })
  }

  if (prosodyAnalysis.stress < 70) {
    suggestions.push({
      type: "stress",
      title: "Word Stress Practice",
      description: "Focus on emphasizing the correct syllables",
      exercises: ["Mark stressed syllables", "Exaggerate stress patterns"],
    })
  }

  if (prosodyAnalysis.intonation < 70) {
    suggestions.push({
      type: "intonation",
      title: "Intonation Patterns",
      description: "Work on rising and falling pitch patterns",
      exercises: ["Question vs statement practice", "Emotion expression drills"],
    })
  }

  return suggestions
}

// API endpoint for pronunciation analysis
const analyzePronunciationAPI = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" })
    }

    const { referenceText } = req.body
    if (!referenceText) {
      return res.status(400).json({ error: "Reference text is required" })
    }

    const audioFilePath = req.file.path

    // Analyze pronunciation
    const analysis = await analyzePronunciation(audioFilePath, referenceText)

    // Clean up uploaded file
    setTimeout(() => {
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath)
      }
    }, 5000) // Delete after 5 seconds

    res.json({
      success: true,
      analysis: analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Pronunciation analysis error:", error)
    res.status(500).json({
      error: "Failed to analyze pronunciation",
      details: error.message,
    })
  }
}

// Get pronunciation exercises
const getPronunciationExercises = async (req, res) => {
  try {
    const exercises = [
      {
        id: 1,
        level: "beginner",
        category: "vowels",
        text: "The cat sat on the mat",
        phonetic: "/ðə kæt sæt ɒn ðə mæt/",
        focus: "Short 'a' sound practice",
      },
      {
        id: 2,
        level: "beginner",
        category: "consonants",
        text: "Peter Piper picked a peck of pickled peppers",
        phonetic: "/ˈpiːtər ˈpaɪpər pɪkt ə pek əv ˈpɪkəld ˈpepərz/",
        focus: "P sound articulation",
      },
      {
        id: 3,
        level: "intermediate",
        category: "stress",
        text: "Photography is my favorite hobby",
        phonetic: "/fəˈtɒɡrəfi ɪz maɪ ˈfeɪvərɪt ˈhɒbi/",
        focus: "Word stress patterns",
      },
      {
        id: 4,
        level: "intermediate",
        category: "intonation",
        text: "Are you coming to the party tonight?",
        phonetic: "/ɑːr juː ˈkʌmɪŋ tuː ðə ˈpɑːrti təˈnaɪt/",
        focus: "Question intonation",
      },
      {
        id: 5,
        level: "advanced",
        category: "connected_speech",
        text: "I would have gone if I had known about it",
        phonetic: "/aɪ wʊd həv ɡɒn ɪf aɪ həd noʊn əˈbaʊt ɪt/",
        focus: "Contractions and linking",
      },
    ]

    const { level, category } = req.query
    let filteredExercises = exercises

    if (level) {
      filteredExercises = filteredExercises.filter((ex) => ex.level === level)
    }

    if (category) {
      filteredExercises = filteredExercises.filter((ex) => ex.category === category)
    }

    res.json({
      success: true,
      exercises: filteredExercises,
    })
  } catch (error) {
    console.error("Error fetching exercises:", error)
    res.status(500).json({ error: "Failed to fetch exercises" })
  }
}

// Get user pronunciation progress
const getUserProgress = async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" })
    }

    // In a real app, fetch from database
    // For now, return mock data
    const progress = {
      overall_score: 78,
      sessions_completed: 15,
      total_practice_time: 450, // minutes
      strengths: ["vowel_clarity", "consonant_precision"],
      weaknesses: ["intonation", "rhythm"],
      recent_scores: [72, 75, 78, 80, 78],
      level: "intermediate",
      next_goals: [
        "Improve question intonation",
        "Practice word stress in compound words",
        "Work on connected speech patterns",
      ],
    }

    res.json({
      success: true,
      progress: progress,
    })
  } catch (error) {
    console.error("Error fetching user progress:", error)
    res.status(500).json({ error: "Failed to fetch progress" })
  }
}

module.exports = {
  upload,
  PronunciationAIController,
  analyzePronunciationAPI,
  getPronunciationExercises,
  getUserProgress,
}
