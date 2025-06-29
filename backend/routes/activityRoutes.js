const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Dosya yükleme için storage konfigürasyonu
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/activities";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Tüm aktiviteler
router.get("/", activityController.getAllActivities);
// Tekil aktivite
router.get("/:id", activityController.getActivity);
// Aktivite oluştur
router.post("/", upload.array("files"), activityController.createActivity);
// Aktivite güncelle
router.put("/:id", upload.array("files"), activityController.updateActivity);
// Aktivite sil
router.delete("/:id", activityController.deleteActivity);

module.exports = router;
