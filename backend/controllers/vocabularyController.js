const db = require("../db")
const csv = require("csv-parser")
const https = require("https")

// Fetch and parse CSV data
const fetchVocabularyData = () => {
  return new Promise((resolve, reject) => {
    const results = []
    const url =
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ENGLISH_CERF_WORDS-NhvSTQ88v19QbR8iTgrsoCzE3hojXr.csv"

    https
      .get(url, (response) => {
        response
          .pipe(csv())
          .on("data", (data) => results.push(data))
          .on("end", () => resolve(results))
          .on("error", reject)
      })
      .on("error", reject)
  })
}

// Initialize vocabulary database with CSV data
const initializeVocabulary = async (req, res) => {
  try {
    // Create vocabulary table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS vocabulary (
        id SERIAL PRIMARY KEY,
        headword VARCHAR(255) NOT NULL,
        cefr_level VARCHAR(10) NOT NULL,
        definition TEXT,
        example_sentence TEXT,
        pronunciation VARCHAR(255),
        part_of_speech VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Check if vocabulary already exists
    const existingCount = await db.query("SELECT COUNT(*) FROM vocabulary")
    if (Number.parseInt(existingCount.rows[0].count) > 0) {
      return res.json({
        success: true,
        message: "Vocabulary already initialized",
        count: existingCount.rows[0].count,
      })
    }

    // Fetch CSV data
    const vocabularyData = await fetchVocabularyData()

    // Insert vocabulary data
    for (const word of vocabularyData) {
      await db.query("INSERT INTO vocabulary (headword, cefr_level) VALUES ($1, $2)", [word.headword, word.CEFR])
    }

    res.json({
      success: true,
      message: "Vocabulary initialized successfully",
      count: vocabularyData.length,
    })
  } catch (error) {
    console.error("Error initializing vocabulary:", error)
    res.status(500).json({ success: false, message: "Failed to initialize vocabulary" })
  }
}

// Get all vocabulary with pagination and filtering
const getVocabulary = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", cefr = "", sortBy = "headword", sortOrder = "ASC" } = req.query

    const offset = (page - 1) * limit
    let whereClause = "WHERE 1=1"
    const queryParams = []
    let paramCount = 0

    // Add search filter
    if (search) {
      paramCount++
      whereClause += ` AND (headword ILIKE $${paramCount} OR definition ILIKE $${paramCount})`
      queryParams.push(`%${search}%`)
    }

    // Add CEFR filter
    if (cefr) {
      paramCount++
      whereClause += ` AND cefr_level = $${paramCount}`
      queryParams.push(cefr)
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM vocabulary ${whereClause}`
    const totalResult = await db.query(countQuery, queryParams)
    const total = Number.parseInt(totalResult.rows[0].count)

    // Get vocabulary data
    paramCount++
    queryParams.push(limit)
    paramCount++
    queryParams.push(offset)

    const dataQuery = `
      SELECT * FROM vocabulary 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `

    const result = await db.query(dataQuery, queryParams)

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching vocabulary:", error)
    res.status(500).json({ success: false, message: "Failed to fetch vocabulary" })
  }
}

// Get vocabulary statistics
const getVocabularyStats = async (req, res) => {
  try {
    // Total count
    const totalResult = await db.query("SELECT COUNT(*) FROM vocabulary")
    const total = Number.parseInt(totalResult.rows[0].count)

    // Count by CEFR level
    const cefrStats = await db.query(`
      SELECT cefr_level, COUNT(*) as count 
      FROM vocabulary 
      GROUP BY cefr_level 
      ORDER BY cefr_level
    `)

    // Words with definitions
    const withDefinitions = await db.query(`
      SELECT COUNT(*) FROM vocabulary 
      WHERE definition IS NOT NULL AND definition != ''
    `)

    res.json({
      success: true,
      stats: {
        total,
        withDefinitions: Number.parseInt(withDefinitions.rows[0].count),
        byCefr: cefrStats.rows.reduce((acc, row) => {
          acc[row.cefr_level] = Number.parseInt(row.count)
          return acc
        }, {}),
      },
    })
  } catch (error) {
    console.error("Error fetching vocabulary stats:", error)
    res.status(500).json({ success: false, message: "Failed to fetch vocabulary statistics" })
  }
}

// Add new vocabulary word
const addVocabulary = async (req, res) => {
  try {
    const { headword, cefr_level, definition, example_sentence, pronunciation, part_of_speech } = req.body

    if (!headword || !cefr_level) {
      return res.status(400).json({
        success: false,
        message: "Headword and CEFR level are required",
      })
    }

    const result = await db.query(
      `INSERT INTO vocabulary 
       (headword, cefr_level, definition, example_sentence, pronunciation, part_of_speech) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [headword, cefr_level, definition, example_sentence, pronunciation, part_of_speech],
    )

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error("Error adding vocabulary:", error)
    res.status(500).json({ success: false, message: "Failed to add vocabulary word" })
  }
}

// Update vocabulary word
const updateVocabulary = async (req, res) => {
  try {
    const { id } = req.params
    const { headword, cefr_level, definition, example_sentence, pronunciation, part_of_speech } = req.body

    const result = await db.query(
      `UPDATE vocabulary 
       SET headword = $1, cefr_level = $2, definition = $3, 
           example_sentence = $4, pronunciation = $5, part_of_speech = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 
       RETURNING *`,
      [headword, cefr_level, definition, example_sentence, pronunciation, part_of_speech, id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Vocabulary word not found" })
    }

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error("Error updating vocabulary:", error)
    res.status(500).json({ success: false, message: "Failed to update vocabulary word" })
  }
}

// Delete vocabulary word
const deleteVocabulary = async (req, res) => {
  try {
    const { id } = req.params

    const result = await db.query("DELETE FROM vocabulary WHERE id = $1 RETURNING *", [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Vocabulary word not found" })
    }

    res.json({ success: true, message: "Vocabulary word deleted successfully" })
  } catch (error) {
    console.error("Error deleting vocabulary:", error)
    res.status(500).json({ success: false, message: "Failed to delete vocabulary word" })
  }
}

// Get random vocabulary words for practice
const getRandomVocabulary = async (req, res) => {
  try {
    const { count = 10, cefr = "" } = req.query

    let whereClause = ""
    const queryParams = [count]

    if (cefr) {
      whereClause = "WHERE cefr_level = $2"
      queryParams.push(cefr)
    }

    const result = await db.query(`SELECT * FROM vocabulary ${whereClause} ORDER BY RANDOM() LIMIT $1`, queryParams)

    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error("Error fetching random vocabulary:", error)
    res.status(500).json({ success: false, message: "Failed to fetch random vocabulary" })
  }
}

module.exports = {
  initializeVocabulary,
  getVocabulary,
  getVocabularyStats,
  addVocabulary,
  updateVocabulary,
  deleteVocabulary,
  getRandomVocabulary,
}
