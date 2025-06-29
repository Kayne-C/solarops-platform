import React, { useState, useMemo } from "react";
import {
  PDFDownloadLink,
  pdf,
  View,
  Text,
  Image,
  StyleSheet,
  Document,
  Page,
  Font,
} from "@react-pdf/renderer";
import logo from "../../assets/images/top-logo.jpg";
import Cover from "../../assets/images/cover.png";
import antet from "../../assets/images/antet.png";
import { translateWorkOrderField } from "../../utils/translateWorkOrderField";
import ArialUnicode from "../../assets/fonts/Arial-Unicode-MS.ttf";
import { formatUserName } from "../../utils/turkishToLatin";
import API_BASE_URL from "../../config/api";

Font.register({
  family: "ArialUnicode",
  src: ArialUnicode,
  fontWeight: "normal",
});

const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 0,
    fontFamily: "ArialUnicode",
    fontSize: 12,
    color: "#222",
    backgroundColor: "#fff",
    position: "relative",
    height: "100%",
  },
  logo: {
    width: 110,
    height: 38,
    objectFit: "contain",
    position: "absolute",
    left: 36,
    top: 36,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bolder",
    textAlign: "center",
    color: "#7a595a",
    marginBottom: 24,
    marginTop: 75,
    zIndex: 1,
    fontFamily: "ArialUnicode",
  },
  infoTable: {
    flexDirection: "column",
    marginBottom: 5,
    gap: 8,
    zIndex: 1,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
    width: "100%",
  },
  label: {
    fontWeight: "normal",
    minWidth: 140,
    color: "#000000",
    fontFamily: "ArialUnicode",
  },
  value: {
    color: "#000000",
    fontWeight: "normal",
    fontFamily: "ArialUnicode",
  },
  activitiesHeader: {
    fontSize: 16,
    fontWeight: "normal",
    color: "#1e293b",
    marginBottom: 2,
    marginTop: 75,
    zIndex: 1,
    fontFamily: "ArialUnicode",
  },
  activityBlock: {
    marginBottom: 28,
    paddingBottom: 8,
    zIndex: 1,
    fontWeight: "normal",
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    marginBottom: 4,
    fontWeight: "normal",
  },
  /*activityUser: {
    fontWeight: "normal",
    color: "#7a595a",
    fontSize: 13,
    fontFamily: "ArialUnicode",
  },*/

  activityDateCol: {
    alignItems: "flex-end",
    flexDirection: "column",
    gap: 0,
    fontWeight: "normal",
  },
  activityDate: {
    fontWeight: "normal",
    color: "#7a595a",
    fontSize: 13,
    marginBottom: 0,
    fontFamily: "ArialUnicode",
  },
  activityTime: {
    fontWeight: "normal",
    color: "#7a595a",
    fontSize: 12,
    marginTop: 0,
    fontFamily: "ArialUnicode",
  },
  activityDesc: {
    marginBottom: 4,
    fontSize: 12,
    color: "#222",
    fontWeight: "normal",
    fontFamily: "ArialUnicode",
  },
  activityImagesRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  activityImage: {
    width: 240,
    height: 150,
    objectFit: "cover",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    marginRight: 8,
    marginBottom: 8,
  },
  divider: {
    borderBottom: "0.7px solid #bdbdbd",
    marginVertical: 6,
    marginBottom: 10,
    opacity: 1,
    fontWeight: "normal",
  },
  antet: {
    position: "absolute",
    left: 0,
    bottom: -15,
    width: "100%",
    height: 60,
    objectFit: "contain",
    zIndex: 20,
    margin: 0,
  },
  coverPage: {
    padding: 0,
    paddingBottom: 0,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  coverImage: {
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    opacity: 1,
    objectFit: "cover",
    margin: "auto",
  },
  coverInfoBox: {
    position: "absolute",
    top: 260,
    left: 10,
    zIndex: 10,
    padding: 10,
    minWidth: 250,
    maxWidth: 400,
    alignItems: "flex-start",
  },
  coverPlantName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#7a595a",
    fontFamily: "ArialUnicode",
    marginBottom: 8,
  },
  coverReportTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#7a595a",
    fontFamily: "ArialUnicode",
    marginBottom: 16,
  },
  coverInfoRow: {
    flexDirection: "row",
    marginBottom: 4,
    width: "100%",
    justifyContent: "space-between",
  },
  coverLabel: {
    fontWeight: "900",
    color: "#7a595a",
    minWidth: 100,
    fontFamily: "ArialUnicode",
    fontSize: 13,
  },
  coverValue: {
    color: "#7a595a",
    fontWeight: "700",
    marginLeft: 8,
    fontFamily: "ArialUnicode",
    fontSize: 13,
  },
  coverDescriptionRow: {
    flexDirection: "column",
    marginTop: 5,
    width: "100%",
  },
  coverDescriptionLabel: {
    fontWeight: "900",
    color: "#7a595a",
    marginBottom: 4,
    fontFamily: "ArialUnicode",
    fontSize: 16,
  },
  coverUnderline: {
    borderBottom: "2px solid #7a595a",
    marginBottom: 8,
    width: "100%",
  },
  coverDescriptionValue: {
    color: "#7a595a",
    fontWeight: "700",
    fontFamily: "ArialUnicode",
    maxWidth: 700,
    maxHeight: 90,
    overflow: "hidden",
    fontSize: 11,
    marginTop: 4,
  },
  coverImageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  pageNumber: {
    position: "absolute",
    bottom: 45,
    right: 36,
    fontSize: 12,
    color: "#7a595a",
    fontWeight: "bold",
    fontFamily: "ArialUnicode",
    zIndex: 10,
  },
});

