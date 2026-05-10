import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Vault from "./Vault.jsx";
import MusicArchive from "./MusicArchive.jsx";
import "./App.css";

function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (hash.includes("music")) {
    return <MusicArchive />;
  }

  if (hash.includes("vault")) {
    return <Vault />;
  }

  return <App />;
}

const el = document.getElementById("root");
createRoot(el).render(<Root />);