import React from "react";

const EsferaFragmento = () => {
  return (
    <div style={{ textAlign: "center", margin: "2rem 0" }}>
      <video
        src="https://gateway.pinata.cloud/ipfs/bafybeibq66a3jmbyo6ztsoldu3aqy35sjpznqgvliysozer3brrup7ixeq"
        controls
        loop
        playsInline
        style={{
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          objectFit: "cover",
          boxShadow: "0 0 50px rgba(255, 255, 255, 0.15)"
        }}
      />
      <p style={{ marginTop: "1rem" }}>Fragmento: Crack in the Silence</p>
    </div>
  );
};

export default EsferaFragmento;
