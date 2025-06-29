import React, { useState, useEffect } from "react";
import { AuthContext } from "../../../context/AuthContext";
import styles from "./ConsoleModal.module.css";

const ConsoleModal = ({ isActive, timeLeft, lastActivity, isWarning }) => {
  const { user } = React.useContext(AuthContext);
  const [logs, setLogs] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (lastActivity) {
      const timestamp = Date.now();
      setLogs((prev) =>
        [
          {
            id: `activity-${timestamp}`,
            message: `Son aktivite: ${lastActivity}`,
            type: "info",
          },
          ...prev,
        ].slice(0, 10)
      );
    }
  }, [lastActivity]);

  useEffect(() => {
    if (isWarning) {
      const timestamp = Date.now();
      setLogs((prev) =>
        [
          {
            id: `warning-${timestamp}`,
            message: "⚠️ Oturum sonlandırılacak!",
            type: "warning",
          },
          ...prev,
        ].slice(0, 10)
      );
    }
  }, [isWarning]);

  // timeLeft milisaniye cinsinden, saniyeye çeviriyoruz
  const timeLeftInSeconds = Math.ceil(timeLeft / 1000);

  if (!isActive) return null;

  return (
    <div className={styles.consoleModal}>
      <div className={styles.header}>
        <div className={styles.title}>Sistem Konsolu</div>
        <div className={styles.timer}>
          {timeLeftInSeconds > 0
            ? `${timeLeftInSeconds} saniye`
            : "Oturum sonlandırılıyor..."}
        </div>
      </div>
      <div className={styles.info}>
        <div className={styles.infoItem}>
          <span className={styles.label}>Kullanıcı:</span>
          <span className={styles.value}>{user?.username || "Misafir"}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.label}>Rol:</span>
          <span className={styles.value}>{user?.role || "Belirsiz"}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.label}>Saat:</span>
          <span className={styles.value}>
            {currentTime.toLocaleTimeString("tr-TR")}
          </span>
        </div>
      </div>
      <div className={styles.logs}>
        {logs.map((log) => (
          <div
            key={log.id}
            className={`${styles.log} ${
              log.type === "warning" ? styles.warning : ""
            }`}
          >
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsoleModal;
