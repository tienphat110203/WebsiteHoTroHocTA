// routes/authRoutes.js
const express = require("express")
const router = express.Router()
const { check } = require("express-validator")
const authController = require("../controllers/authController")
const auth = require("../middleware/auth")

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  "/register",
  [
    check("username", "Username is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password must be at least 6 characters").isLength({ min: 6 }),
    check("first_name", "First name is required").not().isEmpty(),
    check("last_name", "Last name is required").not().isEmpty(),
  ],
  authController.register,
)

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  "/login",
  [check("email", "Please include a valid email").isEmail(), check("password", "Password is required").exists()],
  authController.login,
)

// @route   GET api/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", auth, authController.getCurrentUser)

// @route   POST api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post(
  "/forgot-password",
  [check("email", "Please include a valid email").isEmail()],
  authController.forgotPassword,
)

// @route   POST api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post(
  "/reset-password",
  [
    check("token", "Token is required").not().isEmpty(),
    check("password", "Password must be at least 6 characters").isLength({ min: 6 }),
  ],
  authController.resetPassword,
)

// @route   PUT api/auth/change-password
// @desc    Change user password
// @access  Private
router.put(
  "/change-password",
  auth,
  [
    check("current_password", "Current password is required").not().isEmpty(),
    check("new_password", "New password must be at least 6 characters").isLength({ min: 6 }),
  ],
  authController.changePassword,
)

// @route   GET api/auth/verify-email/:token
// @desc    Verify user email
// @access  Public
router.get("/verify-email/:token", authController.verifyEmail)

// @route   POST api/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", auth, authController.logout)

module.exports = router
