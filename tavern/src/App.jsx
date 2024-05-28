import React from 'react';

const App = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f4f4' }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/product-image.jpg" alt="Product" style={{ maxWidth: '100%', height: 'auto' }} />
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Product Name</h1>
          <p style={{ fontSize: '18px', marginBottom: '20px' }}>This is a great product that you will love!</p>
          <div style={{ fontSize: '22px', color: '#333', marginBottom: '20px' }}>$19.99</div>
          <a href="#" style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 20px', textDecoration: 'none', borderRadius: '5px', fontSize: '18px' }}>Buy Now</a>
        </div>
      </div>
    </div>
  );
};

export default App;
