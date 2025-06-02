const express = require("express")
const router = express.Router()
const certificateController = require("../controllers/certificateController")
const auth = require("../middleware/auth")
const adminAuth = require("../middleware/adminAuth")
const { check } = require("express-validator")

// Public routes
router.get("/verify/:code", certificateController.verifyCertificate)

// Template routes
router.get("/templates", certificateController.getTemplates) // Remove auth middleware temporarily for testing
router.get("/templates/:id", certificateController.getTemplateById)
router.post("/templates", auth, adminAuth, certificateController.createTemplate)
router.put("/templates/:id", auth, adminAuth, certificateController.updateTemplate)
router.delete("/templates/:id", auth, adminAuth, certificateController.deleteTemplate)

// Certificate routes
router.get("/", auth, adminAuth, certificateController.getCertificates)
router.get("/:id", auth, adminAuth, certificateController.getCertificateById)
router.post("/issue", auth, adminAuth, certificateController.issueCertificate)
router.post("/bulk-issue", auth, adminAuth, certificateController.bulkIssueCertificates) // Add this back
router.put("/:id/revoke", auth, adminAuth, certificateController.revokeCertificate)
router.get("/:id/pdf", auth, adminAuth, certificateController.generateCertificatePdf)

module.exports = router
