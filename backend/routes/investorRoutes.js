const express = require("express");
const router = express.Router();
const investorController = require("../controllers/investorController");

// Tüm yatırımcılar
router.get("/", investorController.getAllInvestors);
// Yatırımcı ekle
router.post("/", investorController.createInvestor);
// Yatırımcı güncelle
router.put("/:id", investorController.updateInvestor);
// Yatırımcı sil
router.delete("/:id", investorController.deleteInvestor);

module.exports = router;
