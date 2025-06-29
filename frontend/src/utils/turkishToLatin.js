export function turkishToLatin(text) {
  if (!text) return "";
  return text
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C");
}

/**
 * Kullanıcı adını düzgün formatlar: name.surname, name_surname, name-surname gibi yazıldıysa
 * aradaki sembolleri boşluğa çevirir, baş harfleri büyütür.
 * Örnek: "ali.veli" => "Ali Veli"
 */
export function formatUserName(rawName) {
  if (!rawName) return "";
  // Nokta, tire, alt tire ve fazla boşlukları boşluğa çevir
  let name = rawName
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Her kelimenin baş harfini büyüt
  name = name
    .split(" ")
    .map(
      (w) =>
        w.charAt(0).toLocaleUpperCase("tr-TR") +
        w.slice(1).toLocaleLowerCase("tr-TR")
    )
    .join(" ");
  return name;
}
