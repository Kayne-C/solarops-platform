import React, { useState, useEffect } from "react";
import styles from "./FieldEditModal.module.css";

const FieldEditModal = ({ open, field, onClose, onSave }) => {
  const [form, setForm] = useState(field || {});

  useEffect(() => {
    setForm(field || {});
  }, [field]);

  if (!open || !field) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: "24px",
            position: "relative",
          }}
        >
          <h2
            className={styles.title}
            style={{ margin: 0, textAlign: "center" }}
          >
            Sahayı Düzenle
          </h2>
          <span
            style={{
              position: "absolute",
              top: "-8px",
              right: "0px",
              fontSize: "24px",
              cursor: "pointer",
              color: "var(--text-color)",
              userSelect: "none",
            }}
            onClick={onClose}
          >
            ×
          </span>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Saha Adı
            <input
              name="name"
              value={form.name || ""}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Konum
            <input
              name="location"
              value={form.location || ""}
              onChange={handleChange}
              className={styles.input}
            />
          </label>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
            >
              İptal
            </button>
            <button type="submit" className={styles.submitButton}>
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FieldEditModal;
