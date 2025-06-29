import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import ConfirmModal from "../../components/layout/ConfirmModal/ConfirmModal";
import NotificationStack from "../../components/layout/NotificationStack/NotificationStack";
import UserEditModal from "./UserEditModal";
import UserCreateModal from "./UserCreateModal";
import InvestorCreateModal from "./InvestorCreateModal";
import InvestorEditModal from "./InvestorEditModal";
import FieldCreateModal from "./FieldCreateModal";
import FieldEditModal from "./FieldEditModal";
import styles from "./AdminPage.module.css";
import {
  getInvestors,
  createInvestor,
  updateInvestor,
  deleteInvestor,
} from "../Plant/investorApi";
import {
  getFields,
  createField,
  updateField,
  deleteField,
} from "../Plant/fieldApi";
import LoadingScreen from "../../components/layout/LoadingScreen/LoadingScreen";
import { getUsers } from "./adminApi";

const initialForm = {
  username: "",
  email: "",
  password: "",
  role: "USER",
  phone: "",
};

const initialInvestorForm = {
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
};

const initialFieldForm = {
  name: "",
  location: "",
};

const AdminPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState({
    username: "",
    email: "",
    phone: "",
    role: "",
  });
  const [editUser, setEditUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("users");

  // Yatırımcılar için state
  const [investors, setInvestors] = useState([]);
  const [investorForm, setInvestorForm] = useState(initialInvestorForm);
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const [investorLoading, setInvestorLoading] = useState(false);

  // Sahalar için state
  const [fields, setFields] = useState([]);
  const [fieldForm, setFieldForm] = useState(initialFieldForm);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [fieldLoading, setFieldLoading] = useState(false);

  // Yatırımcılar için ek state
  const [editInvestor, setEditInvestor] = useState(null);
  const [showEditInvestorModal, setShowEditInvestorModal] = useState(false);
  const [deleteInvestorObj, setDeleteInvestorObj] = useState(null);
  const [showDeleteInvestorModal, setShowDeleteInvestorModal] = useState(false);

  // Sahalar için ek state
  const [editField, setEditField] = useState(null);
  const [showEditFieldModal, setShowEditFieldModal] = useState(false);
  const [deleteFieldObj, setDeleteFieldObj] = useState(null);
  const [showDeleteFieldModal, setShowDeleteFieldModal] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Sekme değiştiğinde ilgili verileri getir
  useEffect(() => {
    // Önce tüm loading state'lerini false yap
    setLoading(false);
    setInvestorLoading(false);
    setFieldLoading(false);

    // Sonra aktif sekmeye göre ilgili loading state'ini true yap ve veriyi çek
    if (activeTab === "users") {
      setLoading(true);
      fetchUsers();
    } else if (activeTab === "investors") {
      setInvestorLoading(true);
      fetchInvestors();
    } else if (activeTab === "fields") {
      setFieldLoading(true);
      fetchFields();
    }
  }, [activeTab]);

  // Kullanıcıları getir
  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Kullanıcılar alınamadı");
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Kullanıcılar alınamadı",
          icon: "❌",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Yatırımcıları getir
  const fetchInvestors = async () => {
    try {
      const res = await getInvestors();
      setInvestors(res.data);
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Yatırımcılar alınamadı",
          icon: "❌",
        },
      ]);
    } finally {
      setInvestorLoading(false);
    }
  };

  // Sahaları getir
  const fetchFields = async () => {
    try {
      const res = await getFields();
      setFields(res.data);
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Sahalar alınamadı",
          icon: "❌",
        },
      ]);
    } finally {
      setFieldLoading(false);
    }
  };

  // Kullanıcı ekle (modal ile)
  const handleCreateUser = async (newUser) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (res.ok) {
        setNotifications((prev) => [
          ...prev,
          {
            id: Date.now(),
            title: "Başarılı",
            message: "Kullanıcı eklendi",
            icon: "✅",
          },
        ]);
        fetchUsers();
      } else {
        setNotifications((prev) => [
          ...prev,
          { id: Date.now(), title: "Hata", message: data.message, icon: "❌" },
        ]);
      }
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Kullanıcı eklenemedi",
          icon: "❌",
        },
      ]);
    }
    setLoading(false);
    setShowCreateModal(false);
  };

  // Kullanıcıyı sil
  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3000/api/users/${deleteUser.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        setNotifications((prev) => [
          ...prev,
          {
            id: Date.now(),
            title: "Başarılı",
            message: "Kullanıcı silindi",
            icon: "✅",
          },
        ]);
        fetchUsers();
      } else {
        const data = await res.json();
        setNotifications((prev) => [
          ...prev,
          { id: Date.now(), title: "Hata", message: data.message, icon: "❌" },
        ]);
      }
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Kullanıcı silinemedi",
          icon: "❌",
        },
      ]);
    }
    setLoading(false);
    setShowDeleteModal(false);
    setDeleteUser(null);
  };

  // Kullanıcıyı düzenle
  const handleEdit = (user) => {
    setEditUser(user);
    setShowEditModal(true);
  };

  const handleEditSave = async (updatedUser) => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3000/api/users/${updatedUser.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedUser),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setNotifications((prev) => [
          ...prev,
          {
            id: Date.now(),
            title: "Başarılı",
            message: "Kullanıcı güncellendi",
            icon: "✅",
          },
        ]);
        fetchUsers();
      } else {
        setNotifications((prev) => [
          ...prev,
          { id: Date.now(), title: "Hata", message: data.message, icon: "❌" },
        ]);
      }
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Kullanıcı güncellenemedi",
          icon: "❌",
        },
      ]);
    }
    setLoading(false);
    setShowEditModal(false);
    setEditUser(null);
  };

  // Filtreli kullanıcılar
  const filteredUsers = users.filter(
    (u) =>
      (!filter.username ||
        u.username?.toLowerCase().includes(filter.username.toLowerCase())) &&
      (!filter.email ||
        u.email?.toLowerCase().includes(filter.email.toLowerCase())) &&
      (!filter.phone ||
        u.phone?.toLowerCase().includes(filter.phone.toLowerCase())) &&
      (!filter.role ||
        u.role?.toLowerCase().includes(filter.role.toLowerCase()))
  );

  // Yatırımcı ekle
  const handleCreateInvestor = async (e) => {
    e.preventDefault();
    setInvestorLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(investorForm),
      });
      const data = await res.json();
      if (res.ok) {
        setNotifications((prev) => [
          ...prev,
          {
            id: Date.now(),
            title: "Başarılı",
            message: "Yatırımcı eklendi",
            icon: "✅",
          },
        ]);
        setShowInvestorModal(false);
        setInvestorForm(initialInvestorForm);
        fetchInvestors();
      } else {
        setNotifications((prev) => [
          ...prev,
          { id: Date.now(), title: "Hata", message: data.message, icon: "❌" },
        ]);
      }
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Yatırımcı eklenemedi",
          icon: "❌",
        },
      ]);
    }
    setInvestorLoading(false);
  };

  // Saha ekle
  const handleCreateField = async (e) => {
    e.preventDefault();
    setFieldLoading(true);
    try {
      await createField(fieldForm);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Saha eklendi",
          icon: "✅",
        },
      ]);
      setShowFieldModal(false);
      setFieldForm(initialFieldForm);
      fetchFields();
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: err.response?.data?.message || "Saha eklenemedi",
          icon: "❌",
        },
      ]);
    }
    setFieldLoading(false);
  };

  // Yatırımcıyı güncelle
  const handleEditInvestorSave = async (updatedInvestor) => {
    try {
      await updateInvestor(updatedInvestor.id, updatedInvestor);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Yatırımcı güncellendi",
          icon: "✅",
        },
      ]);
      fetchInvestors();
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Yatırımcı güncellenemedi",
          icon: "❌",
        },
      ]);
    }
    setShowEditInvestorModal(false);
    setEditInvestor(null);
  };

  // Yatırımcıyı sil
  const handleDeleteInvestor = async () => {
    try {
      await deleteInvestor(deleteInvestorObj.id);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Yatırımcı silindi",
          icon: "✅",
        },
      ]);
      fetchInvestors();
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Yatırımcı silinemedi",
          icon: "❌",
        },
      ]);
    }
    setShowDeleteInvestorModal(false);
    setDeleteInvestorObj(null);
  };

  // Sahayı güncelle
  const handleEditFieldSave = async (updatedField) => {
    try {
      await updateField(updatedField.id, updatedField);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Saha güncellendi",
          icon: "✅",
        },
      ]);
      fetchFields();
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Saha güncellenemedi",
          icon: "❌",
        },
      ]);
    }
    setShowEditFieldModal(false);
    setEditField(null);
  };

  // Sahayı sil
  const handleDeleteField = async () => {
    try {
      await deleteField(deleteFieldObj.id);
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Başarılı",
          message: "Saha silindi",
          icon: "✅",
        },
      ]);
      fetchFields();
    } catch (err) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: "Hata",
          message: "Saha silinemedi",
          icon: "❌",
        },
      ]);
    }
    setShowDeleteFieldModal(false);
    setDeleteFieldObj(null);
  };

  if (error) {
    return (
      <div style={{ textAlign: "center", color: "#ef4444" }}>Hata: {error}</div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Sekmeler */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === "users" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("users")}
        >
          Kullanıcılar
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "investors" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("investors")}
        >
          Yatırımcılar
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "fields" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("fields")}
        >
          Sahalar
        </button>
      </div>

      {/* Kullanıcılar sekmesi */}
      {activeTab === "users" && (
        <div>
          <div className={styles.headerContainer}>
            <h1 className={styles.title}>Admin Paneli</h1>
            <button
              className={`${styles.form} ${styles.actionBtn} ${styles.createButton}`}
              onClick={() => setShowCreateModal(true)}
            >
              + Yeni Kullanıcı Oluştur
            </button>
          </div>
          {loading ? (
            <div className={styles.tableWrapper}>
              <LoadingScreen />
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", color: "#ef4444" }}>
              Hata: {error}
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>
                      Kullanıcı Adı
                      <input
                        type="text"
                        className={styles.filterInput}
                        placeholder="Filtrele..."
                        value={filter.username}
                        onChange={(e) =>
                          setFilter((prev) => ({
                            ...prev,
                            username: e.target.value,
                          }))
                        }
                      />
                    </th>
                    <th>
                      Email
                      <input
                        type="text"
                        className={styles.filterInput}
                        placeholder="Filtrele..."
                        value={filter.email}
                        onChange={(e) =>
                          setFilter((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                      />
                    </th>
                    <th>
                      Telefon
                      <input
                        type="text"
                        className={styles.filterInput}
                        placeholder="Filtrele..."
                        value={filter.phone}
                        onChange={(e) =>
                          setFilter((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                      />
                    </th>
                    <th>
                      Rol
                      <input
                        type="text"
                        className={styles.filterInput}
                        placeholder="Filtrele..."
                        value={filter.role}
                        onChange={(e) =>
                          setFilter((prev) => ({
                            ...prev,
                            role: e.target.value,
                          }))
                        }
                      />
                    </th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{user.phone}</td>
                      <td>{user.role}</td>
                      <td>
                        <button
                          onClick={() => handleEdit(user)}
                          title="Düzenle"
                          className={`${styles.actionBtn} ${styles.edit}`}
                        >
                          📝
                        </button>
                        <button
                          onClick={() => {
                            setDeleteUser(user);
                            setShowDeleteModal(true);
                          }}
                          title="Sil"
                          className={`${styles.actionBtn} ${styles.delete}`}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <UserCreateModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSave={handleCreateUser}
          />
          <UserEditModal
            open={showEditModal}
            user={editUser}
            onClose={() => {
              setShowEditModal(false);
              setEditUser(null);
            }}
            onSave={handleEditSave}
          />
          <ConfirmModal
            open={showDeleteModal}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteModal(false)}
            title="Kullanıcı Silinsin mi?"
            description="Bu kullanıcıyı silmek istediğinize emin misiniz?"
          />
        </div>
      )}

      {/* Yatırımcılar sekmesi */}
      {activeTab === "investors" && (
        <div>
          <div className={styles.headerContainer}>
            <h2 className={styles.title}>Yatırımcılar</h2>
            <button
              className={`${styles.form} ${styles.actionBtn} ${styles.createButton}`}
              onClick={() => setShowInvestorModal(true)}
            >
              + Yeni Yatırımcı
            </button>
          </div>
          {investorLoading ? (
            <div className={styles.tableWrapper}>
              <LoadingScreen />
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Şirket Adı</th>
                    <th>Yetkili</th>
                    <th>Email</th>
                    <th>Telefon</th>
                    <th>Adres</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {investors.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.company_name}</td>
                      <td>{inv.contact_person}</td>
                      <td>{inv.email}</td>
                      <td>{inv.phone}</td>
                      <td>{inv.address}</td>
                      <td>
                        <button
                          onClick={() => {
                            setEditInvestor(inv);
                            setShowEditInvestorModal(true);
                          }}
                          title="Düzenle"
                          className={`${styles.actionBtn} ${styles.edit}`}
                        >
                          📝
                        </button>
                        <button
                          onClick={() => {
                            setDeleteInvestorObj(inv);
                            setShowDeleteInvestorModal(true);
                          }}
                          title="Sil"
                          className={`${styles.actionBtn} ${styles.delete}`}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Yatırımcı ekleme modalı */}
          <InvestorCreateModal
            open={showInvestorModal}
            onClose={() => setShowInvestorModal(false)}
            onSave={handleCreateInvestor}
          />
          {/* Yatırımcı düzenle modalı */}
          <InvestorEditModal
            open={showEditInvestorModal}
            investor={editInvestor}
            onClose={() => setShowEditInvestorModal(false)}
            onSave={handleEditInvestorSave}
          />
          {/* Yatırımcı sil onay modalı */}
          {showDeleteInvestorModal && (
            <ConfirmModal
              open={showDeleteInvestorModal}
              onConfirm={handleDeleteInvestor}
              onCancel={() => setShowDeleteInvestorModal(false)}
              title="Yatırımcı Silinsin mi?"
              description="Bu yatırımcıyı silmek istediğinize emin misiniz?"
            />
          )}
        </div>
      )}

      {/* Sahalar sekmesi */}
      {activeTab === "fields" && (
        <div>
          <div className={styles.headerContainer}>
            <h2 className={styles.title}>Sahalar</h2>
            <button
              className={`${styles.form} ${styles.actionBtn} ${styles.createButton}`}
              onClick={() => setShowFieldModal(true)}
            >
              + Yeni Saha
            </button>
          </div>
          {fieldLoading ? (
            <div className={styles.tableWrapper}>
              <LoadingScreen />
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Saha Adı</th>
                    <th>Konum</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.id}>
                      <td>{field.name}</td>
                      <td>{field.location}</td>
                      <td>
                        <button
                          onClick={() => {
                            setEditField(field);
                            setShowEditFieldModal(true);
                          }}
                          title="Düzenle"
                          className={`${styles.actionBtn} ${styles.edit}`}
                        >
                          📝
                        </button>
                        <button
                          onClick={() => {
                            setDeleteFieldObj(field);
                            setShowDeleteFieldModal(true);
                          }}
                          title="Sil"
                          className={`${styles.actionBtn} ${styles.delete}`}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Saha ekleme modalı */}
          <FieldCreateModal
            open={showFieldModal}
            onClose={() => setShowFieldModal(false)}
            onSave={handleCreateField}
          />
          {/* Saha düzenle modalı */}
          {showEditFieldModal && (
            <div
              className={styles.modalOverlay}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowEditFieldModal(false);
                }
              }}
            >
              <div
                className={styles.modalContent}
                onClick={(e) => e.stopPropagation()}
              >
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
                    className={styles.modalTitle}
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
                    onClick={() => setShowEditFieldModal(false)}
                  >
                    ×
                  </span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEditFieldSave(editField);
                  }}
                  className={styles.modalForm}
                >
                  <label>
                    Saha Adı
                    <input
                      type="text"
                      name="name"
                      value={editField.name}
                      onChange={(e) =>
                        setEditField((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Konum
                    <input
                      type="text"
                      name="location"
                      value={editField.location || ""}
                      onChange={(e) =>
                        setEditField((f) => ({
                          ...f,
                          location: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className={styles.modalButtonGroup}>
                    <button
                      type="button"
                      onClick={() => setShowEditFieldModal(false)}
                      className={styles.modalButtonCancel}
                    >
                      İptal
                    </button>
                    <button type="submit" className={styles.modalButtonSubmit}>
                      Kaydet
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Saha sil onay modalı */}
          {showDeleteFieldModal && (
            <ConfirmModal
              open={showDeleteFieldModal}
              onConfirm={handleDeleteField}
              onCancel={() => setShowDeleteFieldModal(false)}
              title="Saha Silinsin mi?"
              description="Bu sahayı silmek istediğinize emin misiniz?"
            />
          )}
        </div>
      )}

      {/* Bildirimler */}
      <NotificationStack
        notifications={notifications}
        onRemove={(id) =>
          setNotifications((prev) => prev.filter((n) => n.id !== id))
        }
      />
    </div>
  );
};

export default AdminPage;
