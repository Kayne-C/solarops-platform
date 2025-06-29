import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./CreatePlant.module.css";
import { AuthContext } from "../../context/AuthContext";
import { createPlant } from "./plantApi";
import { getInvestors } from "./investorApi";
import { getFields } from "./fieldApi";

const CreatePlant = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [investors, setInvestors] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    investor_id: "",
    type: "",
    field_id: "",
    coordinates: "",
    power: "",
    pv_module: "",
    inverter: "",
    iec104AsduAddress: "",
    wanIpAddress: "",
    localIpAddress: "",
    ososId: "",
    installation_date: "",
    depreciation_rate: "",
  });

  useEffect(() => {
    if (!user) navigate("/login");

    Promise.all([
      getInvestors().then((res) => setInvestors(res.data)),
      getFields().then((res) => setFields(res.data)),
    ])
      .catch(() => setError("Veriler alınamadı"))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createPlant(formData);
      navigate("/plants");
    } catch (err) {
      setError(err.response?.data?.message || "Santral eklenemedi");
    }
  };

  if (loading) return <div>Yükleniyor...</div>;
  if (error) return <div>Hata: {error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Yeni Santral Oluştur</h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="name">Santral Adı</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="investor_id">Yatırımcı</label>
          <select
            id="investor_id"
            name="investor_id"
            value={formData.investor_id}
            onChange={handleChange}
            required
          >
            <option value="">Seçiniz</option>
            {investors.map((investor) => (
              <option key={investor.id} value={investor.id}>
                {investor.company_name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="type">Santral Türü</label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            required
          >
            <option value="">Seçiniz</option>
            <option value="GES">GES (Arazi Güneş Enerji Santrali)</option>
            <option value="ÇGES">ÇGES (Çatı Güneş Enerji Santrali)</option>
            <option value="DGES">
              DGES (Depolamalı Güneş Enerji Santrali)
            </option>
            <option value="RES">RES (Rüzgar Enerji Santrali)</option>
            <option value="HES">HES (Hidroelektrik Enerji Santrali)</option>
            <option value="TES">TES (Termik Enerji Santrali)</option>
            <option value="BES">BES (Biyokütle Enerji Santrali)</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="field_id">Saha</label>
          <select
            id="field_id"
            name="field_id"
            value={formData.field_id}
            onChange={handleChange}
            required
          >
            <option value="">Seçiniz</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="coordinates">GPS Koordinatları</label>
          <input
            type="text"
            id="coordinates"
            name="coordinates"
            value={formData.coordinates}
            onChange={handleChange}
            placeholder="Örn: 41.0082, 28.9784"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="power">Güç</label>
          <input
            type="text"
            id="power"
            name="power"
            value={formData.power}
            onChange={handleChange}
            placeholder="Örn: 1000"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="pv_module">PV Modülü</label>
          <input
            type="text"
            id="pv_module"
            name="pv_module"
            value={formData.pv_module}
            onChange={handleChange}
            placeholder="Örn: 1000"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="inverter">Inverter</label>
          <input
            type="text"
            id="inverter"
            name="inverter"
            value={formData.inverter}
            onChange={handleChange}
            placeholder="Örn: 1000"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="installation_date">Kurulum Tarihi</label>
          <input
            type="date"
            id="installation_date"
            name="installation_date"
            value={formData.installation_date}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="depreciation_rate">Yıpranma Payı (%)</label>
          <input
            type="number"
            id="depreciation_rate"
            name="depreciation_rate"
            value={formData.depreciation_rate}
            onChange={handleChange}
            placeholder="Örn: 5.00"
            step="0.01"
            min="0"
            max="100"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="iec104AsduAddress">IEC-104 ASDU Adresi</label>
          <input
            type="text"
            id="iec104AsduAddress"
            name="iec104AsduAddress"
            value={formData.iec104AsduAddress}
            onChange={handleChange}
            placeholder="Örn: 192.168.1.100"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="wanIpAddress">WAN IP Adresi</label>
          <input
            type="text"
            id="wanIpAddress"
            name="wanIpAddress"
            value={formData.wanIpAddress}
            onChange={handleChange}
            placeholder="Örn: 192.168.1.100"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="localIpAddress">Local IP Adresi</label>
          <input
            type="text"
            id="localIpAddress"
            name="localIpAddress"
            value={formData.localIpAddress}
            onChange={handleChange}
            placeholder="Örn: 192.168.1.100"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="ososId">OSOS ID</label>
          <input
            type="text"
            id="ososId"
            name="ososId"
            value={formData.ososId}
            onChange={handleChange}
            placeholder="Örn: OSOS123456"
          />
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            onClick={() => navigate("/plants")}
            className={styles.cancelButton}
          >
            İptal
          </button>
          <button type="submit" className={styles.submitButton}>
            Oluştur
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePlant;
