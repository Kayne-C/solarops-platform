const express = require("express");
const router = express.Router();
const dailyProductionController = require("../controllers/dailyProductionController");

// Tüm günlük üretim verileri
router.get("/", dailyProductionController.getAllDailyProductions);

// Tekil günlük üretim verisi
router.get("/:id", dailyProductionController.getDailyProduction);

// Yeni günlük üretim verisi
router.post("/", dailyProductionController.createDailyProduction);

// Toplu günlük üretim verisi oluştur/güncelle
router.post(
  "/bulk",
  dailyProductionController.bulkCreateOrUpdateDailyProductions
);

// Günlük üretim verisi güncelle
router.put("/:id", dailyProductionController.updateDailyProduction);

// Günlük üretim verisi sil
router.delete("/:id", dailyProductionController.deleteDailyProduction);

// Günlük verileri sil (belirli bir gün için)
router.delete(
  "/date/:plant_id/:date",
  dailyProductionController.deleteDailyProductionsByDate
);

// Aylık verileri sil (belirli bir ay için)
router.delete(
  "/month/:plant_id/:year/:month",
  dailyProductionController.deleteMonthlyProductions
);

// PVSyst aylık verileri kaydet/güncelle
router.post("/pvsyst-monthly", dailyProductionController.savePVSystMonthlyData);

// Santral bazlı günlük üretim verileri
router.get(
  "/plant/:plant_id",
  dailyProductionController.getDailyProductionsByPlant
);

module.exports = router;
