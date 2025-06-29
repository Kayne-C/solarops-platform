const express = require("express");
const router = express.Router();
const plantController = require("../controllers/plantController");

// Tüm santraller
router.get("/", plantController.getAllPlants);
// Tekil santral
router.get("/:id", plantController.getPlant);
// Yeni santral
router.post("/", plantController.createPlant);
// Santral güncelle
router.put("/:id", plantController.updatePlant);
// Santral sil
router.delete("/:id", plantController.deletePlant);

module.exports = router;
