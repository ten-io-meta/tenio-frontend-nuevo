import React, { useEffect, useState } from "react";

const FragmentStats = ({ contractInstance, account }) => {
  const [ownedFragments, setOwnedFragments] = useState(0);
  const [burnedFragments, setBurnedFragments] = useState(0);
  const [mintedFragments, setMintedFragments] = useState(0);
  const [liveFragments, setLiveFragments] = useState(0);
  const [remainingToMint, setRemainingToMint] = useState(0);

  useEffect(() => {
    async function fetchData() {
      if (window.ethereum && contractInstance && account) {
        let burned = 0;
        let owned = 0;

        const minted = await contractInstance.tokenIds();
        const mintedNumber = parseInt(minted.toString());

        for (let i = 1; i <= mintedNumber; i++) {
          try {
            const owner = await contractInstance.ownerOf(i);
            if (owner.toLowerCase() === account.toLowerCase()) {
              owned++;
            }
          } catch (error) {
            burned++;
          }
        }

        setMintedFragments(mintedNumber);
        setOwnedFragments(owned);
        setBurnedFragments(burned);
        setLiveFragments(mintedNumber - burned);
        setRemainingToMint(1000 - mintedNumber);
      }
    }

    fetchData();
  }, [contractInstance, account]);

  return (
    <div style={{ background: "#222", padding: "1.5rem", borderRadius: "12px", marginBottom: "2rem" }}>
      <h2>📊 Estado global de los fragmentos</h2>
      <p>🔢 Total Supply: <strong>1000</strong></p>
      <p>🧿 Tus fragmentos vivos: <strong>{ownedFragments}</strong></p>
      <p>⚰️ Fragmentos quemados: <strong>{burnedFragments}</strong></p>
      <p>💠 Fragmentos vivos en manos de usuarios: <strong>{liveFragments}</strong></p>
      <p>🪙 Fragmentos aún no emitidos: <strong>{remainingToMint}</strong></p>
    </div>
  );
};

export default FragmentStats;
