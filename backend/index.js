// backend/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();

// Uploads klasörünü oluştur
const uploadsDir = path.join(__dirname, "uploads");
const activitiesDir = path.join(uploadsDir, "activities");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(activitiesDir)) {
  fs.mkdirSync(activitiesDir);
}

// Middleware
app.use(cors());
app.use(express.json());

// Statik dosya servisi için uploads klasörünü ekle
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "API çalışıyor!" });
});

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const workOrderRoutes = require("./routes/workOrderRoutes");
const plantRoutes = require("./routes/plantRoutes");
const fieldRoutes = require("./routes/fieldRoutes");
const investorRoutes = require("./routes/investorRoutes");
const activityRoutes = require("./routes/activityRoutes");
const dailyProductionRoutes = require("./routes/dailyProductionRoutes");
const pvsystReportRoutes = require("./routes/pvsystReportRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/work-orders", workOrderRoutes);
app.use("/api/plants", plantRoutes);
app.use("/api/fields", fieldRoutes);
app.use("/api/investors", investorRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/daily-productions", dailyProductionRoutes);
app.use("/api/pvsyst-reports", pvsystReportRoutes);

// Port dinleme
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://localhost:${PORT}`);
});
