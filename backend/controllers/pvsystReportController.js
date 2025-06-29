const db = require("../models");
const PVSystReport = db.PVSystReport;
const Plant = db.Plant;

// Tüm PVSyst rapor verilerini getir
exports.getAllPVSystReports = async (req, res) => {
  try {
    const { plant_id, year, month, is_calculated } = req.query;

    const whereClause = {};
    if (plant_id) whereClause.plant_id = plant_id;
    if (year) whereClause.year = year;
    if (month) whereClause.month = month;
    if (is_calculated !== undefined) whereClause.is_calculated = is_calculated;

    const pvsystReports = await PVSystReport.findAll({
      where: whereClause,
      include: [{ model: Plant, as: "Plant", attributes: ["id", "name"] }],
      order: [
        ["year", "DESC"],
        ["month", "ASC"],
      ],
    });
    res.json(pvsystReports);
  } catch (err) {
    res.status(500).json({
      message: "PVSyst rapor verileri alınamadı",
      error: err.message,
    });
  }
};

// Tekil PVSyst rapor verisi getir
exports.getPVSystReport = async (req, res) => {
  try {
    const pvsystReport = await PVSystReport.findByPk(req.params.id, {
      include: [{ model: Plant, as: "Plant", attributes: ["id", "name"] }],
    });
    if (!pvsystReport) {
      return res
        .status(404)
        .json({ message: "PVSyst rapor verisi bulunamadı" });
    }
    res.json(pvsystReport);
  } catch (err) {
    res.status(500).json({
      message: "PVSyst rapor verisi alınamadı",
      error: err.message,
    });
  }
};

// PVSyst rapor verisi oluştur
exports.createPVSystReport = async (req, res) => {
  try {
    const {
      plant_id,
      year,
      month,
      expected_production,
      is_calculated = false,
    } = req.body;

    if (!plant_id || !year || !month || expected_production === undefined) {
      return res.status(400).json({ message: "Zorunlu alanlar eksik" });
    }

    // Aynı santral için aynı ay ve yıla ait kayıt var mı kontrol et
    const existingRecord = await PVSystReport.findOne({
      where: { plant_id, year, month },
    });

    if (existingRecord) {
      return res.status(400).json({
        message: "Bu ay ve yıl için zaten PVSyst rapor verisi mevcut",
      });
    }

    const pvsystReport = await PVSystReport.create({
      plant_id,
      year,
      month,
      expected_production: parseFloat(expected_production),
      is_calculated,
    });

    res.status(201).json(pvsystReport);
  } catch (err) {
    res.status(500).json({
      message: "PVSyst rapor verisi oluşturulamadı",
      error: err.message,
    });
  }
};

// PVSyst rapor verisi güncelle
exports.updatePVSystReport = async (req, res) => {
  try {
    const pvsystReport = await PVSystReport.findByPk(req.params.id);
    if (!pvsystReport) {
      return res
        .status(404)
        .json({ message: "PVSyst rapor verisi bulunamadı" });
    }

    await pvsystReport.update(req.body);
    res.json(pvsystReport);
  } catch (err) {
    res.status(500).json({
      message: "PVSyst rapor verisi güncellenemedi",
      error: err.message,
    });
  }
};

// PVSyst rapor verisi sil
exports.deletePVSystReport = async (req, res) => {
  try {
    const pvsystReport = await PVSystReport.findByPk(req.params.id);
    if (!pvsystReport) {
      return res
        .status(404)
        .json({ message: "PVSyst rapor verisi bulunamadı" });
    }

    await pvsystReport.destroy();
    res.json({ message: "PVSyst rapor verisi silindi" });
  } catch (err) {
    res.status(500).json({
      message: "PVSyst rapor verisi silinemedi",
      error: err.message,
    });
  }
};

