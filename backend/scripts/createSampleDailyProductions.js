const db = require("../models");
const DailyProduction = db.DailyProduction;
const Plant = db.Plant;

// ID oluşturma fonksiyonu
const generateDailyProductionId = (date, type) => {
  const dateObj = new Date(date);
  const day = dateObj.getDate().toString().padStart(2, "0");
  const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const year = dateObj.getFullYear().toString().slice(-2);
  return `${day}${month}${year}${type}`;
};

// Örnek veri oluşturma fonksiyonu
const createSampleData = async () => {
  try {
    // Önce mevcut santralleri al
    const plants = await Plant.findAll();

    if (plants.length === 0) {
      console.log("Hiç santral bulunamadı. Önce santral oluşturun.");
      return;
    }

    const sampleData = [];
    const today = new Date();

    // Son 30 gün için örnek veri oluştur
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      // Her santral için
      for (const plant of plants) {
        // PVSyst beklenen üretim (tip: 1)
        const expectedProduction = Math.random() * 1000 + 500; // 500-1500 kWh arası
        sampleData.push({
          id: generateDailyProductionId(dateStr, 1),
          plant_id: plant.id,
          date: dateStr,
          type: 1,
          production: parseFloat(expectedProduction.toFixed(2)),
        });

        // Gerçekleşen üretim (tip: 2) - beklenen üretimin %80-120'si arası
        const actualProduction =
          expectedProduction * (0.8 + Math.random() * 0.4);
        sampleData.push({
          id: generateDailyProductionId(dateStr, 2),
          plant_id: plant.id,
          date: dateStr,
          type: 2,
          production: parseFloat(actualProduction.toFixed(2)),
        });
      }
    }

    // Verileri veritabanına ekle
    for (const data of sampleData) {
      try {
        await DailyProduction.create(data);
        console.log(
          `Oluşturuldu: ${data.id} - ${data.date} - Tip: ${data.type} - Üretim: ${data.production} kWh`
        );
      } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
          console.log(`Zaten mevcut: ${data.id}`);
        } else {
          console.error(`Hata: ${error.message}`);
        }
      }
    }

    console.log("Örnek günlük üretim verileri başarıyla oluşturuldu!");
  } catch (error) {
    console.error("Hata:", error.message);
  } finally {
    process.exit(0);
  }
};

// Scripti çalıştır
createSampleData();
