import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
// import ForgotPassword from "./ForgotPassword";

const pageVariants = {
  initial: { opacity: 0, y: 18, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -18, filter: "blur(6px)" },
};

function PageWrap({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageWrap><LoginPage /></PageWrap>} />
        <Route path="/signup" element={<PageWrap><SignupPage /></PageWrap>} />
        {/* <Route path="/forgot-password" element={<PageWrap><ForgotPassword /></PageWrap>} /> */}
      </Routes>
    </AnimatePresence>
  );
}
