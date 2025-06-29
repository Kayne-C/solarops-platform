import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import styles from "./CreateActivity.module.css";
import { getWorkOrders } from "../WorkOrder/workOrderApi";
import { createActivity } from "./activityApi";
import NotificationStack from "../../components/layout/NotificationStack/NotificationStack";

const CreateActivity = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [formData, setFormData] = useState({
    work_order_id: "",
    description: "",
    files: [],
  });
  const [isDragging, setIsDragging] = useState(false);

  // URL'den workOrderId parametresini al
  const queryParams = new URLSearchParams(location.search);
  const workOrderId = queryParams.get("workOrderId");

  useEffect(() => {
    setLoading(true);
    getWorkOrders()
      .then((res) => {
        setWorkOrders(res.data);
        // Eğer URL'de workOrderId varsa, form verilerini güncelle
        if (workOrderId) {
          setFormData((prev) => ({ ...prev, work_order_id: workOrderId }));
        }
      })
      .catch(() => setError("İş emirleri alınamadı"))
      .finally(() => setLoading(false));
  }, [workOrderId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, ...files],
    }));
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, ...files],
    }));
  };

  const removeFile = (index) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createActivity({
        ...formData,
        user_id: user.id,
      });
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Aktivite başarıyla oluşturuldu.",
          icon: "✅",
        },
      ]);
      setTimeout(() => navigate("/activities"), 1200);
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Aktivite oluşturulamadı.",
          icon: "❌",
        },
      ]);
    }
  };

  const handleRemoveNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: 32 }}>Yükleniyor...</div>
    );
  if (error)
    return (
      <div style={{ textAlign: "center", color: "#ef4444" }}>Hata: {error}</div>
    );

  return (
    <div className={styles.container}>
      <NotificationStack
        notifications={notifications}
        onRemove={handleRemoveNotification}
        style={{ zIndex: 9999, position: "fixed", top: 0, right: 0 }}
      />
      <div className={styles.header}>
        <h1 className={styles.title}>Yeni Aktivite Oluştur</h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="work_order_id">İş Emri</label>
          <select
            id="work_order_id"
            name="work_order_id"
            value={formData.work_order_id}
            onChange={handleInputChange}
            required
            disabled={!!workOrderId}
          >
            <option value="">İş Emri Seçin</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                {wo.Plant?.name} - #{wo.id.slice(-4)} -{" "}
                {wo.description?.slice(0, 50)}...
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Aktivite Açıklaması</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            className={styles.textarea}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Dosyalar</label>
          <div
            className={`${styles.dropzone} ${
              isDragging ? styles.dragging : ""
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className={styles.fileInput}
              id="fileInput"
            />
            <label htmlFor="fileInput" className={styles.dropzoneLabel}>
              <span className={styles.icon}>📁</span>
              <span>Dosyaları sürükleyin veya seçin</span>
            </label>
          </div>

          {formData.files.length > 0 && (
            <div className={styles.fileList}>
              {formData.files.map((file, index) => (
                <div key={index} className={styles.fileItem}>
                  <span className={styles.fileName}>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className={styles.removeFile}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className={styles.submitButton}>
          Aktivite Oluştur
        </button>
      </form>
    </div>
  );
};

export default CreateActivity;
