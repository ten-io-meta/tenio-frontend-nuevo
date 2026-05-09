import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Vault from "./Vault.jsx";
import "./App.css";

function Root() {
  const path = window.location.hash;

  if (path === "#/vault") {
    return <Vault />;
  }

  return <App />;
}

const el = document.getElementById("root");
createRoot(el).render(<Root />);