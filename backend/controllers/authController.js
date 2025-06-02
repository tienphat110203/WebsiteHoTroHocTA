const { validationResult } = require("express-validator")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const nodemailer = require("nodemailer")
const db = require("../db")

// Function to send verification email
const sendVerificationEmail = async (email, token, username) => {
  // Get email settings from system_settings
  const emailSettingsResult = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = $1", [
    "email_settings",
  ])

  let emailSettings = {
    smtpHost: process.env.SMTP_HOST || "smtp.example.com",
    smtpPort: process.env.SMTP_PORT || 587,
    smtpUser: process.env.SMTP_USER || "user@example.com",
    smtpPassword: process.env.SMTP_PASSWORD || "password",
    fromName: process.env.EMAIL_FROM_NAME || "Learning Platform",
    fromEmail: process.env.EMAIL_FROM || "noreply@example.com",
  }

  if (emailSettingsResult.rows.length > 0) {
    try {
      emailSettings = { ...emailSettings, ...JSON.parse(emailSettingsResult.rows[0].setting_value) }
    } catch (e) {
      console.error("Error parsing email settings:", e)
    }
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: emailSettings.smtpHost,
    port: emailSettings.smtpPort,
    secure: emailSettings.smtpPort === 465,
    auth: {
      user: emailSettings.smtpUser,
      pass: emailSettings.smtpPassword,
    },
  })

  const verificationLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify-email/${token}`

  const mailOptions = {
    from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
    to: email,
    subject: "Please verify your email",
    html: `
      <p>Hello ${username},</p>
      <p>Thank you for registering. Please verify your email by clicking the link below:</p>
      <a href="${verificationLink}">Verify Email</a>
    `,
  }

  await transporter.sendMail(mailOptions)
}

// Register a new user
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, email, password, first_name, last_name, role } = req.body

    // Check if user already exists
    const userCheck = await db.query("SELECT * FROM users WHERE email = $1 OR username = $2", [email, username])

    if (userCheck.rows.length > 0) {
      if (userCheck.rows[0].email === email) {
        return res.status(400).json({ error: "Email already in use" })
      } else {
        return res.status(400).json({ error: "Username already taken" })
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Validate role or set default
    const validRoles = ["student", "instructor", "admin"]
    const userRole = validRoles.includes(role) ? role : "student"

    // Insert user
    const result = await db.query(
      `INSERT INTO users 
       (username, email, password_hash, first_name, last_name, role, is_active, is_verified, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
       RETURNING user_id, username, email, first_name, last_name, role, is_active, is_verified, created_at`,
      [username, email, hashedPassword, first_name, last_name, userRole, true, false],
    )

    const user = result.rows[0]

    // Create verification token
    const verificationToken = crypto.randomBytes(20).toString("hex")

    // Store verification token
    await db.query(
      `INSERT INTO user_verification 
       (user_id, token, type, expires_at, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        user.user_id,
        verificationToken,
        "email",
        new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ],
    )

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken, user.username)
    } catch (emailErr) {
      console.error("Error sending verification email:", emailErr)
      // Continue registration process even if email fails
    }

    // Create JWT payload
    const payload = {
      user: {
        id: user.user_id,
        role: user.role,
      },
    }

    // Sign token
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" }, (err, token) => {
      if (err) throw err
      res.status(201).json({
        token,
        user: {
          id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          is_verified: user.is_verified,
        },
        message: "Registration successful. Please verify your email.",
      })
    })
  } catch (err) {
    console.error("Error in register:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Login user
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, password } = req.body

    // Check if user exists
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email])

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    const user = result.rows[0]

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: "Account is deactivated. Please contact support." })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    // Update last login
    await db.query("UPDATE users SET last_login = NOW() WHERE user_id = $1", [user.user_id])

    // Create JWT payload
    const payload = {
      user: {
        id: user.user_id,
        role: user.role,
      },
    }

    // Sign token
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" }, (err, token) => {
      if (err) throw err
      res.json({
        token,
        user: {
          id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_picture: user.profile_picture,
          is_verified: user.is_verified,
        },
      })
    })
  } catch (err) {
    console.error("Error in login:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await db.query(
      `SELECT user_id, username, email, first_name, last_name, profile_picture, 
       role, is_active, is_verified, last_login, created_at
       FROM users WHERE user_id = $1`,
      [req.user.id],
    )

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({ user: user.rows[0] })
  } catch (err) {
    console.error("Error in getCurrentUser:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    // Check if user exists
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = result.rows[0]

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // 1 hour expiration

    // Store token in database
    await db.query(
      `INSERT INTO user_verification (user_id, token, type, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [user.user_id, resetToken, "password_reset", expiresAt],
    )

    // Get email settings from system_settings
    const emailSettingsResult = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = $1", [
      "email_settings",
    ])

    let emailSettings = {
      smtpHost: process.env.SMTP_HOST || "smtp.example.com",
      smtpPort: process.env.SMTP_PORT || 587,
      smtpUser: process.env.SMTP_USER || "user@example.com",
      smtpPassword: process.env.SMTP_PASSWORD || "password",
      fromName: process.env.EMAIL_FROM_NAME || "Learning Platform",
      fromEmail: process.env.EMAIL_FROM || "noreply@example.com",
    }

    if (emailSettingsResult.rows.length > 0) {
      try {
        emailSettings = { ...emailSettings, ...JSON.parse(emailSettingsResult.rows[0].setting_value) }
      } catch (e) {
        console.error("Error parsing email settings:", e)
      }
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: emailSettings.smtpHost,
      port: emailSettings.smtpPort,
      secure: emailSettings.smtpPort === 465,
      auth: {
        user: emailSettings.smtpUser,
        pass: emailSettings.smtpPassword,
      },
    })

    // Reset link
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${resetToken}`

    // Email options
    const mailOptions = {
      from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested a password reset. Please click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      `,
    }

    // Send email
    await transporter.sendMail(mailOptions)

    res.json({ message: "Password reset email sent" })
  } catch (err) {
    console.error("Error in forgotPassword:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body

    // Find user with token
    const result = await db.query(
      `SELECT user_id FROM user_verification 
       WHERE token = $1 AND type = 'password_reset' 
       AND expires_at > NOW() AND used = false`,
      [token],
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired token" })
    }

    const userId = result.rows[0].user_id

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const password_hash = await bcrypt.hash(password, salt)

    // Update password
    await db.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2", [
      password_hash,
      userId,
    ])

    // Mark token as used
    await db.query("UPDATE user_verification SET used = true WHERE token = $1", [token])

    res.json({ message: "Password has been reset successfully" })
  } catch (err) {
    console.error("Error in resetPassword:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    const userId = req.user.id

    // Get current user
    const userResult = await db.query("SELECT password_hash FROM users WHERE user_id = $1", [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = userResult.rows[0]

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, user.password_hash)
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const password_hash = await bcrypt.hash(new_password, salt)

    // Update password
    await db.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2", [
      password_hash,
      userId,
    ])

    res.json({ message: "Password changed successfully" })
  } catch (err) {
    console.error("Error in changePassword:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params

    // Find verification record
    const result = await db.query(
      `SELECT user_id FROM user_verification 
       WHERE token = $1 AND type = 'email' 
       AND expires_at > NOW() AND used = false`,
      [token],
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired verification token" })
    }

    const userId = result.rows[0].user_id

    // Update user verification status
    await db.query("UPDATE users SET is_verified = true, updated_at = NOW() WHERE user_id = $1", [userId])

    // Mark token as used
    await db.query("UPDATE user_verification SET used = true WHERE token = $1", [token])

    res.json({ message: "Email verified successfully" })
  } catch (err) {
    console.error("Error in verifyEmail:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}

// Logout
exports.logout = async (req, res) => {
  try {
    res.json({ message: "Logged out successfully" })
  } catch (err) {
    console.error("Error in logout:", err)
    res.status(500).json({ error: "Server error", message: err.message })
  }
}
