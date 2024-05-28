import React from 'react';
import "./ContactUs.css"

const ContactUs = () => {
  return (
    <section id="contact" className="contact-us">
      <h2>Contact Us</h2>
      <p>If you have any questions or need assistance, please feel free to reach out to us using the contact form below or email us at <a href="mailto:info@gamertaverntcg.com">info@gamertaverntcg.com</a>.</p>
      <form>
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input type="text" id="name" name="name" required />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" name="email" required />
        </div>
        <div className="form-group">
          <label htmlFor="message">Message:</label>
          <textarea id="message" name="message" rows="5" required></textarea>
        </div>
        <button type="submit">Send Message</button>
      </form>
    </section>
  );
};

export default ContactUs;
