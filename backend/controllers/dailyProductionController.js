const db = require("../models");
const DailyProduction = db.DailyProduction;
const Plant = db.Plant;

// Tüm günlük üretim verilerini getir
exports.getAllDailyProductions = async (req, res) => {
  try {
    const { plant_id, date, start_date, end_date } = req.query;

    const whereClause = { type: 2 }; // Sadece gerçekleşen veriler (tip 2)
    if (plant_id) whereClause.plant_id = plant_id;
    if (date) whereClause.date = date;
    if (start_date && end_date) {
      whereClause.date = {
        [db.Sequelize.Op.between]: [start_date, end_date],
      };
    }

    const dailyProductions = await DailyProduction.findAll({
      where: whereClause,
      include: [{ model: Plant, as: "Plant", attributes: ["id", "name"] }],
      order: [["date", "DESC"]],
    });
    res.json(dailyProductions);
  } catch (err) {
    res.status(500).json({
      message: "Günlük üretim verileri alınamadı",
      error: err.message,
    });
  }
};

// Tekil günlük üretim verisi getir
exports.getDailyProduction = async (req, res) => {
  try {
    const dailyProduction = await DailyProduction.findByPk(req.params.id, {
      include: [{ model: Plant, as: "Plant", attributes: ["id", "name"] }],
    });
    if (!dailyProduction) {
      return res
        .status(404)
        .json({ message: "Günlük üretim verisi bulunamadı" });
    }
    res.json(dailyProduction);
  } catch (err) {
    res.status(500).json({
      message: "Günlük üretim verisi alınamadı",
      error: err.message,
    });
  }
};

// Günlük üretim verisi oluştur
exports.createDailyProduction = async (req, res) => {
  try {
    const { plant_id, date, production } = req.body;

    if (!plant_id || !date || production === undefined) {
      return res.status(400).json({ message: "Zorunlu alanlar eksik" });
    }

    // Aynı santral için aynı tarihte kayıt var mı kontrol et
    const existingRecord = await DailyProduction.findOne({
      where: { plant_id, date, type: 2 }, // Tip 2: Gerçekleşen
    });

    if (existingRecord) {
      // Mevcut kaydı güncelle
      await existingRecord.update({
        production: parseFloat(production),
        type: 2, // Gerçekleşen
      });
      res.json({
        message: "Günlük üretim verisi güncellendi",
        dailyProduction: existingRecord,
      });
    } else {
      // Yeni kayıt oluştur
      const dailyProduction = await DailyProduction.create({
        plant_id,
        date,
        type: 2, // Gerçekleşen
        production: parseFloat(production),
      });
      res.status(201).json({
        message: "Günlük üretim verisi oluşturuldu",
        dailyProduction,
      });
    }
  } catch (err) {
    res.status(500).json({
      message: "Günlük üretim verisi işlenemedi",
      error: err.message,
    });
  }
};

// Günlük üretim verisi güncelle
exports.updateDailyProduction = async (req, res) => {
  try {
    const dailyProduction = await DailyProduction.findByPk(req.params.id);
    if (!dailyProduction) {
      return res
        .status(404)
        .json({ message: "Günlük üretim verisi bulunamadı" });
    }

    await dailyProduction.update(req.body);
    res.json(dailyProduction);
  } catch (err) {
    res.status(500).json({
      message: "Günlük üretim verisi güncellenemedi",
      error: err.message,
    });
  }
};

// Günlük üretim verisi sil
exports.deleteDailyProduction = async (req, res) => {
  try {
    const dailyProduction = await DailyProduction.findByPk(req.params.id);
    if (!dailyProduction) {
      return res
        .status(404)
        .json({ message: "Günlük üretim verisi bulunamadı" });
    }

    await dailyProduction.destroy();
    res.json({ message: "Günlük üretim verisi silindi" });
  } catch (err) {
    res.status(500).json({
      message: "Günlük üretim verisi silinemedi",
      error: err.message,
    });
  }
};

// Santral bazlı günlük üretim verilerini getir
exports.getDailyProductionsByPlant = async (req, res) => {
  try {
    const { plant_id } = req.params;
    const { start_date, end_date } = req.query;

    const whereClause = { plant_id, type: 2 }; // Sadece gerçekleşen veriler (tip 2)
    if (start_date && end_date) {
      whereClause.date = {
        [db.Sequelize.Op.between]: [start_date, end_date],
      };
    }

    const dailyProductions = await DailyProduction.findAll({
      where: whereClause,
      include: [{ model: Plant, as: "Plant", attributes: ["id", "name"] }],
      order: [["date", "DESC"]],
    });

    res.json(dailyProductions);
  } catch (err) {
    res.status(500).json({
      message: "Santral üretim verileri alınamadı",
      error: err.message,
    });
  }
};

