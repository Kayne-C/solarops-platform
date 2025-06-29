const express = require("express");
const router = express.Router();
const pvsystReportController = require("../controllers/pvsystReportController");

// Tüm PVSyst rapor verileri
router.get("/", pvsystReportController.getAllPVSystReports);

// Tekil PVSyst rapor verisi
router.get("/:id", pvsystReportController.getPVSystReport);

// Yeni PVSyst rapor verisi
router.post("/", pvsystReportController.createPVSystReport);

// Toplu PVSyst rapor verisi oluştur/güncelle
router.post("/bulk", pvsystReportController.bulkCreateOrUpdatePVSystReports);

// PVSyst rapor verisi güncelle
router.put("/:id", pvsystReportController.updatePVSystReport);

// PVSyst rapor verisi sil
router.delete("/:id", pvsystReportController.deletePVSystReport);

// Aylık PVSyst rapor verileri sil (belirli bir ay için)
router.delete(
  "/month/:plant_id/:year/:month",
  pvsystReportController.deleteMonthlyPVSystReports
);

// Yıllık PVSyst rapor verileri sil (belirli bir yıl için)
router.delete(
  "/plant/:plant_id/year/:year",
  pvsystReportController.deleteYearlyPVSystReports
);

// Santral bazlı PVSyst rapor verileri
router.get("/plant/:plant_id", pvsystReportController.getPVSystReportsByPlant);

module.exports = router;
