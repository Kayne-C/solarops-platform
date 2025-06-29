export function translateWorkOrderField(key, value) {
  if (!value) return "";
  if (key === "type") {
    const map = {
      MAINTENANCE: "Bakım",
      FAULT: "Onarım",
      INSPECTION: "Kontrol",
      INSTALLATION: "Kurulum",
      REPAIR: "Tamir",
      OTHER: "Diğer",
    };
    return map[value] || value;
  }
  if (key === "priority") {
    const map = {
      LOW: "Düşük",
      MEDIUM: "Orta",
      HIGH: "Yüksek",
      URGENT: "Acil",
    };
    return map[value] || value;
  }
  if (key === "status") {
    const map = {
      PENDING: "Oluşturuldu",
      IN_PROGRESS: "Devam Ediyor",
      COMPLETED: "Tamamlandı",
      CANCELLED: "İptal Edildi",
    };
    return map[value] || value;
  }
  return value;
}
