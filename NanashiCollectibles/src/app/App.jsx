import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "../components/layout/Layout.jsx";
import HomePage from "../pages/HomePage.jsx";
import ShopPage from "../pages/ShopPage.jsx";
import ProductDetailPage from "../pages/ProductDetailPage.jsx";
import CartPage from "../pages/CartPage.jsx";
import CheckoutPage from "../pages/CheckoutPage.jsx";
import OrderConfirmationPage from "../pages/OrderConfirmationPage.jsx";
import OrdersListPage from "../pages/OrdersListPage.jsx";
import ServicesPage from "../pages/ServicesPage.jsx";
import DroneServicesPage from "../pages/services/DroneServicesPage.jsx";
import WebDevelopmentPage from "../pages/services/WebDevelopmentPage.jsx";
import ApplicationDevelopmentPage from "../pages/services/ApplicationDevelopmentPage.jsx";
import TicketingServicePage from "../pages/services/TicketingServicePage.jsx";
import TcgPage from "../pages/TcgPage.jsx";
import EsportsPage from "../pages/EsportsPage.jsx";
import PortfolioPage from "../pages/PortfolioPage.jsx";
import PortfolioProjectPage from "../pages/PortfolioProjectPage.jsx";
import AboutPage from "../pages/AboutPage.jsx";
import ContactPage from "../pages/ContactPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import TournamentListPage from "../pages/esports/TournamentListPage.jsx";
import TournamentDetailPage from "../pages/esports/TournamentDetailPage.jsx";
import LoginPage from "../features/auth/LoginPage.jsx";
import RegisterPage from "../features/auth/RegisterPage.jsx";
import ForgotPasswordPage from "../features/auth/ForgotPasswordPage.jsx";
import ResetPasswordPage from "../features/auth/ResetPasswordPage.jsx";

import MerchantRoot from "../features/merchant/MerchantRoot.jsx";
import MerchantLayout from "../components/merchant/MerchantLayout.jsx";
import MerchantPortalPage from "../pages/merchant/MerchantPortalPage.jsx";
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
import MerchantSettingsNotificationsPage from "../pages/merchant/MerchantSettingsNotificationsPage.jsx";

import AdminLayout from "../components/admin/AdminLayout.jsx";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage.jsx";
import AdminMerchantsPage from "../pages/admin/AdminMerchantsPage.jsx";
import AdminMerchantDetailPage from "../pages/admin/AdminMerchantDetailPage.jsx";
import AdminAuditLogPage from "../pages/admin/AdminAuditLogPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/:slug" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/orders" element={<OrdersListPage />} />
        <Route path="/orders/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/drone" element={<DroneServicesPage />} />
        <Route path="/services/web-development" element={<WebDevelopmentPage />} />
        <Route
          path="/services/application-development"
          element={<ApplicationDevelopmentPage />}
        />
        <Route path="/services/ticketing" element={<TicketingServicePage />} />
        <Route path="/tcg" element={<TcgPage />} />
        <Route path="/esports" element={<EsportsPage />} />
        <Route path="/esports/tournaments" element={<TournamentListPage />} />
        <Route path="/esports/tournaments/:id" element={<TournamentDetailPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/portfolio/:slug" element={<PortfolioProjectPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Catch-all lives inside the shared Layout too — a broken/typo'd URL
            is exactly the moment a visitor most needs real site navigation,
            not a dead end. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Merchant portal — MerchantRoot wraps every /merchant/* route so
          MerchantAuthProvider is always available (see the note in
          MerchantRoot.jsx). The pre-auth pages (landing/login/register/
          pending) use the same public Header/Footer as the rest of the site —
          a prospective merchant is still a site visitor and needs real
          navigation, not a dead end with one "back to site" button. Only the
          authenticated dashboard gets its own shell (MerchantLayout.jsx). */}
      <Route path="/merchant" element={<MerchantRoot />}>
        <Route element={<Layout />}>
          <Route index element={<MerchantPortalPage />} />
          <Route path="login" element={<MerchantLoginPage />} />
          <Route path="register" element={<MerchantRegisterPage />} />
          <Route path="pending" element={<MerchantPendingPage />} />
        </Route>

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
            <Route path="settings/notifications" element={<MerchantSettingsNotificationsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Admin — reuses the same shared session as the storefront/merchant portal
          (features/auth/AuthContext.js); no separate admin login route, since
          "admin" is just user.role === "ADMIN" on that same JWT. AdminLayout
          redirects unauthenticated visitors to the existing /login. */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="merchants" element={<AdminMerchantsPage />} />
        <Route path="merchants/:id" element={<AdminMerchantDetailPage />} />
        <Route path="audit-log" element={<AdminAuditLogPage />} />
      </Route>
    </Routes>
  );
}
