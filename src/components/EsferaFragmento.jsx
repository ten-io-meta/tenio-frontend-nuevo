import React from "react";

const EsferaFragmento = () => {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      marginTop: "2rem",
      textAlign: "center"
    }}>
      <div style={{
        width: "300px",
        height: "300px",
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 0 50px rgba(255, 255, 255, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <video
          src="https://gateway.pinata.cloud/ipfs/bafybeibq66a3jmbyo6ztsoldu3aqy35sjpznqgvliysozer3brrup7ixeq"
          controls
          loop
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />
      </div>
      <p style={{ marginTop: "1rem" }}>Fragmento: Crack in the Silence</p>
    </div>
  );
};

export default EsferaFragmento;
