const express = require("express")
const router = express.Router()
const vocabularyController = require("../controllers/vocabularyController")
const adminAuth = require("../middleware/adminAuth")

// Initialize vocabulary from CSV (admin only)
router.post("/initialize", adminAuth, vocabularyController.initializeVocabulary)

// Get vocabulary with pagination and filtering
router.get("/", vocabularyController.getVocabulary)

// Get vocabulary statistics
router.get("/stats", vocabularyController.getVocabularyStats)

// Get random vocabulary for practice
router.get("/random", vocabularyController.getRandomVocabulary)

// Add new vocabulary word (admin only)
router.post("/", adminAuth, vocabularyController.addVocabulary)

// Update vocabulary word (admin only)
router.put("/:id", adminAuth, vocabularyController.updateVocabulary)

// Delete vocabulary word (admin only)
router.delete("/:id", adminAuth, vocabularyController.deleteVocabulary)

module.exports = router
