import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Layout from "./components/Layout"
import { LoginPage, RegisterPage } from "./pages/AuthPages"
import CartPage from "./pages/CartPage"
import CheckoutPage from "./pages/CheckoutPage"
import ConfirmationPage from "./pages/ConfirmationPage"
import HomePage from "./pages/HomePage"
import NotFoundPage from "./pages/NotFoundPage"
import OrdersPage from "./pages/OrdersPage"
import ProductPage from "./pages/ProductPage"
import PromotionsPage from "./pages/PromotionsPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route
            path="/orders/:id/confirmation"
            element={<ConfirmationPage />}
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
