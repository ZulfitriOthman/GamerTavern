import { Route, Routes } from "react-router-dom";
import Layout from "../components/layout/Layout.jsx";
import HomePage from "../pages/HomePage.jsx";
import ShopPage from "../pages/ShopPage.jsx";
import ServicesPage from "../pages/ServicesPage.jsx";
import DroneServicesPage from "../pages/services/DroneServicesPage.jsx";
import WebDevelopmentPage from "../pages/services/WebDevelopmentPage.jsx";
import ApplicationDevelopmentPage from "../pages/services/ApplicationDevelopmentPage.jsx";
import TcgPage from "../pages/TcgPage.jsx";
import EsportsPage from "../pages/EsportsPage.jsx";
import AboutPage from "../pages/AboutPage.jsx";
import ContactPage from "../pages/ContactPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import TournamentListPage from "../pages/esports/TournamentListPage.jsx";
import TournamentDetailPage from "../pages/esports/TournamentDetailPage.jsx";
import LoginPage from "../features/auth/LoginPage.jsx";
import RegisterPage from "../features/auth/RegisterPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/drone" element={<DroneServicesPage />} />
        <Route path="/services/web-development" element={<WebDevelopmentPage />} />
        <Route
          path="/services/application-development"
          element={<ApplicationDevelopmentPage />}
        />
        <Route path="/tcg" element={<TcgPage />} />
        <Route path="/esports" element={<EsportsPage />} />
        <Route path="/esports/tournaments" element={<TournamentListPage />} />
        <Route path="/esports/tournaments/:id" element={<TournamentDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
