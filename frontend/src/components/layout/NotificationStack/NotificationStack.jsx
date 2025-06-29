import React, { useEffect, useRef, useState } from "react";
import styles from "./NotificationStack.module.css";

const DURATION = 4000;

const NotificationStack = ({ notifications, onRemove }) => {
  // Her bildirim için kalan süreyi ve çıkış animasyonunu yönet
  const [leaving, setLeaving] = useState({}); // {id: true/false}
  const [progress, setProgress] = useState({}); // {id: yüzde}
  const timers = useRef({});
  const intervals = useRef({});

  useEffect(() => {
    notifications.forEach((n) => {
      if (!timers.current[n.id]) {
        // Progress bar için interval
        intervals.current[n.id] = setInterval(() => {
          setProgress((prev) => ({
            ...prev,
            [n.id]: (prev[n.id] || 0) + 100 / (DURATION / 50),
          }));
        }, 50);
        // Otomatik kapama
        timers.current[n.id] = setTimeout(() => {
          setLeaving((prev) => ({ ...prev, [n.id]: true }));
          setTimeout(() => {
            onRemove(n.id);
            clearInterval(intervals.current[n.id]);
            delete timers.current[n.id];
            delete intervals.current[n.id];
            setProgress((prev) => {
              const copy = { ...prev };
              delete copy[n.id];
              return copy;
            });
            setLeaving((prev) => {
              const copy = { ...prev };
              delete copy[n.id];
              return copy;
            });
          }, 400); // çıkış animasyonu süresi
        }, DURATION);
      }
    });
    // Temizlik: sadece component unmount'ta tümünü temizle
    return () => {
      if (notifications.length === 0) {
        Object.values(timers.current).forEach(clearTimeout);
        Object.values(intervals.current).forEach(clearInterval);
      }
    };
    // eslint-disable-next-line
  }, [notifications, onRemove]);

  const handleRemove = (id) => {
    setLeaving((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      onRemove(id);
      clearInterval(intervals.current[id]);
      delete timers.current[id];
      delete intervals.current[id];
      setProgress((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setLeaving((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 400);
  };

  return (
    <div className={styles.stack}>
      {notifications.map((n, i) => (
        <div
          key={n.id}
          className={styles.toast + (leaving[n.id] ? " " + styles.exit : "")}
          style={{
            animationDelay: `${i * 0.1}s`,
            zIndex: 1000 + i,
          }}
        >
          <div className={styles.icon}>{n.icon}</div>
          <div className={styles.content}>
            <div className={styles.title}>{n.title}</div>
            <div className={styles.message}>{n.message}</div>
            <div className={styles.progressBarWrap}>
              <div
                className={styles.progressBar}
                style={{ width: `${100 - (progress[n.id] || 0)}%` }}
              />
            </div>
          </div>
          <span
            className={styles.close}
            onClick={() => handleRemove(n.id)}
            aria-label="Kapat"
          >
            ×
          </span>
        </div>
      ))}
    </div>
  );
};

export default NotificationStack;
