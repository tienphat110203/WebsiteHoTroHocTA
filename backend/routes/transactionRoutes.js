// routes/transactionRoutes.js
const express = require("express")
const router = express.Router()
const transactionController = require("../controllers/transactionController")
const adminAuth = require("../middleware/adminAuth")

// Transaction management routes
router.get("/", adminAuth, transactionController.getTransactions)
router.get("/reports", adminAuth, transactionController.getFinancialReports)
router.get("/refunds", adminAuth, transactionController.getRefundRequests)
router.get("/:id", adminAuth, transactionController.getTransactionById)
router.post("/create", adminAuth, transactionController.createTransaction)
router.post("/:id/refund", adminAuth, transactionController.processRefund)
router.put("/refunds/:id", adminAuth, transactionController.updateRefundStatus)

module.exports = router
