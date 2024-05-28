import React from 'react';
import './App.css';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import ProductDescription from './components/ProductDescription';
import HowToPlay from './components/HowToPlay';
import CustomerReviews from './components/CustomerReviews';
import PurchaseSection from './components/PurchaseSection';
import Footer from './components/Footer';
import NewsEvents from './components/NewsEvents';
import AboutUs from './components/AboutUs';
import ContactUs from './components/ContactUs';

function App() {
  return (
    <div className="App">
      <Header />
      <HeroSection />
      <AboutUs />
      <NewsEvents />
      <ProductDescription />
      <HowToPlay />
      <CustomerReviews />
      <PurchaseSection />
      <ContactUs />
      <Footer />
    </div>
  );
}

export default App;
