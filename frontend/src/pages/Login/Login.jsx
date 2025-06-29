import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ThemeContext } from "../../context/ThemeContext";
import styles from "./Login.module.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import logo from "../../assets/images/logo.png";
import logoWhite from "../../assets/images/white-logo.png";
import LoadingScreen from "../../components/layout/LoadingScreen/LoadingScreen";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();

  // Eğer kullanıcı zaten giriş yapmışsa dashboard'a yönlendir
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Yapay gecikme ekleyelim (2 saniye)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Giriş başarısız");
      }

      await login(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err.message || "Kullanıcı adı veya şifre hatalı");
    } finally {
      setIsLoading(false);
    }
  };

  // Eğer kullanıcı giriş yapmışsa hiçbir şey gösterme
  if (user) {
    return null;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className={styles.loginContainer}>
      <img
        src={theme === "dark" ? logoWhite : logo}
        alt="Egesa Logo"
        className={styles.logo}
      />
      <form onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <input
            type="text"
            placeholder="Kullanıcı Adı"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={styles.eyeButton}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button type="submit" className={styles.loginButton}>
          Giriş Yap
        </button>
      </form>
    </div>
  );
};

export default Login;
