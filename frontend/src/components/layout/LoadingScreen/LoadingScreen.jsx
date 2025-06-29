import React from "react";
import styles from "./LoadingScreen.module.css";
import logo from "../../../assets/images/logo.png";

const LoadingScreen = () => {
  return (
    <div className={styles.overlay}>
      <div className={styles.logoContainer}>
        <img src={logo} alt="Egesa Logo" className={styles.logo} />
      </div>
    </div>
  );
};

export default LoadingScreen;
