// paymentRoutes.js
const express = require("express")
const router = express.Router()
const paymentController = require("../controllers/paymentController")
const authMiddleware = require("../middleware/auth")
const { check } = require("express-validator")

// Process payment
router.post(
  "/payments/process",
  [
    authMiddleware,
    check("courseId").isNumeric().withMessage("ID khóa học không hợp lệ"),
    check("transactionId").isNumeric().withMessage("ID giao dịch không hợp lệ"),
    check("paymentMethod")
      .isIn(["vnpay", "momo", "credit_card", "bank_transfer"])
      .withMessage("Phương thức thanh toán không hợp lệ"),
  ],
  paymentController.processPayment,
)

// Handle VNPay callback
router.get("/payments/vnpay-callback", paymentController.handleVNPayCallback)

// Handle MoMo callback
router.post("/payments/momo-callback", paymentController.handleMoMoCallback)

// Check payment status
router.get("/payments/status/:transactionId", authMiddleware, paymentController.getPaymentStatus)

// Request refund
router.post(
  "/payments/refund",
  [
    authMiddleware,
    check("transactionId").isNumeric().withMessage("ID giao dịch không hợp lệ"),
    check("refundReason").notEmpty().withMessage("Lý do hoàn tiền là bắt buộc"),
  ],
  paymentController.requestRefund,
)

module.exports = router
