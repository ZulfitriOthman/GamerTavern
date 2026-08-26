import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f5f5f5",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "20px",
          backgroundColor: "#222",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <h1>My React Website</h1>
      </header>

      {/* Main Content */}
      <main
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <h2>Welcome</h2>

        <p>
          This is a basic React starter page. You can replace this content with
          your own components and pages.
        </p>

        <div style={{ marginTop: "30px" }}>
          <p>Count: {count}</p>

          <button
            type="button"
            onClick={() => setCount((previousCount) => previousCount + 1)}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Increase Count
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          position: "fixed",
          bottom: 0,
          width: "100%",
          padding: "15px",
          backgroundColor: "#222",
          color: "#fff",
          textAlign: "center",
        }}
      >
        © 2026 My Website
      </footer>
    </div>
  );
}

export default App;