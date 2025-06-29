import React, { useState, useEffect, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./Navbar.module.css";
import { AuthContext } from "../../../context/AuthContext";
import { ThemeContext } from "../../../context/ThemeContext";
import logoWhite from "../../../assets/images/white-logo.png";
import {
  FaChartBar,
  FaClipboardList,
  FaIndustry,
  FaShieldAlt,
  FaUser,
  FaMoon,
  FaSun,
  FaBell,
  FaSignOutAlt,
  FaPlus,
  FaList,
  FaChevronDown,
  FaChevronUp,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

const Navbar = ({ onCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const [showText, setShowText] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);

  // Giriş yapılmamışsa navbar'ı gösterme
  if (!user) return null;

  const toggleMenu = (menuName) => {
    setExpandedMenu(expandedMenu === menuName ? null : menuName);
  };

  const toggleNavbar = () => {
    const newCollapsedState = !isCollapsed;

    if (newCollapsedState) {
      // Kapanırken önce metinleri gizle
      setShowText(false);
      // Sonra submenüleri kapat
      setExpandedMenu(null);
      // En son navbar'ı collapse et
      setTimeout(() => {
        setIsCollapsed(true);
        onCollapse(true);
      }, 50);
    } else {
      // Açılırken önce navbar'ı genişlet
      setIsCollapsed(false);
      onCollapse(false);
      // Sonra metinleri göster
      setTimeout(() => {
        setShowText(true);
      }, 150);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleProfileClick = () => {
    setProfileMenuOpen((prev) => !prev);
  };

  const handleLogoutAndClose = () => {
    setProfileMenuOpen(false);
    handleLogout();
  };

  return (
    <>
      <nav
        className={`${styles.navbar} ${isCollapsed ? styles.collapsed : ""}`}
      >
        <div className={styles.navbarHeader}>
          <div className={styles.logo}>
            <Link to="/">
              <img src={logoWhite} alt="EGESA" className={styles.logoImage} />
              {showText && !isCollapsed && <span>EGESA</span>}
            </Link>
          </div>
          <button className={styles.collapseButton} onClick={toggleNavbar}>
            {isCollapsed ? (
              <FaChevronRight className={styles.arrow} />
            ) : (
              <FaChevronLeft className={styles.arrow} />
            )}
          </button>
        </div>
        <div className={styles.links}>
          <Link
            to="/dashboard"
            className={styles.link}
            data-tooltip="Dashboard"
          >
            <FaChartBar className={styles.icon} />
            {showText && !isCollapsed && <span>Dashboard</span>}
          </Link>
          <div className={styles.menuItem}>
            <button
              className={`${styles.menuButton} ${
                expandedMenu === "workOrders" ? styles.expanded : ""
              }`}
              onClick={() => toggleMenu("workOrders")}
              data-tooltip="İş Emirleri"
            >
              <FaClipboardList className={styles.icon} />
              {showText && !isCollapsed && (
                <>
                  <span>İş Emirleri</span>
                  {expandedMenu === "workOrders" ? (
                    <FaChevronUp className={styles.arrow} />
                  ) : (
                    <FaChevronDown className={styles.arrow} />
                  )}
                </>
              )}
            </button>
            <div
              className={`${styles.submenu} ${
                expandedMenu === "workOrders" ? styles.show : ""
              }`}
            >
              <Link
                to="/work-orders"
                className={`${styles.submenuItem} ${
                  location.pathname === "/work-orders" ? styles.active : ""
                }`}
                data-tooltip="Tüm İş Emirleri"
              >
                <FaList className={styles.icon} />
                {!isCollapsed && "Tüm İş Emirleri"}
              </Link>

              <Link
                to="/create-work-order"
                className={`${styles.submenuItem} ${
                  location.pathname === "/create-work-order"
                    ? styles.active
                    : ""
                }`}
                data-tooltip="Yeni İş Emri"
              >
                <FaPlus className={styles.icon} />
                {!isCollapsed && "Yeni İş Emri"}
              </Link>

              <Link
                to="/activities"
                className={`${styles.submenuItem} ${
                  location.pathname === "/activities" ? styles.active : ""
                }`}
                data-tooltip="Tüm Aktiviteler"
              >
                <FaList className={styles.icon} />
                {!isCollapsed && "Tüm Aktiviteler"}
              </Link>
              {user && (
                <Link
                  to="/activities/create"
                  className={`${styles.submenuItem} ${
                    location.pathname === "/activities/create"
                      ? styles.active
                      : ""
                  }`}
                  data-tooltip="Yeni Aktivite"
                >
                  <FaPlus className={styles.icon} />
                  {!isCollapsed && "Yeni Aktivite"}
                </Link>
              )}
            </div>
          </div>
          <div className={styles.menuItem}>
            <button
              className={`${styles.menuButton} ${
                expandedMenu === "plants" ? styles.expanded : ""
              }`}
              onClick={() => toggleMenu("plants")}
              data-tooltip="Santral Yönetimi"
            >
              <FaIndustry className={styles.icon} />
              {showText && !isCollapsed && (
                <>
                  <span>Santral Yönetimi</span>
                  {expandedMenu === "plants" ? (
                    <FaChevronUp className={styles.arrow} />
                  ) : (
                    <FaChevronDown className={styles.arrow} />
                  )}
                </>
              )}
            </button>
            <div
              className={`${styles.submenu} ${
                expandedMenu === "plants" ? styles.show : ""
              }`}
            >
              <Link
                to="/plants"
                className={`${styles.submenuItem} ${
                  location.pathname === "/plants" ? styles.active : ""
                }`}
                data-tooltip="Santraller"
              >
                <FaList className={styles.icon} />
                {!isCollapsed && "Santraller"}
              </Link>

              <Link
                to="/plants/create"
                className={`${styles.submenuItem} ${
                  location.pathname === "/plants/create" ? styles.active : ""
                }`}
                data-tooltip="Yeni Santral"
              >
                <FaPlus className={styles.icon} />
                {!isCollapsed && "Yeni Santral"}
              </Link>
            </div>
          </div>

          <Link
            to="/production-reports"
            className={styles.link}
            data-tooltip="Raporlama Özet"
          >
            <FaChartBar className={styles.icon} />
            {showText && !isCollapsed && <span>Raporlama Özet</span>}
          </Link>

          {user?.role === "ADMIN" && (
            <Link
              to="/admin"
              className={styles.link}
              data-tooltip="Admin Paneli"
            >
              <FaShieldAlt className={styles.icon} />
              {showText && !isCollapsed && <span>Admin Paneli</span>}
            </Link>
          )}
        </div>
        <div className={styles.actions}>
          {user && (
            <div className={styles.menuItem}>
              <button
                className={`${styles.userButton} ${
                  expandedMenu === "user" ? styles.expanded : ""
                }`}
                onClick={() => toggleMenu("user")}
              >
                <div className={styles.userAvatar}>
                  <FaUser />
                </div>
                {showText && !isCollapsed && (
                  <>
                    <span>{user.username}</span>
                    {expandedMenu === "user" ? (
                      <FaChevronUp className={styles.arrow} />
                    ) : (
                      <FaChevronDown className={styles.arrow} />
                    )}
                  </>
                )}
              </button>
              <div
                className={`${styles.submenu} ${
                  expandedMenu === "user" ? styles.show : ""
                }`}
              >
                <button
                  onClick={() => {
                    toggleTheme();
                    setExpandedMenu(null);
                  }}
                  className={styles.submenuItem}
                >
                  {theme === "light" ? (
                    <FaMoon className={styles.icon} />
                  ) : (
                    <FaSun className={styles.icon} />
                  )}
                  {!isCollapsed &&
                    (theme === "light" ? "Dark Mode" : "Light Mode")}
                </button>
                <button
                  onClick={() => {
                    setExpandedMenu(null);
                    alert("Bildirimler özelliği yakında!");
                  }}
                  className={styles.submenuItem}
                >
                  <FaBell className={styles.icon} />
                  {!isCollapsed && "Bildirimler"}
                </button>
                <button
                  onClick={() => {
                    setExpandedMenu(null);
                    handleLogout();
                  }}
                  className={styles.submenuItem}
                >
                  <FaSignOutAlt className={styles.icon} />
                  {!isCollapsed && "Çıkış Yap"}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
