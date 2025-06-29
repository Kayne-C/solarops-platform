/**
 * String değeri güvenli bir şekilde sayıya dönüştürür
 * @param {string} value - Dönüştürülecek string değer
 * @param {number} decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns {number} Dönüştürülmüş sayı
 */
export const parseNumber = (value, decimals = 2) => {
  if (!value || value === "") return 0;

  // String'i temizle ve sayıya çevir
  const cleanValue = value.toString().trim();
  const number = parseFloat(cleanValue);

  // Geçerli sayı mı kontrol et
  if (isNaN(number)) return 0;

  // Ondalık basamak sayısına yuvarla
  return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Sayıyı string formatına çevirir
 * @param {number} value - Formatlanacak sayı
 * @param {number} decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns {string} Formatlanmış string
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || value === "") return "";

  const number = parseFloat(value);
  if (isNaN(number)) return "";

  return number.toFixed(decimals);
};

/**
 * Input değerini temizler ve sadece sayı ve nokta karakterlerine izin verir
 * @param {string} value - Temizlenecek değer
 * @returns {string} Temizlenmiş değer
 */
export const cleanNumberInput = (value) => {
  if (!value) return "";

  // Sadece sayı ve nokta karakterlerine izin ver
  return value.replace(/[^\d.]/g, "");
};
