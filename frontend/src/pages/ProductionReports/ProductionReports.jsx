import React, { useState, useEffect } from "react";
import styles from "./ProductionReports.module.css";
import { useLocation } from "react-router-dom";
import ConfirmModal from "../../components/layout/ConfirmModal/ConfirmModal";
import NotificationStack from "../../components/layout/NotificationStack/NotificationStack";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { cleanNumberInput } from "../../utils/numberUtils";
import ProductionImportModal from "./ProductionImportModal";

const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const ProductionReports = () => {
  const location = useLocation();
  const [selectedPlant, setSelectedPlant] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [plants, setPlants] = useState([]);
  const [monthlyData, setMonthlyData] = useState({});
  const [existingData, setExistingData] = useState({});
  const [loading, setLoading] = useState(false);

  // Modal ve notification state
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // URL parametrelerini oku
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plant = params.get("plant");
    const year = params.get("year");
    const month = params.get("month");

    if (plant) setSelectedPlant(plant);
    if (year) setSelectedYear(Number(year));
    if (month) setSelectedMonth(Number(month));

    document.title = "Gerçekleşen Üretim - EGESA";
  }, [location.search]);

  // Santralleri yükle
  useEffect(() => {
    fetchPlants();
  }, []);

  // Seçili santral, yıl ve ay değiştiğinde mevcut veriyi kontrol et
  useEffect(() => {
    if (selectedPlant && selectedYear && selectedMonth) {
      checkExistingData();
    }
  }, [selectedPlant, selectedYear, selectedMonth]);

  // Seçili ayın gün sayısını hesapla
  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  // Günlük veri objesi oluştur
  const createDailyDataObject = () => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const data = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${selectedMonth
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      data[dateStr] = "";
    }

    return data;
  };

  // Mevcut verileri yükle
  const checkExistingData = async () => {
    try {
      const startDate = `${selectedYear}-${selectedMonth
        .toString()
        .padStart(2, "0")}-01`;
      const endDate = `${selectedYear}-${selectedMonth
        .toString()
        .padStart(2, "0")}-${getDaysInMonth(selectedYear, selectedMonth)}`;

      const response = await fetch(
        `/api/daily-productions?plant_id=${selectedPlant}&start_date=${startDate}&end_date=${endDate}`
      );
      const data = await response.json();

      // Günlük gerçekleşen verileri
      const dailyData = createDailyDataObject();
      data.forEach((item) => {
        const dateStr = item.date;
        if (dailyData[dateStr] !== undefined) {
          dailyData[dateStr] = item.production.toString();
        }
      });

      setMonthlyData({
        daily: dailyData,
      });
      setExistingData({
        daily: dailyData,
      });
    } catch (error) {
      console.error("Veri kontrolü yapılamadı:", error);
      setMonthlyData({ daily: createDailyDataObject() });
      setExistingData({ daily: createDailyDataObject() });
    }
  };

  const fetchPlants = async () => {
    try {
      const response = await fetch("/api/plants");
      const data = await response.json();
      setPlants(data);
    } catch (error) {
      console.error("Santraller yüklenemedi:", error);
      addNotification("Hata", "Santraller yüklenemedi", "error");
    }
  };

  const handleDailyInputChange = (date, value) => {
    setMonthlyData((prev) => ({
      ...prev,
      daily: {
        ...prev.daily,
        [date]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Veri değişikliği kontrolü
    const hasChanges = checkDataChanges();

    if (hasChanges) {
      saveData();
    } else {
      addNotification("Bilgi", "Değişiklik yapılmadı", "info");
    }
  };

  const checkDataChanges = () => {
    if (!existingData.daily) return false;

    for (const date in monthlyData.daily) {
      if (monthlyData.daily[date] !== existingData.daily[date]) {
        return true;
      }
    }
    return false;
  };

  const saveData = async () => {
    setLoading(true);
    try {
      // Günlük gerçekleşen veriler
      const dailyData = monthlyData.daily;
      const dataToSend = [];

      for (const date in dailyData) {
        const production = dailyData[date];
        if (production !== "") {
          // Virgüllü sayıları da kabul et (83,050049 -> 83.050049)
          const cleanProduction = production.toString().replace(",", ".");
          const numericProduction = parseFloat(cleanProduction);

          if (!isNaN(numericProduction)) {
            dataToSend.push({
              plant_id: selectedPlant,
              date: date,
              production: numericProduction,
            });
          }
        }
      }

      if (dataToSend.length === 0) {
        addNotification("Uyarı", "Kaydedilecek veri bulunamadı", "warning");
        setLoading(false);
        return;
      }

      // Tek istekte tüm veriyi gönder
      const response = await fetch("/api/daily-productions/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();

      if (response.ok) {
        addNotification(
          "Başarılı",
          `${result.successCount} veri başarıyla kaydedildi${
            result.errorCount > 0 ? `, ${result.errorCount} hata` : ""
          }`,
          "success"
        );
        checkExistingData(); // Mevcut verileri güncelle
      } else {
        addNotification(
          "Hata",
          result.message || "Veriler kaydedilemedi",
          "error"
        );
      }
    } catch (error) {
      console.error("Veri kaydedilemedi:", error);
      addNotification("Hata", "Veriler kaydedilemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = async () => {
    setShowResetConfirm(false);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/daily-productions/month/${selectedPlant}/${selectedYear}/${selectedMonth}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        addNotification(
          "Başarılı",
          `${result.deletedCount} gerçekleşen veri silindi`,
          "success"
        );
        // Verileri yeniden yükle
        await checkExistingData();
      } else {
        addNotification(
          "Hata",
          result.message || "Veriler silinemedi",
          "error"
        );
      }
    } catch (error) {
      console.error("Reset işlemi başarısız:", error);
      addNotification("Hata", "Reset işlemi başarısız", "error");
    } finally {
      setLoading(false);
    }
  };

  const addNotification = (title, message, type = "info") => {
    const icon =
      type === "success" ? (
        <FaCheckCircle style={{ color: "#22c55e" }} />
      ) : type === "warning" ? (
        <FaExclamationTriangle style={{ color: "#f59e0b" }} />
      ) : (
        <FaExclamationTriangle style={{ color: "#f59e0b" }} />
      );

    setNotifications((prev) => [
      ...prev,
      {
        id: Date.now(),
        title,
        message,
        icon,
      },
    ]);
  };

  const handleRemoveNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleImportData = (importedData) => {
    // Import edilen verileri monthlyData'ya ekle
    setMonthlyData((prev) => ({
      ...prev,
      daily: {
        ...prev.daily,
        ...importedData,
      },
    }));
    setImportModalOpen(false);
    addNotification("Başarılı", "Veriler başarıyla içe aktarıldı", "success");
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const selectedMonthName = monthNames[selectedMonth - 1];

  return (
    <div className={styles.container}>
      <ConfirmModal
        open={showConfirm}
        onConfirm={saveData}
        onCancel={() => setShowConfirm(false)}
        title="Uyarı"
        description="Bu ay için zaten kayıtlı veri bulunuyor. Üzerine yazmak istediğinize emin misiniz?"
      />
      <ConfirmModal
        open={showResetConfirm}
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        title="Uyarı"
        description="Bu ay için gerçekleşen üretim verilerini silmek istediğinize emin misiniz?"
      />
      <NotificationStack
        notifications={notifications}
        onRemove={handleRemoveNotification}
      />

      <h1 className={styles.title}>Gerçekleşen Üretim Verisi</h1>

      <div className={styles.filterRow}>
        <div className={styles.formGroup}>
          <label htmlFor="plant">Santral</label>
          <select
            id="plant"
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
          >
            <option value="">Santral Seçin</option>
            {plants.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="year">Yıl</label>
          <select
            id="year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2023, 2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="month">Ay</label>
          <select
            id="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {monthNames.map((month, index) => (
              <option key={index + 1} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedPlant && selectedYear && selectedMonth && (
        <form onSubmit={handleSubmit} className={styles.monthlyForm}>
          {/* Günlük Gerçekleşen Veriler - Tablo Yapısı */}
          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Gün</th>
                  <th>Gerçekleşen Üretim</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1;
                  const dateStr = `${selectedYear}-${selectedMonth
                    .toString()
                    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
                  const dayData = monthlyData.daily?.[dateStr] || "";

                  return (
                    <tr key={day}>
                      <td className={styles.dayCell}>{day}</td>
                      <td>
                        <input
                          type="text"
                          value={dayData}
                          onChange={(e) => {
                            const value = e.target.value;
                            handleDailyInputChange(dateStr, value);
                          }}
                          placeholder="0.00"
                          className={styles.dataInput}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Butonlar - Tablo dışında */}
          <div className={styles.submitContainer}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>

            <button
              type="button"
              className={styles.resetButton}
              onClick={handleResetClick}
              disabled={loading}
            >
              {loading ? "İşleniyor..." : "Ay Verisi Sıfırla"}
            </button>

            <button
              type="button"
              className={styles.importButton}
              onClick={() => setImportModalOpen(true)}
              disabled={loading}
              style={{
                backgroundColor: "#f59e0b",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "opacity 0.2s",
                marginLeft: "auto",
              }}
            >
              Veri İçe Aktar
            </button>
          </div>
        </form>
      )}

      {/* Production Import Modal */}
      <ProductionImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportData}
      />
    </div>
  );
};

export default ProductionReports;
