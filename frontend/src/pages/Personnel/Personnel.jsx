import React, { useState } from "react";
import styles from "./Personnel.module.css";

const Personnel = () => {
  const [filters, setFilters] = useState({
    id: "",
    name: "",
    role: "",
    field: "",
    status: "",
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });

  const personnel = [
    {
      id: 1,
      name: "Ahmet Yılmaz",
      role: "Teknisyen",
      field: "Saha 1",
      status: "Aktif",
    },
    {
      id: 2,
      name: "Mehmet Demir",
      role: "Mühendis",
      field: "Saha 2",
      status: "İzinli",
    },
    {
      id: 3,
      name: "Ayşe Kaya",
      role: "Teknisyen",
      field: "Saha 3",
      status: "Aktif",
    },
    {
      id: 4,
      name: "Ali Öztürk",
      role: "Mühendis",
      field: "Saha 1",
      status: "Aktif",
    },
  ];

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = (data) => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  };

  const filteredPersonnel = personnel.filter((person) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value) return true;
      return person[key].toString().toLowerCase().includes(value.toLowerCase());
    });
  });

  const sortedPersonnel = getSortedData(filteredPersonnel);

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return "↑↓";
    }
    return sortConfig.direction === "ascending" ? "↑" : "↓";
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Personel Bilgisi</h1>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: "5%" }}>
                <div className={styles.columnHeader}>
                  <span>ID</span>
                  <button
                    onClick={() => handleSort("id")}
                    className={styles.sortButton}
                  >
                    {renderSortIcon("id")}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.id}
                  onChange={(e) => handleFilterChange("id", e.target.value)}
                  className={styles.filterInput}
                />
              </th>
              <th>
                <div className={styles.columnHeader}>
                  <span>Ad Soyad</span>
                  <button
                    onClick={() => handleSort("name")}
                    className={styles.sortButton}
                  >
                    {renderSortIcon("name")}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange("name", e.target.value)}
                  className={styles.filterInput}
                />
              </th>
              <th>
                <div className={styles.columnHeader}>
                  <span>Rol</span>
                  <button
                    onClick={() => handleSort("role")}
                    className={styles.sortButton}
                  >
                    {renderSortIcon("role")}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.role}
                  onChange={(e) => handleFilterChange("role", e.target.value)}
                  className={styles.filterInput}
                />
              </th>
              <th>
                <div className={styles.columnHeader}>
                  <span>Saha</span>
                  <button
                    onClick={() => handleSort("field")}
                    className={styles.sortButton}
                  >
                    {renderSortIcon("field")}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.field}
                  onChange={(e) => handleFilterChange("field", e.target.value)}
                  className={styles.filterInput}
                />
              </th>
              <th>
                <div className={styles.columnHeader}>
                  <span>Durum</span>
                  <button
                    onClick={() => handleSort("status")}
                    className={styles.sortButton}
                  >
                    {renderSortIcon("status")}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className={styles.filterInput}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPersonnel.map((person) => (
              <tr key={person.id}>
                <td>{person.id}</td>
                <td>{person.name}</td>
                <td>{person.role}</td>
                <td>{person.field}</td>
                <td>
                  <span className={styles.status}>{person.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Personnel;
