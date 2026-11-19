import { useEffect, useState } from "react";
import { explainChainReadError } from "../web3/explainChainReadError.js";
import { getStats, getOwnedFragments } from "../web3/TENIOFragmentConnection.js";

// Compatibility view for LEGACY V2 only. Never infer "burned" from an RPC
// exception, because a timeout, unsupported getter or wrong chain is UNKNOWN.
export default function FragmentStats({ contractInstance, account }) {
  const [snapshot, setSnapshot] = useState(null);
  const [userCount, setUserCount] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setUserCount(null);
    setError("");
    const address = contractInstance?.target || contractInstance?.address;
    if (!address) {
      setError("Contrato no verificado: estadísticas no disponibles.");
      return () => { active = false; };
    }

    (async () => {
      try {
        const stats = await getStats(address);
        const owned = account ? await getOwnedFragments(address, account) : null;
        if (active) {
          setSnapshot(stats);
          setUserCount(owned === null ? null : owned.length);
        }
      } catch (e) {
        if (active) {
          setSnapshot(null);
          setUserCount(null);
          setError(explainChainReadError(e, "es", true));
        }
      }
    })();
    return () => { active = false; };
  }, [contractInstance, account]);

  const display = (value) => value ?? "—";
  return (
    <div className="stats-column">
      <span>🧱 Total máximo: <strong>{display(snapshot?.maxSupply)}</strong></span>
      <span>🟣 Vivos tuyos: <strong>{display(userCount)}</strong></span>
      <span>⚰️ Quemados: <strong>{display(snapshot?.burned)}</strong></span>
      <span>💎 NFT vivos: <strong>{display(snapshot?.supplyLive)}</strong></span>
      <span>📭 No emitidos: <strong>{display(snapshot?.availableToMint)}</strong></span>
      {error && <div role="alert">{error}</div>}
    </div>
  );
}
