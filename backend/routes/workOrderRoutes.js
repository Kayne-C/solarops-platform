const express = require("express");
const router = express.Router();
const workOrderController = require("../controllers/workOrderController");

// Tüm iş emirleri
router.get("/", workOrderController.getAllWorkOrders);
// Tekil iş emri
router.get("/:id", workOrderController.getWorkOrder);
// İş emri güncelle
router.put("/:id", workOrderController.updateWorkOrder);
// İş emri oluştur
router.post("/", workOrderController.createWorkOrder);

module.exports = router;
