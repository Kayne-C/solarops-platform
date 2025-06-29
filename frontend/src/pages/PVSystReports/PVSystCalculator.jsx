import React, { useState, useEffect } from "react";
import styles from "./PVSystCalculator.module.css";

const PVSystCalculator = ({
  plant,
  selectedYear,
  selectedMonth,
  onCalculate,
  onCancel,
  onNotification,
  isYearlyMode = false, // Yıllık hesaplama modu
}) => {
  const [availablePVSystData, setAvailablePVSystData] = useState([]);
  const [selectedBaseData, setSelectedBaseData] = useState(null);
  const [selectedBaseYear, setSelectedBaseYear] = useState("");
  const [calculatedValue, setCalculatedValue] = useState(null);
  const [calculatedData, setCalculatedData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const selectedMonthName = monthNames[selectedMonth - 1];

  // Bozulma hesaplama fonksiyonu
  const calculateDegradation = (
    baseValue,
    baseYear,
    targetYear,
    installationYear,
    degradationRate
  ) => {
    if (
      !baseValue ||
      !baseYear ||
      !targetYear ||
      !installationYear ||
      !degradationRate
    ) {
      return null;
    }

    const baseAge = baseYear - installationYear;
    const targetAge = targetYear - installationYear;

    // Negatif yaş durumlarını kontrol et
    if (baseAge < 0) {
      const message = `Baz yıl (${baseYear}) kurulum yılından (${installationYear}) önce olamaz`;
      console.warn(message);
      if (onNotification) {
        onNotification("Uyarı", message, "warning");
      }
      return null;
    }

    if (targetAge < 0) {
      const message = `Hedef yıl (${targetYear}) kurulum yılından (${installationYear}) önce olamaz`;
      console.warn(message);
      if (onNotification) {
        onNotification("Uyarı", message, "warning");
      }
      return null;
    }

    // Basit yıllık bozulma hesaplaması
    // Yıl farkı kadar bozulma uygula
    const yearDifference = targetYear - baseYear;
    const degradationFactor = degradationRate / 100;

    // Her yıl için (1 - bozulma_oranı) çarpanı uygula
    const targetValue =
      baseValue * Math.pow(1 - degradationFactor, yearDifference);

    return Math.round(targetValue * 100) / 100; // 2 ondalık basamak
  };

  // Mevcut PVSyst verilerini yükle
  const loadAvailablePVSystData = async () => {
    if (!plant?.id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/pvsyst-reports?plant_id=${plant.id}&is_calculated=false`
      );
      const data = await response.json();

      // Sadece manuel girilmiş verileri al (is_calculated = false)
      const manualData = data.filter((item) => !item.is_calculated);

      // Kurulum tarihinden sonra gelen verileri filtrele
      const installationYear = plant?.installation_date
        ? new Date(plant.installation_date).getFullYear()
        : null;

      const filteredData = installationYear
        ? manualData.filter((item) => item.year >= installationYear)
        : manualData;

      if (isYearlyMode) {
        // Yıllık mod için yıllara göre grupla
        const yearGroups = {};
        filteredData.forEach((item) => {
          if (!yearGroups[item.year]) {
            yearGroups[item.year] = [];
          }
          yearGroups[item.year].push(item);
        });
        setAvailablePVSystData(yearGroups);
      } else {
        // Tek ay mod için düz liste
        setAvailablePVSystData(filteredData);
      }
    } catch (error) {
      console.error("PVSyst verileri alınamadı:", error);
      setAvailablePVSystData(isYearlyMode ? {} : []);
    } finally {
      setLoading(false);
    }
  };

  // Tek ay hesaplama
  const handleCalculateSingle = () => {
    if (
      !selectedBaseData ||
      !plant?.installation_date ||
      !plant?.depreciation_rate
    ) {
      return;
    }

    setErrorMessage("");

    const installationYear = new Date(plant.installation_date).getFullYear();
    const baseAge = selectedBaseData.year - installationYear;
    const targetAge = selectedYear - installationYear;

    // Negatif yaş kontrolü
    if (baseAge < 0) {
      setErrorMessage(
        `Hesaplama yapılamaz: Seçilen veri (${selectedBaseData.year}) kurulum yılından (${installationYear}) önce olamaz.`
      );
      return;
    }

    if (targetAge < 0) {
      setErrorMessage(
        `Hesaplama yapılamaz: Hedef yıl (${selectedYear}) kurulum yılından (${installationYear}) önce olamaz.`
      );
      return;
    }

    // Gelecek verisini seçip geçmiş verisini çekmek kontrolü
    if (selectedBaseData.year > selectedYear) {
      setErrorMessage(
        `Hesaplama yapılamaz: Gelecek verisi (${selectedBaseData.year}) seçilerek geçmiş verisi (${selectedYear}) hesaplanamaz.`
      );
      return;
    }

    const calculated = calculateDegradation(
      parseFloat(selectedBaseData.expected_production),
      selectedBaseData.year,
      selectedYear,
      installationYear,
      parseFloat(plant.depreciation_rate)
    );

    setCalculatedValue(calculated);
  };

  // Yıllık hesaplama
  const handleCalculateYearly = () => {
    if (
      !selectedBaseYear ||
      !plant?.installation_date ||
      !plant?.depreciation_rate
    ) {
      setErrorMessage(
        "Lütfen baz yıl seçin ve santral bilgilerini kontrol edin."
      );
      return;
    }

    setErrorMessage("");
    const installationYear = new Date(plant.installation_date).getFullYear();
    const baseYearData = availablePVSystData[selectedBaseYear];

    if (!baseYearData || baseYearData.length === 0) {
      setErrorMessage("Seçilen yıl için veri bulunamadı.");
      return;
    }

    // Gelecek verisini seçip geçmiş verisini çekmek kontrolü
    if (parseInt(selectedBaseYear) > selectedYear) {
      setErrorMessage(
        `Hesaplama yapılamaz: Gelecek verisi (${selectedBaseYear}) seçilerek geçmiş verisi (${selectedYear}) hesaplanamaz.`
      );
      return;
    }

    const calculated = {};
    baseYearData.forEach((item) => {
      const calculatedValue = calculateDegradation(
        parseFloat(item.expected_production),
        parseInt(selectedBaseYear),
        selectedYear,
        installationYear,
        parseFloat(plant.depreciation_rate)
      );

      if (calculatedValue !== null) {
        calculated[item.month] = calculatedValue.toString();
      }
    });

    setCalculatedData(calculated);
  };

  // Hesaplama yap
  const handleCalculate = () => {
    if (isYearlyMode) {
      handleCalculateYearly();
    } else {
      handleCalculateSingle();
    }
  };

  // Hesaplanan değeri kullan
  const handleUseCalculated = () => {
    if (isYearlyMode) {
      if (Object.keys(calculatedData).length > 0) {
        onCalculate(calculatedData);
      }
    } else {
      if (calculatedValue !== null) {
        onCalculate(calculatedValue);
      }
    }
  };

  useEffect(() => {
    setCalculatedValue(null);
    setCalculatedData({});
    setSelectedBaseData(null);
    setSelectedBaseYear("");
  }, [selectedYear, selectedMonth, isYearlyMode]);

  useEffect(() => {
    loadAvailablePVSystData();
  }, [plant?.id, isYearlyMode]);

  const availableYears = isYearlyMode
    ? Object.keys(availablePVSystData)
        .filter((year) => {
          const yearInt = parseInt(year);
          const installationYear = plant?.installation_date
            ? new Date(plant.installation_date).getFullYear()
            : null;

          // Kurulum tarihi yoksa sadece hedef yıldan önceki yılları göster
          if (!installationYear) {
            return yearInt < selectedYear;
          }

          // Kurulum tarihinden sonraki ve hedef yıldan önceki yılları göster
          return yearInt >= installationYear && yearInt < selectedYear;
        })
        .sort((a, b) => b - a)
    : [];

  // Tek ay mod için filtrelenmiş veriler
  const filteredAvailableData = isYearlyMode
    ? []
    : availablePVSystData.filter((item) => {
        const installationYear = plant?.installation_date
          ? new Date(plant.installation_date).getFullYear()
          : null;

        // Kurulum tarihi yoksa sadece hedef yıldan önceki verileri göster
        if (!installationYear) {
          return item.year < selectedYear;
        }

        // Kurulum tarihinden sonraki ve hedef yıldan önceki verileri göster
        return item.year >= installationYear && item.year < selectedYear;
      });

  return (
    <div className={styles.calculatorModal}>
      <div className={styles.calculatorContent}>
        <h3 className={styles.calculatorTitle}>
          {isYearlyMode
            ? "PVSyst Yıllık Hesaplama"
            : "PVSyst Otomatik Hesaplama"}
        </h3>

        <div className={styles.calculatorInfo}>
          <p>
            <strong>Santral:</strong> {plant?.name}
          </p>
          <p>
            <strong>Kurulum Tarihi:</strong>{" "}
            {plant?.installation_date
              ? new Date(plant.installation_date).toLocaleDateString("tr-TR")
              : "Belirtilmemiş"}
          </p>
          <p>
            <strong>Bozulma Katsayısı:</strong>{" "}
            {plant?.depreciation_rate
              ? `${plant.depreciation_rate}%`
              : "Belirtilmemiş"}
          </p>
          <p>
            <strong>Hedef:</strong>{" "}
            {isYearlyMode
              ? selectedYear
              : `${selectedMonthName} ${selectedYear}`}
          </p>
        </div>

        {(!plant?.installation_date || !plant?.depreciation_rate) && (
          <div className={styles.warning}>
            ⚠️ Otomatik hesaplama için santral kurulum tarihi ve bozulma
            katsayısı gereklidir.
          </div>
        )}

        {isYearlyMode ? (
          // Yıllık mod için arayüz
          <div className={styles.inputGroup}>
            <label>Baz Alınacak Yıl Seçin:</label>
            {loading ? (
              <div className={styles.loading}>Veriler yükleniyor...</div>
            ) : availableYears.length === 0 ? (
              <div className={styles.noData}>
                {availablePVSystData.length === 0
                  ? "Henüz manuel girilmiş PVSyst verisi bulunmuyor."
                  : plant?.installation_date
                  ? `Kurulum tarihi (${new Date(
                      plant.installation_date
                    ).getFullYear()}) ile hedef yıl (${selectedYear}) arasında PVSyst verisi bulunmuyor.`
                  : `Hedef yıldan (${selectedYear}) önceki PVSyst verisi bulunmuyor.`}
              </div>
            ) : (
              <select
                value={selectedBaseYear}
                onChange={(e) => setSelectedBaseYear(e.target.value)}
                className={styles.dataSelect}
              >
                <option value="">Yıl seçin...</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year} - {availablePVSystData[year].length} ay verisi
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          // Tek ay mod için arayüz
          <div className={styles.inputGroup}>
            <label>Baz Alınacak PVSyst Verisi Seçin:</label>
            {loading ? (
              <div className={styles.loading}>Veriler yükleniyor...</div>
            ) : filteredAvailableData.length === 0 ? (
              <div className={styles.noData}>
                {availablePVSystData.length === 0
                  ? "Henüz manuel girilmiş PVSyst verisi bulunmuyor."
                  : plant?.installation_date
                  ? `Kurulum tarihi (${new Date(
                      plant.installation_date
                    ).getFullYear()}) ile hedef yıl (${selectedYear}) arasında PVSyst verisi bulunmuyor.`
                  : `Hedef yıldan (${selectedYear}) önceki PVSyst verisi bulunmuyor.`}
              </div>
            ) : (
              <select
                value={
                  selectedBaseData
                    ? `${selectedBaseData.year}-${selectedBaseData.month}`
                    : ""
                }
                onChange={(e) => {
                  const [year, month] = e.target.value.split("-");
                  const selected = availablePVSystData.find(
                    (item) =>
                      item.year === parseInt(year) &&
                      item.month === parseInt(month)
                  );
                  setSelectedBaseData(selected);
                }}
                className={styles.dataSelect}
              >
                <option value="">Veri seçin...</option>
                {filteredAvailableData.map((item) => (
                  <option
                    key={`${item.year}-${item.month}`}
                    value={`${item.year}-${item.month}`}
                  >
                    {monthNames[item.month - 1]} {item.year} -{" "}
                    {item.expected_production.toLocaleString("tr-TR")} kWh
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {isYearlyMode &&
          selectedBaseYear &&
          availablePVSystData[selectedBaseYear] && (
            <div className={styles.selectedDataInfo}>
              <h4>Seçilen Yıl Verileri:</h4>
              <div className={styles.monthDataGrid}>
                {availablePVSystData[selectedBaseYear].map((item) => (
                  <div key={item.month} className={styles.monthDataItem}>
                    <span className={styles.monthName}>
                      {monthNames[item.month - 1]}
                    </span>
                    <span className={styles.monthValue}>
                      {item.expected_production.toLocaleString("tr-TR")} kWh
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {!isYearlyMode && selectedBaseData && (
          <div className={styles.selectedDataInfo}>
            <h4>Seçilen Veri:</h4>
            <p>
              <strong>Dönem:</strong> {monthNames[selectedBaseData.month - 1]}{" "}
              {selectedBaseData.year}
            </p>
            <p>
              <strong>Üretim:</strong>{" "}
              {selectedBaseData.expected_production.toLocaleString("tr-TR")} kWh
            </p>
            <p>
              <strong>Santral Yaşı:</strong>{" "}
              {plant?.installation_date
                ? Math.max(
                    0,
                    selectedBaseData.year -
                      new Date(plant.installation_date).getFullYear()
                  )
                : "Kurulum tarihi belirtilmemiş"}{" "}
              yıl
            </p>
            <p>
              <strong>Hedef Yaş:</strong>{" "}
              {plant?.installation_date
                ? Math.max(
                    0,
                    selectedYear -
                      new Date(plant.installation_date).getFullYear()
                  )
                : "Kurulum tarihi belirtilmemiş"}{" "}
              yıl
            </p>
          </div>
        )}

        {errorMessage && (
          <div className={styles.errorMessage}>
            <p>⚠️ {errorMessage}</p>
          </div>
        )}

        {!isYearlyMode && (
          <div className={styles.calculationInfo}>
            <p>
              <strong>Hesaplama Formülü:</strong>
            </p>
            <p>V = V₀ × (1 - r)^n</p>
            <p>
              V: Hedef yıl değeri, V₀: Baz yıl değeri, r: Yıllık bozulma oranı,
              n: Yıl farkı
            </p>
          </div>
        )}

        <div className={styles.buttonGroup}>
          <button onClick={onCancel} className={styles.cancelButton}>
            İptal
          </button>

          {((isYearlyMode && Object.keys(calculatedData).length > 0) ||
            (!isYearlyMode && calculatedValue !== null && !errorMessage)) && (
            <button onClick={handleUseCalculated} className={styles.useButton}>
              {isYearlyMode ? "Hesaplanan Verileri Kullan" : "Bu Değeri Kullan"}
            </button>
          )}

          <button
            onClick={handleCalculate}
            disabled={
              isYearlyMode
                ? !selectedBaseYear ||
                  !plant?.installation_date ||
                  !plant?.depreciation_rate
                : !selectedBaseData ||
                  !plant?.installation_date ||
                  !plant?.depreciation_rate ||
                  (selectedBaseData &&
                    plant?.installation_date &&
                    (selectedBaseData.year <
                      new Date(plant.installation_date).getFullYear() ||
                      selectedYear <
                        new Date(plant.installation_date).getFullYear()))
            }
            className={styles.calculateButton}
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
            Hesapla
          </button>
        </div>

        {!isYearlyMode && calculatedValue !== null && !errorMessage && (
          <div className={styles.result}>
            <h4>Hesaplama Sonucu:</h4>
            <p>
              <strong>
                {selectedMonthName} {selectedYear} için beklenen üretim:
              </strong>
            </p>
            <p className={styles.calculatedValue}>
              {calculatedValue.toLocaleString("tr-TR")} kWh
            </p>
          </div>
        )}

        {isYearlyMode && Object.keys(calculatedData).length > 0 && (
          <div className={styles.calculatedDataInfo}>
            <h4>Hesaplanan Veriler ({selectedYear}):</h4>
            <div className={styles.monthDataGrid}>
              {Object.entries(calculatedData).map(([month, value]) => (
                <div key={month} className={styles.monthDataItem}>
                  <span className={styles.monthName}>
                    {monthNames[parseInt(month) - 1]}
                  </span>
                  <span className={styles.monthValue}>
                    {parseFloat(value).toLocaleString("tr-TR")} kWh
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PVSystCalculator;
