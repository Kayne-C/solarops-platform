import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./WorkOrderDetail.module.css";
import { getWorkOrder, updateWorkOrder } from "./workOrderApi";
import ConfirmModal from "../../components/layout/ConfirmModal/ConfirmModal";
import NotificationStack from "../../components/layout/NotificationStack/NotificationStack";
import stylesTable from "../../components/layout/Table/Table.module.css";
import { getWorkOrderPDFBlob } from "./PDFWorkOrderReport";
import PDFReviewIcon from "../../components/layout/PDF/PDFReviewIcon";
import PDFDownloadIcon from "../../components/layout/PDF/PDFDownloadIcon";
import { translateWorkOrderField } from "../../utils/translateWorkOrderField";
import API_BASE_URL from "../../config/api";

const statusOptions = [
  { value: "PENDING", label: "Oluşturuldu" },
  { value: "IN_PROGRESS", label: "Devam Ediyor" },
  { value: "COMPLETED", label: "Tamamlandı" },
  { value: "CANCELLED", label: "İptal Edildi" },
];

const workOrderTypes = [
  { value: "MAINTENANCE", label: "Bakım" },
  { value: "FAULT", label: "Onarım" },
  { value: "INSPECTION", label: "Kontrol" },
  { value: "OTHER", label: "Diğer" },
];

const priorityOptions = [
  { value: "LOW", label: "Düşük" },
  { value: "MEDIUM", label: "Orta" },
  { value: "HIGH", label: "Yüksek" },
  { value: "URGENT", label: "Acil" },
];

const WorkOrderDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [workOrder, setWorkOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [editFormData, setEditFormData] = useState(null);
  const [activityFilters, setActivityFilters] = useState({
    date: "",
    description: "",
    user: "",
  });

  const [activitySortConfig, setActivitySortConfig] = useState({
    key: null,
    direction: "ascending",
  });

  useEffect(() => {
    setLoading(true);
    getWorkOrder(id)
      .then((res) => {
        setWorkOrder(res.data);
      })
      .catch(() => setError("İş emri alınamadı"))
      .finally(() => setLoading(false));
  }, [id]);

  // İş emri numarasının son 5 hanesini al
  const getShortId = (fullId) => {
    if (!fullId) return "";
    return fullId.slice(-5);
  };

  // Düzenle butonuna basınca mevcut iş emri bilgileriyle formu aç
  const handleEditClick = () => {
    setEditFormData({
      description: workOrder.description,
      plant: workOrder.Plant?.name || "",
      type: workOrder.type,
      priority: workOrder.priority,
      status: workOrder.status,
    });
    setEditModalOpen(true);
  };

  // Modalda form değişikliklerini yönet
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
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
      await updateWorkOrder(workOrder.id, editFormData);
      setEditModalOpen(false);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "İş emri güncellendi.",
          icon: "✅",
        },
      ]);
      getWorkOrder(id).then((res) => setWorkOrder(res.data));
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "İş emri güncellenemedi.",
          icon: "❌",
        },
      ]);
    }
  };

  const handleCancel = () => setShowConfirm(false);
  const handleRemoveNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleActivityFilterChange = (key, value) => {
    setActivityFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleActivitySort = (key) => {
    let direction = "ascending";
    if (
      activitySortConfig.key === key &&
      activitySortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setActivitySortConfig({ key, direction });
  };

  const getSortedActivities = (activities) => {
    if (!activitySortConfig.key) return activities;

    return [...activities].sort((a, b) => {
      if (a[activitySortConfig.key] < b[activitySortConfig.key]) {
        return activitySortConfig.direction === "ascending" ? -1 : 1;
      }
      if (a[activitySortConfig.key] > b[activitySortConfig.key]) {
        return activitySortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  };

  const renderActivitySortIcon = (key) => {
    if (activitySortConfig.key !== key) {
      return "↑↓";
    }
    return activitySortConfig.direction === "ascending" ? "↑" : "↓";
  };

  const filteredActivities =
    workOrder?.Activities?.filter((activity) => {
      return (
        (!activityFilters.date ||
          new Date(activity.created_at)
            .toLocaleDateString("tr-TR")
            .includes(activityFilters.date)) &&
        (!activityFilters.description ||
          activity.description
            .toLowerCase()
            .includes(activityFilters.description.toLowerCase())) &&
        (!activityFilters.user ||
          activity.User?.username
            .toLowerCase()
            .includes(activityFilters.user.toLowerCase()))
      );
    }) || [];

  const sortedActivities = getSortedActivities(filteredActivities);

  const handleActivityClick = (activityId) => {
    navigate(`/activities/${activityId}`);
  };

  // PDF önizleme fonksiyonu (yeni sekmede aç)
  const handlePreviewPDF = async () => {
    try {
      const res = await getWorkOrder(workOrder.id);
      const fullWO = res.data;
      const blob = await getWorkOrderPDFBlob(fullWO, fullWO.Activities || []);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      alert("PDF hazırlanırken hata oluştu.");
    }
  };

  // PDF indirme fonksiyonu
  const handleDownloadPDF = async () => {
    try {
      const res = await getWorkOrder(workOrder.id);
      const fullWO = res.data;
      const blob = await getWorkOrderPDFBlob(fullWO, fullWO.Activities || []);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `is-emri-raporu-${workOrder.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("PDF hazırlanırken hata oluştu.");
    }
  };

  // Dosya yolları için
  const getFileUrl = (filePath) => `${API_BASE_URL}/${filePath}`;

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: 32 }}>Yükleniyor...</div>
    );
  if (error)
    return (
      <div style={{ textAlign: "center", color: "#ef4444" }}>Hata: {error}</div>
    );
  if (!workOrder)
    return (
      <div style={{ textAlign: "center", color: "#ef4444" }}>
        İş emri bulunamadı
      </div>
    );

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
          title="İş Emri Güncellensin mi?"
          description="Yaptığınız değişiklikler kaydedilecek. Onaylıyor musunuz?"
        />
      </div>
      <NotificationStack
        notifications={notifications}
        onRemove={handleRemoveNotification}
        style={{ zIndex: 9999, position: "fixed", top: 0, right: 0 }}
      />
      {/* Düzenle Modalı */}
      {editModalOpen && (
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
              setEditModalOpen(false);
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
              maxWidth: "600px",
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
              onClick={() => setEditModalOpen(false)}
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
              İş Emrini Düzenle
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
                  Açıklama
                  <textarea
                    name="description"
                    value={editFormData?.description || ""}
                    onChange={handleEditFormChange}
                    required
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                      minHeight: 60,
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Santral
                  <input
                    type="text"
                    name="plant"
                    value={editFormData?.plant || ""}
                    readOnly
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-background)",
                      color: "var(--input-text)",
                      opacity: 0.7,
                    }}
                  />
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Tür
                  <select
                    name="type"
                    value={editFormData?.type || ""}
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
                    {workOrderTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Öncelik
                  <select
                    name="priority"
                    value={editFormData?.priority || "LOW"}
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
                    {priorityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ color: "var(--form-label)" }}>
                  Durum
                  <select
                    name="status"
                    value={editFormData?.status || "PENDING"}
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
                    onClick={() => setEditModalOpen(false)}
                    style={{
                      padding: "0.5rem 1.5rem",
                      borderRadius: 6,
                      border: "none",
                      background: "var(--button-secondary)",
                      color: "var(--button-text)",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "opacity 0.2s",
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
      <div className={styles.header}>
        <button
          onClick={() => navigate("/work-orders")}
          className={styles.backButton}
        >
          ← Geri
        </button>
        <h1 className={styles.title}>İş Emri #{getShortId(workOrder.id)}</h1>
        <span
          onClick={handleEditClick}
          title="İş Emrini Düzenle"
          style={{
            fontSize: 22,
            color: "var(--text-color)",
            marginLeft: 12,
            cursor: "pointer",
          }}
        >
          🛠️
        </span>
        <span style={{ marginLeft: 16 }}>
          <PDFReviewIcon onClick={handlePreviewPDF} />
        </span>
        <span style={{ marginLeft: 4 }}>
          <PDFDownloadIcon onClick={handleDownloadPDF} />
        </span>
      </div>

      <div className={styles.workOrderCard}>
        <div className={styles.details}>
          <div className={styles.detailGroup}>
            <label>İş Emri Türü</label>
            <p>{translateWorkOrderField("type", workOrder.type)}</p>
          </div>
          <div className={styles.detailGroup}>
            <label>İş Emri Açıklaması</label>
            <p>{workOrder.description}</p>
          </div>
          <div className={styles.detailGroup}>
            <label>Santral</label>
            <p>{workOrder.Plant?.name}</p>
          </div>
          <div className={styles.detailGroup}>
            <label>Oluşturulma Tarihi</label>
            <p>{new Date(workOrder.createdAt).toLocaleDateString("tr-TR")}</p>
          </div>
          <div className={styles.detailGroup}>
            <label>Öncelik</label>
            <p className={styles[`priority${workOrder.priority}`]}>
              {translateWorkOrderField("priority", workOrder.priority)}
            </p>
          </div>
          <div className={styles.detailGroup}>
            <label>Durum</label>
            <p className={styles[`status${workOrder.status}`]}>
              {translateWorkOrderField("status", workOrder.status)}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.activitiesSection}>
        <div className={styles.activitiesHeader}>
          <h2 className={styles.sectionTitle}>Aktiviteler</h2>
          <button
            onClick={() =>
              navigate(`/activities/create?workOrderId=${workOrder.id}`)
            }
            className={stylesTable.createButton}
          >
            <span className={stylesTable.icon}>➕</span>
            Aktivite Ekle
          </button>
        </div>
        <div className={stylesTable.tableWrapper}>
          <table className={stylesTable.table}>
            <thead>
              <tr>
                <th>
                  <div className={stylesTable.columnHeader}>
                    <span>Tarih</span>
                    <span
                      onClick={() => handleActivitySort("created_at")}
                      className={stylesTable.sortIcon}
                    >
                      {renderActivitySortIcon("created_at")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={activityFilters.date}
                    onChange={(e) =>
                      handleActivityFilterChange("date", e.target.value)
                    }
                    className={stylesTable.filterInput}
                  />
                </th>
                <th>
                  <div className={stylesTable.columnHeader}>
                    <span>Aktivite</span>
                    <span
                      onClick={() => handleActivitySort("description")}
                      className={stylesTable.sortIcon}
                    >
                      {renderActivitySortIcon("description")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={activityFilters.description}
                    onChange={(e) =>
                      handleActivityFilterChange("description", e.target.value)
                    }
                    className={stylesTable.filterInput}
                  />
                </th>
                <th>
                  <div className={stylesTable.columnHeader}>
                    <span>Kullanıcı</span>
                    <span
                      onClick={() => handleActivitySort("User.username")}
                      className={stylesTable.sortIcon}
                    >
                      {renderActivitySortIcon("User.username")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={activityFilters.user}
                    onChange={(e) =>
                      handleActivityFilterChange("user", e.target.value)
                    }
                    className={stylesTable.filterInput}
                  />
                </th>
                <th>Dosyalar</th>
              </tr>
            </thead>
            <tbody>
              {sortedActivities.length > 0 ? (
                sortedActivities.map((activity) => (
                  <tr
                    key={activity.id}
                    className={stylesTable.tableRow}
                    onClick={() => handleActivityClick(activity.id)}
                  >
                    <td>
                      {new Date(activity.created_at).toLocaleDateString(
                        "tr-TR"
                      )}
                    </td>
                    <td>
                      <span className={stylesTable.clickableText}>
                        {activity.description}
                      </span>
                    </td>
                    <td>{activity.User?.username}</td>
                    <td>
                      <div className={styles.photoList}>
                        {activity.ActivityAttachments?.slice(0, 3).map(
                          (attachment) => {
                            const isImage = attachment.file_name.match(
                              /\.(jpg|jpeg|png|gif|webp)$/i
                            );
                            return (
                              <div
                                key={attachment.id}
                                className={styles.attachmentPreview}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isImage ? (
                                  <div className={styles.imagePreview}>
                                    <img
                                      src={getFileUrl(attachment.file_path)}
                                      alt={attachment.file_name}
                                      className={styles.previewImage}
                                    />
                                  </div>
                                ) : (
                                  <a
                                    href={getFileUrl(attachment.file_path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.fileLink}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    📎 {attachment.file_name}
                                  </a>
                                )}
                              </div>
                            );
                          }
                        )}
                        {activity.ActivityAttachments?.length > 3 && (
                          <span className={styles.morePhotos}>
                            +{activity.ActivityAttachments.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className={stylesTable.noData}>
                    Henüz aktivite kaydı bulunmuyor
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderDetail;
