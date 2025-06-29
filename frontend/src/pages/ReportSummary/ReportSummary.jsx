import React, { useState, useEffect } from "react";
import styles from "./ReportSummary.module.css";
import { useLocation } from "react-router-dom";
import NotificationStack from "../../components/layout/NotificationStack/NotificationStack";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  BarElement,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  BarElement
);

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

const ReportSummary = () => {
  const location = useLocation();
  const [selectedPlant, setSelectedPlant] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [monthlyReportData, setMonthlyReportData] = useState(null);
  const [comparisonChartData, setComparisonChartData] = useState(null);

  // URL parametrelerini oku
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plant = params.get("plant");
    const year = params.get("year");
    const month = params.get("month");

    if (plant) setSelectedPlant(plant);
    if (year) setSelectedYear(Number(year));
    if (month) setSelectedMonth(Number(month));

    document.title = "Üretim Raporları - EGESA";
  }, [location.search]);

  // Santralleri yükle
  useEffect(() => {
    fetchPlants();
  }, []);

  // Seçili santral ve yıl değiştiğinde rapor verilerini yükle
  useEffect(() => {
    if (selectedPlant && selectedYear && selectedMonth) {
      loadMonthlyReportData();
      loadComparisonData();
    }
  }, [selectedPlant, selectedYear, selectedMonth]);

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

  const loadReportData = async () => {
    setLoading(true);
    try {
      // PVSyst beklenen verileri
      const pvsystResponse = await fetch(
        `/api/pvsyst-reports?plant_id=${selectedPlant}&year=${selectedYear}`
      );
      const pvsystData = await pvsystResponse.json();

      // Gerçekleşen üretim verileri
      const startDate = `${selectedYear}-${selectedMonth}-01`;
      const endDate = `${selectedYear}-${selectedMonth}-${new Date(
        selectedYear,
        selectedMonth,
        0
      ).getDate()}`;
      const actualResponse = await fetch(
        `/api/daily-productions?plant_id=${selectedPlant}&start_date=${startDate}&end_date=${endDate}`
      );
      const actualData = await actualResponse.json();

      // Verileri aylık olarak grupla
      const monthlyExpected = {};
      const monthlyActual = {};

      // PVSyst verilerini aylık olarak grupla
      pvsystData.forEach((item) => {
        monthlyExpected[item.month] = Number(item.expected_production || 0);
      });

      // Gerçekleşen verileri aylık olarak grupla
      actualData.forEach((item) => {
        const month = new Date(item.date).getMonth() + 1;
        if (!monthlyActual[month]) {
          monthlyActual[month] = 0;
        }
        monthlyActual[month] += Number(item.production || 0);
      });

      // Tüm aylar için veri hazırla
      const monthlyData = [];
      let totalExpected = 0;
      let totalActual = 0;

      for (let month = 1; month <= 12; month++) {
        const expected = Number(monthlyExpected[month] || 0);
        const actual = Number(monthlyActual[month] || 0);

        monthlyData.push({
          month: month,
          monthName: monthNames[month - 1],
          expected: expected,
          actual: actual,
          difference: actual - expected,
          performance: expected > 0 ? (actual / expected) * 100 : 0,
        });

        totalExpected += expected;
        totalActual += actual;
      }

      setReportData({
        monthlyData,
        totalExpected,
        totalActual,
        totalDifference: totalActual - totalExpected,
        totalPerformance:
          totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0,
      });
    } catch (error) {
      console.error("Rapor verileri yüklenemedi:", error);
      addNotification("Hata", "Rapor verileri yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReportData = async () => {
    setLoading(true);
    try {
      // PVSyst beklenen verileri
      const pvsystResponse = await fetch(
        `/api/pvsyst-reports?plant_id=${selectedPlant}&year=${selectedYear}`
      );
      const pvsystData = await pvsystResponse.json();

      // Gerçekleşen üretim verileri
      const startDate = `${selectedYear}-${selectedMonth
        .toString()
        .padStart(2, "0")}-01`;
      const endDate = `${selectedYear}-${selectedMonth
        .toString()
        .padStart(2, "0")}-${new Date(
        selectedYear,
        selectedMonth,
        0
      ).getDate()}`;
      const actualResponse = await fetch(
        `/api/daily-productions?plant_id=${selectedPlant}&start_date=${startDate}&end_date=${endDate}`
      );
      const actualData = await actualResponse.json();

      // PVSyst verilerinden seçili ayın beklenen üretimini al
      const selectedMonthExpected = pvsystData.find(
        (item) => item.month === selectedMonth
      );
      const expectedProduction = Number(
        selectedMonthExpected?.expected_production || 0
      );

      // Günlük verileri hazırla
      const dailyData = [];
      let totalActual = 0;

      // Ayın tüm günleri için veri hazırla
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedYear}-${selectedMonth
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        const dayData = actualData.find((item) => item.date === dateStr);
        const dailyProduction = Number(dayData?.production || 0);

        dailyData.push({
          day: day,
          date: dateStr,
          production: dailyProduction,
        });

        totalActual += dailyProduction;
      }

      setMonthlyReportData({
        dailyData,
        expectedProduction,
        totalActual,
        totalDifference: totalActual - expectedProduction,
        totalPerformance:
          expectedProduction > 0 ? (totalActual / expectedProduction) * 100 : 0,
      });
    } catch (error) {
      console.error("Aylık rapor verileri yüklenemedi:", error);
      addNotification("Hata", "Aylık rapor verileri yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadComparisonData = async () => {
    try {
      const chartData = await getLast4MonthsComparisonBarChartData();
      setComparisonChartData(chartData);
    } catch (error) {
      console.error("Karşılaştırma verileri yüklenemedi:", error);
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

  // Ay bazında pie chart verisi
  const getMonthlyPieChartData = () => {
    if (!monthlyReportData) return null;

    const expectedProduction = Number(
      monthlyReportData.expectedProduction || 0
    );
    const totalActual = Number(monthlyReportData.totalActual || 0);

    if (totalActual >= expectedProduction) {
      return {
        labels: ["Beklenen Üretim", "Fazla Üretim"],
        datasets: [
          {
            data: [expectedProduction, totalActual - expectedProduction],
            backgroundColor: ["#3b82f6", "#10b981"],
            borderWidth: 0,
          },
        ],
      };
    } else {
      return {
        labels: ["Gerçekleşen Üretim", "Eksik Üretim"],
        datasets: [
          {
            data: [totalActual, expectedProduction - totalActual],
            backgroundColor: ["#10b981", "#ef4444"],
            borderWidth: 0,
          },
        ],
      };
    }
  };

  // Günlük üretim bar chart verisi
  const getDailyProductionBarChartData = () => {
    if (!monthlyReportData || !monthlyReportData.dailyData) return null;

    const labels = monthlyReportData.dailyData.map((item) => `${item.day}`);
    const data = monthlyReportData.dailyData.map((item) =>
      Number(item.production || 0)
    );

    return {
      labels,
      datasets: [
        {
          label: "Günlük Üretim (MWh)",
          data: data,
          backgroundColor: "rgba(16, 185, 129, 0.8)",
          borderColor: "#10b981",
          borderWidth: 1,
        },
      ],
    };
  };

  // Önceki 4 ay ile karşılaştırma bar chart verisi
  const getLast4MonthsComparisonBarChartData = async () => {
    if (!selectedPlant || !selectedYear) return null;

    try {
      // PVSyst beklenen verileri
      const pvsystResponse = await fetch(
        `/api/pvsyst-reports?plant_id=${selectedPlant}&year=${selectedYear}`
      );
      const pvsystData = await pvsystResponse.json();

      // Son 4 ayı hesapla
      const last4Months = [];
      for (let i = 3; i >= 0; i--) {
        let month = selectedMonth - i;
        let year = selectedYear;

        if (month <= 0) {
          month += 12;
          year -= 1;
        }

        last4Months.push({ month, year });
      }

      // Her ay için gerçekleşen üretim verilerini al
      const actualDataPromises = last4Months.map(async ({ month, year }) => {
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = `${year}-${month
          .toString()
          .padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

        const response = await fetch(
          `/api/daily-productions?plant_id=${selectedPlant}&start_date=${startDate}&end_date=${endDate}`
        );
        const data = await response.json();

        const totalProduction = data.reduce(
          (sum, item) => sum + Number(item.production || 0),
          0
        );
        return { month, year, actual: totalProduction };
      });

      const actualData = await Promise.all(actualDataPromises);

      const labels = last4Months.map(({ month, year }) => {
        const monthName = monthNames[month - 1];
        return year === selectedYear ? monthName : `${monthName} ${year}`;
      });

      const actualValues = actualData.map((item) => Number(item.actual || 0));

      // Beklenen üretim verilerini al
      const expectedValues = last4Months.map(({ month, year }) => {
        if (year === selectedYear) {
          const monthData = pvsystData.find((item) => item.month === month);
          return Number(monthData?.expected_production || 0);
        } else {
          return 0; // Farklı yıl için şimdilik 0
        }
      });

      return {
        labels,
        datasets: [
          {
            label: "Gerçekleşen Üretim (MWh)",
            data: actualValues,
            backgroundColor: "rgba(16, 185, 129, 0.8)",
            borderColor: "#10b981",
            borderWidth: 1,
            type: "bar",
            order: 1,
            z: 1,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          },
          {
            label: "Beklenen Üretim (MWh)",
            data: expectedValues,
            borderColor: "#3b82f6",
            backgroundColor: "transparent",
            borderWidth: 2,
            type: "line",
            fill: false,
            tension: 0.4,
            order: 99,
            z: 99,
            pointRadius: 4,
            pointBackgroundColor: "#3b82f6",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            clip: false,
          },
        ],
      };
    } catch (error) {
      console.error("Karşılaştırma verileri yüklenemedi:", error);
      return null;
    }
  };

  // Takvim benzeri hizalama için günleri düzenle
  const getCalendarDays = () => {
    if (!monthlyReportData || !monthlyReportData.dailyData) return [];

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDayOfMonth = new Date(
      selectedYear,
      selectedMonth - 1,
      1
    ).getDay(); // 0 = Pazar, 1 = Pazartesi, ...

    // Pazartesi'den başlaması için gün indeksini ayarla
    // 0=Pazar -> 6, 1=Pazartesi -> 0, 2=Salı -> 1, ..., 6=Cumartesi -> 5
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const calendarDays = [];

    // Ayın başındaki boş günler için boş kutucuklar ekle
    for (let i = 0; i < adjustedFirstDay; i++) {
      calendarDays.push({ isEmpty: true });
    }

    // Ayın günlerini ekle
    monthlyReportData.dailyData.forEach((item) => {
      calendarDays.push({
        ...item,
        isEmpty: false,
      });
    });

    // Son satırı tamamlamak için boş hücreler ekle (7'nin katı olacak şekilde)
    const totalCells = calendarDays.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;

    for (let i = 0; i < remainingCells; i++) {
      calendarDays.push({ isEmpty: true });
    }

    return calendarDays;
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: `${monthNames[selectedMonth - 1]} Ayı Günlük Üretim Verileri`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Üretim (MWh)",
        },
      },
    },
  };

  const comparisonChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Son 4 Ay Karşılaştırması",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Üretim (MWh)",
        },
      },
    },
  };

  return (
    <div className={styles.container}>
      <NotificationStack
        notifications={notifications}
        onRemove={handleRemoveNotification}
      />

      <h1 className={styles.title}>Raporlama Özet</h1>

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
            {monthNames.map((monthName, index) => (
              <option key={index + 1} value={index + 1}>
                {monthName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>Rapor verileri yükleniyor...</div>
      )}

      {!loading && monthlyReportData && (
        <div className={styles.reportContainer}>
          {/* Özet Kartları */}
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <h3>{monthNames[selectedMonth - 1]} Beklenen Üretim</h3>
              <p className={styles.summaryValue}>
                {Number(monthlyReportData.expectedProduction || 0).toFixed(2)}{" "}
                MWh
              </p>
            </div>
            <div className={styles.summaryCard}>
              <h3>{monthNames[selectedMonth - 1]} Gerçekleşen Üretim</h3>
              <p className={styles.summaryValue}>
                {Number(monthlyReportData.totalActual || 0).toFixed(2)} MWh
              </p>
            </div>
            <div className={styles.summaryCard}>
              <h3>{monthNames[selectedMonth - 1]} Performans Oranı</h3>
              <p className={styles.summaryValue}>
                {Number(monthlyReportData.totalPerformance || 0).toFixed(1)}%
              </p>
            </div>
            <div className={styles.summaryCard}>
              <h3>{monthNames[selectedMonth - 1]} Fark</h3>
              <p
                className={`${styles.summaryValue} ${
                  Number(monthlyReportData.totalDifference || 0) >= 0
                    ? styles.positive
                    : styles.negative
                }`}
              >
                {Number(monthlyReportData.totalDifference || 0) >= 0 ? "+" : ""}
                {Number(monthlyReportData.totalDifference || 0).toFixed(2)} MWh
              </p>
            </div>
          </div>

          {/* Ay Bazında Chart'lar */}
          <div className={styles.monthlyChartsContainer}>
            <div className={styles.monthlyChart}>
              <h3>{monthNames[selectedMonth - 1]} Ayı Üretim Dağılımı</h3>
              <div className={styles.smallPieChart}>
                {getMonthlyPieChartData() && (
                  <Pie data={getMonthlyPieChartData()} />
                )}
              </div>
            </div>

            <div className={styles.monthlyChart}>
              <div className={styles.comparisonChart}>
                <h3>Son 4 Ay Karşılaştırması</h3>
                {comparisonChartData && (
                  <Bar
                    data={comparisonChartData}
                    options={comparisonChartOptions}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Günlük Detay Tablosu - Grid Layout */}
          <div className={styles.gridTableContainer}>
            <h3>{monthNames[selectedMonth - 1]} Ayı Günlük Detaylar</h3>

            {/* Haftanın günleri başlığı */}
            <div className={styles.weekDaysHeader}>
              <div className={styles.weekDay}>Pazartesi</div>
              <div className={styles.weekDay}>Salı</div>
              <div className={styles.weekDay}>Çarşamba</div>
              <div className={styles.weekDay}>Perşembe</div>
              <div className={styles.weekDay}>Cuma</div>
              <div className={styles.weekDay}>Cumartesi</div>
              <div className={styles.weekDay}>Pazar</div>
            </div>

            <div className={styles.gridTable}>
              {getCalendarDays().map((item, index) => (
                <div key={index} className={styles.gridTableCell}>
                  {item.isEmpty ? (
                    <div className={styles.emptyCell}></div>
                  ) : (
                    <>
                      <div className={styles.dayNumber}>{`${item.day
                        .toString()
                        .padStart(2, "0")}.${selectedMonth
                        .toString()
                        .padStart(2, "0")}`}</div>
                      <div className={styles.productionValue}>
                        {Number(item.production || 0).toFixed(2)} MWh
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Günlük Üretim Bar Chart - En Altta */}
          <div className={styles.fullWidthChartContainer}>
            <h3>{monthNames[selectedMonth - 1]} Ayı Günlük Üretim Verileri</h3>
            <div className={styles.fullWidthBarChart}>
              {getDailyProductionBarChartData() && (
                <Bar
                  data={getDailyProductionBarChartData()}
                  options={barChartOptions}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {!loading &&
        !monthlyReportData &&
        selectedPlant &&
        selectedYear &&
        selectedMonth && (
          <div className={styles.noData}>
            Seçilen santral ve yıl için veri bulunamadı.
          </div>
        )}
    </div>
  );
};

export default ReportSummary;
