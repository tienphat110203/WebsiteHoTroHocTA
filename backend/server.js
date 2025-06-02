const express = require("express")
const cors = require("cors")
const authRoutes = require("./routes/authRoutes")
const userRoutes = require("./routes/userRoutes")
const adminRoutes = require("./routes/adminRoutes")
const courseRoutes = require("./routes/courseRoutes")
const paymentRoutes = require("./routes/paymentRoutes")
const path = require("path")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 5000

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"], // Frontend URLs
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-auth-token", "Authorization"],
  }),
)

// Add this near the top of your server.js file, after other requires
const fileUpload = require("express-fileupload")

// Middleware
// Increase the JSON payload limit
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Add this middleware before your routes
// Remove the fileUpload middleware if it's conflicting with multer
// app.use(
//   fileUpload({
//     limits: { fileSize: 50 * 1024 * 1024 },
//     useTempFiles: true,
//     tempFileDir: "/tmp/",
//   }),
// )

// Add more detailed logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  if (req.url.includes("upload")) {
    console.log("Content-Type:", req.headers["content-type"])
    console.log("Content-Length:", req.headers["content-length"])
  }
  next()
})

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
app.use("/audio", express.static(path.join(__dirname, "uploads/audio")))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/user", userRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api", courseRoutes)
app.use("/api", paymentRoutes)

// Add listening routes
const adminListeningRoutes = require("./routes/adminListeningRoutes")
app.use("/api/admin/listening", adminListeningRoutes)

const transactionRoutes = require("./routes/transactionRoutes")
app.use("/api/admin/transactions", transactionRoutes)

app.use("/api/certificates", require("./routes/certificateRoutes"))

// Import the AI routes only once
const userAiRoutes = require("./routes/userAiRoutes")
app.use("/api/ai", userAiRoutes)

// Add pronunciation AI routes
const pronunciationAIRoutes = require("./routes/pronunciationAIRoutes")
app.use("/api/pronunciation-ai", pronunciationAIRoutes)

const writingAIRoutes = require("./routes/writingAIRoutes")
app.use("/api/writing-ai", writingAIRoutes)

const listeningRoutes = require("./routes/listeningAIRoutes")
app.use("/api/listening", listeningRoutes)

// Create data directories if they don't exist
const fs = require("fs")
const dataDir = path.join(__dirname, "data")
const uploadsDir = path.join(__dirname, "uploads")
const audioDir = path.join(__dirname, "uploads/audio")

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true })
}

// More detailed error handling
app.use((err, req, res, next) => {
  console.error("Error details:", err)
  console.error(err.stack)
  res.status(500).json({ error: "Server error", message: err.message })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: "Something went wrong!" })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`API available at http://localhost:${PORT}/api`)
})
