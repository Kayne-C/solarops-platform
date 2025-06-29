import React from "react";

export default function PDFDownloadIcon({ onClick }) {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        borderRadius: 4,
        transition: "background-color 0.2s",
      }}
      title="PDF İndir"
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick();
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = "rgba(122, 89, 90, 0.1)";
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = "transparent";
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2a1 1 0 011 1v8.59l2.3-2.3a1 1 0 111.4 1.42l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.42l2.3 2.3V3a1 1 0 011-1zm-7 14a1 1 0 011-1h12a1 1 0 110 2H6a1 1 0 01-1-1z"
          fill="#7a595a"
        />
      </svg>
    </span>
  );
}
