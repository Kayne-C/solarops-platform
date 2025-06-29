import React, { useState, useContext, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext";
import styles from "../../../components/layout/Table/Table.module.css";
import { getPlants, deletePlant, updatePlant } from "../plantApi";
import ConfirmModal from "../../../components/layout/ConfirmModal/ConfirmModal";
import NotificationStack from "../../../components/layout/NotificationStack/NotificationStack";
import { getInvestors } from "../investorApi";
import { getFields } from "../fieldApi";
import LoadingScreen from "../../../components/layout/LoadingScreen/LoadingScreen";
import { FaChartLine, FaCalculator } from "react-icons/fa";

const statusColors = {
  Aktif: styles.statusAktif,
  Bakımda: styles.statusBakımda,
  İnaktif: styles.statusİnaktif,
};

const statusOptions = [
  { value: "Aktif", label: "Aktif" },
  { value: "Bakımda", label: "Bakımda" },
  { value: "İnaktif", label: "İnaktif" },
];

const PlantsTable = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("general");
  const [filters, setFilters] = useState({
    id: "",
    name: "",
    investor: "",
    type: "",
    field: "",
    status: "",
    power: "",
    pv_module: "",
    inverter: "",
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });

  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editPlant, setEditPlant] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletePlantObj, setDeletePlantObj] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [fields, setFields] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPlants().then((res) => setPlants(res.data)),
      getInvestors().then((res) => setInvestors(res.data)),
      getFields().then((res) => setFields(res.data)),
    ])
      .catch(() => setError("Santraller alınamadı"))
      .finally(() => setLoading(false));
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = (data) => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  };

  const filteredPlants = plants.filter((plant) => {
    return (
      (!filters.id ||
        plant.id.toLowerCase().includes(filters.id.toLowerCase())) &&
      (!filters.name ||
        plant.name.toLowerCase().includes(filters.name.toLowerCase())) &&
      (!filters.investor ||
        plant.Investor?.company_name
          ?.toLowerCase()
          .includes(filters.investor.toLowerCase())) &&
      (!filters.type ||
        plant.type.toLowerCase().includes(filters.type.toLowerCase())) &&
      (!filters.field ||
        plant.Field?.name
          ?.toLowerCase()
          .includes(filters.field.toLowerCase())) &&
      (!filters.status ||
        plant.status?.toLowerCase().includes(filters.status.toLowerCase())) &&
      (!filters.power ||
        plant.power?.toLowerCase().includes(filters.power.toLowerCase())) &&
      (!filters.pv_module ||
        plant.pv_module
          ?.toLowerCase()
          .includes(filters.pv_module.toLowerCase())) &&
      (!filters.inverter ||
        plant.inverter?.toLowerCase().includes(filters.inverter.toLowerCase()))
    );
  });

  const sortedPlants = getSortedData(filteredPlants);

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return "↑↓";
    }
    return sortConfig.direction === "ascending" ? "↑" : "↓";
  };

  const selectedPlant = id
    ? plants.find((plant) => plant.id === parseInt(id))
    : null;

  const handleEditSave = async (updatedPlant) => {
    try {
      await updatePlant(updatedPlant.id, updatedPlant);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Santral güncellendi",
          icon: "✅",
        },
      ]);
      getPlants().then((res) => setPlants(res.data));
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Santral güncellenemedi",
          icon: "❌",
        },
      ]);
    }
    setShowEditModal(false);
    setEditPlant(null);
  };

  const handleDelete = async () => {
    try {
      await deletePlant(deletePlantObj.id);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Santral silindi",
          icon: "✅",
        },
      ]);
      getPlants().then((res) => setPlants(res.data));
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Santral silinemedi",
          icon: "❌",
        },
      ]);
    }
    setShowDeleteModal(false);
    setDeletePlantObj(null);
  };

  const handleNavigateToReports = (plantId, dataType) => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    if (dataType === "actual") {
      navigate(
        `/daily-production?plant=${plantId}&year=${year}&month=${month}`
      );
    } else {
      navigate(
        `/pvsyst-reports?plant=${plantId}&year=${year}&month=${month}&type=${dataType}`
      );
    }
  };

  if (selectedPlant) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            onClick={() => navigate("/plants")}
            className={styles.backButton}
          >
            ← Geri
          </button>
          <h1 className={styles.title}>{selectedPlant.name}</h1>
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
        </div>

        <div className={styles.tabContent}>
          {activeTab === "general" && (
            <div className={styles.details}>
              <div className={styles.detailGroup}>
                <label>Saha</label>
                <p>{selectedPlant.Field?.name}</p>
              </div>
              <div className={styles.detailGroup}>
                <label>Santral Adı</label>
                <p>{selectedPlant.name}</p>
              </div>
              <div className={styles.detailGroup}>
                <label>Santral Türü</label>
                <p>{selectedPlant.type}</p>
              </div>
              <div className={styles.detailGroup}>
                <label>Yatırımcı</label>
                <p>{selectedPlant.Investor?.company_name}</p>
              </div>
              <div className={styles.detailGroup}>
                <label>Durum</label>
                <p className={statusColors[selectedPlant.status]}>
                  {selectedPlant.status}
                </p>
              </div>
            </div>
          )}

          {activeTab === "location" && (
            <div>
              <div className={styles.detailGroup}>
                <label>GPS Koordinatları</label>
                <p>{selectedPlant.coordinates}</p>
              </div>
              <div className={styles.mapContainer}>
                {/* Harita komponenti buraya eklenecek */}
                <p
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--color-gray-400)",
                  }}
                >
                  Harita görüntüsü burada olacak
                </p>
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div className={styles.details}>
              <div className={styles.detailGroup}>
                <label>IEC-104 Adresi</label>
                <p>{selectedPlant.iec104Address}</p>
              </div>
              <div className={styles.detailGroup}>
                <label>OSOS ID</label>
                <p>{selectedPlant.ososId}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <NotificationStack
        notifications={notifications}
        onRemove={(id) =>
          setNotifications((prev) => prev.filter((n) => n.id !== id))
        }
      />
      <div className={styles.header}>
        <h1 className={styles.title}>Santraller</h1>
        <button
          onClick={() => navigate("/plants/create")}
          className={styles.createButton}
        >
          <span className={styles.icon}>➕</span>
          Yeni Santral
        </button>
      </div>

      {loading ? (
        <div className={styles.tableWrapper}>
          <LoadingScreen />
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", color: "#ef4444" }}>
          Hata: {error}
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "12%" }}>
                  <div className={styles.columnHeader}>
                    <span>Veri Girişi</span>
                  </div>
                </th>
                <th style={{ width: "17%" }}>
                  <div className={styles.columnHeader}>
                    <span>Santral Adı</span>
                    <span
                      onClick={() => handleSort("name")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("name")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.name}
                    onChange={(e) => handleFilterChange("name", e.target.value)}
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "15%" }}>
                  <div className={styles.columnHeader}>
                    <span>Yatırımcı</span>
                    <span
                      onClick={() => handleSort("investor")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("investor")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.investor}
                    onChange={(e) =>
                      handleFilterChange("investor", e.target.value)
                    }
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "10%" }}>
                  <div className={styles.columnHeader}>
                    <span>Tür</span>
                    <span
                      onClick={() => handleSort("type")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("type")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.type}
                    onChange={(e) => handleFilterChange("type", e.target.value)}
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "10%" }}>
                  <div className={styles.columnHeader}>
                    <span>Saha</span>
                    <span
                      onClick={() => handleSort("field")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("field")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.field}
                    onChange={(e) =>
                      handleFilterChange("field", e.target.value)
                    }
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "8%" }}>
                  <div className={styles.columnHeader}>
                    <span>Güç</span>
                    <span
                      onClick={() => handleSort("power")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("power")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.power}
                    onChange={(e) =>
                      handleFilterChange("power", e.target.value)
                    }
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "8%" }}>
                  <div className={styles.columnHeader}>
                    <span>PV Modülü</span>
                    <span
                      onClick={() => handleSort("pv_module")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("pv_module")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.pv_module}
                    onChange={(e) =>
                      handleFilterChange("pv_module", e.target.value)
                    }
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "8%" }}>
                  <div className={styles.columnHeader}>
                    <span>Inverter</span>
                    <span
                      onClick={() => handleSort("inverter")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("inverter")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.inverter}
                    onChange={(e) =>
                      handleFilterChange("inverter", e.target.value)
                    }
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "10%" }}>
                  <div className={styles.columnHeader}>
                    <span>Durum</span>
                    <span
                      onClick={() => handleSort("status")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("status")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.status}
                    onChange={(e) =>
                      handleFilterChange("status", e.target.value)
                    }
                    className={styles.filterInput}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPlants.length > 0 ? (
                sortedPlants.map((plant) => (
                  <tr key={plant.id} className={styles.tableRow}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() =>
                            handleNavigateToReports(plant.id, "actual")
                          }
                          title="Gerçekleşen Üretim Verisi Gir"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#3b82f6",
                            cursor: "pointer",
                            padding: "4px",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background =
                              "rgba(59, 130, 246, 0.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = "none";
                          }}
                        >
                          <FaChartLine size={16} />
                        </button>
                        <button
                          onClick={() =>
                            handleNavigateToReports(plant.id, "pvsyst")
                          }
                          title="PVSyst Verisi Gir"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#10b981",
                            cursor: "pointer",
                            padding: "4px",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background =
                              "rgba(16, 185, 129, 0.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = "none";
                          }}
                        >
                          <FaCalculator size={16} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <span
                        className={styles.clickableText}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/plants/${plant.id}`);
                        }}
                      >
                        {plant.name}
                      </span>
                    </td>
                    <td>{plant.Investor?.company_name}</td>
                    <td>{plant.type}</td>
                    <td>{plant.Field?.name}</td>
                    <td>{plant.power}</td>
                    <td>{plant.pv_module}</td>
                    <td>{plant.inverter}</td>
                    <td>
                      <span className={statusColors[plant.status] || ""}>
                        {plant.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className={styles.noData}>
                    Henüz santral kaydı bulunmuyor
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showEditModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(30,41,59,0.7)",
            zIndex: 4000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#1e293b",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              padding: 32,
              minWidth: 350,
              maxWidth: "90vw",
              position: "relative",
            }}
          >
            <button
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: 24,
                cursor: "pointer",
              }}
              onClick={() => setShowEditModal(false)}
              aria-label="Kapat"
            >
              ×
            </button>
            <h2 style={{ color: "#fff", marginBottom: 24 }}>
              Santrali Düzenle
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditSave(editPlant);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <label>
                Santral Adı
                <input
                  type="text"
                  name="name"
                  value={editPlant.name}
                  onChange={(e) =>
                    setEditPlant((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#fff",
                  }}
                />
              </label>
              <label>
                Yatırımcı
                <select
                  name="investor_id"
                  value={editPlant.investor_id || editPlant.Investor?.id || ""}
                  onChange={(e) =>
                    setEditPlant((f) => ({ ...f, investor_id: e.target.value }))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#fff",
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
              <label>
                Saha
                <select
                  name="field_id"
                  value={editPlant.field_id || editPlant.Field?.id || ""}
                  onChange={(e) =>
                    setEditPlant((f) => ({ ...f, field_id: e.target.value }))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#fff",
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
              <label>
                Güç
                <input
                  type="text"
                  name="power"
                  value={editPlant.power || ""}
                  onChange={(e) =>
                    setEditPlant((f) => ({ ...f, power: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#fff",
                  }}
                />
              </label>
              <label>
                PV Modülü
                <input
                  type="text"
                  name="pv_module"
                  value={editPlant.pv_module || ""}
                  onChange={(e) =>
                    setEditPlant((f) => ({ ...f, pv_module: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#fff",
                  }}
                />
              </label>
              <label>
                Inverter
                <input
                  type="text"
                  name="inverter"
                  value={editPlant.inverter || ""}
                  onChange={(e) =>
                    setEditPlant((f) => ({ ...f, inverter: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#fff",
                  }}
                />
              </label>
              <label>
                Durum
                <select
                  name="status"
                  value={editPlant.status}
                  onChange={(e) =>
                    setEditPlant((f) => ({ ...f, status: e.target.value }))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#fff",
                  }}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
                  onClick={() => setShowEditModal(false)}
                  style={{
                    padding: "0.5rem 1.5rem",
                    borderRadius: 6,
                    border: "none",
                    background: "#334155",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "0.5rem 1.5rem",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <ConfirmModal
          open={showDeleteModal}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          title="Santral Silinsin mi?"
          description="Bu santrali silmek istediğinize emin misiniz?"
        />
      )}
    </div>
  );
};

export default PlantsTable;