const PAGE_HEIGHT = 1000; // A4 height in points (daha gerçekçi)
const PAGE_PADDING = 36;
const ANTET_HEIGHT = 60;
const LOGO_HEIGHT = 38;
const LOGO_MARGIN = 36;
const USABLE_HEIGHT = PAGE_HEIGHT - PAGE_PADDING - ANTET_HEIGHT;
const ACTIVITY_HEADER_HEIGHT = 90;
const ACTIVITY_BLOCK_MARGIN = 28;
const IMAGE_ROW_HEIGHT = 158;
const IMAGES_PER_ROW = 2;

const allFields = [
  { key: "id", label: "İş Emri No" },
  { key: "Plant.name", label: "Santral" },
  { key: "type", label: "Tür" },
  { key: "priority", label: "Öncelik" },
  { key: "status", label: "Durum" },
  { key: "description", label: "Açıklama" },
  { key: "createdAt", label: "Oluşturulma Tarihi" },
];

const getFieldValue = (workOrder, key) => {
  if (!workOrder) return "";

  if (key === "plant") return workOrder?.Plant?.name || "";
  if (key === "createdAt") {
    return workOrder?.createdAt
      ? new Date(workOrder.createdAt).toLocaleDateString("tr-TR")
      : "";
  }
  if (key === "completedAt") {
    return workOrder?.completedAt
      ? new Date(workOrder.completedAt).toLocaleDateString("tr-TR")
      : "";
  }
  if (key === "user") return formatUserName(workOrder?.User?.username) || "";
  if (["type", "priority", "status"].includes(key)) {
    return translateWorkOrderField(key, workOrder?.[key]) || "";
  }
  return workOrder?.[key] || "";
};

// Aktivite yükseklik hesaplama fonksiyonu
const calculateActivityHeight = (activity) => {
  let height = ACTIVITY_HEADER_HEIGHT + ACTIVITY_BLOCK_MARGIN;

  // Açıklama metni yüksekliği (daha gerçekçi hesaplama)
  const descriptionLength = activity.description?.length || 0;
  const descriptionLines = Math.ceil(descriptionLength / 60); // 60 karakter = 1 satır
  const descriptionHeight = descriptionLines * 14; // 14px per line (font 12px + margin)
  height += descriptionHeight;

  // Görsel yüksekliği
  const images = (activity.ActivityAttachments || []).filter((att) =>
    att.file_name.match(/\.(jpg|jpeg|png|webp)$/i)
  );
  const imageRows = Math.ceil(images.length / IMAGES_PER_ROW);
  height += imageRows * IMAGE_ROW_HEIGHT;

  // Divider yüksekliği
  height += 10;

  return height;
};

