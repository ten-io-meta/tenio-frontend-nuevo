import React from "react";
import "./EsferaFragmento.css";

const EsferaFragmento = () => {
  return (
    <div className="esfera-container">
      <video
        src="https://gateway.pinata.cloud/ipfs/bafybeibq66a3jmbyo6ztsoldu3aqy35sjpznqgvliysozer3brrup7ixeq"
        controls
        loop
        playsInline
        className="esfera-video"
      />
      <p>Fragmento: Crack in the Silence</p>
    </div>
  );
};

export default EsferaFragmento;
