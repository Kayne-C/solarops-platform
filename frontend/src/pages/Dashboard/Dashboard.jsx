import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Tooltip,
} from "react-leaflet";
import { Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from "chart.js";
import {
  FaClipboardList,
  FaCheckCircle,
  FaIndustry,
  FaExclamationTriangle,
  FaTools,
  FaUserFriends,
  FaTimesCircle,
  FaRegMap,
  FaSatelliteDish,
} from "react-icons/fa";
import styles from "./Dashboard.module.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getPlants } from "../Plant/plantApi";
import { getWorkOrders } from "../WorkOrder/workOrderApi";
import tableStyles from "../../components/layout/Table/Table.module.css";
import { useState as useStateReact } from "react";
import { getUsers } from "../AdminPage/adminApi";

// Chart.js kayıt
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);

// Leaflet marker ikonu düzeltmesi
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const TURKEY_BOUNDS = [
  [36, 26], // Güneybatı (SW)
  [42, 45], // Kuzeydoğu (NE)
];

// Türkiye sınırlarının merkezini ve uygun zoom'u belirle
const TURKEY_CENTER = [39, 35.5];
const TURKEY_ZOOM = 5.8;

// Harita katmanları
const mapLayers = [
  {
    key: "standart",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    icon: <FaRegMap />,
    tooltip: "Standart Görünüm",
  },
  {
    key: "uydu",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
    icon: <FaSatelliteDish />,
    tooltip: "Uydu Görünümü",
  },
];

