const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")
const db = require("../db")

class AdvancedWritingAIController {
  constructor() {
    this.isInitialized = false
    this.mlModelAvailable = false
    this.initializeController()
  }

  async initializeController() {
    try {
      console.log("Initializing Advanced Writing AI Controller...")

      // Check database connection
      await this.checkDatabaseConnection()

      // Check ML model availability
      await this.checkMLModelAvailability()

      this.isInitialized = true
      console.log("Advanced Writing AI Controller initialized successfully")
      console.log(`ML Model Available: ${this.mlModelAvailable}`)
    } catch (error) {
      console.error("Error initializing Writing AI Controller:", error)
      this.isInitialized = false
    }
  }

  async checkDatabaseConnection() {
    try {
      const result = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('writing_prompts', 'writing_submissions', 'writing_analysis', 'writing_progress')
      `)

      if (result.rows.length < 4) {
        console.warn("Some writing tables are missing. Please run the schema setup.")
        return false
      }

      console.log("Database connection verified - all required writing tables found")
      return true
    } catch (error) {
      console.error("Database connection error:", error)
      throw error
    }
  }

  async checkMLModelAvailability() {
    try {
      const scriptPath = path.join(__dirname, "../ml_scripts/essay_inference.py")
      const modelExists = await fs.promises
        .access(scriptPath)
        .then(() => true)
        .catch(() => false)

      if (modelExists) {
        // Test if Python and required packages are available
        const testResult = await this.testMLModel()
        this.mlModelAvailable = testResult
      } else {
        console.warn("ML script not found, using rule-based analysis only")
        this.mlModelAvailable = false
      }
    } catch (error) {
      console.warn("ML model check failed:", error.message)
      this.mlModelAvailable = false
    }
  }

  async testMLModel() {
    return new Promise((resolve) => {
      try {
        const scriptPath = path.join(__dirname, "../ml_scripts/essay_inference.py")
        const python = spawn("python3", [scriptPath, "--test"])

        let output = ""
        let error = ""

        python.stdout.on("data", (data) => {
          output += data.toString()
        })

        python.stderr.on("data", (data) => {
          error += data.toString()
        })

        python.on("close", (code) => {
          if (code === 0 && output.includes("ML_MODEL_READY")) {
            console.log("ML model test successful")
            resolve(true)
          } else {
            console.warn("ML model test failed:", error)
            resolve(false)
          }
        })

        python.on("error", (err) => {
          console.warn("Python process error:", err.message)
          resolve(false)
        })

        // Timeout after 15 seconds
        setTimeout(() => {
          python.kill()
          resolve(false)
        }, 15000)
      } catch (error) {
        resolve(false)
      }
    })
  }

  // ==================== PROMPT MANAGEMENT ====================

  async getWritingPrompts(req, res) {
    try {
      if (!this.isInitialized) {
        return res.status(503).json({
          success: false,
          error: "Service not initialized. Please try again later.",
        })
      }

      const { level = "intermediate", category = "all", limit = 10, random = true } = req.query

      let query = `
        SELECT 
          prompt_id,
          prompt_name,
          assignment,
          source_text_1,
          source_text_2,
          source_text_3,
          source_text_4,
          difficulty_level,
          category,
          time_limit_minutes,
          min_word_count,
          max_word_count,
          created_at
        FROM writing_prompts 
        WHERE is_active = true
      `
      const params = []

      // Filter by difficulty level
      if (level !== "all") {
        query += ` AND difficulty_level = $${params.length + 1}`
        params.push(level)
      }

      // Filter by category
      if (category !== "all") {
        query += ` AND category = $${params.length + 1}`
        params.push(category)
      }

      // Order and limit
      if (random === "true") {
        query += ` ORDER BY RANDOM()`
      } else {
        query += ` ORDER BY created_at DESC`
      }

      query += ` LIMIT $${params.length + 1}`
      params.push(Number.parseInt(limit))

      const result = await db.query(query, params)

      // Get total count for pagination
      let countQuery = `SELECT COUNT(*) as total FROM writing_prompts WHERE is_active = true`
      const countParams = []

      if (level !== "all") {
        countQuery += ` AND difficulty_level = $${countParams.length + 1}`
        countParams.push(level)
      }

      if (category !== "all") {
        countQuery += ` AND category = $${countParams.length + 1}`
        countParams.push(category)
      }

      const countResult = await db.query(countQuery, countParams)

      res.json({
        success: true,
        prompts: result.rows,
        total_available: Number.parseInt(countResult.rows[0].total),
        returned: result.rows.length,
        filters: { level, category, limit: Number.parseInt(limit) },
      })
    } catch (error) {
      console.error("Error fetching writing prompts:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch writing prompts",
      })
    }
  }

  async getPromptById(req, res) {
    try {
      const { prompt_id } = req.params

      const query = `
        SELECT 
          prompt_id,
          prompt_name,
          assignment,
          source_text_1,
          source_text_2,
          source_text_3,
          source_text_4,
          difficulty_level,
          category,
          time_limit_minutes,
          min_word_count,
          max_word_count
        FROM writing_prompts 
        WHERE prompt_id = $1 AND is_active = true
      `

      const result = await db.query(query, [prompt_id])

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Prompt not found",
        })
      }

      res.json({
        success: true,
        prompt: result.rows[0],
      })
    } catch (error) {
      console.error("Error fetching prompt:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch prompt",
      })
    }
  }

  // ==================== ADVANCED ESSAY ANALYSIS ====================

  async analyzeWriting(req, res) {
    try {
      const { essay_text, essay, prompt, prompt_id, level = "intermediate", time_spent = 0 } = req.body
      const user_id = req.user?.user_id

      // Accept either essay_text or essay parameter for flexibility
      const essayContent = essay_text || essay

      // Enhanced validation
      if (!essayContent || essayContent.trim().length < 20) {
        return res.status(400).json({
          success: false,
          error: "Essay text is required and must be at least 20 characters long",
        })
      }

      if (!prompt_id) {
        return res.status(400).json({
          success: false,
          error: "Prompt ID is required",
        })
      }

      // Calculate basic statistics
      const words = essayContent
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
      const word_count = words.length

      // Get prompt details for analysis context
      const promptResult = await db.query(
        "SELECT assignment, difficulty_level FROM writing_prompts WHERE prompt_id = $1",
        [prompt_id],
      )

      if (promptResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Prompt not found",
        })
      }

      const promptData = promptResult.rows[0]

      // Save submission to database (but not errors)
      let submission_id = null
      if (user_id) {
        const submissionQuery = `
          INSERT INTO writing_submissions (user_id, prompt_id, essay_text, word_count, time_spent_seconds)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING submission_id
        `
        const submissionResult = await db.query(submissionQuery, [
          user_id,
          prompt_id,
          essayContent,
          word_count,
          time_spent,
        ])
        submission_id = submissionResult.rows[0].submission_id
      }

      // Perform comprehensive analysis
      const analysis = await this.performComprehensiveAnalysis(
        essayContent,
        prompt || promptData.assignment,
        level || promptData.difficulty_level,
      )

      // Save analysis to database (without errors)
      let analysis_id = null
      if (user_id && submission_id) {
        try {
          analysis_id = await this.saveAnalysisToDatabase(submission_id, analysis)
          await this.updateUserProgress(user_id, analysis, word_count, time_spent, level)

          // Mark submission as analyzed
          await db.query("UPDATE writing_submissions SET is_analyzed = true WHERE submission_id = $1", [submission_id])
        } catch (dbError) {
          console.error("Database operation failed, but analysis completed:", dbError)
          // Continue without failing the entire request
        }
      }

      res.json({
        success: true,
        submission_id: submission_id,
        analysis_id: analysis_id,
        analysis: {
          ...analysis,
          ml_model_used: this.mlModelAvailable && analysis.analysis_method === "comprehensive_ml_rule_hybrid",
        },
      })
    } catch (error) {
      console.error("Error analyzing writing:", error)
      res.status(500).json({
        success: false,
        error: "Failed to analyze writing. Please try again.",
      })
    }
  }

  async performComprehensiveAnalysis(essay_text, prompt_text, level) {
    let analysis = null
    let analysis_method = "rule_based"

    // Try ML analysis first if available
    if (this.mlModelAvailable) {
      try {
        analysis = await this.performMLAnalysis(essay_text, prompt_text, level)
        analysis_method = "comprehensive_ml_rule_hybrid"
        console.log("Comprehensive ML analysis completed successfully")
      } catch (mlError) {
        console.warn("ML analysis failed, falling back to rule-based:", mlError.message)
        analysis = null
      }
    }

    // Fallback to enhanced rule-based analysis
    if (!analysis) {
      analysis = await this.performEnhancedRuleBasedAnalysis(essay_text, prompt_text, level)
      analysis_method = "enhanced_rule_based"
    }

    // Add metadata
    analysis.analysis_method = analysis_method
    analysis.timestamp = new Date().toISOString()
    analysis.level = level

    return analysis
  }

  async performMLAnalysis(essay_text, prompt_text, level) {
    return new Promise((resolve, reject) => {
      try {
        const inputData = JSON.stringify({
          essay: essay_text,
          prompt: prompt_text,
          level: level,
        })

        const scriptPath = path.join(__dirname, "../ml_scripts/essay_inference.py")
        const python = spawn("python3", [scriptPath])

        let output = ""
        let error = ""

        python.stdout.on("data", (data) => {
          output += data.toString()
        })

        python.stderr.on("data", (data) => {
          error += data.toString()
        })

        python.stdin.write(inputData)
        python.stdin.end()

        python.on("close", (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(output)
              resolve(result)
            } catch (parseError) {
              reject(new Error(`Failed to parse ML output: ${parseError.message}`))
            }
          } else {
            reject(new Error(`ML analysis failed with code ${code}: ${error}`))
          }
        })

        python.on("error", (err) => {
          reject(new Error(`Failed to start ML analysis: ${err.message}`))
        })

        // Timeout after 60 seconds
        setTimeout(() => {
          python.kill()
          reject(new Error("ML analysis timed out"))
        }, 60000)
      } catch (error) {
        reject(error)
      }
    })
  }

  async performEnhancedRuleBasedAnalysis(essay_text, prompt_text, level) {
    // Enhanced rule-based analysis with better error detection
    const words = essay_text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
    const sentences = essay_text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    const paragraphs = essay_text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

    // Calculate comprehensive statistics
    const statistics = {
      word_count: words.length,
      sentence_count: sentences.length,
      paragraph_count: paragraphs.length,
      character_count: essay_text.length,
      character_count_no_spaces: essay_text.replace(/\s/g, "").length,
      avg_words_per_sentence: Math.round((words.length / sentences.length) * 10) / 10,
      avg_sentences_per_paragraph: Math.round((sentences.length / paragraphs.length) * 10) / 10,
      unique_words: new Set(words.map((w) => w.toLowerCase())).size,
      vocabulary_diversity: new Set(words.map((w) => w.toLowerCase())).size / words.length,
      reading_time_minutes: Math.ceil(words.length / 200),
    }

    // Enhanced scoring
    const content_score = this.analyzeContentEnhanced(essay_text, prompt_text, words, sentences, statistics)
    const organization_score = this.analyzeOrganizationEnhanced(essay_text, paragraphs, sentences, statistics)
    const language_score = this.analyzeLanguageEnhanced(essay_text, words, sentences, statistics)
    const conventions_score = this.analyzeConventionsEnhanced(essay_text)

    // Apply level adjustments
    const level_multiplier = this.getLevelMultiplier(level)
    const adjusted_scores = {
      content: Math.min(10, Math.max(1, content_score * level_multiplier)),
      organization: Math.min(10, Math.max(1, organization_score * level_multiplier)),
      language: Math.min(10, Math.max(1, language_score * level_multiplier)),
      conventions: Math.min(10, Math.max(1, conventions_score)),
    }

    const overall_score =
      (adjusted_scores.content +
        adjusted_scores.organization +
        adjusted_scores.language +
        adjusted_scores.conventions) /
      4

    // Enhanced error detection (but don't save to DB)
    const detected_errors = this.detectComprehensiveErrors(essay_text)

    // Adjust conventions score based on errors
    if (detected_errors.length > 0) {
      const error_penalty = Math.min(detected_errors.length * 0.1, 2.0)
      adjusted_scores.conventions = Math.max(adjusted_scores.conventions - error_penalty, 1.0)
    }

    // Recalculate overall score
    const final_overall =
      (adjusted_scores.content +
        adjusted_scores.organization +
        adjusted_scores.language +
        adjusted_scores.conventions) /
      4

    // Group errors by type
    const grouped_errors = this.groupErrorsByType(detected_errors)

    // Generate enhanced feedback and improvements
    const feedback = this.generateEnhancedFeedback(adjusted_scores, level, statistics, detected_errors)
    const improvements = this.generateEnhancedImprovements(adjusted_scores, detected_errors, level)
    const structure_analysis = this.analyzeStructureEnhanced(essay_text, paragraphs, sentences)

    return {
      overall_score: Math.round(final_overall * 10) / 10,
      content_score: Math.round(adjusted_scores.content * 10) / 10,
      organization_score: Math.round(adjusted_scores.organization * 10) / 10,
      language_score: Math.round(adjusted_scores.language * 10) / 10,
      conventions_score: Math.round(adjusted_scores.conventions * 10) / 10,
      detailed_scores: {
        content: Math.round(adjusted_scores.content * 10) / 10,
        organization: Math.round(adjusted_scores.organization * 10) / 10,
        language: Math.round(adjusted_scores.language * 10) / 10,
        conventions: Math.round(adjusted_scores.conventions * 10) / 10,
      },
      feedback: feedback,
      improvements: improvements,
      structure_analysis: structure_analysis,
      statistics: statistics,
      errors: detected_errors, // Return errors but don't save to DB
      grouped_errors: grouped_errors,
      error_count: detected_errors.length,
    }
  }

  // Enhanced analysis methods
  analyzeContentEnhanced(essay_text, prompt_text, words, sentences, statistics) {
    let score = 5.0

    // Word count consideration with better scaling
    const word_count = statistics.word_count
    if (word_count >= 400) score += 1.5
    else if (word_count >= 250) score += 1.0
    else if (word_count >= 150) score += 0.5
    else if (word_count < 100) score -= 1.5

    // Enhanced prompt relevance
    const prompt_keywords = this.extractKeywordsEnhanced(prompt_text.toLowerCase())
    const essay_keywords = this.extractKeywordsEnhanced(essay_text.toLowerCase())
    const relevance_score = this.calculateRelevanceEnhanced(prompt_keywords, essay_keywords)
    score += relevance_score * 2.5

    // Evidence and analysis indicators
    const evidence_indicators = [
      "for example",
      "according to",
      "the text states",
      "evidence shows",
      "the author argues",
      "in the article",
      "the passage",
      "research shows",
      "studies indicate",
      "data suggests",
      "statistics show",
      "experts claim",
      "scholars argue",
      "findings reveal",
      "analysis shows",
    ]
    const evidence_count = evidence_indicators.filter((indicator) =>
      essay_text.toLowerCase().includes(indicator),
    ).length
    score += Math.min(evidence_count * 0.4, 2.0)

    // Thesis and argument development
    if (this.detectThesisEnhanced(essay_text)) score += 1.2
    score += this.assessArgumentStrengthEnhanced(essay_text)

    return Math.min(score, 10)
  }

  analyzeOrganizationEnhanced(essay_text, paragraphs, sentences, statistics) {
    let score = 5.0

    // Paragraph structure with better assessment
    const para_count = statistics.paragraph_count
    if (para_count >= 5) score += 1.5
    else if (para_count >= 4) score += 1.2
    else if (para_count >= 3) score += 0.8
    else if (para_count < 2) score -= 1.5

    // Introduction and conclusion detection
    if (this.detectIntroductionEnhanced(paragraphs[0] || "")) score += 1.2
    if (this.detectConclusionEnhanced(paragraphs[paragraphs.length - 1] || "")) score += 1.2

    // Transition usage with better detection
    const transition_count = this.countTransitionsEnhanced(essay_text)
    score += Math.min(transition_count * 0.25, 1.8)

    // Logical flow assessment
    score += this.assessLogicalFlowEnhanced(paragraphs, sentences)

    return Math.min(score, 10)
  }

  analyzeLanguageEnhanced(essay_text, words, sentences, statistics) {
    let score = 5.0

    // Vocabulary diversity with better scaling
    const vocab_diversity = statistics.vocabulary_diversity
    if (vocab_diversity > 0.75) score += 1.8
    else if (vocab_diversity > 0.6) score += 1.2
    else if (vocab_diversity > 0.45) score += 0.8
    else if (vocab_diversity < 0.3) score -= 1.0

    // Sentence variety and complexity
    const avg_sentence_length = statistics.avg_words_per_sentence
    if (avg_sentence_length >= 12 && avg_sentence_length <= 22) score += 1.0
    else if (avg_sentence_length > 25) score -= 0.5
    else if (avg_sentence_length < 8) score -= 0.8

    // Academic vocabulary
    const academic_count = this.countAcademicVocabularyEnhanced(words)
    score += Math.min(academic_count * 0.08, 1.5)

    // Sentence complexity
    const complex_sentences = this.countComplexSentences(essay_text)
    score += Math.min(complex_sentences * 0.15, 1.2)

    return Math.min(score, 10)
  }

  analyzeConventionsEnhanced(essay_text) {
    let score = 8.5 // Start higher for enhanced analysis

    // Detect errors but don't save them
    const errors = this.detectComprehensiveErrors(essay_text)

    // More nuanced error penalty system
    errors.forEach((error) => {
      const severity = error.severity || "medium"
      const error_type = error.type || "other"

      let penalty = 0
      switch (severity) {
        case "high":
          penalty = error_type === "grammar" ? 0.6 : 0.4
          break
        case "medium":
          penalty = error_type === "spelling" ? 0.3 : 0.25
          break
        case "low":
          penalty = 0.1
          break
      }
      score -= penalty
    })

    return Math.max(score, 1.0)
  }

  detectComprehensiveErrors(essay_text) {
    const errors = []

    // Enhanced spelling error detection
    const spelling_errors = this.detectSpellingErrorsEnhanced(essay_text)
    errors.push(...spelling_errors)

    // Enhanced grammar error detection
    const grammar_errors = this.detectGrammarErrorsEnhanced(essay_text)
    errors.push(...grammar_errors)

    // Enhanced punctuation error detection
    const punctuation_errors = this.detectPunctuationErrorsEnhanced(essay_text)
    errors.push(...punctuation_errors)

    // Style and clarity issues
    const style_errors = this.detectStyleIssuesEnhanced(essay_text)
    errors.push(...style_errors)

    // Word choice issues
    const word_choice_errors = this.detectWordChoiceErrors(essay_text)
    errors.push(...word_choice_errors)

    return errors
  }

  detectSpellingErrorsEnhanced(text) {
    const errors = []
    const common_misspellings = {
      // Contractions
      alot: "a lot",
      cant: "can't",
      dont: "don't",
      doesnt: "doesn't",
      didnt: "didn't",
      couldnt: "couldn't",
      shouldnt: "shouldn't",
      wouldnt: "wouldn't",
      wont: "won't",
      isnt: "isn't",
      wasnt: "wasn't",
      werent: "weren't",
      havent: "haven't",
      hasnt: "hasn't",
      hadnt: "hadn't",
      youre: "you're",
      youve: "you've",
      youll: "you'll",
      youd: "you'd",
      hes: "he's",
      shes: "she's",
      weve: "we've",
      wed: "we'd",
      theyd: "they'd",
      theyve: "they've",
      thats: "that's",
      whats: "what's",
      wheres: "where's",

      // Common misspellings
      recieve: "receive",
      seperate: "separate",
      definately: "definitely",
      occured: "occurred",
      begining: "beginning",
      beleive: "believe",
      acheive: "achieve",
      neccessary: "necessary",
      accomodate: "accommodate",
      embarass: "embarrass",
      existance: "existence",
      independant: "independent",
      maintainance: "maintenance",
      occassion: "occasion",
      priviledge: "privilege",
      recomend: "recommend",
      succesful: "successful",
      tommorrow: "tomorrow",
      untill: "until",
      wierd: "weird",
      goverment: "government",
      enviroment: "environment",
      arguement: "argument",
      judgement: "judgment",
      knowlege: "knowledge",
      rythm: "rhythm",
      speach: "speech",
      writting: "writing",
      grammer: "grammar",
    }

    for (const [wrong, correct] of Object.entries(common_misspellings)) {
      const regex = new RegExp(`\\b${wrong}\\b`, "gi")
      let match
      while ((match = regex.exec(text)) !== null) {
        errors.push({
          type: "spelling",
          text: match[0],
          start_pos: match.index,
          end_pos: match.index + match[0].length,
          suggestion: correct,
          explanation: `'${match[0]}' should be '${correct}'`,
          severity: "medium",
          confidence: 0.9,
        })
      }
    }

    return errors
  }

  detectGrammarErrorsEnhanced(text) {
    const errors = []

    // Enhanced grammar patterns
    const grammar_patterns = [
      {
        pattern: /\b(he|she|it)\s+(are|were)\b/gi,
        message: "Subject-verb agreement error",
        suggestion: "Use 'is' or 'was' with singular subjects",
        severity: "high",
      },
      {
        pattern: /\b(they|we|you)\s+(is|was)\b/gi,
        message: "Subject-verb agreement error",
        suggestion: "Use 'are' or 'were' with plural subjects",
        severity: "high",
      },
      {
        pattern: /\bcould of|should of|would of|must of|might of\b/gi,
        message: "Incorrect modal verb form",
        suggestion: "Use 'have' instead of 'of' after modal verbs",
        severity: "high",
      },
      {
        pattern: /\bdifferent than\b/gi,
        message: "Incorrect preposition",
        suggestion: "Use 'different from' instead of 'different than'",
        severity: "medium",
      },
      {
        pattern: /\bless\s+\w+s\b/gi,
        message: "Incorrect quantifier",
        suggestion: "Use 'fewer' with countable nouns",
        severity: "medium",
      },
    ]

    grammar_patterns.forEach((pattern_info) => {
      let match
      while ((match = pattern_info.pattern.exec(text)) !== null) {
        errors.push({
          type: "grammar",
          text: match[0],
          start_pos: match.index,
          end_pos: match.index + match[0].length,
          suggestion: this.generateGrammarSuggestion(match[0]),
          explanation: pattern_info.message + ". " + pattern_info.suggestion,
          severity: pattern_info.severity,
          confidence: 0.8,
        })
      }
    })

    return errors
  }

  detectPunctuationErrorsEnhanced(text) {
    const errors = []

    // Enhanced punctuation patterns
    const punctuation_patterns = [
      {
        pattern: /[.!?]{2,}/g,
        message: "Multiple punctuation marks",
        suggestion: "Use only one punctuation mark",
        severity: "low",
      },
      {
        pattern: /[.!?,;:][a-zA-Z]/g,
        message: "Missing space after punctuation",
        suggestion: "Add space after punctuation marks",
        severity: "medium",
      },
      {
        pattern: /\s+[,;:]/g,
        message: "Space before punctuation",
        suggestion: "Remove space before punctuation",
        severity: "low",
      },
      {
        pattern: /[a-zA-Z]\s*$$[^)]*$$\s*[a-zA-Z]/g,
        message: "Parentheses spacing",
        suggestion: "Check spacing around parentheses",
        severity: "low",
      },
    ]

    punctuation_patterns.forEach((pattern_info) => {
      let match
      while ((match = pattern_info.pattern.exec(text)) !== null) {
        errors.push({
          type: "punctuation",
          text: match[0],
          start_pos: match.index,
          end_pos: match.index + match[0].length,
          suggestion: this.generatePunctuationSuggestion(match[0]),
          explanation: pattern_info.message + ". " + pattern_info.suggestion,
          severity: pattern_info.severity,
          confidence: 0.8,
        })
      }
    })

    return errors
  }

  detectStyleIssuesEnhanced(text) {
    const errors = []

    // Word repetition analysis
    const words = text.toLowerCase().split(/\s+/)
    const word_counts = {}
    words.forEach((word) => {
      if (word.length > 4 && /^[a-z]+$/.test(word)) {
        word_counts[word] = (word_counts[word] || 0) + 1
      }
    })

    // Common words to ignore
    const common_words = new Set([
      "the",
      "and",
      "that",
      "have",
      "for",
      "not",
      "with",
      "you",
      "this",
      "but",
      "his",
      "from",
      "they",
      "she",
      "her",
      "been",
      "than",
      "its",
      "were",
      "said",
    ])

    for (const [word, count] of Object.entries(word_counts)) {
      if (count > 4 && !common_words.has(word)) {
        const match = text.toLowerCase().indexOf(word)
        if (match !== -1) {
          errors.push({
            type: "style",
            text: word,
            start_pos: match,
            end_pos: match + word.length,
            suggestion: "Use synonyms for variety",
            explanation: `The word '${word}' appears ${count} times. Consider using synonyms.`,
            severity: "low",
            confidence: 0.6,
          })
        }
      }
    }

    // Passive voice detection
    const passive_pattern = /\b(is|are|was|were|be|been|being)\s+\w*ed\b/gi
    let match
    while ((match = passive_pattern.exec(text)) !== null) {
      // Skip if followed by "by" (intentional passive)
      const following_text = text.slice(match.index + match[0].length, match.index + match[0].length + 10)
      if (!/^\s+by\b/i.test(following_text)) {
        errors.push({
          type: "style",
          text: match[0],
          start_pos: match.index,
          end_pos: match.index + match[0].length,
          suggestion: "Consider active voice",
          explanation: "Consider rewriting in active voice for more direct expression.",
          severity: "low",
          confidence: 0.5,
        })
      }
    }

    return errors
  }

  detectWordChoiceErrors(text) {
    const errors = []

    const word_choice_confusions = {
      affect: "effect",
      effect: "affect",
      accept: "except",
      except: "accept",
      than: "then",
      then: "than",
      there: "their/they're",
      their: "there/they're",
      "they're": "there/their",
      your: "you're",
      "you're": "your",
      its: "it's",
      "it's": "its",
      whose: "who's",
      "who's": "whose",
      weather: "whether",
      whether: "weather",
      lose: "loose",
      loose: "lose",
    }

    for (const [word, suggestion] of Object.entries(word_choice_confusions)) {
      const regex = new RegExp(`\\b${word}\\b`, "gi")
      let match
      while ((match = regex.exec(text)) !== null) {
        errors.push({
          type: "word_choice",
          text: match[0],
          start_pos: match.index,
          end_pos: match.index + match[0].length,
          suggestion: suggestion,
          explanation: `'${match[0]}' might be confused with '${suggestion}'. Check context.`,
          severity: "medium",
          confidence: 0.6,
        })
      }
    }

    return errors
  }

  // Helper methods for enhanced analysis
  extractKeywordsEnhanced(text) {
    const stopwords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
    ])

    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3 && !stopwords.has(word))
      .filter((word) => /^[a-z]+$/.test(word))
  }

  calculateRelevanceEnhanced(prompt_keywords, essay_keywords) {
    if (prompt_keywords.length === 0) return 0

    const matched = prompt_keywords.filter((keyword) =>
      essay_keywords.some((essay_word) => essay_word.includes(keyword) || keyword.includes(essay_word)),
    )

    return matched.length / prompt_keywords.length
  }

  detectThesisEnhanced(essay_text) {
    const thesis_indicators = [
      "in this essay",
      "this essay will",
      "i will argue",
      "i believe",
      "i think",
      "this paper",
      "in conclusion",
      "to conclude",
      "therefore",
      "thus",
      "the main argument",
      "the central claim",
      "it is clear that",
      "evidence shows that",
    ]

    return thesis_indicators.some((indicator) => essay_text.toLowerCase().includes(indicator))
  }

  assessArgumentStrengthEnhanced(essay_text) {
    let score = 0
    const text_lower = essay_text.toLowerCase()

    // Look for argument indicators
    const argument_indicators = [
      "furthermore",
      "moreover",
      "in addition",
      "additionally",
      "also",
      "however",
      "nevertheless",
      "on the other hand",
      "in contrast",
      "for instance",
      "for example",
      "such as",
      "specifically",
      "first",
      "second",
      "finally",
      "in conclusion",
      "therefore",
    ]

    const found_indicators = argument_indicators.filter((indicator) => text_lower.includes(indicator))

    score += Math.min(found_indicators.length * 0.2, 1.5)

    // Look for evidence phrases
    const evidence_phrases = [
      "according to",
      "research shows",
      "studies indicate",
      "data suggests",
      "experts argue",
      "scholars claim",
      "the text states",
      "evidence indicates",
    ]

    const found_evidence = evidence_phrases.filter((phrase) => text_lower.includes(phrase))

    score += Math.min(found_evidence.length * 0.3, 1.0)

    return score
  }

  detectIntroductionEnhanced(first_paragraph) {
    const intro_indicators = [
      "introduction",
      "this essay",
      "this paper",
      "in this",
      "today",
      "throughout history",
      "many people",
      "it is important",
      "one of the most",
    ]

    return intro_indicators.some((indicator) => first_paragraph.toLowerCase().includes(indicator))
  }

  detectConclusionEnhanced(last_paragraph) {
    const conclusion_indicators = [
      "in conclusion",
      "to conclude",
      "in summary",
      "to summarize",
      "finally",
      "overall",
      "in the end",
      "therefore",
      "thus",
      "as a result",
      "consequently",
      "ultimately",
    ]

    return conclusion_indicators.some((indicator) => last_paragraph.toLowerCase().includes(indicator))
  }

  countTransitionsEnhanced(essay_text) {
    const transitions = [
      "however",
      "therefore",
      "furthermore",
      "moreover",
      "nevertheless",
      "in addition",
      "additionally",
      "consequently",
      "as a result",
      "on the other hand",
      "in contrast",
      "similarly",
      "likewise",
      "for example",
      "for instance",
      "specifically",
      "in particular",
      "first",
      "second",
      "third",
      "finally",
      "in conclusion",
      "meanwhile",
      "subsequently",
      "previously",
      "afterwards",
    ]

    const text_lower = essay_text.toLowerCase()
    return transitions.filter((transition) => text_lower.includes(transition)).length
  }

  assessLogicalFlowEnhanced(paragraphs, sentences) {
    let score = 0

    // Check for topic sentences
    paragraphs.forEach((paragraph) => {
      const first_sentence = paragraph.split(/[.!?]/)[0]
      if (first_sentence.length > 20 && first_sentence.length < 100) {
        score += 0.2
      }
    })

    // Check paragraph length consistency
    const para_lengths = paragraphs.map((p) => p.split(/\s+/).length)
    const avg_length = para_lengths.reduce((a, b) => a + b, 0) / para_lengths.length
    const variance = para_lengths.reduce((acc, len) => acc + Math.pow(len - avg_length, 2), 0) / para_lengths.length

    if (variance < 400) score += 0.5 // Low variance means consistent paragraph lengths

    return Math.min(score, 1.5)
  }

  countAcademicVocabularyEnhanced(words) {
    const academic_words = new Set([
      "analyze",
      "analysis",
      "argue",
      "argument",
      "assess",
      "assume",
      "concept",
      "conclude",
      "conclusion",
      "contrast",
      "criteria",
      "demonstrate",
      "derive",
      "evaluate",
      "evidence",
      "examine",
      "identify",
      "illustrate",
      "imply",
      "indicate",
      "interpret",
      "investigate",
      "maintain",
      "obtain",
      "perceive",
      "perspective",
      "principle",
      "process",
      "require",
      "research",
      "respond",
      "significant",
      "source",
      "specific",
      "structure",
      "theory",
      "vary",
      "approach",
      "authority",
      "available",
      "benefit",
      "commission",
      "community",
      "complex",
      "compute",
      "consistent",
      "constitutional",
      "context",
      "contract",
      "create",
      "data",
      "definition",
      "design",
      "distinction",
      "element",
      "environment",
      "estimate",
      "export",
      "factor",
      "feature",
      "final",
      "focus",
      "formula",
      "function",
      "income",
      "indicate",
      "individual",
      "interpret",
      "involve",
      "issue",
      "labor",
      "legal",
      "legislation",
      "major",
      "method",
      "occur",
      "percent",
      "period",
      "policy",
      "previous",
      "primary",
      "procedure",
      "process",
      "purchase",
      "range",
      "region",
      "regulation",
      "relevant",
      "require",
      "research",
      "resource",
      "response",
      "role",
      "section",
      "sector",
      "significant",
      "similar",
      "source",
      "specific",
      "structure",
      "theory",
      "variable",
    ])

    return words.filter((word) => academic_words.has(word.toLowerCase().replace(/[^a-z]/g, ""))).length
  }

  countComplexSentences(essay_text) {
    // Count sentences with subordinating conjunctions
    const subordinating_conjunctions = [
      "although",
      "because",
      "since",
      "while",
      "whereas",
      "if",
      "unless",
      "when",
      "where",
      "before",
      "after",
      "until",
      "as",
      "though",
    ]

    const sentences = essay_text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    return sentences.filter((sentence) =>
      subordinating_conjunctions.some((conj) => sentence.toLowerCase().includes(conj)),
    ).length
  }

  getLevelMultiplier(level) {
    const multipliers = {
      beginner: 1.2,
      intermediate: 1.0,
      advanced: 0.9,
    }
    return multipliers[level] || 1.0
  }

  groupErrorsByType(errors) {
    const grouped = {}
    errors.forEach((error) => {
      const type = error.type || "other"
      if (!grouped[type]) grouped[type] = []
      grouped[type].push(error)
    })
    return grouped
  }

  generateEnhancedFeedback(scores, level, statistics, errors) {
    const feedback = {
      overall_comment: "",
      strengths: [],
      areas_for_improvement: [],
      specific_suggestions: [],
    }

    // Overall comment
    const overall_score = (scores.content + scores.organization + scores.language + scores.conventions) / 4
    if (overall_score >= 8) {
      feedback.overall_comment = "Excellent work! Your essay demonstrates strong writing skills across all areas."
    } else if (overall_score >= 6) {
      feedback.overall_comment =
        "Good work! Your essay shows solid writing ability with room for improvement in some areas."
    } else if (overall_score >= 4) {
      feedback.overall_comment = "Your essay shows potential but needs development in several key areas."
    } else {
      feedback.overall_comment =
        "Your essay needs significant improvement in multiple areas. Focus on the suggestions below."
    }

    // Identify strengths
    if (scores.content >= 7) feedback.strengths.push("Strong content development and idea elaboration")
    if (scores.organization >= 7) feedback.strengths.push("Well-organized structure with clear paragraph development")
    if (scores.language >= 7) feedback.strengths.push("Effective use of vocabulary and varied sentence structure")
    if (scores.conventions >= 8) feedback.strengths.push("Good command of writing conventions and mechanics")
    if (statistics.vocabulary_diversity > 0.6) feedback.strengths.push("Good vocabulary variety")
    if (statistics.avg_words_per_sentence >= 12 && statistics.avg_words_per_sentence <= 20) {
      feedback.strengths.push("Appropriate sentence length and complexity")
    }

    // Areas for improvement
    if (scores.content < 6) feedback.areas_for_improvement.push("Content development and depth of analysis")
    if (scores.organization < 6) feedback.areas_for_improvement.push("Essay organization and paragraph structure")
    if (scores.language < 6) feedback.areas_for_improvement.push("Language use and vocabulary variety")
    if (scores.conventions < 6) feedback.areas_for_improvement.push("Writing conventions and error correction")

    // Specific suggestions
    if (statistics.word_count < 200) {
      feedback.specific_suggestions.push("Expand your essay with more detailed examples and analysis")
    }
    if (statistics.paragraph_count < 3) {
      feedback.specific_suggestions.push("Organize your ideas into more distinct paragraphs")
    }
    if (errors.length > 10) {
      feedback.specific_suggestions.push("Focus on proofreading to reduce mechanical errors")
    }
    if (statistics.vocabulary_diversity < 0.5) {
      feedback.specific_suggestions.push("Use more varied vocabulary to enhance your expression")
    }

    return feedback
  }

  generateEnhancedImprovements(scores, errors, level) {
    const improvements = []

    // Content improvements
    if (scores.content < 7) {
      improvements.push({
        area: "Content Development",
        description: "Strengthen your ideas with more detailed analysis and specific examples",
        tips: [
          "Use specific examples from the text to support your points",
          "Explain how your evidence connects to your main argument",
          "Develop each paragraph with at least 3-4 sentences",
          "Include analysis that goes beyond summary",
        ],
      })
    }

    // Organization improvements
    if (scores.organization < 7) {
      improvements.push({
        area: "Organization",
        description: "Improve the structure and flow of your essay",
        tips: [
          "Start with a clear introduction that states your main argument",
          "Use topic sentences to begin each body paragraph",
          "Include transition words to connect ideas between paragraphs",
          "End with a conclusion that reinforces your main points",
        ],
      })
    }

    // Language improvements
    if (scores.language < 7) {
      improvements.push({
        area: "Language Use",
        description: "Enhance your vocabulary and sentence variety",
        tips: [
          "Use more sophisticated vocabulary where appropriate",
          "Vary your sentence lengths and structures",
          "Avoid repetitive word choices",
          "Use active voice when possible",
        ],
      })
    }

    // Conventions improvements
    if (scores.conventions < 7 || errors.length > 5) {
      improvements.push({
        area: "Writing Conventions",
        description: "Focus on grammar, punctuation, and spelling accuracy",
        tips: [
          "Proofread your essay carefully before submitting",
          "Check for common errors like subject-verb agreement",
          "Use spell-check and grammar-check tools",
          "Read your essay aloud to catch errors",
        ],
      })
    }

    return improvements
  }

  analyzeStructureEnhanced(essay_text, paragraphs, sentences) {
    const structure = {
      has_introduction: false,
      has_conclusion: false,
      body_paragraphs: 0,
      transition_count: 0,
      paragraph_balance: "uneven",
    }

    // Check for introduction
    if (paragraphs.length > 0) {
      structure.has_introduction = this.detectIntroductionEnhanced(paragraphs[0])
    }

    // Check for conclusion
    if (paragraphs.length > 1) {
      structure.has_conclusion = this.detectConclusionEnhanced(paragraphs[paragraphs.length - 1])
    }

    // Count body paragraphs
    structure.body_paragraphs = Math.max(0, paragraphs.length - 2)
    if (paragraphs.length <= 2) {
      structure.body_paragraphs = paragraphs.length
    }

    // Count transitions
    structure.transition_count = this.countTransitionsEnhanced(essay_text)

    // Assess paragraph balance
    const para_lengths = paragraphs.map((p) => p.split(/\s+/).length)
    const avg_length = para_lengths.reduce((a, b) => a + b, 0) / para_lengths.length
    const variance = para_lengths.reduce((acc, len) => acc + Math.pow(len - avg_length, 2), 0) / para_lengths.length

    if (variance < 200) structure.paragraph_balance = "well-balanced"
    else if (variance < 500) structure.paragraph_balance = "somewhat uneven"
    else structure.paragraph_balance = "uneven"

    return structure
  }

  generateGrammarSuggestion(error_text) {
    const suggestions = {
      "he are": "he is",
      "she are": "she is",
      "it are": "it is",
      "they is": "they are",
      "could of": "could have",
      "should of": "should have",
      "would of": "would have",
    }

    return suggestions[error_text.toLowerCase()] || "Check grammar"
  }

  generatePunctuationSuggestion(error_text) {
    if (error_text.includes("  ")) return error_text.replace(/\s+/g, " ")
    if (error_text.match(/[.!?]{2,}/)) return error_text.charAt(0)
    return "Check punctuation"
  }

  // ==================== DATABASE OPERATIONS ====================

  async saveAnalysisToDatabase(submission_id, analysis) {
    try {
      const query = `
        INSERT INTO writing_analysis (
          submission_id, overall_score, content_score, organization_score, 
          language_score, conventions_score, feedback, improvements, 
          structure_analysis, statistics, analysis_method, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING analysis_id
      `

      const values = [
        submission_id,
        analysis.overall_score,
        analysis.content_score || analysis.detailed_scores?.content,
        analysis.organization_score || analysis.detailed_scores?.organization,
        analysis.language_score || analysis.detailed_scores?.language,
        analysis.conventions_score || analysis.detailed_scores?.conventions,
        JSON.stringify(analysis.feedback),
        JSON.stringify(analysis.improvements),
        JSON.stringify(analysis.structure_analysis),
        JSON.stringify(analysis.statistics),
        analysis.analysis_method || "enhanced_rule_based",
      ]

      const result = await db.query(query, values)
      return result.rows[0].analysis_id
    } catch (error) {
      console.error("Error saving analysis to database:", error)
      throw error
    }
  }

  async updateUserProgress(user_id, analysis, word_count, time_spent, level) {
    try {
      // Check if user progress record exists
      const existingProgress = await db.query("SELECT * FROM writing_progress WHERE user_id = $1", [user_id])

      if (existingProgress.rows.length === 0) {
        // Create new progress record
        await db.query(
          `
          INSERT INTO writing_progress (
            user_id, total_essays, total_words_written, total_time_spent_minutes,
            average_score, best_score, essays_by_level, last_activity, created_at
          ) VALUES ($1, 1, $2, $3, $4, $4, $5, NOW(), NOW())
        `,
          [user_id, word_count, Math.round(time_spent / 60), analysis.overall_score, JSON.stringify({ [level]: 1 })],
        )
      } else {
        // Update existing progress
        const current = existingProgress.rows[0]
        const essays_by_level = current.essays_by_level || {}
        essays_by_level[level] = (essays_by_level[level] || 0) + 1

        const new_total_essays = current.total_essays + 1
        const new_avg_score = (current.average_score * current.total_essays + analysis.overall_score) / new_total_essays

        await db.query(
          `
          UPDATE writing_progress SET
            total_essays = $1,
            total_words_written = total_words_written + $2,
            total_time_spent_minutes = total_time_spent_minutes + $3,
            average_score = $4,
            best_score = GREATEST(best_score, $5),
            essays_by_level = $6,
            last_activity = NOW()
          WHERE user_id = $7
        `,
          [
            new_total_essays,
            word_count,
            Math.round(time_spent / 60),
            new_avg_score,
            analysis.overall_score,
            JSON.stringify(essays_by_level),
            user_id,
          ],
        )
      }
    } catch (error) {
      console.error("Error updating user progress:", error)
      // Don't throw - this shouldn't fail the main analysis
    }
  }

  // ==================== USER PROGRESS AND HISTORY ====================

  async getUserWritingHistory(req, res) {
    try {
      const user_id = req.user?.user_id
      const { limit = 10, offset = 0, level = "all" } = req.query

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        })
      }

      let query = `
        SELECT 
          ws.submission_id,
          ws.prompt_id,
          wp.prompt_name,
          ws.essay_text,
          ws.word_count,
          ws.time_spent_seconds,
          ws.submitted_at,
          wa.overall_score,
          wa.content_score,
          wa.organization_score,
          wa.language_score,
          wa.conventions_score,
          wa.analysis_method
        FROM writing_submissions ws
        LEFT JOIN writing_analysis wa ON ws.submission_id = wa.submission_id
        LEFT JOIN writing_prompts wp ON ws.prompt_id = wp.prompt_id
        WHERE ws.user_id = $1
      `
      const params = [user_id]

      if (level !== "all") {
        query += ` AND wp.difficulty_level = $${params.length + 1}`
        params.push(level)
      }

      query += ` ORDER BY ws.submitted_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(Number.parseInt(limit), Number.parseInt(offset))

      const result = await db.query(query, params)

      res.json({
        success: true,
        submissions: result.rows,
        returned: result.rows.length,
      })
    } catch (error) {
      console.error("Error fetching user writing history:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch writing history",
      })
    }
  }

