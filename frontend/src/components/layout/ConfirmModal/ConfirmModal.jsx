import React, { useEffect, useRef, useState } from "react";
import styles from "./ConfirmModal.module.css";

const ConfirmModal = ({ open, onConfirm, onCancel, title, description }) => {
  const modalRef = useRef(null);
  const [visible, setVisible] = useState(open);
  const [exiting, setExiting] = useState(false);

  // Escape ile kapama
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  // Dışarı tıklama ile kapama
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onCancel]);

  // Açılış ve çıkış animasyonu yönetimi
  useEffect(() => {
    if (open) {
      setVisible(true);
      setExiting(false);
    } else if (visible) {
      setExiting(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 300); // animasyon süresi
      return () => clearTimeout(timeout);
    }
  }, [open]);

  if (!visible) return null;

  return (
    <div className={styles.overlay + (exiting ? " " + styles.exit : "")}>
      <div
        className={styles.modal + (exiting ? " " + styles.exit : "")}
        ref={modalRef}
      >
        <button className={styles.close} onClick={onCancel} aria-label="Kapat">
          ×
        </button>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        <div className={styles.buttonGroup}>
          <button onClick={onCancel} className={styles.cancelButton}>
            İptal
          </button>
          <button onClick={onConfirm} className={styles.confirmButton}>
            Onayla
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
