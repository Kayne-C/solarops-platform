import React from "react";
import styles from "./Home.module.css";

const Home = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Hoş Geldiniz</h1>
      <p className={styles.description}>
        Bu sayfa shadcn/ui kullanılarak oluşturulmuş bir örnek sayfadır.
      </p>
    </div>
  );
};

export default Home;
