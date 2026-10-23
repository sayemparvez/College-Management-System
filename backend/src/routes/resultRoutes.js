const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const resultController = require("../controllers/resultController");

router.get("/status", protect, resultController.getResultStatus);
router.post("/publish", protect, resultController.publishResult);
router.post("/unpublish", protect, resultController.unpublishResult);

module.exports = router;
