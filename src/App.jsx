import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import ABI from "./web3/ABI.json";
import {
  __env,
  getHeroVideoHttp,
  getChainId,
  getAccounts,
  getActiveAddressFromChain,
  getCounterOffset,
  getStats,
  getOwnedFragments,
  getTokenURI,
  mintNext,
  burn as burnTx,
  addToMetamask,
  withdrawAllSurplus,
  withdrawSurplus,
  hasWindowEthereum,
} from "./web3/TENIOFragmentConnection";
import "./App.css";

/* ipfs:// -> https://ipfs.io/ipfs/  */
function ipfsToHttp(url) {
  if (!url) return "";
  return url.replace("ipfs://", "https://ipfs.io/ipfs/");
}

/* Deriva métricas coherentes desde on-chain */
function deriveNumbers(s) {
  const total = s?.maxSupply ?? 1000;
  const burned = s?.burned ?? 0;     // tokens quemados (histórico)
  const live = s?.supplyLive ?? 0;   // supply vivo actual
  const minted = burned + live;      // minteados históricos
  const available = total - minted;  // disponibles sin mintear
  return { total, burned, live, minted, available };
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [forceNet, setForceNet] = useState(null); // "sepolia" | "mainnet" | null

  const activeContract = useMemo(
    () => getActiveAddressFromChain(chainId, forceNet),
    [chainId, forceNet]
  );
  const counterOffset = useMemo(
    () => getCounterOffset(chainId, forceNet),
    [chainId, forceNet]
  );

  const [videoUrl, setVideoUrl] = useState("");
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState("");

  const [owned, setOwned] = useState([]);
  const [ownedError, setOwnedError] = useState("");

  const [minting, setMinting] = useState(false);
  const [burning, setBurning] = useState(false);
  const [burnId, setBurnId] = useState("");

  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawPartialAmt, setWithdrawPartialAmt] = useState("");

  /* NUEVO: flag de owner para ocultar panel a no-owners */
  const [isOwner, setIsOwner] = useState(false);

  /* Cargar URL del vídeo (gateway) */
  useEffect(() => {
    (async () => {
      const raw = await getHeroVideoHttp();
      setVideoUrl(ipfsToHttp(raw));
    })();
  }, []);

  /* Suscripción básica a cambios de cuenta/red */
  useEffect(() => {
    if (!hasWindowEthereum()) return;

    const onAcc = (acc) => {
      const a = (acc && acc[0]) || "";
      setAccount(a);
      setConnected(!!a);
    };
    const onChain = (id) => setChainId(id);

    window.ethereum.request({ method: "eth_accounts" }).then(onAcc).catch(() => {});
    window.ethereum.on?.("accountsChanged", onAcc);
    window.ethereum.on?.("chainChanged", onChain);
    getChainId().then(setChainId).catch(() => {});

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAcc);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  }, []);

  /* Carga inicial cuando cambia contrato o cuenta */
  useEffect(() => {
    if (!activeContract) return;
    (async () => {
      setLoadingStats(true);
      setStatsError("");
      try {
        const s = await getStats(activeContract);
        setStats(s);
      } catch (e) {
        setStatsError(e?.message || "No se pudieron cargar las estadísticas.");
      } finally {
        setLoadingStats(false);
      }

      if (account) {
        try {
          setOwned(await getOwnedFragments(activeContract, account));
          setOwnedError("");
        } catch (e) {
          setOwned([]);
          setOwnedError(e?.message || "No se pudo obtener tus fragmentos.");
        }
      } else {
        setOwned([]);
        setOwnedError("");
      }
    })();
  }, [activeContract, account]);

  /* NUEVO: polling (refresca stats/owned cada 15s) */
  useEffect(() => {
    if (!activeContract) return;
    let alive = true;

    const tick = async () => {
      try {
        const s = await getStats(activeContract);
        if (!alive) return;
        setStats(s);
      } catch {}
      if (account) {
        try {
          const o = await getOwnedFragments(activeContract, account);
          if (!alive) return;
          setOwned(o);
        } catch {}
      }
    };

    const id = setInterval(tick, 15000);
    tick(); // primer tiro inmediato
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [activeContract, account]);

  /* NUEVO: detectar owner on-chain (Ownable.owner()) */
  useEffect(() => {
    (async () => {
      try {
        if (!activeContract || !account || !hasWindowEthereum()) {
          setIsOwner(false);
          return;
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(activeContract, ABI, await provider);
        const ownerAddr = await contract.owner(); // OpenZeppelin Ownable
        setIsOwner(ownerAddr?.toLowerCase() === account?.toLowerCase());
      } catch {
        setIsOwner(false);
      }
    })();
  }, [activeContract, account]);

  const derived = useMemo(() => deriveNumbers(stats), [stats]);

  const handleConnect = async () => {
    try {
      const accs = await getAccounts();
      const a = accs?.[0] || "";
      setAccount(a);
      setConnected(!!a);
      setChainId(await getChainId());
    } catch (e) {
      console.warn(e);
    }
  };

  const handleUseSepolia = () => setForceNet("sepolia");
  const handleUseMainnet = () => setForceNet("mainnet");

  // siguiente número visual con offset opcional
  const nextMintNumber = useMemo(() => {
    return derived.minted + 1 + (counterOffset || 0);
  }, [derived.minted, counterOffset]);

  const handleMint = async () => {
    try {
      setMinting(true);
      await mintNext(activeContract, "metadata.json");
      const s = await getStats(activeContract);
      setStats(s);
      if (account) setOwned(await getOwnedFragments(activeContract, account));
    } catch (e) {
      alert(`Error mint: ${e?.message || e}`);
    } finally {
      setMinting(false);
    }
  };

  const handleBurn = async () => {
    const id = Number(burnId);
    if (!id || Number.isNaN(id)) return;
    try {
      setBurning(true);
      await burnTx(activeContract, id);
      setBurnId("");
      const s = await getStats(activeContract);
      setStats(s);
      if (account) setOwned(await getOwnedFragments(activeContract, account));
    } catch (e) {
      alert(`Error burn: ${e?.message || e}`);
    } finally {
      setBurning(false);
    }
  };

  const handleAddToMM = async (id) => {
    try {
      const uri = await getTokenURI(activeContract, id);
      await addToMetamask(activeContract, id, uri);
    } catch (e) {
      alert(`No se pudo añadir a MetaMask: ${e?.message || e}`);
    }
  };

  const handleWithdrawAll = async () => {
    try {
      setWithdrawing(true);
      await withdrawAllSurplus(activeContract);
      setStats(await getStats(activeContract));
    } catch (e) {
      alert(`Error retirando excedente: ${e?.message || e}`);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleWithdrawPartial = async () => {
    const amt = Number(withdrawPartialAmt);
    if (!amt || Number.isNaN(amt)) return;
    try {
      setWithdrawing(true);
      await withdrawSurplus(activeContract, amt);
      setWithdrawPartialAmt("");
      setStats(await getStats(activeContract));
    } catch (e) {
      alert(`Error retirando parcial: ${e?.message || e}`);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">TEN.IO Fragment</div>
        <h1>EL UMBRAL – Frontend</h1>
      </header>

      <main className="grid">
        {/* IZQUIERDA: vídeo */}
        <section className="left">
          {videoUrl ? (
            <video
              className="video"
              src={videoUrl}
              playsInline
              loop
              autoPlay
              controls
              preload="metadata"
            />
          ) : (
            <div className="no-media">Sin media</div>
          )}
        </section>

        {/* DERECHA: panel */}
        <section className="right">
          <div className="connection">
            <span className={connected ? "dot ok" : "dot off"} />
            {connected ? `Conectado: ${account}` : "Conectado: No conectado"}
          </div>

          <div className="addr">{activeContract || "<sin contrato>"}</div>

          <div className="row">
            <button onClick={handleUseSepolia}>Usar Sepolia</button>
            <button onClick={handleUseMainnet}>Usar Mainnet</button>
            <button onClick={handleConnect}>Conectar wallet</button>
          </div>

          <div className="stats">
            <div><b>Total:</b> {derived.total}</div>
            <div>🧮 <b>Minteados (histórico):</b> {derived.minted}</div>
            <div>🥓 <b>Quemados:</b> {derived.burned}</div>
            <div>🟢 <b>Vivos (holders):</b> {derived.live}</div>
            <div>🪙 <b>Disponibles (sin mintear):</b> {derived.available}</div>

            <div className="mt8"><b>Mint:</b> {stats?.mintPrice ?? 0} ETH</div>
            <div><b>Colateral (burn):</b> {stats?.burnRefund ?? 0} ETH</div>
            <div><b>Reserva requerida:</b> {(stats?.requiredReserveEth ?? 0).toFixed(3)} ETH</div>

            {/* NUEVO: Excedente retirable solo visible para owner */}
            {isOwner && (
              <div><b>Excedente retirable:</b> {(stats?.withdrawableEth ?? 0).toFixed(3)} ETH</div>
            )}

            {loadingStats && <div className="note">Cargando estadísticas…</div>}
            {statsError && <div className="warn">{statsError}</div>}
          </div>

          <div className="row">
            <button onClick={handleMint} disabled={minting || !connected}>
              {minting ? "Minteando…" : `Mintear fragmento #${nextMintNumber}`}
            </button>
          </div>

          <div className="row">
            <input
              placeholder="ID a quemar / ver"
              value={burnId}
              onChange={(e) => setBurnId(e.target.value)}
            />
            <button onClick={handleBurn} disabled={burning || !connected}>
              {burning ? "Quemando…" : "Quemar"}
            </button>
          </div>

          <div className="note small">
            Nota: al quemar recibes {stats?.burnRefund ?? 0} ETH <i>(menos gas)</i>.
          </div>

          <div className="owned">
            <div><b>🥚 Tus fragmentos ({owned.length}):</b></div>
            {owned.length === 0 ? (
              <div className="muted">No tienes fragmentos.</div>
            ) : (
              <ul>
                {owned.map((id) => (
                  <li key={id}>
                    #{id}{" "}
                    <button className="ghost" onClick={() => handleAddToMM(id)}>
                      Añadir a MetaMask
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ownedError && <div className="warn">{ownedError}</div>}
          </div>

          {/* NUEVO: Panel de Owner SOLO si isOwner */}
          {isOwner && (
            <div className="owner">
              <div className="owner-title">🔑 Panel de Owner</div>
              <div className="row">
                <button onClick={handleWithdrawAll} disabled={withdrawing}>
                  Retirar excedente (todo)
                </button>
                <input
                  placeholder="Monto parcial (ETH)"
                  value={withdrawPartialAmt}
                  onChange={(e) => setWithdrawPartialAmt(e.target.value)}
                />
                <button onClick={handleWithdrawPartial} disabled={withdrawing}>
                  Retirar parcial…
                </button>
              </div>
              <div className="muted">
                Excedente disponible: {(stats?.withdrawableEth ?? 0).toFixed(3)} ETH
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
