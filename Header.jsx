import React from 'react';
import './Header.css';  // We'll add a separate CSS file for the Header
import imgtavern from "./img/Gamer's Tavern.png"

const Header = () => {
  return (
    <header className="header">
      <div className="logo">
        <img src={imgtavern} alt="Gamer Tavern TCG Logo" />
        <h1>Gamer Tavern TCG</h1>
      </div>
      <nav className="nav">
        <ul>
          <li><a href="#aboutus">About Us</a></li>
          <li><a href="#news">News & Events</a></li>
          <li><a href="#product">Product</a></li>
          <li><a href="#contact">Contact Us</a></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
