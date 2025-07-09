import React, { useEffect, useState } from "react";

function FragmentStats({ contractInstance, account }) {
  const [burned, setBurned] = useState(0);
  const [held, setHeld] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [remaining, setRemaining] = useState(1000); // basado en supply = 1000

  useEffect(() => {
    async function fetchStats() {
      if (!contractInstance || !account) return;

      try {
        const supplyBN = await contractInstance.tokenIds();
        const minted = Number(supplyBN);

        let userOwned = 0;
        let burnedCount = 0;

        for (let i = 1; i <= minted; i++) {
          try {
            const owner = await contractInstance.ownerOf(i);
            if (owner.toLowerCase() === account.toLowerCase()) {
              userOwned++;
            }
          } catch (error) {
            burnedCount++; // token no existe → quemado
          }
        }

        setUserCount(userOwned);
        setBurned(burnedCount);
        setHeld(minted - burnedCount);
        setRemaining(1000 - minted);
      } catch (err) {
        console.error("Error obteniendo stats:", err);
      }
    }

    fetchStats();
  }, [contractInstance, account]);

  return (
    <div className="stats-column">
      <span>🧱 Total Supply: <strong>1000</strong></span>
      <span>🟣 Vivos tuyos: <strong>{userCount}</strong></span>
      <span>⚰️ Quemados: <strong>{burned}</strong></span>
      <span>💎 En manos: <strong>{held}</strong></span>
      <span>📭 No emitidos: <strong>{remaining}</strong></span>
    </div>
  );
}

export default FragmentStats;
