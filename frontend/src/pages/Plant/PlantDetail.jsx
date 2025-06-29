import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import styles from "./PlantDetail.module.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import ConfirmModal from "../../components/layout/ConfirmModal/ConfirmModal";
import NotificationStack from "../../components/layout/NotificationStack/NotificationStack";
import CreatePlant from "./CreatePlant";
import { getPlant, updatePlant, deletePlant } from "./plantApi";
import { getInvestors } from "./investorApi";
import { getFields } from "./fieldApi";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const navyBg = "#1e293b";
const navyBorder = "#334155";
const navyText = "#f1f5f9";
const navyGrid = "#334155";
const blueLine = "#2563eb";

const sahaListesi = ["Saha 1", "Saha 2", "Saha 3"];

const statusOptions = [
  { value: "Aktif", label: "Aktif" },
  { value: "Bakımda", label: "Bakımda" },
  { value: "İnaktif", label: "İnaktif" },
];

// Türkçe-İngilizce status mapping
const statusMap = {
  Aktif: "ACTIVE",
  Bakımda: "MAINTENANCE",
  İnaktif: "INACTIVE",
};
const statusMapReverse = {
  ACTIVE: "Aktif",
  MAINTENANCE: "Bakımda",
  INACTIVE: "İnaktif",
};

const PlantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("general");
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [investors, setInvestors] = useState([]);
  const [fields, setFields] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [productionData, setProductionData] = useState([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [viewType, setViewType] = useState("monthly");

  // Örnek veri: Gerçek uygulamada API'den çekilecek
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
  // Yıl, saha ve santral bazlı örnek veri
  // pvsystData[yıl][saha][santral]
  const pvsystData = {
    2023: {
      "Saha 1": {
        1: {
          Ocak: 12000,
          Şubat: 13000,
          Mart: 14000,
          Nisan: 15000,
          Mayıs: 16000,
          Haziran: 17000,
          Temmuz: 18000,
          Ağustos: 17000,
          Eylül: 16000,
          Ekim: 15000,
          Kasım: 14000,
          Aralık: 13000,
        },
        2: {
          Ocak: 9000,
          Şubat: 9500,
          Mart: 10000,
          Nisan: 11000,
          Mayıs: 12000,
          Haziran: 13000,
          Temmuz: 14000,
          Ağustos: 13500,
          Eylül: 13000,
          Ekim: 12000,
          Kasım: 11000,
          Aralık: 10000,
        },
      },
      "Saha 2": {
        3: {
          Ocak: 8000,
          Şubat: 8500,
          Mart: 9000,
          Nisan: 9500,
          Mayıs: 10000,
          Haziran: 11000,
          Temmuz: 12000,
          Ağustos: 11500,
          Eylül: 11000,
          Ekim: 10000,
          Kasım: 9000,
          Aralık: 8500,
        },
      },
    },
    2024: {
      "Saha 1": {
        1: {
          Ocak: 15000,
          Şubat: 16000,
          Mart: 18000,
          Nisan: 20000,
          Mayıs: 22000,
          Haziran: 24000,
          Temmuz: 23000,
          Ağustos: 21000,
          Eylül: 19000,
          Ekim: 17000,
          Kasım: 15000,
          Aralık: 14000,
        },
        2: {
          Ocak: 11000,
          Şubat: 12000,
          Mart: 13000,
          Nisan: 14000,
          Mayıs: 15000,
          Haziran: 16000,
          Temmuz: 17000,
          Ağustos: 16500,
          Eylül: 16000,
          Ekim: 15000,
          Kasım: 14000,
          Aralık: 13000,
        },
      },
      "Saha 2": {
        3: {
          Ocak: 10000,
          Şubat: 11000,
          Mart: 12000,
          Nisan: 13000,
          Mayıs: 14000,
          Haziran: 15000,
          Temmuz: 16000,
          Ağustos: 15500,
          Eylül: 15000,
          Ekim: 14000,
          Kasım: 13000,
          Aralık: 12000,
        },
      },
    },
    2025: {
      "Saha 1": {
        1: {
          Ocak: 17000,
          Şubat: 17500,
          Mart: 18000,
          Nisan: 18500,
          Mayıs: 19000,
          Haziran: 19500,
          Temmuz: 20000,
          Ağustos: 19500,
          Eylül: 19000,
          Ekim: 18500,
          Kasım: 18000,
          Aralık: 17500,
        },
        2: {
          Ocak: 13000,
          Şubat: 13500,
          Mart: 14000,
          Nisan: 14500,
          Mayıs: 15000,
          Haziran: 15500,
          Temmuz: 16000,
          Ağustos: 15500,
          Eylül: 15000,
          Ekim: 14500,
          Kasım: 14000,
          Aralık: 13500,
        },
      },
      "Saha 2": {
        3: {
          Ocak: 12000,
          Şubat: 12500,
          Mart: 13000,
          Nisan: 13500,
          Mayıs: 14000,
          Haziran: 14500,
          Temmuz: 15000,
          Ağustos: 14500,
          Eylül: 14000,
          Ekim: 13500,
          Kasım: 13000,
          Aralık: 12500,
        },
      },
    },
  };

  const plantId = Number(id);
  const sahaAdi = plant?.field;
  const veri =
    pvsystData[selectedYear] &&
    pvsystData[selectedYear][sahaAdi] &&
    pvsystData[selectedYear][sahaAdi][plantId]
      ? pvsystData[selectedYear][sahaAdi][plantId]
      : null;
  const hasData = !!veri;
  const chartDataArr = monthNames.map((month) => ({
    name: month,
    value: hasData ? veri[month] : 0,
  }));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPlant(id).then((res) => {
        const data = res.data;
        // status'u Türkçeye çevir
        if (data.status && statusMapReverse[data.status]) {
          data.status = statusMapReverse[data.status];
        }
        setPlant(data);
      }),
      getInvestors().then((res) => setInvestors(res.data)),
      getFields().then((res) => setFields(res.data)),
    ])
      .catch(() => setError("Santral veya yardımcı veriler alınamadı"))
      .finally(() => setLoading(false));
  }, [id]);

  // Üretim verilerini yükle
  const fetchProductionData = async () => {
    if (!plant?.id) return;

    setProductionLoading(true);
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      // Gerçekleşen verileri al
      const actualResponse = await fetch(
        `/api/daily-productions/plant/${plant.id}?start_date=${startDate}&end_date=${endDate}`
      );
      const actualData = await actualResponse.json();

      // PVSyst verilerini al
      const pvsystResponse = await fetch(
        `/api/pvsyst-reports/plant/${plant.id}?start_year=${selectedYear}&end_year=${selectedYear}`
      );
      const pvsystData = await pvsystResponse.json();

      // Verileri birleştir
      const combinedData = [];

      // Gerçekleşen verileri ekle (tip 2)
      actualData.forEach((item) => {
        combinedData.push({
          ...item,
          type: 2, // Gerçekleşen
        });
      });

      // PVSyst verilerini ekle (tip 1)
      pvsystData.forEach((item) => {
        // PVSyst verisi aylık olduğu için, ayın ilk günü olarak ekle
        const date = `${item.year}-${item.month
          .toString()
          .padStart(2, "0")}-01`;
        combinedData.push({
          id: item.id,
          plant_id: item.plant_id,
          date: date,
          production: item.expected_production,
          type: 1, // PVSyst beklenen
          is_calculated: item.is_calculated,
          year: item.year,
          month: item.month,
        });
      });

      setProductionData(combinedData);
    } catch (error) {
      console.error("Üretim verileri yüklenemedi:", error);
      addNotification("Hata", "Üretim verileri yüklenemedi", "error");
    } finally {
      setProductionLoading(false);
    }
  };

  // Seçili yıl değiştiğinde verileri yeniden yükle
  useEffect(() => {
    if (plant?.id) {
      fetchProductionData();
    }
  }, [plant?.id, selectedYear]);

  // Aylık verileri hesapla
  const getMonthlyData = () => {
    const monthlyExpected = {};
    const monthlyActual = {};

    // Ayları başlat
    monthNames.forEach((month) => {
      monthlyExpected[month] = 0;
      monthlyActual[month] = 0;
    });

    productionData.forEach((item) => {
      const date = new Date(item.date);
      const monthIndex = date.getMonth();
      const monthName = monthNames[monthIndex];

      if (item.type === 1) {
        // PVSyst Beklenen (aylık)
        monthlyExpected[monthName] += parseFloat(item.production);
      } else if (item.type === 2) {
        // Gerçekleşen (günlük)
        monthlyActual[monthName] += parseFloat(item.production);
      }
    });

    return { monthlyExpected, monthlyActual };
  };

  const { monthlyExpected, monthlyActual } = getMonthlyData();

  // Grafik verilerini hazırla
  const getChartData = () => {
    if (viewType === "monthly") {
      // Aylık veri - seçili yılın tüm ayları
      return monthNames.map((month, index) => {
        const monthNum = index + 1;
        const monthData = productionData.filter((item) => {
          const itemDate = new Date(item.date);
          return (
            itemDate.getFullYear() === selectedYear &&
            itemDate.getMonth() === index
          );
        });

        const expected = monthData
          .filter((item) => item.type === 1) // PVSyst Beklenen
          .reduce((sum, item) => sum + parseFloat(item.production), 0);
        const actual = monthData
          .filter((item) => item.type === 2) // Gerçekleşen
          .reduce((sum, item) => sum + parseFloat(item.production), 0);

        // Hesaplanan veri bilgisini al
        const pvsystItem = monthData.find((item) => item.type === 1);
        const isCalculated = pvsystItem ? pvsystItem.is_calculated : false;

        const difference = actual - expected;
        const percentage = expected > 0 ? (difference / expected) * 100 : 0;

        return {
          period: month,
          expected: expected > 0 ? expected : null,
          actual: actual > 0 ? actual : null,
          isCalculated,
          difference,
          percentage,
        };
      });
    } else {
      // Yıllık veri - tüm yıllar
      const years = [2023, 2024, 2025, 2026];
      return years.map((year) => {
        const yearData = productionData.filter((item) => {
          const itemDate = new Date(item.date);
          return itemDate.getFullYear() === year;
        });

        const expected = yearData
          .filter((item) => item.type === 1) // PVSyst Beklenen
          .reduce((sum, item) => sum + parseFloat(item.production), 0);
        const actual = yearData
          .filter((item) => item.type === 2) // Gerçekleşen
          .reduce((sum, item) => sum + parseFloat(item.production), 0);

        // Hesaplanan veri bilgisini al (yıllık toplamda en az bir hesaplanan veri varsa)
        const hasCalculatedData = yearData.some(
          (item) => item.type === 1 && item.is_calculated
        );

        const difference = actual - expected;
        const percentage = expected > 0 ? (difference / expected) * 100 : 0;

        return {
          period: year,
          expected: expected > 0 ? expected : null,
          actual: actual > 0 ? actual : null,
          isCalculated: hasCalculatedData,
          difference,
          percentage,
        };
      });
    }
  };

  const getTableData = () => {
    const chartData = getChartData();

    return chartData.map((item) => {
      const expected = item.expected || 0;
      const actual = item.actual || 0;
      const difference = actual - expected;
      const percentage = expected > 0 ? (difference / expected) * 100 : 0;

      // Hesaplanan veri bilgisini al
      const isCalculated = item.isCalculated || false;

      return {
        period: item.period,
        expected,
        actual,
        difference,
        percentage,
        hasExpected: item.expected !== null,
        hasActual: item.actual !== null,
        isCalculated,
      };
    });
  };

  const chartData = getChartData();

  const selectedMonthName = monthNames[selectedMonth - 1];

  // Düzenle butonuna basınca mevcut santral bilgileriyle formu aç
  const handleEditClick = () => {
    setEditForm({
      ...plant,
      investor_id: plant.Investor?.id || plant.investor_id || "",
      field_id: plant.Field?.id || plant.field_id || "",
      status: plant.status || "Aktif",
    });
    setShowEditModal(true);
  };

  // Modalda form değişikliklerini yönet
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  // Kaydet butonuna basınca önce onay modalı aç
  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  // Onay modalında evet derse kaydet ve bildirim göster
  const handleConfirm = async () => {
    setShowConfirm(false);
    try {
      await updatePlant(plant.id, {
        ...editForm,
        investor_id: editForm.investor_id,
        field_id: editForm.field_id,
        status: statusMap[editForm.status] || "ACTIVE",
      });
      setShowEditModal(false);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Santral bilgileri güncellendi.",
          icon: "✅",
        },
      ]);
      getPlant(id).then((res) => {
        const data = res.data;
        if (data.status && statusMapReverse[data.status]) {
          data.status = statusMapReverse[data.status];
        }
        setPlant(data);
      });
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Santral güncellenemedi.",
          icon: "❌",
        },
      ]);
    }
  };

  // Silme işlemi
  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await deletePlant(plant.id);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Santral silindi.",
          icon: "✅",
        },
      ]);
      setTimeout(() => navigate("/plants"), 1200); // Bildirim görünsün diye gecikmeli yönlendir
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Santral silinemedi.",
          icon: "❌",
        },
      ]);
    }
  };

  const handleCancel = () => setShowConfirm(false);
  const handleRemoveNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Bildirim ekleme fonksiyonu
  const addNotification = (title, message, type = "info") => {
    const icon = type === "success" ? "✅" : type === "error" ? "❌" : "⚠️";

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

  // Santral türüne göre emoji/ikon döndüren yardımcı fonksiyon
  const getPlantTypeIcon = (type) => {
    switch (type) {
      case "GES":
        return "☀️";
      case "ÇGES":
        return "🏠";
      case "RES":
        return "💨";
      case "HES":
        return "💧";
      case "TES":
        return "🔥";
      case "BES":
        return "🌱";
      case "DGES":
        return "🔋";
      default:
        return "🏭";
    }
  };

  return (
    <div className={styles.container}>
      {/* ConfirmModal'ın modalın üstünde olması için z-index yüksek */}
      <div
        style={{
          position: "fixed",
          zIndex: 9999,
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: showConfirm ? "auto" : "none",
        }}
      >
        <ConfirmModal
          open={showConfirm}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title="Santral Bilgileri Güncellensin mi?"
          description="Yaptığınız değişiklikler kaydedilecek. Onaylıyor musunuz?"
        />
      </div>
      <NotificationStack
        notifications={notifications}
        onRemove={handleRemoveNotification}
        style={{ zIndex: 9999, position: "fixed", top: 0, right: 0 }}
      />
      {/* Düzenle Modalı */}
      {showEditModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 4000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
            overflow: "hidden",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
            }
          }}
        >
          <div
            style={{
              background: "var(--card-background)",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              padding: 32,
              width: "90vw",
              maxWidth: "800px",
              maxHeight: "90vh",
              position: "relative",
              border: "1px solid var(--border-color)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                position: "absolute",
                top: "-8px",
                right: "0px",
                background: "none",
                border: "none",
                color: "var(--text-color)",
                fontSize: 24,
                cursor: "pointer",
                transition: "color 0.2s",
                zIndex: 1,
              }}
              onClick={() => setShowEditModal(false)}
              aria-label="Kapat"
            >
              ×
            </button>
            <h2
              style={{
                color: "var(--text-color)",
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              Santral Bilgilerini Düzenle
            </h2>
            <form
              onSubmit={handleEditFormSubmit}
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  flex: 1,
                  overflowY: "auto",
                  paddingRight: 8,
                }}
              >
                <label style={{ color: "var(--form-label)" }}>
                  Santral Adı
                  <input
                    type="text"
                    name="name"
                    value={editForm?.name || ""}
                    onChange={handleEditFormChange}
                    required
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Yatırımcı
                  <select
                    name="investor_id"
                    value={editForm?.investor_id || ""}
                    onChange={handleEditFormChange}
                    required
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  >
                    <option value="">Seçiniz</option>
                    {investors.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.company_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Santral Türü
                  <select
                    name="type"
                    value={editForm?.type || ""}
                    onChange={handleEditFormChange}
                    required
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  >
                    <option value="GES">
                      GES (Arazi Güneş Enerji Santrali)
                    </option>
                    <option value="ÇGES">
                      ÇGES (Çatı Güneş Enerji Santrali)
                    </option>
                    <option value="DGES">
                      DGES (Depolamalı Güneş Enerji Santrali)
                    </option>
                    <option value="RES">RES (Rüzgar Enerji Santrali)</option>
                    <option value="HES">
                      HES (Hidroelektrik Enerji Santrali)
                    </option>
                    <option value="TES">TES (Termik Enerji Santrali)</option>
                    <option value="BES">BES (Biyokütle Enerji Santrali)</option>
                  </select>
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Saha
                  <select
                    name="field_id"
                    value={editForm?.field_id || ""}
                    onChange={handleEditFormChange}
                    required
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  >
                    <option value="">Seçiniz</option>
                    {fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Durum
                  <select
                    name="status"
                    value={editForm?.status || "Aktif"}
                    onChange={handleEditFormChange}
                    required
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  GPS Koordinatları
                  <input
                    type="text"
                    name="coordinates"
                    value={editForm?.coordinates || ""}
                    onChange={handleEditFormChange}
                    required
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Güç
                  <input
                    type="text"
                    name="power"
                    value={editForm?.power || ""}
                    onChange={handleEditFormChange}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  PV Modülü
                  <input
                    type="text"
                    name="pv_module"
                    value={editForm?.pv_module || ""}
                    onChange={handleEditFormChange}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Inverter
                  <input
                    type="text"
                    name="inverter"
                    value={editForm?.inverter || ""}
                    onChange={handleEditFormChange}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Kabul Tarihi
                  <input
                    type="date"
                    name="installation_date"
                    value={editForm?.installation_date || ""}
                    onChange={handleEditFormChange}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Yıpranma Payı (%)
                  <input
                    type="number"
                    name="depreciation_rate"
                    value={editForm?.depreciation_rate || ""}
                    onChange={handleEditFormChange}
                    step="0.01"
                    min="0"
                    max="100"
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  IEC-104 ASDU Adresi
                  <input
                    type="text"
                    name="iec104AsduAddress"
                    value={editForm?.iec104AsduAddress || ""}
                    onChange={handleEditFormChange}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  WAN IP Adresi
                  <input
                    type="text"
                    name="wanIpAddress"
                    value={editForm?.wanIpAddress || ""}
                    onChange={handleEditFormChange}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Local IP Adresi
                  <input
                    type="text"
                    name="localIpAddress"
                    value={editForm?.localIpAddress || ""}
                    onChange={handleEditFormChange}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  OSOS ID
                  <input
                    type="text"
                    name="ososId"
                    value={editForm?.ososId || ""}
                    onChange={handleEditFormChange}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                    }}
                  />
                </label>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 16,
                    marginTop: 16,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: "0.5rem 1.5rem",
                      borderRadius: 6,
                      border: "none",
                      background: "var(--status-error)",
                      color: "var(--color-100)",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "opacity 0.2s",
                    }}
                  >
                    Sil
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: "0.5rem 1.5rem",
                      borderRadius: 6,
                      border: "none",
                      background: "var(--button-primary)",
                      color: "var(--button-text)",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "opacity 0.2s",
                    }}
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Silme onay modalı */}
      {showDeleteConfirm && (
        <div
          style={{
            zIndex: 9999,
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
          }}
        >
          <ConfirmModal
            open={showDeleteConfirm}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            title="Santral Silinsin mi?"
            description="Bu santrali silmek istediğinize emin misiniz?"
          />
        </div>
      )}
      <div className={styles.header}>
        <button
          onClick={() => navigate("/plants")}
          className={styles.backButton}
        >
          ← Geri
        </button>
        <h1 className={styles.title}>
          {plant?.name}{" "}
          <span style={{ fontSize: 28, marginLeft: 8 }}>
            {getPlantTypeIcon(plant?.type)}
          </span>
        </h1>
      </div>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === "general" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("general")}
        >
          Genel Bilgiler
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "location" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("location")}
        >
          Coğrafi Bilgiler
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "data" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("data")}
        >
          Veri Çekme Bilgileri
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "pvsyst" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("pvsyst")}
        >
          PVSyst
        </button>
        {/* Düzenle butonu sekmelerin en sağına */}
        <button
          style={{
            marginLeft: "auto",
            fontSize: 22,
            background: "none",
            border: "none",
            color: navyText,
            cursor: "pointer",
            padding: "0 12px",
          }}
          title="Santrali Düzenle"
          onClick={handleEditClick}
        >
          🛠️
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === "general" && (
          <div className={styles.details}>
            <div className={styles.detailGroup}>
              <label>Saha</label>
              <p>{plant?.Field?.name}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>Santral Adı</label>
              <p>{plant?.name}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>Santral Türü</label>
              <p>{plant?.type}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>Yatırımcı</label>
              <p>{plant?.Investor?.company_name}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>Güç</label>
              <p>{plant?.power}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>PV Modülü</label>
              <p>{plant?.pv_module}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>Inverter</label>
              <p>{plant?.inverter}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>Kabul Tarihi</label>
              <p>
                {plant?.installation_date
                  ? new Date(plant.installation_date).toLocaleDateString(
                      "tr-TR"
                    )
                  : "Belirtilmemiş"}
              </p>
            </div>
            <div className={styles.detailGroup}>
              <label>Yıpranma Payı</label>
              <p>
                {plant?.depreciation_rate
                  ? `${plant.depreciation_rate}%`
                  : "Belirtilmemiş"}
              </p>
            </div>
            <div className={styles.detailGroup}>
              <label>Durum</label>
              <p className={styles.status}>{plant?.status}</p>
            </div>
          </div>
        )}

        {activeTab === "location" && (
          <div>
            <div className={styles.detailGroup}>
              <label>GPS Koordinatları</label>
              <p>{plant?.coordinates}</p>
            </div>
            <div
              className={styles.mapContainer}
              style={{
                height: 400,
                width: "100%",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {(() => {
                let lat = 39.925533;
                let lng = 32.866287;
                let hasCoords = false;
                if (plant?.coordinates) {
                  const parts = plant.coordinates.split(",");
                  if (parts.length === 2) {
                    lat = parseFloat(parts[0]);
                    lng = parseFloat(parts[1]);
                    hasCoords = !isNaN(lat) && !isNaN(lng);
                  }
                }
                return (
                  <MapContainer
                    center={[lat, lng]}
                    zoom={hasCoords ? 13 : 6}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {hasCoords && (
                      <Marker position={[lat, lng]}>
                        <Popup>
                          {plant?.name || "Santral"}
                          <br />
                          {plant?.coordinates}
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className={styles.details}>
            <div className={styles.detailGroup}>
              <label>IEC-104 ASDU Adresi</label>
              <p>{plant?.iec104AsduAddress}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>WAN IP Adresi</label>
              <p>{plant?.wanIpAddress}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>Local IP Adresi</label>
              <p>{plant?.localIpAddress}</p>
            </div>
            <div className={styles.detailGroup}>
              <label>OSOS ID</label>
              <p>{plant?.ososId}</p>
            </div>
          </div>
        )}

        {activeTab === "pvsyst" && (
          <div className={styles.pvsystTab}>
            <h2 className={styles.pvsystTitle}>Üretim Verileri Analizi</h2>

            <div className={styles.viewSelector}>
              <button
                className={`${styles.viewButton} ${
                  viewType === "monthly" ? styles.active : ""
                }`}
                onClick={() => setViewType("monthly")}
              >
                Aylık
              </button>
              <button
                className={`${styles.viewButton} ${
                  viewType === "yearly" ? styles.active : ""
                }`}
                onClick={() => setViewType("yearly")}
              >
                Yıllık
              </button>
            </div>

            {viewType === "monthly" && (
              <div className={styles.monthlyView}>
                <div className={styles.periodSelector}>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className={styles.periodSelect}
                  >
                    {[2023, 2024, 2025, 2026].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {viewType === "yearly" && (
              <div className={styles.yearlyView}>
                <div className={styles.periodSelector}>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className={styles.periodSelect}
                  >
                    {[2023, 2024, 2025, 2026].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {productionLoading ? (
              <div className={styles.loadingMessage}>Veriler yükleniyor...</div>
            ) : productionData.length === 0 ? (
              <div className={styles.noDataWarning}>
                Bu dönem için henüz üretim verisi girilmemiş
              </div>
            ) : (
              <>
                {/* Tablo */}
                <div className={styles.tableContainer}>
                  <table className={styles.pvsystTable}>
                    <thead>
                      <tr>
                        <th>{viewType === "monthly" ? "Ay" : "Yıl"}</th>
                        <th>PVSyst Beklenen (kWh)</th>
                        <th>Gerçekleşen (kWh)</th>
                        <th>Fark (kWh)</th>
                        <th>Fark (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getTableData().map((row, index) => (
                        <tr key={index}>
                          <td className={styles.periodCell}>{row.period}</td>
                          <td>
                            {row.hasExpected ? (
                              <span>
                                {row.expected.toFixed(2)}
                                {row.isCalculated && (
                                  <span
                                    style={{
                                      color: "#10b981",
                                      fontSize: "12px",
                                      marginLeft: "4px",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    (hesaplanan)
                                  </span>
                                )}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>{row.hasActual ? row.actual.toFixed(2) : "-"}</td>
                          <td
                            className={
                              row.difference >= 0
                                ? styles.positive
                                : styles.negative
                            }
                          >
                            {row.hasExpected && row.hasActual
                              ? (row.difference >= 0 ? "+" : "") +
                                row.difference.toFixed(2)
                              : "-"}
                          </td>
                          <td
                            className={
                              row.percentage >= 0
                                ? styles.positive
                                : styles.negative
                            }
                          >
                            {row.hasExpected && row.hasActual
                              ? (row.percentage >= 0 ? "+" : "") +
                                row.percentage.toFixed(1) +
                                "%"
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Grafik */}
                <div className={styles.chartContainer}>
                  <h3 className={styles.chartTitle}>
                    {viewType === "monthly" ? "Aylık" : "Yıllık"} Üretim
                    Karşılaştırması
                  </h3>
                  <div className={styles.chartWrapper}>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart
                        data={getChartData()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={navyGrid}
                        />
                        <XAxis
                          dataKey="period"
                          tick={{
                            fill: "#1e293b",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        />
                        <YAxis
                          tick={{
                            fill: "#1e293b",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                          label={{
                            value: "Üretim (kWh)",
                            angle: -90,
                            position: "insideLeft",
                            fill: "#1e293b",
                            fontWeight: 500,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: navyBg,
                            border: `1px solid ${navyBorder}`,
                            color: navyText,
                            fontWeight: 500,
                          }}
                          labelStyle={{ color: navyText, fontWeight: 500 }}
                          formatter={(value, name) => [
                            value.toFixed(2) + " kWh",
                            name === "expected"
                              ? "PVSyst Beklenen"
                              : "Gerçekleşen",
                          ]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="expected"
                          name="PVSyst Beklenen"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          dot={{ r: 2, fill: "#3b82f6" }}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          name="Gerçekleşen"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 2, fill: "#10b981" }}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlantDetail;
