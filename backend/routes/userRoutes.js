// routes/userRoutes.js
const express = require("express")
const router = express.Router()
const { check } = require("express-validator")
const userController = require("../controllers/userController")
const auth = require("../middleware/auth")

// These routes are kept but will only be used by admin
// They won't be accessible from the frontend directly

// @route   GET api/user/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", auth, userController.getProfile)

// @route   PUT api/user/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  [
    auth,
    userController.upload.single("profile_picture"),
    [
      check("first_name", "First name must be a string").optional().isString(),
      check("last_name", "Last name must be a string").optional().isString(),
      check("bio", "Bio must be a string").optional().isString(),
    ],
  ],
  userController.updateProfile,
)

// @route   PUT api/user/change-password
// @desc    Change user password
// @access  Private
router.put(
  "/change-password",
  [
    auth,
    [
      check("current_password", "Current password is required").not().isEmpty(),
      check("new_password", "New password must be at least 6 characters").isLength({ min: 6 }),
    ],
  ],
  userController.changePassword,
)

// @route   GET api/user/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get("/dashboard", auth, userController.getDashboard)

// @route   GET api/user/learning-history
// @desc    Get user learning history
// @access  Private
router.get("/learning-history", auth, userController.getLearningHistory)

// @route   PUT api/user/notification-settings
// @desc    Update notification settings
// @access  Private
router.put("/notification-settings", auth, userController.updateNotificationSettings)

// @route   GET api/user/notification-settings
// @desc    Get notification settings
// @access  Private
router.get("/notification-settings", auth, userController.getNotificationSettings)

// @route   GET api/user/notifications
// @desc    Get user notifications
// @access  Private
router.get("/notifications", auth, userController.getUserNotifications)

// @route   PATCH api/user/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.patch("/notifications/:id/read", auth, userController.markNotificationAsRead)

// @route   PATCH api/user/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.patch("/notifications/read-all", auth, userController.markAllNotificationsAsRead)

module.exports = router
