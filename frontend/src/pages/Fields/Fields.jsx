import React, { useState } from "react";
import styles from "./Fields.module.css";

const Fields = () => {
  const [filters, setFilters] = useState({
    id: "",
    name: "",
    location: "",
    status: "",
    capacity: "",
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });

  const fields = [
    {
      id: 1,
      name: "Saha 1",
      location: "İstanbul",
      status: "Aktif",
      capacity: "1000 MW",
    },
    {
      id: 2,
      name: "Saha 2",
      location: "Ankara",
      status: "Bakımda",
      capacity: "800 MW",
    },
    {
      id: 3,
      name: "Saha 3",
      location: "İzmir",
      status: "Aktif",
      capacity: "1200 MW",
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

  const filteredFields = fields.filter((field) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value) return true;
      return field[key].toString().toLowerCase().includes(value.toLowerCase());
    });
  });

  const sortedFields = getSortedData(filteredFields);

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return "↑↓";
    }
    return sortConfig.direction === "ascending" ? "↑" : "↓";
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sahalar</h1>
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
                  <span>İsim</span>
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
                  <span>Konum</span>
                  <button
                    onClick={() => handleSort("location")}
                    className={styles.sortButton}
                  >
                    {renderSortIcon("location")}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.location}
                  onChange={(e) =>
                    handleFilterChange("location", e.target.value)
                  }
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
              <th>
                <div className={styles.columnHeader}>
                  <span>Kapasite</span>
                  <button
                    onClick={() => handleSort("capacity")}
                    className={styles.sortButton}
                  >
                    {renderSortIcon("capacity")}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Filtrele..."
                  value={filters.capacity}
                  onChange={(e) =>
                    handleFilterChange("capacity", e.target.value)
                  }
                  className={styles.filterInput}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFields.map((field) => (
              <tr key={field.id}>
                <td>{field.id}</td>
                <td>{field.name}</td>
                <td>{field.location}</td>
                <td>
                  <span className={styles.status}>{field.status}</span>
                </td>
                <td>{field.capacity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Fields;