function paginateActivitiesSmart(activities) {
  if (!activities || activities.length === 0) return [];

  const pages = [];
  let currentPage = [];
  let currentY = PAGE_PADDING + LOGO_HEIGHT; // Sadece logo yüksekliği + padding

  console.log("=== PAGINATION DEBUG ===");
  console.log("USABLE_HEIGHT:", USABLE_HEIGHT);
  console.log("Total activities:", activities.length);

  activities.forEach((activity, idx) => {
    const activityHeight = calculateActivityHeight(activity);

    console.log(`\n--- Activity ${idx + 1} ---`);
    console.log("Current Y:", currentY);
    console.log("Activity Height:", activityHeight);
    console.log("Would fit:", currentY + activityHeight <= USABLE_HEIGHT);
    console.log("Remaining space:", USABLE_HEIGHT - currentY);

    // Sayfa kontrolü - eğer bu aktivite sığmıyorsa yeni sayfa başlat
    if (currentY + activityHeight > USABLE_HEIGHT) {
      console.log("❌ Page break needed!");
      if (currentPage.length > 0) {
        pages.push(currentPage);
        console.log("Page completed with", currentPage.length, "elements");
      }
      currentPage = [];
      currentY = PAGE_PADDING + LOGO_HEIGHT; // Yeni sayfa için başlangıç pozisyonu
      console.log("New page started, currentY reset to:", currentY);
    }

    // Aktivite başlığını ekle
    currentPage.push({ type: "activityHeader", activity });
    currentY += ACTIVITY_HEADER_HEIGHT + ACTIVITY_BLOCK_MARGIN;
    console.log("After header, currentY:", currentY);

    // Açıklama metni yüksekliği (daha gerçekçi)
    const descriptionLength = activity.description?.length || 0;
    const descriptionLines = Math.ceil(descriptionLength / 60);
    const descriptionHeight = descriptionLines * 14;
    currentY += descriptionHeight;
    console.log(
      "Description lines:",
      descriptionLines,
      "height:",
      descriptionHeight
    );
    console.log("After description, currentY:", currentY);

    // Görselleri işle
    const images = (activity.ActivityAttachments || []).filter((att) =>
      att.file_name.match(/\.(jpg|jpeg|png|webp)$/i)
    );

    for (let i = 0; i < images.length; i += IMAGES_PER_ROW) {
      // Görsel satırı için sayfa kontrolü
      if (currentY + IMAGE_ROW_HEIGHT > USABLE_HEIGHT) {
        console.log("❌ Image row page break!");
        if (currentPage.length > 0) {
          pages.push(currentPage);
        }
        currentPage = [];
        currentY = PAGE_PADDING + LOGO_HEIGHT;
      }

      currentPage.push({
        type: "imageRow",
        images: images.slice(i, i + IMAGES_PER_ROW),
        activityKey: activity.id,
      });
      currentY += IMAGE_ROW_HEIGHT;
      console.log(
        "After image row",
        Math.floor(i / IMAGES_PER_ROW) + 1,
        "currentY:",
        currentY
      );
    }

    // Divider için sayfa kontrolü
    if (currentY + 10 > USABLE_HEIGHT) {
      console.log("❌ Divider page break!");
      if (currentPage.length > 0) {
        pages.push(currentPage);
      }
      currentPage = [];
      currentY = PAGE_PADDING + LOGO_HEIGHT;
    }

    currentPage.push({ type: "divider", activityKey: activity.id });
    currentY += 10;
    console.log("After divider, currentY:", currentY);
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
    console.log("Final page completed with", currentPage.length, "elements");
  }

  console.log("Total pages created:", pages.length);
  console.log("=== END PAGINATION DEBUG ===");

  return pages;
}

// Dosya yolları için
const getFileUrl = (filePath) => `${API_BASE_URL}/${filePath}`;

// Metin kısaltma fonksiyonu
const truncateText = (text, maxLength = 500) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

const WorkOrderReportPDF = ({
  workOrder,
  activities,
  coverImage = Cover,
  showFields,
  selectedFields,
}) => {
  const infoRows = useMemo(
    () => [
      {
        label: "İş Emri Türü",
        value: getFieldValue(workOrder, "type"),
      },
      {
        label: "Oluşturulma Tarihi",
        value: getFieldValue(workOrder, "createdAt"),
      },
      ...(workOrder?.status === "COMPLETED" && workOrder?.completedAt
        ? [
            {
              label: "Tamamlanma Tarihi",
              value: new Date(workOrder.completedAt).toLocaleDateString(
                "tr-TR"
              ),
            },
          ]
        : []),
    ],
    [workOrder]
  );

  const plantSpecs = useMemo(
    () => [
      {
        label: "Tesis Tipi ve Konumu",
        value: `${workOrder?.Plant?.type || ""} - ${
          workOrder?.Plant?.Field?.name || ""
        }`,
      },
      {
        label: "Güç",
        value: workOrder?.Plant?.power || "",
      },
      {
        label: "PV Modülü",
        value: workOrder?.Plant?.pv_module || "",
      },
      {
        label: "Inverter",
        value: workOrder?.Plant?.inverter || "",
      },
    ],
    [workOrder]
  );

  const description = useMemo(
    () => truncateText(getFieldValue(workOrder, "description")),
    [workOrder]
  );

  const activityPages = useMemo(
    () => paginateActivitiesSmart(activities || []),
    [activities]
  );

  return (
    <Document>
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverImageContainer}>
          <Image src={coverImage} style={styles.coverImage} />
        </View>

        <View style={styles.coverInfoBox}>
          <Text style={styles.coverReportTitle}>İş Emri Raporu</Text>
          <Text style={styles.coverPlantName}>
            {getFieldValue(workOrder, "plant")}
          </Text>

          <View style={styles.coverDescriptionRow}>
            <Text style={styles.coverDescriptionLabel}>
              Santral Özellikleri
            </Text>
            <View style={styles.coverUnderline} />
            {plantSpecs.map((item, i) => (
              <View key={i} style={styles.coverInfoRow}>
                <Text style={styles.coverLabel}>{item.label}:</Text>
                <Text style={styles.coverValue}>{item.value}</Text>
              </View>
            ))}
            <View style={styles.coverUnderline} />
          </View>

          {infoRows.map((item, i) => (
            <View key={i} style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>{item.label}:</Text>
              <Text style={styles.coverValue}>{item.value}</Text>
            </View>
          ))}

          <View style={styles.coverDescriptionRow}>
            <Text style={styles.coverDescriptionValue}>{description}</Text>
          </View>
        </View>
      </Page>

      {/* Aktivite Sayfaları */}
      {activityPages.map((pageElements, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          <Image src={logo} style={styles.logo} />
          <Text style={styles.pageNumber}>
            {pageIdx + 2}/{activityPages.length + 1}
          </Text>

          {pageElements.map((el, idx) => {
            const extraMargin = idx === 0 ? { marginTop: 75 } : {};

            if (el.type === "activityHeader") {
              const activity = el.activity;
              const dateStr = activity.created_at
                ? new Date(activity.created_at).toLocaleDateString("tr-TR")
                : "";
              const timeStr = activity.created_at
                ? new Date(activity.created_at).toLocaleTimeString("tr-TR")
                : "";

              return (
                <View
                  key={idx}
                  style={{ ...styles.activityBlock, ...extraMargin }}
                  wrap={false}
                >
                  <View style={styles.activityHeader}>
                    <View style={styles.activityDateCol}>
                      <Text style={styles.activityDate}>{dateStr}</Text>
                      <Text style={styles.activityTime}>{timeStr}</Text>
                    </View>
                  </View>
                  <Text style={styles.activityDesc}>
                    {activity.description}
                  </Text>
                </View>
              );
            }

            if (el.type === "imageRow") {
              return (
                <View
                  key={idx}
                  style={{ ...styles.activityImagesRow, ...extraMargin }}
                >
                  {el.images.map((att, i) => (
                    <Image
                      key={i}
                      src={getFileUrl(att.file_path)}
                      style={styles.activityImage}
                    />
                  ))}
                </View>
              );
            }

            if (el.type === "divider") {
              return (
                <View key={idx} style={{ ...styles.divider, ...extraMargin }} />
              );
            }

            return null;
          })}

          <Image src={antet} style={styles.antet} />
        </Page>
      ))}
    </Document>
  );
};

