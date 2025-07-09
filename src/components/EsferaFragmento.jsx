// src/components/EsferaFragmento.jsx
import React from "react";

const EsferaFragmento = () => {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <video
        src="https://gateway.pinata.cloud/ipfs/bafybeibq66a3jmbyo6ztsoldu3aqy35sjpznqgvliysozer3brrup7ixeq"
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          objectFit: "cover",
          boxShadow: "0 0 40px #ffffff20"
        }}
      />
      <p style={{ textAlign: "center", marginTop: "0.5rem", color: "white" }}>
        Fragmento: Crack in the Silence
      </p>
    </div>
  );
};

export default EsferaFragmento;