// Santral bazlı PVSyst rapor verilerini getir
exports.getPVSystReportsByPlant = async (req, res) => {
  try {
    const { plant_id } = req.params;
    const { start_year, end_year, start_month, end_month } = req.query;

    const whereClause = { plant_id };

    if (start_year && end_year) {
      whereClause.year = {
        [db.Sequelize.Op.between]: [parseInt(start_year), parseInt(end_year)],
      };
    }

    if (start_month && end_month) {
      whereClause.month = {
        [db.Sequelize.Op.between]: [parseInt(start_month), parseInt(end_month)],
      };
    }

    const pvsystReports = await PVSystReport.findAll({
      where: whereClause,
      include: [{ model: Plant, as: "Plant", attributes: ["id", "name"] }],
      order: [
        ["year", "DESC"],
        ["month", "ASC"],
      ],
    });

    res.json(pvsystReports);
  } catch (err) {
    res.status(500).json({
      message: "Santral PVSyst rapor verileri alınamadı",
      error: err.message,
    });
  }
};

// Toplu PVSyst rapor verisi oluştur/güncelle
exports.bulkCreateOrUpdatePVSystReports = async (req, res) => {
  try {
    const dataArray = req.body;

    if (!Array.isArray(dataArray)) {
      return res
        .status(400)
        .json({ message: "Geçersiz veri formatı - array bekleniyor" });
    }

    const results = [];
    const errors = [];

    for (const item of dataArray) {
      const {
        plant_id,
        year,
        month,
        expected_production,
        is_calculated = false,
      } = item;

      if (!plant_id || !year || !month || expected_production === undefined) {
        errors.push(`Geçersiz veri: ${JSON.stringify(item)}`);
        continue;
      }

      try {
        // Mevcut kayıt var mı kontrol et
        const existingRecord = await PVSystReport.findOne({
          where: { plant_id, year, month },
        });

        if (existingRecord) {
          // Güncelle
          await existingRecord.update({
            expected_production: parseFloat(expected_production),
            is_calculated,
          });
          results.push(`${year}-${month}: Güncellendi`);
        } else {
          // Yeni kayıt oluştur
          await PVSystReport.create({
            plant_id,
            year,
            month,
            expected_production: parseFloat(expected_production),
            is_calculated,
          });
          results.push(`${year}-${month}: Oluşturuldu`);
        }
      } catch (error) {
        errors.push(`${year}-${month}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: "Toplu PVSyst rapor kaydetme tamamlandı",
      results,
      errors: errors.length > 0 ? errors : undefined,
      successCount: results.length,
      errorCount: errors.length,
    });
  } catch (err) {
    res.status(500).json({
      message: "Toplu PVSyst rapor kaydetme işlemi başarısız",
      error: err.message,
    });
  }
};

// Aylık PVSyst rapor verileri sil (belirli bir ay için)
exports.deleteMonthlyPVSystReports = async (req, res) => {
  try {
    const { plant_id, year, month } = req.params;

    if (!plant_id || !year || !month) {
      return res.status(400).json({ message: "Plant ID, yıl ve ay gerekli" });
    }

    // O ay için PVSyst verisini bul
    const pvsystReport = await PVSystReport.findOne({
      where: { plant_id, year: parseInt(year), month: parseInt(month) },
    });

    if (!pvsystReport) {
      return res.status(404).json({
        message: "Bu ay için PVSyst rapor verisi bulunamadı",
      });
    }

    // Veriyi sil
    await pvsystReport.destroy();

    res.json({
      message: "PVSyst rapor verisi silindi",
      deletedCount: 1,
    });
  } catch (err) {
    res.status(500).json({
      message: "Aylık PVSyst rapor verisi silinemedi",
      error: err.message,
    });
  }
};

// Yıllık PVSyst rapor verileri sil (belirli bir yıl için)
exports.deleteYearlyPVSystReports = async (req, res) => {
  try {
    const { plant_id, year } = req.params;

    if (!plant_id || !year) {
      return res.status(400).json({ message: "Plant ID ve yıl gerekli" });
    }

    // O yıl için tüm PVSyst verilerini bul
    const pvsystReports = await PVSystReport.findAll({
      where: { plant_id, year: parseInt(year) },
    });

    if (pvsystReports.length === 0) {
      return res.status(404).json({
        message: "Bu yıl için PVSyst rapor verisi bulunamadı",
      });
    }

    // Tüm verileri sil
    await PVSystReport.destroy({
      where: { plant_id, year: parseInt(year) },
    });

    res.json({
      message: "Yıllık PVSyst rapor verileri silindi",
      deletedCount: pvsystReports.length,
    });
  } catch (err) {
    res.status(500).json({
      message: "Yıllık PVSyst rapor verileri silinemedi",
      error: err.message,
    });
  }
};
