const express = require("express")
const router = express.Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const db = require("../db")
const auth = require("../middleware/auth")
const adminAuth = require("../middleware/adminAuth")

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads/audio")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    // Create unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname) || ".mp3" // Default to .mp3 if no extension
    cb(null, "listening-" + uniqueSuffix + ext)
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1, // Only allow 1 file
  },
  fileFilter: (req, file, cb) => {
    console.log("File filter - Original name:", file.originalname)
    console.log("File filter - Mimetype:", file.mimetype)

    // Accept audio files only - more permissive check
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true)
    } else {
      cb(new Error("Only audio files are allowed!"), false)
    }
  },
})

// Middleware to log all requests
router.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`)
  console.log("Headers:", req.headers)
  console.log("Body:", req.body)
  next()
})

// Get all listening content
router.get("/content", auth, adminAuth, async (req, res) => {
  try {
    console.log("Fetching listening content...")
    const result = await db.query(`
      SELECT 
        content_id,
        title,
        description,
        transcript,
        difficulty_level,
        category,
        accent_type,
        audio_url,
        original_filename,
        duration_seconds,
        speaker_count,
        is_active,
        created_at,
        updated_at
      FROM listening_content 
      WHERE is_active = true
      ORDER BY created_at DESC
    `)

    console.log(`Found ${result.rows.length} listening content items`)
    res.json({ success: true, content: result.rows })
  } catch (err) {
    console.error("Error fetching listening content:", err)
    res.status(500).json({
      success: false,
      message: "Failed to fetch listening content",
      error: err.message,
    })
  }
})

// Get single listening content
router.get("/content/:id", auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params
    console.log(`Fetching listening content with ID: ${id}`)

    const result = await db.query(`SELECT * FROM listening_content WHERE content_id = $1 AND is_active = true`, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Content not found" })
    }

    console.log("Content found:", result.rows[0])
    res.json({ success: true, content: result.rows[0] })
  } catch (err) {
    console.error("Error fetching listening content:", err)
    res.status(500).json({
      success: false,
      message: "Failed to fetch content",
      error: err.message,
    })
  }
})

// Create new listening content
router.post("/content", auth, adminAuth, async (req, res) => {
  try {
    console.log("Creating new listening content...")
    console.log("Request body:", req.body)

    const { title, description, transcript, difficulty_level, category, accent_type, duration_seconds, speaker_count } =
      req.body

    // Validate required fields
    if (!title || !transcript) {
      return res.status(400).json({
        success: false,
        message: "Title and transcript are required",
      })
    }

    const result = await db.query(
      `INSERT INTO listening_content (
        title, description, transcript, difficulty_level, category,
        accent_type, duration_seconds, speaker_count, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
      RETURNING content_id, title`,
      [
        title,
        description || "",
        transcript,
        difficulty_level || "beginner",
        category || "conversation",
        accent_type || "american",
        Number.parseInt(duration_seconds) || 0,
        Number.parseInt(speaker_count) || 1,
      ],
    )

    console.log("Content created successfully:", result.rows[0])

    res.json({
      success: true,
      message: "Content created successfully",
      content_id: result.rows[0].content_id,
      title: result.rows[0].title,
    })
  } catch (err) {
    console.error("Error creating listening content:", err)
    res.status(500).json({
      success: false,
      message: "Failed to create content",
      error: err.message,
    })
  }
})

// Update listening content
router.put("/content/:id", auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params
    console.log(`Updating listening content with ID: ${id}`)
    console.log("Request body:", req.body)

    const { title, description, transcript, difficulty_level, category, accent_type, duration_seconds, speaker_count } =
      req.body

    // Validate required fields
    if (!title || !transcript) {
      return res.status(400).json({
        success: false,
        message: "Title and transcript are required",
      })
    }

    const result = await db.query(
      `UPDATE listening_content
      SET title = $1, 
          description = $2, 
          transcript = $3, 
          difficulty_level = $4, 
          category = $5,
          accent_type = $6,
          duration_seconds = $7,
          speaker_count = $8,
          updated_at = NOW()
      WHERE content_id = $9 AND is_active = true
      RETURNING content_id, title`,
      [
        title,
        description || "",
        transcript,
        difficulty_level || "beginner",
        category || "conversation",
        accent_type || "american",
        Number.parseInt(duration_seconds) || 0,
        Number.parseInt(speaker_count) || 1,
        id,
      ],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Content not found" })
    }

    console.log("Content updated successfully:", result.rows[0])
    res.json({ success: true, message: "Content updated successfully" })
  } catch (err) {
    console.error("Error updating listening content:", err)
    res.status(500).json({
      success: false,
      message: "Failed to update content",
      error: err.message,
    })
  }
})

// Delete listening content
router.delete("/content/:id", auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params
    console.log(`Deleting listening content with ID: ${id}`)

    // First get the content to check for audio file
    const contentResult = await db.query(`SELECT audio_url FROM listening_content WHERE content_id = $1`, [id])

    if (contentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Content not found" })
    }

    // Delete audio file if exists
    if (contentResult.rows[0].audio_url) {
      const audioPath = path.join(__dirname, "../uploads", contentResult.rows[0].audio_url.replace("/uploads/", ""))
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath)
        console.log("Audio file deleted:", audioPath)
      }
    }

    // Soft delete - set is_active to false
    await db.query(`UPDATE listening_content SET is_active = false, updated_at = NOW() WHERE content_id = $1`, [id])

    console.log("Content deleted successfully")
    res.json({ success: true, message: "Content deleted successfully" })
  } catch (err) {
    console.error("Error deleting listening content:", err)
    res.status(500).json({
      success: false,
      message: "Failed to delete content",
      error: err.message,
    })
  }
})

// Upload audio file
router.post("/upload-audio", auth, adminAuth, (req, res) => {
  console.log("Upload audio endpoint hit")
  console.log("Headers:", req.headers)
  console.log("Content-Type:", req.headers["content-type"])

  // Use a more robust error handling approach with multer
  upload.single("audio")(req, res, async (err) => {
    try {
      console.log("Multer processing...")

      if (err) {
        console.error("Multer error:", err)
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              success: false,
              message: "File too large. Maximum size is 50MB.",
            })
          } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
              success: false,
              message: "Unexpected field name. Use 'audio' for the file upload.",
            })
          }
        }
        return res.status(400).json({
          success: false,
          message: "File upload error: " + err.message,
        })
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded or file was rejected",
        })
      }

      console.log("File info:", req.file)
      console.log("Body:", req.body)

      const { contentId } = req.body

      if (!contentId) {
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path)
        }
        return res.status(400).json({
          success: false,
          message: "Content ID is required",
        })
      }

      // Create relative path for database storage
      const relativePath = `/uploads/audio/${req.file.filename}`
      const originalFilename = req.file.originalname

      console.log("Updating database with audio URL:", relativePath)
      console.log("Original filename:", originalFilename)

      // Update the content record with the audio URL and original filename
      const result = await db.query(
        `UPDATE listening_content
        SET audio_url = $1, original_filename = $2, updated_at = NOW()
        WHERE content_id = $3 AND is_active = true
        RETURNING content_id, title, audio_url, original_filename`,
        [relativePath, originalFilename, contentId],
      )

      if (result.rows.length === 0) {
        // Delete the uploaded file if content not found
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path)
        }
        return res.status(404).json({
          success: false,
          message: "Content not found",
        })
      }

      console.log("Audio uploaded successfully:", result.rows[0])

      res.json({
        success: true,
        message: "Audio uploaded successfully",
        audio_url: relativePath,
        filename: req.file.filename,
        content: result.rows[0],
      })
    } catch (dbErr) {
      console.error("Database error during upload:", dbErr)

      // Clean up uploaded file on database error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }

      res.status(500).json({
        success: false,
        message: "Database error during upload",
        error: dbErr.message,
      })
    }
  })
})

// Get analytics data
router.get("/analytics", auth, adminAuth, async (req, res) => {
  try {
    console.log("Fetching listening analytics...")

    // Get total content count
    const contentCountResult = await db.query(`
      SELECT COUNT(*) as total FROM listening_content WHERE is_active = true
    `)

    // Get difficulty stats
    const difficultyStatsResult = await db.query(`
      SELECT 
        difficulty_level as difficulty, 
        COUNT(*) as count
      FROM listening_content
      WHERE is_active = true
      GROUP BY difficulty_level
    `)

    // Get category stats
    const categoryStatsResult = await db.query(`
      SELECT 
        category, 
        COUNT(*) as count
      FROM listening_content
      WHERE is_active = true
      GROUP BY category
    `)

    const analytics = {
      totalContent: Number.parseInt(contentCountResult.rows[0].total),
      totalSessions: 0, // Default value
      averageScore: 0, // Default value
      popularContent: [], // Default empty array
      difficultyStats: difficultyStatsResult.rows.map((item) => ({
        ...item,
        count: Number.parseInt(item.count),
      })),
      categoryStats: categoryStatsResult.rows.map((item) => ({
        ...item,
        count: Number.parseInt(item.count),
      })),
      recentActivity: [], // Default empty array
    }

    console.log("Analytics data:", analytics)
    res.json(analytics)
  } catch (err) {
    console.error("Error fetching analytics:", err)
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
      error: err.message,
    })
  }
})

module.exports = router
