import React, { useState } from "react";
import * as XLSX from "xlsx";
import styles from "./ProductionImportModal.module.css";

const ProductionImportModal = ({ open, onClose, onImport }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileType, setFileType] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);

  const fileTypes = [
    {
      value: "retgen",
      label: "Retgen",
      description: "Retgen formatında üretim verilerini içeren Excel dosyası",
    },
    {
      value: "fusionSolar",
      label: "FusionSolar",
      description:
        "FusionSolar formatında üretim verilerini içeren Excel dosyası",
    },
    {
      value: "neteco",
      label: "Neteco",
      description: "Neteco formatında üretim verilerini içeren CSV dosyası",
    },
  ];

  if (!open) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Excel ve CSV dosyalarına izin ver
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        alert(
          "Lütfen sadece Excel (.xlsx, .xls) veya CSV (.csv) dosyası seçin."
        );
        return;
      }

      // Dosya boyutu kontrolü (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert("Dosya boyutu 10MB'dan büyük olamaz.");
        return;
      }

      setSelectedFile(file);
      setParsedData(null); // Yeni dosya seçildiğinde parsed data'yı temizle
    }
  };

  const parseRetgenFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          const range = XLSX.utils.decode_range(worksheet["!ref"]);
          const parsedData = {};

          // B8'den başlayarak günlük verileri oku
          for (let row = 8; row <= range.e.r; row++) {
            const dateCell =
              worksheet[XLSX.utils.encode_cell({ r: row - 1, c: 0 })]; // A sütunu (0-based)
            const valueCell =
              worksheet[XLSX.utils.encode_cell({ r: row - 1, c: 1 })]; // B sütunu (0-based)

            if (dateCell && valueCell) {
              const dateValue = dateCell.v;
              const productionValue = valueCell.v;

              // Sayı formatını düzenle
              let formattedValue = productionValue;
              if (typeof productionValue === "string") {
                // Bin ayracını kaldır (1.234,56 -> 1234,56)
                formattedValue = productionValue.replace(/\./g, "");
                // Virgülü noktaya çevir (1234,56 -> 1234.56)
                formattedValue = formattedValue.replace(",", ".");
              }

              // Sayıya çevir
              const numericValue = parseFloat(formattedValue);

              if (!isNaN(numericValue) && numericValue >= 0) {
                // 2 ondalık basamağa yuvarla
                const roundedValue = Math.round(numericValue * 100) / 100;

                // Basit tarih formatı: row numarasından gün hesapla
                const day = row - 7; // 8. satırdan başladığı için
                const dateStr = `2025-06-${day.toString().padStart(2, "0")}`;
                parsedData[dateStr] = roundedValue;
              }
            }
          }

          resolve(parsedData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Dosya okuma hatası"));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseFusionSolarFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          const range = XLSX.utils.decode_range(worksheet["!ref"]);
          const parsedData = {};

          // H3'ten başlayarak günlük verileri oku (H sütunu = 7, 3. satır = 2)
          for (let row = 3; row <= range.e.r; row++) {
            const valueCell =
              worksheet[XLSX.utils.encode_cell({ r: row - 1, c: 7 })]; // H sütunu (0-based = 7)

            if (valueCell) {
              const productionValue = valueCell.v;

              // Sayı formatını düzenle
              let formattedValue = productionValue;
              if (typeof productionValue === "string") {
                // Bin ayracını kaldır (1.234,56 -> 1234,56)
                formattedValue = productionValue.replace(/\./g, "");
                // Virgülü noktaya çevir (1234,56 -> 1234.56)
                formattedValue = formattedValue.replace(",", ".");
              }

              // Sayıya çevir
              const numericValue = parseFloat(formattedValue);

              if (!isNaN(numericValue) && numericValue >= 0) {
                // Basit tarih formatı: row numarasından gün hesapla
                const day = row - 2; // 3. satırdan başladığı için
                const dateStr = `2025-06-${day.toString().padStart(2, "0")}`;
                parsedData[dateStr] = numericValue;
              }
            }
          }

          resolve(parsedData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Dosya okuma hatası"));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseType3File = async (file) => {
    // Tip 3 formatı için mock data (şimdilik)
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockData = {};
        for (let day = 1; day <= 31; day++) {
          const dateStr = `2024-01-${day.toString().padStart(2, "0")}`;
          mockData[dateStr] = Math.floor(Math.random() * 1200) + 200;
        }
        resolve(mockData);
      }, 1000);
    });
  };

  const parseNeteoFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const csvText = e.target.result;
          const lines = csvText.split("\n");
          const parsedData = {};

          // 3. satırdan başlayarak (0-based index = 2)
          for (let row = 2; row < lines.length; row++) {
            const line = lines[row];

            if (!line.trim()) continue; // Boş satırları atla

            // Tırnak içindeki değerleri regex ile çıkar
            const matches = line.match(/"([^"]*)"/g);

            if (matches && matches.length >= 2) {
              // İlk tırnak içindeki değer tarih, ikincisi toplam üretim
              const dateColumn = matches[0].replace(/"/g, "");
              const totalValueColumn = matches[1].replace(/"/g, "");

              // Tarih formatını parse et ("2025-06-01	" -> "2025-06-01")
              let dateStr = dateColumn
                .trim()
                .replace(/\t/g, "")
                .replace(/\s+/g, ""); // Tüm boşlukları kaldır

              // Toplam üretim değerini parse et
              let productionValue = totalValueColumn.trim();

              // Sayı formatını düzenle
              if (typeof productionValue === "string") {
                // Bin ayracı noktalarını kaldır (1.234,56 -> 1234,56) - sadece 3'lü gruplar halinde olan noktaları
                productionValue = productionValue.replace(
                  /\B(?=(\d{3})+(?!\d))/g,
                  ""
                );
                // Virgülü noktaya çevir (1234,56 -> 1234.56)
                productionValue = productionValue.replace(",", ".");
              }

              // Sayıya çevir
              const numericValue = parseFloat(productionValue);

              if (!isNaN(numericValue) && numericValue >= 0 && dateStr) {
                // 2 decimal formatına çevir
                const formattedValue = parseFloat(numericValue.toFixed(2));
                parsedData[dateStr] = formattedValue;
              }
            }
          }

          resolve(parsedData);
        } catch (error) {
          console.error("Neteo parse error:", error);
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Dosya okuma hatası"));
      reader.readAsText(file); // CSV için text olarak oku
    });
  };

  const parseExcelFile = async (file, type) => {
    switch (type) {
      case "retgen":
        return await parseRetgenFile(file);
      case "fusionSolar":
        return await parseFusionSolarFile(file);
      case "neteco":
        return await parseNeteoFile(file);
      default:
        throw new Error("Geçersiz dosya tipi");
    }
  };

  const handleParseFile = async () => {
    if (!selectedFile || !fileType) {
      alert("Lütfen dosya ve dosya tipini seçin.");
      return;
    }

    setLoading(true);
    try {
      const data = await parseExcelFile(selectedFile, fileType);
      setParsedData(data);
    } catch (error) {
      console.error("Dosya parse hatası:", error);
      alert("Dosya parse edilirken hata oluştu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!parsedData) {
      alert("Lütfen önce dosyayı parse edin.");
      return;
    }

    onImport(parsedData);

    // Modal'i ve dosyayı sıfırla
    setSelectedFile(null);
    setFileType("");
    setParsedData(null);

    // File input'u da sıfırla
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.value = "";
    }

    onClose();
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setFileType("");
    setParsedData(null);

    // File input'u da sıfırla
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.value = "";
    }

    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Üretim Verisi İçe Aktar</h2>
          <button className={styles.closeButton} onClick={handleCancel}>
            ×
          </button>
        </div>

        <div className={styles.modalContent}>
          {/* Dosya Tipi Seçimi */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Parse Türü</label>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              className={styles.select}
            >
              <option value="">Parse türünü seçin...</option>
              {fileTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {fileType && (
              <p className={styles.description}>
                {fileTypes.find((t) => t.value === fileType)?.description}
              </p>
            )}
          </div>

          {/* Dosya Seçimi */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Excel Dosyası</label>
            <div className={styles.fileInputContainer}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className={styles.fileInput}
                id="fileInput"
              />
              <label htmlFor="fileInput" className={styles.fileInputLabel}>
                {selectedFile ? selectedFile.name : "Dosya Seç"}
              </label>
            </div>
            {selectedFile && (
              <p className={styles.fileInfo}>
                Dosya boyutu: {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            )}
          </div>

          {/* Parse Butonu */}
          {selectedFile && fileType && (
            <div className={styles.formGroup}>
              <button
                type="button"
                className={styles.parseButton}
                onClick={handleParseFile}
                disabled={loading}
              >
                {loading ? "Parse Ediliyor..." : "Dosyayı Parse Et"}
              </button>
            </div>
          )}

          {/* Parse Edilen Veri Önizlemesi */}
          {parsedData && (
            <div className={styles.parsedDataPreview}>
              <h4>Parse Edilen Veri Önizlemesi</h4>
              <div className={styles.previewTable}>
                <table>
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Üretim (kWh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(parsedData)
                      .slice(0, 10)
                      .map(([date, value]) => (
                        <tr key={date}>
                          <td>{date}</td>
                          <td>{value}</td>
                        </tr>
                      ))}
                    {Object.keys(parsedData).length > 10 && (
                      <tr>
                        <td colSpan="2">
                          ... ve {Object.keys(parsedData).length - 10} kayıt
                          daha
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Desteklenen Formatlar */}
          <div className={styles.supportedFormats}>
            <h4>Desteklenen Formatlar</h4>
            <ul>
              <li>Excel (.xlsx, .xls)</li>
              <li>CSV (.csv)</li>
              <li>Maksimum dosya boyutu: 10 MB</li>
              <li>İlk satır başlık satırı olmalıdır</li>
              <li>Tarih formatı: YYYY-MM-DD</li>
            </ul>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={loading}
          >
            İptal
          </button>
          <button
            className={styles.importButton}
            onClick={handleImport}
            disabled={!parsedData || loading}
          >
            İçe Aktar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductionImportModal;
