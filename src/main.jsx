import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

function Root() {
  return <App />;
}

const el = document.getElementById("root");
createRoot(el).render(<Root />);