// PDF dosya adı oluşturma fonksiyonu
const generatePDFFileName = (workOrder) => {
  if (!workOrder) return "İs_Emri_Raporu.pdf";

  const plantName = workOrder?.Plant?.name || "Bilinmeyen-Santral";
  const workOrderId = workOrder?.id || "";
  const lastFiveDigits = workOrderId.toString().slice(-5);

  console.log("=== PDF FILE NAME DEBUG ===");
  console.log("Original plant name:", plantName);
  console.log("Work order ID:", workOrderId);
  console.log("Last 5 digits:", lastFiveDigits);

  // Türkçe karakterleri temizle ve dosya adı için uygun hale getir
  const cleanPlantName = plantName
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const fileName = `${cleanPlantName}_${lastFiveDigits}_İs_Emri_Raporu.pdf`;

  console.log("Clean plant name:", cleanPlantName);
  console.log("Final file name:", fileName);
  console.log("=== END PDF FILE NAME DEBUG ===");

  return fileName;
};

const PDFWorkOrderReportActions = ({ workOrder, activities }) => {
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePrepare = async () => {
    setIsLoading(true);
    try {
      const doc = (
        <WorkOrderReportPDF workOrder={workOrder} activities={activities} />
      );
      setPdfDoc(doc);
      setPdfReady(true);
    } catch (error) {
      console.error("PDF hazırlama hatası:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        onClick={handlePrepare}
        disabled={pdfReady || isLoading}
        style={{
          padding: "6px 18px",
          borderRadius: 6,
          border: "none",
          background:
            pdfReady || isLoading ? "#ccc" : "var(--button-primary, #7a595a)",
          color: "#fff",
          fontWeight: 500,
          cursor: pdfReady || isLoading ? "not-allowed" : "pointer",
        }}
      >
        {isLoading ? "Hazırlanıyor..." : "PDF Hazırla"}
      </button>

      <PDFDownloadLink
        document={pdfDoc}
        fileName={generatePDFFileName(workOrder)}
        style={{
          padding: "6px 18px",
          borderRadius: 6,
          border: "none",
          background: pdfReady ? "var(--button-secondary, #4caf50)" : "#ccc",
          color: "#fff",
          fontWeight: 500,
          cursor: pdfReady ? "pointer" : "not-allowed",
          textDecoration: "none",
          pointerEvents: pdfReady ? "auto" : "none",
        }}
      >
        {pdfReady ? "PDF İndir" : "PDF İndir"}
      </PDFDownloadLink>
    </div>
  );
};

export async function getWorkOrderPDFBlob(workOrder, activities) {
  try {
    const doc = (
      <WorkOrderReportPDF workOrder={workOrder} activities={activities} />
    );
    const asPdf = pdf([]);
    asPdf.updateContainer(doc);
    const blob = await asPdf.toBlob();
    return blob;
  } catch (error) {
    console.error("PDF blob oluşturma hatası:", error);
    throw error;
  }
}

export function PDFPreviewModal({ open, onClose, pdfBlob }) {
  const [url, setUrl] = useState(null);

  React.useEffect(() => {
    if (open && pdfBlob) {
      const objectUrl = URL.createObjectURL(pdfBlob);
      setUrl(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }
  }, [open, pdfBlob]);

  if (!open || !pdfBlob || !url) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 16,
          maxWidth: "90vw",
          maxHeight: "90vh",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "none",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            zIndex: 1,
          }}
        >
          ×
        </button>
        <iframe
          src={url}
          title="PDF Önizleme"
          style={{ width: "70vw", height: "80vh", border: "none" }}
        />
      </div>
    </div>
  );
}

export default PDFWorkOrderReportActions;