  async getUserProgress(req, res) {
    try {
      const user_id = req.user?.user_id

      if (!user_id) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        })
      }

      const progressResult = await db.query("SELECT * FROM writing_progress WHERE user_id = $1", [user_id])

      if (progressResult.rows.length === 0) {
        return res.json({
          success: true,
          progress: {
            total_essays: 0,
            total_words_written: 0,
            total_time_spent_minutes: 0,
            average_score: 0,
            best_score: 0,
            essays_by_level: {},
            improvement_trend: "no_data",
          },
        })
      }

      const progress = progressResult.rows[0]

      // Calculate improvement trend
      const recentScores = await db.query(
        `
        SELECT wa.overall_score, ws.submitted_at
        FROM writing_analysis wa
        JOIN writing_submissions ws ON wa.submission_id = ws.submission_id
        WHERE ws.user_id = $1
        ORDER BY ws.submitted_at DESC
        LIMIT 5
      `,
        [user_id],
      )

      let improvement_trend = "stable"
      if (recentScores.rows.length >= 3) {
        const scores = recentScores.rows.reverse().map((row) => row.overall_score)
        const firstHalf = scores.slice(0, Math.floor(scores.length / 2))
        const secondHalf = scores.slice(Math.floor(scores.length / 2))

        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

        if (secondAvg > firstAvg + 0.5) improvement_trend = "improving"
        else if (secondAvg < firstAvg - 0.5) improvement_trend = "declining"
      }

      res.json({
        success: true,
        progress: {
          ...progress,
          improvement_trend,
        },
      })
    } catch (error) {
      console.error("Error fetching user progress:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch user progress",
      })
    }
  }

  // ==================== SYSTEM STATUS ====================

  async getSystemStatus(req, res) {
    try {
      const status = {
        service_initialized: this.isInitialized,
        ml_model_available: this.mlModelAvailable,
        database_connected: false,
        prompt_count: 0,
        analysis_mode: this.mlModelAvailable ? "AI-Enhanced" : "Rule-Based",
      }

      // Check database connection
      try {
        await db.query("SELECT 1")
        status.database_connected = true

        // Get prompt count
        const promptResult = await db.query("SELECT COUNT(*) as count FROM writing_prompts WHERE is_active = true")
        status.prompt_count = Number.parseInt(promptResult.rows[0].count)
      } catch (dbError) {
        console.error("Database check failed:", dbError)
      }

      res.json({
        success: true,
        status: status,
      })
    } catch (error) {
      console.error("Error checking system status:", error)
      res.status(500).json({
        success: false,
        error: "Failed to check system status",
      })
    }
  }

  // ==================== SAMPLE ESSAYS ====================

  async getSampleEssays(req, res) {
    try {
      const { level = "intermediate", category = "all", limit = 5 } = req.query

      // For now, return sample essays data
      const sampleEssays = [
        {
          id: 1,
          title: "The Impact of Technology on Education",
          level: "intermediate",
          category: "argumentative",
          excerpt: "Technology has revolutionized the way we learn and teach...",
          score: 8.5,
          strengths: ["Clear thesis", "Good examples", "Strong conclusion"],
        },
        {
          id: 2,
          title: "Climate Change Solutions",
          level: "advanced",
          category: "persuasive",
          excerpt: "Addressing climate change requires immediate action...",
          score: 9.2,
          strengths: ["Compelling evidence", "Sophisticated vocabulary", "Logical flow"],
        },
        {
          id: 3,
          title: "Benefits of Reading",
          level: "beginner",
          category: "expository",
          excerpt: "Reading books provides many benefits for people of all ages...",
          score: 7.8,
          strengths: ["Clear organization", "Simple language", "Good examples"],
        },
      ]

      let filteredEssays = sampleEssays
      if (level !== "all") {
        filteredEssays = filteredEssays.filter((essay) => essay.level === level)
      }
      if (category !== "all") {
        filteredEssays = filteredEssays.filter((essay) => essay.category === category)
      }

      res.json({
        success: true,
        essays: filteredEssays.slice(0, Number.parseInt(limit)),
        total: filteredEssays.length,
      })
    } catch (error) {
      console.error("Error fetching sample essays:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch sample essays",
      })
    }
  }

  // ==================== WRITING TIPS ====================

  async getWritingTips(req, res) {
    try {
      const { category = "all", level = "all" } = req.query

      const writingTips = {
        content: [
          {
            tip: "Start with a strong thesis statement",
            description: "Your thesis should clearly state your main argument or position",
            level: "beginner",
          },
          {
            tip: "Use specific examples and evidence",
            description: "Support your points with concrete examples from the text or real life",
            level: "intermediate",
          },
          {
            tip: "Develop complex arguments with nuance",
            description: "Consider multiple perspectives and acknowledge counterarguments",
            level: "advanced",
          },
        ],
        organization: [
          {
            tip: "Use the five-paragraph structure",
            description: "Introduction, three body paragraphs, and conclusion",
            level: "beginner",
          },
          {
            tip: "Create smooth transitions between paragraphs",
            description: "Use transitional phrases to connect your ideas logically",
            level: "intermediate",
          },
          {
            tip: "Vary your paragraph structure",
            description: "Use different organizational patterns to enhance readability",
            level: "advanced",
          },
        ],
        language: [
          {
            tip: "Use varied sentence structures",
            description: "Mix simple, compound, and complex sentences for better flow",
            level: "intermediate",
          },
          {
            tip: "Choose precise vocabulary",
            description: "Select words that convey your exact meaning",
            level: "intermediate",
          },
          {
            tip: "Maintain consistent tone",
            description: "Keep your writing style appropriate for your audience",
            level: "advanced",
          },
        ],
        conventions: [
          {
            tip: "Proofread carefully",
            description: "Check for spelling, grammar, and punctuation errors",
            level: "beginner",
          },
          {
            tip: "Use proper citation format",
            description: "Follow the required citation style for your assignment",
            level: "intermediate",
          },
          {
            tip: "Master advanced punctuation",
            description: "Use semicolons, colons, and dashes effectively",
            level: "advanced",
          },
        ],
      }

      let tips = []
      if (category === "all") {
        tips = Object.values(writingTips).flat()
      } else if (writingTips[category]) {
        tips = writingTips[category]
      }

      if (level !== "all") {
        tips = tips.filter((tip) => tip.level === level)
      }

      res.json({
        success: true,
        tips: tips,
        categories: Object.keys(writingTips),
      })
    } catch (error) {
      console.error("Error fetching writing tips:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch writing tips",
      })
    }
  }
}

// Export singleton instance
const writingAIController = new AdvancedWritingAIController()

module.exports = {
  getWritingPrompts: (req, res) => writingAIController.getWritingPrompts(req, res),
  getPromptById: (req, res) => writingAIController.getPromptById(req, res),
  analyzeWriting: (req, res) => writingAIController.analyzeWriting(req, res),
  getUserWritingHistory: (req, res) => writingAIController.getUserWritingHistory(req, res),
  getWritingProgress: (req, res) => writingAIController.getUserProgress(req, res),
  getSystemStatus: (req, res) => writingAIController.getSystemStatus(req, res),
  getSampleEssays: (req, res) => writingAIController.getSampleEssays(req, res),
  getWritingTips: (req, res) => writingAIController.getWritingTips(req, res),
}
