import React, { useState } from "react";
import ConfirmModal from "../../components/layout/ConfirmModal/ConfirmModal";
import styles from "./UserCreateModal.module.css";

const UserCreateModal = ({ open, onClose, onSave }) => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    role: "USER",
    password: "",
  });
  const [showConfirm, setShowConfirm] = useState(false);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
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
            Yeni Kullanıcı Oluştur
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
            Kullanıcı Adı
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Email
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              required
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
            Rol
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              required
              className={styles.input}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <label className={styles.label}>
            Şifre
            <input
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              type="password"
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
              Oluştur
            </button>
          </div>
        </form>
        <ConfirmModal
          open={showConfirm}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          title="Yeni Kullanıcı Oluşturulsun mu?"
          description="Yeni kullanıcı bilgileri kaydedilecek. Onaylıyor musunuz?"
        />
      </div>
    </div>
  );
};

export default UserCreateModal;
