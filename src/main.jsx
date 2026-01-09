import React from "react";
import { createRoot } from "react-dom/client";
import { inject } from "@vercel/analytics";
import App from "./App.jsx";
import "./App.css";

// Initialize Vercel Web Analytics
inject();

function Root() {
  return <App />;
}

const el = document.getElementById("root");
createRoot(el).render(<Root />);
