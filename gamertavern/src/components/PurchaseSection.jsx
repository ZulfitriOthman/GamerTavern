import React from 'react';

const PurchaseSection = () => {
  return (
    <section className="purchase-section">
      <h2>Ready to experience the fun?</h2>
      <p>Order now and get free shipping on your first purchase!</p>
      <div className="purchase-buttons">
        <button>Add to Cart</button>
        <button>Buy Now</button>
      </div>
      <p className="price">$29.99</p>
    </section>
  );
};

export default PurchaseSection;
