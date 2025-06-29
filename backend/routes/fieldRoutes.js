const express = require("express");
const router = express.Router();
const fieldController = require("../controllers/fieldController");

// Tüm sahalar
router.get("/", fieldController.getAllFields);
// Saha ekle
router.post("/", fieldController.createField);
// Saha güncelle
router.put("/:id", fieldController.updateField);
// Saha sil
router.delete("/:id", fieldController.deleteField);

module.exports = router;
