import React from "react";

const iconStyle = {
  position: "relative",
  width: 32,
  height: 32,
  display: "inline-block",
};
const overlayStyle = {
  position: "absolute",
  bottom: 0,
  width: 16,
  height: 16,
  background: "rgba(255,255,255,0.85)",
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  cursor: "pointer",
};

export default function PDFIconActions({ onPreview, onDownload }) {
  return (
    <span style={iconStyle}>
      {/* PDF dosya ikonu */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="6"
          y="4"
          width="20"
          height="24"
          rx="3"
          fill="#fff"
          stroke="#7a595a"
          strokeWidth="2"
        />
        <rect x="10" y="8" width="12" height="2" rx="1" fill="#7a595a" />
        <rect x="10" y="13" width="12" height="2" rx="1" fill="#e0cfcf" />
        <rect x="10" y="18" width="8" height="2" rx="1" fill="#e0cfcf" />
      </svg>
      {/* Göz ikonu (sol alt) */}
      <span
        title="PDF Önizle"
        style={{ ...overlayStyle, left: 0, border: "1px solid #ddd" }}
        onClick={(e) => {
          e.stopPropagation();
          onPreview && onPreview();
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 4C5 4 1.73 8.11 1.13 9.01a1.5 1.5 0 000 1.98C1.73 11.89 5 16 10 16s8.27-4.11 8.87-5.01a1.5 1.5 0 000-1.98C18.27 8.11 15 4 10 4zm0 10c-3.31 0-6.13-2.94-7.19-4C3.87 8.94 6.69 6 10 6s6.13 2.94 7.19 4C16.13 11.06 13.31 14 10 14zm0-7a3 3 0 100 6 3 3 0 000-6zm0 4a1 1 0 110-2 1 1 0 010 2z"
            fill="#7a595a"
          />
        </svg>
      </span>
      {/* İndirme oku (sağ alt) */}
      <span
        title="PDF İndir"
        style={{ ...overlayStyle, right: 0, border: "1px solid #ddd" }}
        onClick={(e) => {
          e.stopPropagation();
          onDownload && onDownload();
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2a1 1 0 011 1v8.59l2.3-2.3a1 1 0 111.4 1.42l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.42l2.3 2.3V3a1 1 0 011-1zm-7 14a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            fill="#7a595a"
          />
        </svg>
      </span>
    </span>
  );
}
