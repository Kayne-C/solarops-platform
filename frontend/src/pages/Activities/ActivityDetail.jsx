import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import styles from "./ActivityDetail.module.css";
import { getActivity } from "./activityApi";
import NotificationStack from "../../components/layout/NotificationStack/NotificationStack";
import API_BASE_URL from "../../config/api";

const ActivityDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Dosya yolları için
  const getFileUrl = (filePath) => `${API_BASE_URL}/${filePath}`;

  useEffect(() => {
    setLoading(true);
    getActivity(id)
      .then((res) => setActivity(res.data))
      .catch(() => setError("Aktivite alınamadı"))
      .finally(() => setLoading(false));
  }, [id]);

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
  if (!activity)
    return (
      <div style={{ textAlign: "center", color: "#ef4444" }}>
        Aktivite bulunamadı
      </div>
    );

  return (
    <div className={styles.container}>
      <NotificationStack
        notifications={notifications}
        onRemove={handleRemoveNotification}
      />
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          ← Geri
        </button>
        <h1 className={styles.title}>
          {activity.WorkOrder?.Plant?.name} - #
          {activity.WorkOrder?.id.slice(-4)} Aktivite Detayı
        </h1>
      </div>

      <div className={styles.activityCard}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Açıklama</h2>
          <p className={styles.description}>{activity.description}</p>
        </div>

        <div className={styles.metaSection}>
          <div className={styles.metaItem}>
            <h2 className={styles.sectionTitle}>Oluşturan</h2>
            <p className={styles.metaText}>{activity.User?.username}</p>
          </div>
          <div className={styles.metaItem}>
            <h2 className={styles.sectionTitle}>Oluşturulma Tarihi</h2>
            <p className={styles.metaText}>
              {new Date(activity.created_at).toLocaleString("tr-TR")}
            </p>
          </div>
        </div>

        {activity.ActivityAttachments &&
          activity.ActivityAttachments.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Ekler</h2>
              <div className={styles.attachmentsGrid}>
                {activity.ActivityAttachments.map((attachment) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(
                    attachment.file_path
                  );
                  return (
                    <div key={attachment.id} className={styles.attachmentItem}>
                      {isImage ? (
                        <a
                          href={getFileUrl(attachment.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.imageLink}
                        >
                          <img
                            src={getFileUrl(attachment.file_path)}
                            alt="Aktivite görseli"
                            className={styles.attachmentImage}
                          />
                        </a>
                      ) : (
                        <a
                          href={getFileUrl(attachment.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fileLink}
                        >
                          📎 {attachment.file_path.split("/").pop()}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default ActivityDetail;
