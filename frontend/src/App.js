import React, { useState, useContext, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/layout/Navbar/Navbar";
import Dashboard from "./pages/Dashboard/Dashboard";
import WorkOrders from "./pages/WorkOrder/WorkOrdersTable/WorkOrdersTable";
import WorkOrderDetail from "./pages/WorkOrder/WorkOrderDetail";
import CreateWorkOrder from "./pages/WorkOrder/CreateWorkOrder";
import Login from "./pages/Login/Login";
import PlantsTable from "./pages/Plant/PlantsTable/PlantsTable";
import CreatePlant from "./pages/Plant/CreatePlant";
import PlantDetail from "./pages/Plant/PlantDetail";
import PVSystReports from "./pages/PVSystReports/PVSystReports";
import ProductionReports from "./pages/ProductionReports/ProductionReports";
import ReportSummary from "./pages/ReportSummary/ReportSummary";
import AdminPage from "./pages/AdminPage/AdminPage";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ActivitiesTable from "./pages/Activities/ActivitiesTable";
import CreateActivity from "./pages/Activities/CreateActivity";
import ActivityDetail from "./pages/Activities/ActivityDetail";
import { initSessionService } from "./services/sessionService";
import "./App.css";

function PrivateRoute({ children, roles }) {
  const { user } = useContext(AuthContext);

  // Kullanıcı yoksa login sayfasına yönlendir
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Rol kontrolü varsa ve kullanıcının rolü uygun değilse unauthorized sayfasına yönlendir
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

function AppContent() {
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    // AuthContext'i global olarak erişilebilir yap
    window.authContext = authContext;
    initSessionService();

    return () => {
      delete window.authContext;
    };
  }, [authContext]);

  const handleNavbarCollapse = (collapsed) => {
    setIsNavbarCollapsed(collapsed);
  };

  return (
    <div className="App">
      <Navbar onCollapse={handleNavbarCollapse} />
      <main className={isNavbarCollapsed ? "expanded" : ""}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Navigate to="/dashboard" replace />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/work-orders"
            element={
              <PrivateRoute>
                <WorkOrders />
              </PrivateRoute>
            }
          />
          <Route
            path="/work-orders/:id"
            element={
              <PrivateRoute>
                <WorkOrderDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/create-work-order"
            element={
              <PrivateRoute>
                <CreateWorkOrder />
              </PrivateRoute>
            }
          />
          <Route
            path="/plants"
            element={
              <PrivateRoute>
                <PlantsTable />
              </PrivateRoute>
            }
          />
          <Route
            path="/plants/create"
            element={
              <PrivateRoute>
                <CreatePlant />
              </PrivateRoute>
            }
          />
          <Route
            path="/plants/:id"
            element={
              <PrivateRoute>
                <PlantDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/pvsyst-reports"
            element={
              <PrivateRoute>
                <PVSystReports />
              </PrivateRoute>
            }
          />
          <Route
            path="/production-reports"
            element={
              <PrivateRoute>
                <ReportSummary />
              </PrivateRoute>
            }
          />
          <Route
            path="/daily-production"
            element={
              <PrivateRoute>
                <ProductionReports />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute roles={["ADMIN"]}>
                <AdminPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <PrivateRoute>
                <ActivitiesTable />
              </PrivateRoute>
            }
          />
          <Route
            path="/activities/create"
            element={
              <PrivateRoute>
                <CreateActivity />
              </PrivateRoute>
            }
          />
          <Route
            path="/activities/:id"
            element={
              <PrivateRoute>
                <ActivityDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="*"
            element={
              <PrivateRoute>
                <Navigate to="/dashboard" replace />
              </PrivateRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
