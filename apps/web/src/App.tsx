import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from './components/AdminLayout';
import AdminPage from './pages/AdminPage';
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AccountPage from "./pages/AccountPage";
import CartPage from "./pages/CartPage";

import RegisterPage from "./pages/RegisterPage";
import PromotionsPage from "./pages/PromotionsPage";
import RewardsPage from "./pages/RewardsPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";
import PaymentReturnPage from "./pages/PaymentReturnPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="ingredients" replace />} />
          <Route path=":section" element={<AdminPage />} />
        </Route>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/payments/return" element={<PaymentReturnPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrdersPage />} />
            <Route path="/orders/:id/confirmation" element={<OrdersPage />} />
          </Route>
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/rewards" element={<RewardsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
