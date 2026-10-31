import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import { AuthProvider } from "./features/auth/AuthProvider.jsx";
import { SocketProvider } from "./services/socket/SocketProvider.jsx";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
import { CartProvider } from "./features/cart/CartProvider.jsx";
import { WishlistProvider } from "./features/shop/WishlistProvider.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <CartProvider>
              <WishlistProvider>
                <App />
              </WishlistProvider>
            </CartProvider>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
