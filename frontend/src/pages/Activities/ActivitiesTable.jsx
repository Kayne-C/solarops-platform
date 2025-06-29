import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import styles from "../../components/layout/Table/Table.module.css";
import { getActivities } from "./activityApi";
import LoadingScreen from "../../components/layout/LoadingScreen/LoadingScreen";

const ActivitiesTable = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    id: "",
    description: "",
    workOrder: "",
    user: "",
    date: "",
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getActivities()
      .then((res) => setActivities(res.data))
      .catch(() => setError("Aktiviteler alınamadı"))
      .finally(() => setLoading(false));
  }, []);

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

  const filteredActivities = activities.filter((activity) => {
    return (
      (!filters.id ||
        activity.id
          .toString()
          .toLowerCase()
          .includes(filters.id.toLowerCase())) &&
      (!filters.description ||
        activity.description
          ?.toLowerCase()
          .includes(filters.description.toLowerCase())) &&
      (!filters.workOrder ||
        activity.WorkOrder?.description
          ?.toLowerCase()
          .includes(filters.workOrder.toLowerCase())) &&
      (!filters.user ||
        activity.User?.username
          ?.toLowerCase()
          .includes(filters.user.toLowerCase())) &&
      (!filters.date ||
        new Date(activity.created_at)
          .toLocaleDateString("tr-TR")
          .includes(filters.date))
    );
  });

  const sortedActivities = getSortedData(filteredActivities);

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return "↑↓";
    }
    return sortConfig.direction === "ascending" ? "↑" : "↓";
  };

  const handleDescriptionClick = (e, id) => {
    e.stopPropagation();
    navigate(`/activities/${id}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Aktiviteler</h1>
        <button
          onClick={() => navigate("/activities/create")}
          className={styles.createButton}
        >
          <span className={styles.icon}>➕</span>
          Yeni Aktivite
        </button>
      </div>

      {loading ? (
        <div className={styles.tableWrapper}>
          <LoadingScreen />
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", color: "#ef4444" }}>
          Hata: {error}
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "27%" }}>
                  <div className={styles.columnHeader}>
                    <span>Açıklama</span>
                    <span
                      onClick={() => handleSort("description")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("description")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.description}
                    onChange={(e) =>
                      handleFilterChange("description", e.target.value)
                    }
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "30%" }}>
                  <div className={styles.columnHeader}>
                    <span>İş Emri</span>
                    <span
                      onClick={() => handleSort("workOrder")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("workOrder")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.workOrder}
                    onChange={(e) =>
                      handleFilterChange("workOrder", e.target.value)
                    }
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "15%" }}>
                  <div className={styles.columnHeader}>
                    <span>Kullanıcı</span>
                    <span
                      onClick={() => handleSort("user")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("user")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.user}
                    onChange={(e) => handleFilterChange("user", e.target.value)}
                    className={styles.filterInput}
                  />
                </th>
                <th style={{ width: "20%" }}>
                  <div className={styles.columnHeader}>
                    <span>Tarih</span>
                    <span
                      onClick={() => handleSort("created_at")}
                      className={styles.sortIcon}
                    >
                      {renderSortIcon("created_at")}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrele..."
                    value={filters.date}
                    onChange={(e) => handleFilterChange("date", e.target.value)}
                    className={styles.filterInput}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedActivities.length > 0 ? (
                sortedActivities.map((activity) => (
                  <tr key={activity.id} className={styles.tableRow}>
                    <td>
                      <span
                        className={styles.clickableText}
                        onClick={(e) => handleDescriptionClick(e, activity.id)}
                      >
                        {activity.description}
                      </span>
                    </td>
                    <td>
                      {activity.WorkOrder?.Plant?.name} - #
                      {activity.WorkOrder?.id.slice(-4)}
                    </td>
                    <td>{activity.User?.username}</td>
                    <td>
                      {new Date(activity.created_at).toLocaleDateString(
                        "tr-TR"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className={styles.noData}>
                    Henüz aktivite kaydı bulunmuyor
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ActivitiesTable;