// Custom marker icon
const createCustomIcon = () => {
  return L.divIcon({
    className: "dashboard-marker",
    html: `<div class="marker-content" style="
      width: 20px;
      height: 20px;
      background: #1e293b;
      border: 2px solid #2563eb;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.2s ease;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Harita kontrolü için yardımcı bileşen
const MapController = ({ hoveredPlantId, plants, defaultBounds }) => {
  const map = useMap();

  useEffect(() => {
    if (hoveredPlantId) {
      const plant = plants.find((p) => p.id === hoveredPlantId);
      if (
        plant &&
        typeof plant.latitude === "number" &&
        typeof plant.longitude === "number"
      ) {
        map.flyTo([plant.latitude, plant.longitude], 12, {
          duration: 1,
          easeLinearity: 0.1,
        });
      }
    } else {
      map.flyTo(TURKEY_CENTER, TURKEY_ZOOM, {
        duration: 1,
        easeLinearity: 0.1,
      });
    }
  }, [hoveredPlantId, plants, map]);

  return null;
};

// Tooltip içeriği için yardımcı bileşen
const PlantTooltip = ({ plant }) => {
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        minWidth: "200px",
        fontSize: "14px",
        lineHeight: "1.4",
      }}
    >
      <h3
        style={{
          margin: "0 0 8px 0",
          color: "#1e293b",
          fontSize: "16px",
          fontWeight: "600",
        }}
      >
        {plant.name}
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "4px 8px",
          color: "#475569",
        }}
      >
        <span style={{ fontWeight: "500" }}>Tür:</span>
        <span>{plant.type}</span>
        <span style={{ fontWeight: "500" }}>Durum:</span>
        <span>{plant.status}</span>
        <span style={{ fontWeight: "500" }}>Kapasite:</span>
        <span>{plant.capacity} MW</span>
        <span style={{ fontWeight: "500" }}>Yatırımcı:</span>
        <span>{plant.Investor?.company_name}</span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [plants, setPlants] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [hoveredPlantId, setHoveredPlantId] = useState(null);
  const [showInfoMessage, setShowInfoMessage] = useState(false);
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const infoMessageTimeoutRef = useRef(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [personnelCount, setPersonnelCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPlants().then((res) => {
        // coordinates string'ini latitude ve longitude'ya çevir
        const plantsWithLatLng = res.data.map((plant) => {
          if (
            plant.coordinates &&
            typeof plant.coordinates === "string" &&
            plant.coordinates.includes(",")
          ) {
            const [latStr, lngStr] = plant.coordinates.split(",");
            const latitude = parseFloat(latStr);
            const longitude = parseFloat(lngStr);
            if (!isNaN(latitude) && !isNaN(longitude)) {
              return { ...plant, latitude, longitude };
            }
          }
          return plant;
        });
        setPlants(plantsWithLatLng);
      }),
      getWorkOrders().then((res) => setWorkOrders(res.data)),
      getUsers().then((res) => {
        setUsers(res.data);
        setPersonnelCount(res.data.length);
      }),
    ])
      .catch(() => setError("Veriler alınamadı"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Control") setIsCtrlPressed(true);
    };
    const handleKeyUp = (event) => {
      if (event.key === "Control") {
        setIsCtrlPressed(false);
        if (showInfoMessage) {
          if (infoMessageTimeoutRef.current)
            clearTimeout(infoMessageTimeoutRef.current);
          setShowInfoMessage(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (infoMessageTimeoutRef.current)
        clearTimeout(infoMessageTimeoutRef.current);
    };
  }, [showInfoMessage]);

  useEffect(() => {
    const mapElement = mapDivRef.current;
    const handleWheel = (event) => {
      if (!mapElement || !mapRef.current) return;
      if (isCtrlPressed) {
        event.preventDefault();
        event.stopPropagation();
        if (showInfoMessage) {
          if (infoMessageTimeoutRef.current)
            clearTimeout(infoMessageTimeoutRef.current);
          setShowInfoMessage(false);
        }
        if (event.deltaY < 0) mapRef.current.zoomIn();
        else mapRef.current.zoomOut();
      } else {
        if (event.deltaY !== 0) {
          if (infoMessageTimeoutRef.current)
            clearTimeout(infoMessageTimeoutRef.current);
          setShowInfoMessage(true);
          infoMessageTimeoutRef.current = setTimeout(
            () => setShowInfoMessage(false),
            2500
          );
        }
      }
    };
    if (mapElement)
      mapElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      if (mapElement) mapElement.removeEventListener("wheel", handleWheel);
    };
  }, [isCtrlPressed, showInfoMessage]);

  // İstatistikler
  const totalFields = new Set(plants.map((p) => p.Field?.id)).size;
  const totalPlants = plants.length;
  const activeWorkOrders = workOrders.filter(
    (w) => w.status !== "COMPLETED" && w.status !== "CANCELLED"
  ).length;
  const completedWorkOrders = workOrders.filter(
    (w) => w.status === "COMPLETED"
  ).length;
  const cancelledWorkOrders = workOrders.filter(
    (w) => w.status === "CANCELLED"
  ).length;
  const urgentWorkOrders = workOrders.filter(
    (w) => w.priority === "URGENT"
  ).length;
  const maintenancePlants = plants.filter((p) => p.status === "Bakımda").length;

  // İş Emri Öncelik Dağılımı (Pasta Grafiği)
  const priorityCounts = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  };
  workOrders
    .filter((w) => w.status !== "COMPLETED" && w.status !== "CANCELLED")
    .forEach((w) => {
      if (priorityCounts[w.priority] !== undefined) {
        priorityCounts[w.priority]++;
      }
    });
  const priorityPieData = {
    labels: ["Düşük", "Orta", "Yüksek", "Acil"],
    datasets: [
      {
        data: [
          priorityCounts.LOW,
          priorityCounts.MEDIUM,
          priorityCounts.HIGH,
          priorityCounts.URGENT,
        ],
        backgroundColor: [
          "#22c55e", // Düşük - yeşil
          "#fde047", // Orta - sarı
          "#fb923c", // Yüksek - turuncu
          "#ef4444", // Acil - kırmızı
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className={styles.dashboard}>
      <h1>Dashboard</h1>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>Yükleniyor...</div>
      ) : error ? (
        <div style={{ textAlign: "center", color: "#ef4444" }}>
          Hata: {error}
        </div>
      ) : (
        <>
          {/* En üst: Saha, Santral, Personel */}
          <div className={styles.statsContainer}>
            <h2>Genel İstatistikler</h2>
            <div className={styles.statsGrid} style={{ marginBottom: 0 }}>
              <div className={styles.statCard}>
                <FaIndustry className={styles.statIcon} />
                <div className={styles.statContent}>
                  <h3>Toplam Saha</h3>
                  <p>{totalFields}</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <FaIndustry className={styles.statIcon} />
                <div className={styles.statContent}>
                  <h3>Toplam Santral</h3>
                  <p>{totalPlants}</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <FaUserFriends className={styles.statIcon} />
                <div className={styles.statContent}>
                  <h3>Personel Sayısı</h3>
                  <p>{personnelCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Harita ve Tablo Grid */}
          <div className={styles.contentGrid}>
            {/* Sol Panel: Santral Tablosu */}
            <div style={{ minWidth: 320, maxWidth: 500 }}>
              <div className={styles.plantsTableContainer}>
                <h2>Santraller</h2>
                <div className={tableStyles.tableWrapper}>
                  <table className={tableStyles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: "50%" }}>Santral Adı</th>
                        <th style={{ width: "20%" }}>Yatırımcı</th>
                        <th style={{ width: "15%" }}>Tür</th>
                        <th style={{ width: "15%" }}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plants.length > 0 ? (
                        plants.map((plant) => (
                          <tr
                            key={plant.id}
                            className={tableStyles.tableRow}
                            style={{ transition: "background 0.2s" }}
                            onMouseEnter={() => setHoveredPlantId(plant.id)}
                            onMouseLeave={() => setHoveredPlantId(null)}
                          >
                            <td style={{ fontWeight: 600 }}>{plant.name}</td>
                            <td>{plant.Investor?.company_name}</td>
                            <td>{plant.type}</td>
                            <td>{plant.status}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className={tableStyles.noData}>
                            Henüz santral kaydı bulunmuyor
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Harita */}
            <div className={styles.mapTableContainer}>
              <h2>Saha Lokasyonları</h2>
              <div className={styles.mapWrapper}>
                <MapContainer
                  bounds={TURKEY_BOUNDS}
                  boundsOptions={{ padding: [20, 20] }}
                  className={styles.map}
                  style={{ width: "100%", height: "100%" }}
                  zoomControl={false}
                  preferCanvas={true}
                  maxZoom={18}
                  minZoom={4}
                  scrollWheelZoom={false}
                  ref={mapRef}
                >
                  <TileLayer
                    key={mapLayers[selectedLayer].key}
                    url={mapLayers[selectedLayer].url}
                    attribution={mapLayers[selectedLayer].attribution}
                    updateWhenIdle={true}
                    updateWhenZooming={false}
                    keepBuffer={2}
                  />
                  {plants
                    .filter(
                      (p) =>
                        typeof p.latitude === "number" &&
                        typeof p.longitude === "number"
                    )
                    .map((plant) => (
                      <Marker
                        key={plant.id}
                        position={[plant.latitude, plant.longitude]}
                        icon={createCustomIcon()}
                      />
                    ))}
                  <MapController
                    hoveredPlantId={hoveredPlantId}
                    plants={plants}
                    defaultBounds={TURKEY_BOUNDS}
                  />
                </MapContainer>
                {/* Katman değiştirme sade ikon */}
                <span
                  onClick={() => setSelectedLayer(selectedLayer === 0 ? 1 : 0)}
                  title={mapLayers[selectedLayer === 0 ? 1 : 0].tooltip}
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    fontSize: 26,
                    color: "#6b7280",
                    cursor: "pointer",
                    zIndex: 1200,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#374151")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#6b7280")
                  }
                >
                  {mapLayers[selectedLayer === 0 ? 1 : 0].icon}
                </span>
              </div>
            </div>
          </div>

          {/* En alt: İş Emri Kartları ve Pie Chart */}
          <div className={styles.statsContainer}>
            <h2>İş Emri İstatistikleri</h2>
            <div
              style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div
                className={styles.statCard}
                style={{ flex: 1, minWidth: 220 }}
              >
                <FaCheckCircle className={styles.statIcon} />
                <div className={styles.statContent}>
                  <h3>Tamamlanan İş Emirleri</h3>
                  <p>{completedWorkOrders}</p>
                </div>
              </div>
              <div
                className={styles.statCard}
                style={{ flex: 1, minWidth: 220 }}
              >
                <FaTimesCircle className={styles.statIcon} />
                <div className={styles.statContent}>
                  <h3>İptal Edilen</h3>
                  <p>{cancelledWorkOrders}</p>
                </div>
              </div>
              <div
                className={styles.statCard}
                style={{ flex: 1, minWidth: 220 }}
              >
                <FaClipboardList className={styles.statIcon} />
                <div className={styles.statContent}>
                  <h3>Aktif İş Emirleri</h3>
                  <p>{activeWorkOrders}</p>
                </div>
              </div>
              <div
                className={styles.statCard}
                style={{ flex: 1, minWidth: 220 }}
              >
                <FaExclamationTriangle className={styles.statIcon} />
                <div className={styles.statContent}>
                  <h3>Acil Öncelikli</h3>
                  <p>{urgentWorkOrders}</p>
                </div>
              </div>
              <div
                className={styles.chartContainer}
                style={{ flex: 1, minWidth: 320, maxWidth: 400 }}
              >
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>
                  Aktif İş Emirleri Öncelik Dağılımı
                </h2>
                <Pie
                  data={priorityPieData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: {
                          color: "#1e293b",
                          font: { size: 14 },
                        },
                      },
                      title: {
                        display: false,
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