// Toplu günlük üretim verisi oluştur/güncelle
exports.bulkCreateOrUpdateDailyProductions = async (req, res) => {
  try {
    const dataArray = req.body;

    console.log("Gelen veri:", dataArray);

    if (!Array.isArray(dataArray)) {
      return res
        .status(400)
        .json({ message: "Geçersiz veri formatı - array bekleniyor" });
    }

    const results = [];
    const errors = [];

    for (const item of dataArray) {
      const { plant_id, date, production } = item;

      console.log("İşlenen veri:", { plant_id, date, production });

      if (!plant_id || !date || production === undefined) {
        errors.push(`Geçersiz veri: ${JSON.stringify(item)}`);
        continue;
      }

      try {
        // Mevcut kayıt var mı kontrol et
        const existingRecord = await DailyProduction.findOne({
          where: { plant_id, date, type: 2 }, // Tip 2: Gerçekleşen
        });

        console.log("Mevcut kayıt:", existingRecord ? "Var" : "Yok");

        if (existingRecord) {
          // Güncelle
          await existingRecord.update({
            production: parseFloat(production),
            type: 2, // Gerçekleşen
          });
          results.push(`${date}: Güncellendi`);
        } else {
          // Yeni kayıt oluştur
          const newRecord = await DailyProduction.create({
            plant_id,
            date,
            type: 2, // Gerçekleşen
            production: parseFloat(production),
          });
          console.log("Yeni kayıt oluşturuldu:", newRecord.id);
          results.push(`${date}: Oluşturuldu`);
        }
      } catch (error) {
        console.error("Kayıt hatası:", error);
        errors.push(`${date}: ${error.message}`);
      }
    }

    console.log("Sonuçlar:", results);
    console.log("Hatalar:", errors);

    res.status(200).json({
      message: "Toplu kaydetme tamamlandı",
      results,
      errors: errors.length > 0 ? errors : undefined,
      successCount: results.length,
      errorCount: errors.length,
    });
  } catch (err) {
    console.error("Genel hata:", err);
    res.status(500).json({
      message: "Toplu kaydetme işlemi başarısız",
      error: err.message,
    });
  }
};

// Günlük verileri sil (belirli bir gün için)
exports.deleteDailyProductionsByDate = async (req, res) => {
  try {
    const { plant_id, date } = req.params;

    if (!plant_id || !date) {
      return res.status(400).json({ message: "Plant ID ve tarih gerekli" });
    }

    // O gün için veriyi bul
    const dailyProduction = await DailyProduction.findOne({
      where: { plant_id, date },
    });

    if (!dailyProduction) {
      return res.status(404).json({
        message: "Bu tarih için veri bulunamadı",
      });
    }

    // Veriyi sil
    await dailyProduction.destroy();

    res.json({
      message: "Günlük veri silindi",
      deletedCount: 1,
    });
  } catch (err) {
    res.status(500).json({
      message: "Günlük veri silinemedi",
      error: err.message,
    });
  }
};

// Aylık verileri sil (belirli bir ay için)
exports.deleteMonthlyProductions = async (req, res) => {
  try {
    const { plant_id, year, month } = req.params;

    if (!plant_id || !year || !month) {
      return res.status(400).json({ message: "Plant ID, yıl ve ay gerekli" });
    }

    // Ayın son gününü doğru hesapla
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
    const endDate = `${year}-${month
      .toString()
      .padStart(2, "0")}-${lastDayOfMonth.toString().padStart(2, "0")}`;

    // O ay için tüm verileri bul
    const monthlyProductions = await DailyProduction.findAll({
      where: {
        plant_id,
        type: 2, // Sadece gerçekleşen veriler (tip 2)
        date: {
          [db.Sequelize.Op.between]: [startDate, endDate],
        },
      },
    });

    if (monthlyProductions.length === 0) {
      return res.status(404).json({
        message: "Bu ay için veri bulunamadı",
      });
    }

    // Tüm verileri sil
    await DailyProduction.destroy({
      where: {
        plant_id,
        type: 2, // Sadece gerçekleşen veriler (tip 2)
        date: {
          [db.Sequelize.Op.between]: [startDate, endDate],
        },
      },
    });

    res.json({
      message: `${monthlyProductions.length} veri silindi`,
      deletedCount: monthlyProductions.length,
    });
  } catch (err) {
    res.status(500).json({
      message: "Aylık veriler silinemedi",
      error: err.message,
    });
  }
};

// PVSyst aylık verileri kaydet/güncelle
exports.savePVSystMonthlyData = async (req, res) => {
  try {
    const { plant_id, year, month, pvsyst_expected } = req.body;

    if (!plant_id || !year || !month) {
      return res.status(400).json({ message: "Plant ID, yıl ve ay gerekli" });
    }

    // PVSyst aylık beklenen üretim için tarih: 01.ay.yıl
    const pvsystDate = `${year}-${month.toString().padStart(2, "0")}-01`;
    const pvsystId = generateDailyProductionId(pvsystDate, 1);

    try {
      // Mevcut PVSyst kaydı var mı kontrol et
      const existingPVSyst = await DailyProduction.findByPk(pvsystId);

      if (
        pvsyst_expected === "" ||
        pvsyst_expected === null ||
        pvsyst_expected === undefined
      ) {
        // Boş değer geldi, kaydı sil
        if (existingPVSyst) {
          await existingPVSyst.destroy();
          res.json({
            message: "PVSyst aylık verisi silindi",
            deletedCount: 1,
          });
        } else {
          res.json({
            message: "PVSyst aylık verisi zaten yok",
            deletedCount: 0,
          });
        }
      } else {
        // Değer var, kaydet/güncelle
        const pvsystValue = parseFloat(pvsyst_expected) || 0;

        if (existingPVSyst) {
          // Güncelle
          await existingPVSyst.update({ production: pvsystValue });
          res.json({
            message: "PVSyst aylık verisi güncellendi",
            updatedCount: 1,
          });
        } else {
          // Yeni kayıt oluştur
          await DailyProduction.create({
            id: pvsystId,
            plant_id,
            date: pvsystDate,
            type: 1, // PVSyst Aylık Beklenen
            production: pvsystValue,
          });
          res.json({
            message: "PVSyst aylık verisi oluşturuldu",
            createdCount: 1,
          });
        }
      }
    } catch (error) {
      res.status(500).json({
        message: "PVSyst verisi kaydedilemedi",
        error: error.message,
      });
    }
  } catch (err) {
    res.status(500).json({
      message: "PVSyst aylık veri işlemi başarısız",
      error: err.message,
    });
  }
};
