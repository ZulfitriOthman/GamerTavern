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

import MerchantRoot from "../features/merchant/MerchantRoot.jsx";
import MerchantLayout from "../components/merchant/MerchantLayout.jsx";
import MerchantLoginPage from "../pages/merchant/MerchantLoginPage.jsx";
import MerchantRegisterPage from "../pages/merchant/MerchantRegisterPage.jsx";
import MerchantPendingPage from "../pages/merchant/MerchantPendingPage.jsx";
import MerchantDashboardPage from "../pages/merchant/MerchantDashboardPage.jsx";
import MerchantProductsListPage from "../pages/merchant/MerchantProductsListPage.jsx";
import MerchantProductNewPage from "../pages/merchant/MerchantProductNewPage.jsx";
import MerchantProductDetailPage from "../pages/merchant/MerchantProductDetailPage.jsx";
import MerchantProductEditPage from "../pages/merchant/MerchantProductEditPage.jsx";
import MerchantInventoryPage from "../pages/merchant/MerchantInventoryPage.jsx";
import MerchantOrdersListPage from "../pages/merchant/MerchantOrdersListPage.jsx";
import MerchantOrderDetailPage from "../pages/merchant/MerchantOrderDetailPage.jsx";
import MerchantStaffPage from "../pages/merchant/MerchantStaffPage.jsx";
import MerchantPayoutsPage from "../pages/merchant/MerchantPayoutsPage.jsx";
import MerchantSettingsLayout from "../pages/merchant/MerchantSettingsLayout.jsx";
import MerchantSettingsProfilePage from "../pages/merchant/MerchantSettingsProfilePage.jsx";
import MerchantSettingsBankPage from "../pages/merchant/MerchantSettingsBankPage.jsx";

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
      </Route>

      {/* Merchant portal — deliberately outside the public Layout (own shell,
          see MerchantLayout.jsx). MerchantRoot wraps every /merchant/* route,
          login/register/pending included, so MerchantAuthProvider is always
          available (see the note in MerchantRoot.jsx). */}
      <Route path="/merchant" element={<MerchantRoot />}>
        <Route path="login" element={<MerchantLoginPage />} />
        <Route path="register" element={<MerchantRegisterPage />} />
        <Route path="pending" element={<MerchantPendingPage />} />

        <Route element={<MerchantLayout />}>
          <Route path="dashboard" element={<MerchantDashboardPage />} />
          <Route path="products" element={<MerchantProductsListPage />} />
          <Route path="products/new" element={<MerchantProductNewPage />} />
          <Route path="products/:id" element={<MerchantProductDetailPage />} />
          <Route path="products/:id/edit" element={<MerchantProductEditPage />} />
          <Route path="inventory" element={<MerchantInventoryPage />} />
          <Route path="orders" element={<MerchantOrdersListPage />} />
          <Route path="orders/:id" element={<MerchantOrderDetailPage />} />
          <Route path="staff" element={<MerchantStaffPage />} />
          <Route path="payouts" element={<MerchantPayoutsPage />} />
          <Route element={<MerchantSettingsLayout />}>
            <Route path="settings" element={<MerchantSettingsProfilePage />} />
            <Route path="settings/profile" element={<MerchantSettingsProfilePage />} />
            <Route path="settings/bank" element={<MerchantSettingsBankPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
