import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import styles from "./CreateWorkOrder.module.css";
import { getFields } from "../Plant/fieldApi";
import { getPlants } from "../Plant/plantApi";
import { getUsers } from "./userApi";
import { createWorkOrder } from "./workOrderApi";

const statusOptions = [
  { value: "PENDING", label: "Oluşturuldu" },
  { value: "IN_PROGRESS", label: "Devam Ediyor" },
  { value: "COMPLETED", label: "Tamamlandı" },
  { value: "CANCELLED", label: "İptal Edildi" },
];

const priorityOptions = [
  { value: "LOW", label: "Düşük" },
  { value: "MEDIUM", label: "Orta" },
  { value: "HIGH", label: "Yüksek" },
  { value: "URGENT", label: "Acil" },
];

const CreateWorkOrder = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    description: "",
    fieldId: "",
    plantId: "",
    typeId: "",
    status: "PENDING",
    priority: "LOW",
    selectedPersonnel: [],
  });

  const [fields, setFields] = useState([]);
  const [plants, setPlants] = useState([]);
  const [users, setUsers] = useState([]);
  const [workOrderTypes, setWorkOrderTypes] = useState([
    { id: "MAINTENANCE", name: "Bakım" },
    { id: "FAULT", name: "Onarım" },
    { id: "INSPECTION", name: "Kontrol" },
    { id: "OTHER", name: "Diğer" },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!user) navigate("/login");
    getFields().then((res) => setFields(res.data));
    getPlants().then((res) => setPlants(res.data));
    getUsers().then((res) => setUsers(res.data));
  }, [user, navigate]);

  // Saha seçildiğinde santralleri filtrele
  useEffect(() => {
    if (formData.fieldId) {
      setPlants((prev) =>
        prev.filter((plant) => plant.field_id === formData.fieldId)
      );
    } else {
      getPlants().then((res) => setPlants(res.data));
    }
  }, [formData.fieldId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePersonnelSelect = (personnelId) => {
    setFormData((prev) => {
      const isSelected = prev.selectedPersonnel.includes(personnelId);
      return {
        ...prev,
        selectedPersonnel: isSelected
          ? prev.selectedPersonnel.filter((id) => id !== personnelId)
          : [...prev.selectedPersonnel, personnelId],
      };
    });
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Departman başlığı user.role olacak şekilde grupla
  const groupedPersonnel = users.reduce((acc, user) => {
    if (!acc[user.role]) acc[user.role] = [];
    acc[user.role].push(user);
    return acc;
  }, {});

  const filteredPersonnel = (personnelList) =>
    personnelList.filter((person) =>
      person.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      description: formData.description,
      plant_id: formData.plantId,
      type: formData.typeId,
      priority: formData.priority,
      status: formData.status,
      created_by: user.id,
      assignees: formData.selectedPersonnel,
    };
    console.log("API'ye gönderilecek veri:", payload);
    try {
      const response = await createWorkOrder(payload);
      console.log("Backend cevabı:", response.data);
      setNotification({
        type: "success",
        message: "İş emri başarıyla oluşturuldu.",
      });
      setTimeout(() => navigate("/work-orders"), 1200);
    } catch (err) {
      setNotification({ type: "error", message: "İş emri oluşturulamadı." });
      console.error("API Hatası:", err?.response?.data || err);
    }
  };

  return (
    <div className={styles.container}>
      {notification && (
        <div
          style={{
            background: notification.type === "success" ? "#10b981" : "#ef4444",
            color: "#fff",
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            textAlign: "center",
            zIndex: 9999,
            position: "fixed",
            top: 20,
            left: 0,
            right: 0,
            maxWidth: 400,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {notification.message}
        </div>
      )}
      <div className={styles.header}>
        <h1 className={styles.title}>Yeni İş Emri Oluştur</h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="description">İş Emri Açıklaması</label>
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
          <label htmlFor="fieldId">Saha</label>
          <select
            id="fieldId"
            name="fieldId"
            value={formData.fieldId}
            onChange={handleInputChange}
            required
          >
            <option value="">Saha Seçin</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="plantId">Santral</label>
          <select
            id="plantId"
            name="plantId"
            value={formData.plantId}
            onChange={handleInputChange}
            required
            disabled={!formData.fieldId}
          >
            <option value="">Santral Seçin</option>
            {plants
              .filter(
                (plant) =>
                  !formData.fieldId || plant.field_id === formData.fieldId
              )
              .map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="typeId">İş Emri Türü</label>
          <select
            id="typeId"
            name="typeId"
            value={formData.typeId}
            onChange={handleInputChange}
            required
          >
            <option value="">İş Emri Türü Seçin</option>
            {workOrderTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Durum</label>
          <div className={styles.radioGroup}>
            {statusOptions.map((opt) => (
              <label key={opt.value}>
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  checked={formData.status === opt.value}
                  onChange={handleInputChange}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Öncelik</label>
          <div className={styles.radioGroup}>
            {priorityOptions.map((opt) => (
              <label key={opt.value}>
                <input
                  type="radio"
                  name="priority"
                  value={opt.value}
                  checked={formData.priority === opt.value}
                  onChange={handleInputChange}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Teknik Personel</label>
          <div className={styles.personnelSection}>
            <input
              type="text"
              placeholder="Personel ara..."
              value={searchTerm}
              onChange={handleSearchChange}
              className={styles.searchInput}
            />

            <div className={styles.personnelList}>
              {Object.entries(groupedPersonnel).map(([role, personnelList]) => {
                const filtered = filteredPersonnel(personnelList);
                if (filtered.length === 0) return null;
                return (
                  <div key={role} className={styles.departmentGroup}>
                    <h3 className={styles.departmentTitle}>{role}</h3>
                    {filtered.map((person) => (
                      <label key={person.id} className={styles.personnelItem}>
                        <input
                          type="checkbox"
                          checked={formData.selectedPersonnel.includes(
                            person.id
                          )}
                          onChange={() => handlePersonnelSelect(person.id)}
                        />
                        {person.username}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <button type="submit" className={styles.submitButton}>
          İş Emri Oluştur
        </button>
      </form>
    </div>
  );
};

export default CreateWorkOrder;
