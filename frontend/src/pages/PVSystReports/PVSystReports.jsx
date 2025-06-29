import React, { useState, useEffect } from "react";
import styles from "./PVSystReports.module.css";
import { useLocation } from "react-router-dom";
import ConfirmModal from "../../components/layout/ConfirmModal/ConfirmModal";
import NotificationStack from "../../components/layout/NotificationStack/NotificationStack";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import PVSystCalculator from "./PVSystCalculator";

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

const PVSystReports = () => {
  const location = useLocation();
  const [selectedPlant, setSelectedPlant] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [plants, setPlants] = useState([]);
  const [selectedPlantData, setSelectedPlantData] = useState(null);
  const [monthlyData, setMonthlyData] = useState({});
  const [existingData, setExistingData] = useState({});
  const [loading, setLoading] = useState(false);
  const [pvsystCalculatorOpen, setPvsystCalculatorOpen] = useState(false);

  // Modal ve notification state
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPVSystResetConfirm, setShowPVSystResetConfirm] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // URL parametrelerini oku
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plant = params.get("plant");
    const year = params.get("year");

    if (plant) setSelectedPlant(plant);
    if (year) setSelectedYear(Number(year));

    document.title = "PVSyst Verisi - EGESA";
  }, [location.search]);

  // Santralleri yükle
  useEffect(() => {
    fetchPlants();
  }, []);

  // Seçili santral değiştiğinde santral bilgilerini al
  useEffect(() => {
    if (selectedPlant) {
      fetchPlantDetails();
    }
  }, [selectedPlant]);

  // Seçili santral ve yıl değiştiğinde mevcut veriyi kontrol et
  useEffect(() => {
    if (selectedPlant && selectedYear) {
      loadAllPVSystData();
    }
  }, [selectedPlant, selectedYear]);

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

  const fetchPlantDetails = async () => {
    try {
      const response = await fetch(`/api/plants/${selectedPlant}`);
      const data = await response.json();
      setSelectedPlantData(data);
    } catch (error) {
      console.error("Santral detayları yüklenemedi:", error);
    }
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
    // PVSyst modu için tüm ayları karşılaştır
    if (!existingData.pvsyst || !monthlyData.pvsyst) return false;

    for (let month = 1; month <= 12; month++) {
      const currentValue = monthlyData.pvsyst[month] || "";
      const existingValue = existingData.pvsyst[month] || "";
      if (currentValue !== existingValue) {
        return true;
      }
    }
    return false;
  };

  const saveData = async () => {
    setLoading(true);
    try {
      // PVSyst aylık veri - toplu kaydetme
      if (monthlyData.pvsyst) {
        // Tüm aylar için veri hazırla
        const bulkData = [];
        for (let month = 1; month <= 12; month++) {
          const monthValue = monthlyData.pvsyst[month];
          if (monthValue && monthValue !== "") {
            // Virgüllü sayıları da kabul et (83,050049 -> 83.050049)
            const cleanValue = monthValue.toString().replace(",", ".");
            const numericValue = parseFloat(cleanValue);

            if (!isNaN(numericValue)) {
              bulkData.push({
                plant_id: selectedPlant,
                year: selectedYear,
                month: month,
                expected_production: numericValue,
                is_calculated: false,
              });
            }
          }
        }

        if (bulkData.length > 0) {
          const response = await fetch("/api/pvsyst-reports/bulk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bulkData),
          });

          if (response.ok) {
            addNotification(
              "Başarılı",
              `${bulkData.length} ay için PVSyst verisi kaydedildi`,
              "success"
            );
            await loadAllPVSystData(); // Verileri yeniden yükle
          } else {
            const errorData = await response.json();
            addNotification(
              "Hata",
              errorData.message || "PVSyst verisi kaydedilemedi",
              "error"
            );
          }
        } else {
          addNotification(
            "Uyarı",
            "Kaydedilecek PVSyst verisi bulunamadı",
            "warning"
          );
        }
      } else {
        addNotification(
          "Uyarı",
          "Kaydedilecek PVSyst verisi bulunamadı",
          "warning"
        );
      }
    } catch (error) {
      console.error("Veri kaydedilemedi:", error);
      addNotification("Hata", "Veriler kaydedilemedi", "error");
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

  // PVSyst modu için tüm ayların verilerini yükle
  const loadAllPVSystData = async () => {
    if (!selectedPlant || !selectedYear) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/pvsyst-reports?plant_id=${selectedPlant}&year=${selectedYear}`
      );
      const data = await response.json();

      // Tüm aylar için veri objesi oluştur
      const allMonthsData = {};
      for (let month = 1; month <= 12; month++) {
        const monthData = data.find((item) => item.month === month);
        allMonthsData[month] = monthData
          ? monthData.expected_production.toString()
          : "";
      }

      setMonthlyData({ pvsyst: allMonthsData });
      setExistingData({ pvsyst: allMonthsData });
    } catch (error) {
      console.error("PVSyst verileri yüklenemedi:", error);
      addNotification("Hata", "PVSyst verileri yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePVSystInputChange = (month, value) => {
    setMonthlyData((prev) => ({
      ...prev,
      pvsyst: {
        ...prev.pvsyst,
        [month]: value,
      },
    }));
  };

  const handlePVSystCalculate = () => {
    if (!selectedPlantData) {
      addNotification("Hata", "Santral bilgileri yüklenemedi", "error");
      return;
    }
    setPvsystCalculatorOpen(true);
  };

  const handlePVSystCalculatorResult = (calculatedData) => {
    setMonthlyData((prev) => ({
      ...prev,
      pvsyst: calculatedData,
    }));
    setPvsystCalculatorOpen(false);
    addNotification("Başarılı", "PVSyst verileri hesaplandı", "success");
  };

  const handlePVSystReset = () => {
    if (!selectedPlant || !selectedYear) {
      addNotification("Hata", "Lütfen santral ve yıl seçin", "error");
      return;
    }
    setShowPVSystResetConfirm(true);
  };

  const handlePVSystResetConfirm = async () => {
    setShowPVSystResetConfirm(false);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/pvsyst-reports/plant/${selectedPlant}/year/${selectedYear}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        addNotification("Başarılı", "PVSyst verileri sıfırlandı", "success");
        loadAllPVSystData();
      } else {
        addNotification("Hata", "PVSyst verileri sıfırlanamadı", "error");
      }
    } catch (error) {
      console.error("PVSyst sıfırlama hatası:", error);
      addNotification("Hata", "PVSyst verileri sıfırlanamadı", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <ConfirmModal
        open={showConfirm}
        onConfirm={saveData}
        onCancel={() => setShowConfirm(false)}
        title="Uyarı"
        description="Bu yıl için zaten kayıtlı veri bulunuyor. Üzerine yazmak istediğinize emin misiniz?"
      />
      <ConfirmModal
        open={showPVSystResetConfirm}
        onConfirm={handlePVSystResetConfirm}
        onCancel={() => setShowPVSystResetConfirm(false)}
        title="Uyarı"
        description="PVSyst verilerini sıfırlamak istediğinize emin misiniz?"
      />
      <NotificationStack
        notifications={notifications}
        onRemove={handleRemoveNotification}
      />

      <h1 className={styles.title}>PVSyst Verisi</h1>

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
      </div>

      {selectedPlant && selectedYear && (
        <form onSubmit={handleSubmit} className={styles.monthlyForm}>
          {/* PVSyst Aylık Beklenen - Tablo Yapısı */}
          <div className={styles.pvsystTableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Ay</th>
                  <th>Beklenen Üretim</th>
                </tr>
              </thead>
              <tbody>
                {monthNames.map((month, index) => {
                  const monthNumber = index + 1;
                  const monthValue = monthlyData.pvsyst?.[monthNumber] || "";

                  return (
                    <tr key={monthNumber}>
                      <td className={styles.monthCell}>{month}</td>
                      <td>
                        <input
                          type="text"
                          value={monthValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            handlePVSystInputChange(monthNumber, value);
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

          {/* Butonlar - PVSyst modunda tablo dışında */}
          <div className={styles.pvsystButtons}>
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
              onClick={handlePVSystReset}
              disabled={loading || !selectedPlant || !selectedYear}
            >
              {loading ? "İşleniyor..." : "Yılı Sıfırla"}
            </button>

            <button
              type="button"
              className={styles.calculateButton}
              onClick={handlePVSystCalculate}
              disabled={loading || !selectedPlantData}
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
              Otomatik Hesapla
            </button>
          </div>
        </form>
      )}

      {/* PVSyst Hesaplayıcı Modal */}
      {pvsystCalculatorOpen && (
        <PVSystCalculator
          plant={selectedPlantData}
          selectedYear={selectedYear}
          selectedMonth={1}
          onCalculate={handlePVSystCalculatorResult}
          onCancel={() => setPvsystCalculatorOpen(false)}
          onNotification={addNotification}
          isYearlyMode={true}
        />
      )}
    </div>
  );
};

export default PVSystReports;
