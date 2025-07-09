import React from "react";

const EsferaFragmento = () => {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginTop: "2rem"
    }}>
      <video
        src="https://gateway.pinata.cloud/ipfs/bafybeibq66a3jmbyo6ztsoldu3aqy35sjpznqgvliysozer3brrup7ixeq"
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: "260px",
          height: "260px",
          borderRadius: "50%",
          objectFit: "cover",
          boxShadow: "0 0 60px rgba(255, 255, 255, 0.2)"
        }}
      />
      <p style={{ marginTop: "0.5rem", textAlign: "center" }}>
        Fragmento: Crack in the Silence
      </p>
    </div>
  );
};

export default EsferaFragmento;
