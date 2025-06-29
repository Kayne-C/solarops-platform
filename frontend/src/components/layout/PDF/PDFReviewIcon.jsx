import React from "react";

export default function PDFReviewIcon({ onClick }) {
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
      title="PDF Önizle"
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
          d="M12 4.5C7 4.5 2.73 9.61 2.13 10.51a1.5 1.5 0 000 2.98C2.73 14.39 7 19.5 12 19.5s9.27-5.11 9.87-6.01a1.5 1.5 0 000-2.98C21.27 9.61 17 4.5 12 4.5zm0 12c-3.31 0-6.13-2.94-7.19-4C5.87 13.06 8.69 10 12 10s6.13 3.06 7.19 4C18.13 15.06 15.31 18 12 18zm0-7a3 3 0 100 6 3 3 0 000-6zm0 4a1 1 0 110-2 1 1 0 010 2z"
          fill="#7a595a"
        />
      </svg>
    </span>
  );
}
