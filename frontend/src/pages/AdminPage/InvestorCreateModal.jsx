import React, { useState } from "react";
import styles from "./InvestorCreateModal.module.css";

const InvestorCreateModal = ({ open, onClose, onSave }) => {
  const [form, setForm] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
  });

  if (!open) return null;

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
            Yeni Yatırımcı
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
            Şirket Adı
            <input
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Yetkili
            <input
              name="contact_person"
              value={form.contact_person}
              onChange={handleChange}
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Email
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              type="email"
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Telefon
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Adres
            <input
              name="address"
              value={form.address}
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

export default InvestorCreateModal;
