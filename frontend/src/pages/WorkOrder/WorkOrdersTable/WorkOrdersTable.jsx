import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../../components/layout/Table/Table.module.css";
import LoadingScreen from "../../../components/layout/LoadingScreen/LoadingScreen";
import { getWorkOrders, getWorkOrder } from "../workOrderApi";
import { getWorkOrderPDFBlob } from "../PDFWorkOrderReport";
import PDFReviewIcon from "../../../components/layout/PDF/PDFReviewIcon";
import PDFDownloadIcon from "../../../components/layout/PDF/PDFDownloadIcon";
import { translateWorkOrderField } from "../../../utils/translateWorkOrderField";

const WorkOrdersTable = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    id: "",
    type: "",
    description: "",
    field: "",
    plant: "",
    priority: "",
    status: "",
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });

  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const workOrderTypes = {
    MAINTENANCE: "Bakım",
    REPAIR: "Tamir",
    INSPECTION: "Kontrol",
    INSTALLATION: "Kurulum",
    OTHER: "Diğer",
  };

  const priorityLabels = {
    LOW: "Düşük",
    MEDIUM: "Orta",
    HIGH: "Yüksek",
    URGENT: "Acil",
  };

  // Status Türkçe mapping
  const statusLabels = {
    PENDING: "Oluşturuldu",
    IN_PROGRESS: "Devam Ediyor",
    COMPLETED: "Tamamlandı",
    CANCELLED: "İptal Edildi",
  };

  useEffect(() => {
    setLoading(true);
    getWorkOrders()
      .then((res) => setWorkOrders(res.data))
      .catch(() => setError("İş emirleri alınamadı"))
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

  const filteredWorkOrders = workOrders.filter((wo) => {
    return (
      (!filters.id ||
        wo.id.toString().toLowerCase().includes(filters.id.toLowerCase())) &&
      (!filters.type ||
        wo.type?.toLowerCase().includes(filters.type.toLowerCase())) &&
      (!filters.description ||
        wo.description
          ?.toLowerCase()
          .includes(filters.description.toLowerCase())) &&
      (!filters.field ||
        wo.Plant?.field_id
          ?.toString()
          .toLowerCase()
          .includes(filters.field.toLowerCase()) ||
        wo.Plant?.Field?.name
          ?.toLowerCase()
          .includes(filters.field.toLowerCase())) &&
      (!filters.plant ||
        wo.Plant?.name?.toLowerCase().includes(filters.plant.toLowerCase())) &&
      (!filters.status ||
        wo.status?.toLowerCase().includes(filters.status.toLowerCase()))
    );
  });

  const sortedWorkOrders = getSortedData(filteredWorkOrders);

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return "↑↓";
    }
    return sortConfig.direction === "ascending" ? "↑" : "↓";
  };

  const handleDescriptionClick = (e, id) => {
    e.stopPropagation();
    navigate(`/work-orders/${id}`);
  };

  // PDF önizleme fonksiyonu (yeni sekmede aç)
  const handlePreviewPDF = async (wo) => {
    try {
      const res = await getWorkOrder(wo.id);
      const fullWO = res.data;
      const blob = await getWorkOrderPDFBlob(fullWO, fullWO.Activities || []);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      alert("PDF hazırlanırken hata oluştu.");
    }
  };

  // PDF indirme fonksiyonu
  const handleDownloadPDF = async (wo) => {
    try {
      const res = await getWorkOrder(wo.id);
      const fullWO = res.data;
      const blob = await getWorkOrderPDFBlob(fullWO, fullWO.Activities || []);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `is-emri-raporu-${wo.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("PDF hazırlanırken hata oluştu.");
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", color: "#ef4444" }}>Hata: {error}</div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>İş Emirleri</h1>
        <button
          onClick={() => navigate("/create-work-order")}
          className={styles.createButton}
        >
          <span className={styles.icon}>➕</span>
          Yeni İş Emri
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: "8%" }}>
                <div className={styles.columnHeader}>
                  <span>PDF</span>
                </div>
              </th>
              <th style={{ width: "42%" }}>
                <div className={styles.columnHeader}>
                  <span>Açıklama</span>
                  <span
                    onClick={() => handleSort("description")}
                    className={styles.sortIcon}
                  >
                    {renderSortIcon("description")}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.description}
                  onChange={(e) =>
                    handleFilterChange("description", e.target.value)
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
                  onChange={(e) => handleFilterChange("field", e.target.value)}
                  className={styles.filterInput}
                />
              </th>
              <th style={{ width: "15%" }}>
                <div className={styles.columnHeader}>
                  <span>Santral</span>
                  <span
                    onClick={() => handleSort("plant")}
                    className={styles.sortIcon}
                  >
                    {renderSortIcon("plant")}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.plant}
                  onChange={(e) => handleFilterChange("plant", e.target.value)}
                  className={styles.filterInput}
                />
              </th>
              <th style={{ width: "15%" }}>
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
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className={styles.filterInput}
                />
              </th>
              <th style={{ width: "10%" }}>
                <div className={styles.columnHeader}>
                  <span>Öncelik</span>
                  <span
                    onClick={() => handleSort("priority")}
                    className={styles.sortIcon}
                  >
                    {renderSortIcon("priority")}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.priority}
                  onChange={(e) =>
                    handleFilterChange("priority", e.target.value)
                  }
                  className={styles.filterInput}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedWorkOrders.length > 0 ? (
              sortedWorkOrders.map((wo) => (
                <tr key={wo.id} className={styles.tableRow}>
                  <td>
                    <PDFReviewIcon onClick={() => handlePreviewPDF(wo)} />
                    <PDFDownloadIcon onClick={() => handleDownloadPDF(wo)} />
                  </td>
                  <td>
                    <span
                      className={styles.clickableText}
                      onClick={(e) => handleDescriptionClick(e, wo.id)}
                    >
                      {wo.description}
                    </span>
                  </td>
                  <td>
                    <span className={styles[`status${wo.type}`] || ""}>
                      {translateWorkOrderField("type", wo.type)}
                    </span>
                  </td>
                  <td>{wo.Plant?.Field?.name || wo.Plant?.field_id}</td>
                  <td>{wo.Plant?.name}</td>
                  <td>
                    <span className={styles[`status${wo.status}`] || ""}>
                      {translateWorkOrderField("status", wo.status)}
                    </span>
                  </td>
                  <td>
                    <span className={styles[`priority${wo.priority}`] || ""}>
                      {translateWorkOrderField("priority", wo.priority)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className={styles.noData}>
                  Henüz iş emri bulunmuyor
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkOrdersTable;
