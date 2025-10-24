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

/* ---------- i18n ---------- */
const T = {
  es: {
    brand: "TEN.IO Fragment",
    title: "EL UMBRAL – Frontend",
    btnSepolia: "Usar Sepolia",
    btnMainnet: "Usar Mainnet",
    btnConnect: "Conectar wallet",
    connectedYes: (acc) => `Conectado: ${acc}`,
    connectedNo: "Conectado: No conectado",

    statsTotal: "Total",
    statsMintedHist: "Minteados (histórico)",
    statsBurned: "Quemados",
    statsLive: "Vivos (holders)",
    statsAvail: "Disponibles (sin mintear)",

    mintPrice: "Mint",
    burnRefund: "Colateral (burn)",
    reserveReq: "Reserva requerida",
    withdrawable: "Excedente retirable",

    loadingStats: "Cargando estadísticas…",
    mintAction: (n) => `Mintear fragmento #${n}`,
    minting: "Minteando…",

    burnInputPH: "ID a quemar / ver",
    burnBtn: "Quemar",
    burning: "Quemando…",
    burnNotePrefix: "Nota: al quemar recibes",
    burnNoteSuffix: "ETH (menos gas).",

    yourFrags: (n) => `🥚 Tus fragmentos (${n}):`,
    noFrags: "No tienes fragmentos.",
    addMM: "Añadir a MetaMask",

    ownerPanel: "🔑 Panel de Owner",
    withdrawAll: "Retirar excedente (todo)",
    withdrawPartialPH: "Monto parcial (ETH)",
    withdrawPartialBtn: "Retirar parcial…",
    ownerExcess: "Excedente disponible",

    lang_es: "ES",
    lang_en: "EN",
  },
  en: {
    brand: "TEN.IO Fragment",
    title: "THE THRESHOLD – Frontend",
    btnSepolia: "Use Sepolia",
    btnMainnet: "Use Mainnet",
    btnConnect: "Connect wallet",
    connectedYes: (acc) => `Connected: ${acc}`,
    connectedNo: "Connected: Not connected",

    statsTotal: "Total",
    statsMintedHist: "Minted (historical)",
    statsBurned: "Burned",
    statsLive: "Alive (holders)",
    statsAvail: "Available (unminted)",

    mintPrice: "Mint",
    burnRefund: "Collateral (burn)",
    reserveReq: "Required reserve",
    withdrawable: "Withdrawable surplus",

    loadingStats: "Loading stats…",
    mintAction: (n) => `Mint fragment #${n}`,
    minting: "Minting…",

    burnInputPH: "ID to burn / view",
    burnBtn: "Burn",
    burning: "Burning…",
    burnNotePrefix: "Note: burning returns",
    burnNoteSuffix: "ETH (minus gas).",

    yourFrags: (n) => `🥚 Your fragments (${n}):`,
    noFrags: "You don't hold any fragments.",
    addMM: "Add to MetaMask",

    ownerPanel: "🔑 Owner Panel",
    withdrawAll: "Withdraw surplus (all)",
    withdrawPartialPH: "Partial amount (ETH)",
    withdrawPartialBtn: "Withdraw partial…",
    ownerExcess: "Available surplus",

    lang_es: "ES",
    lang_en: "EN",
  },
};

/* Utilidad ipfs:// -> https://ipfs.io/ipfs/  */
function ipfsToHttp(url) {
  if (!url) return "";
  return url.replace("ipfs://", "https://ipfs.io/ipfs/");
}

/* Deriva métricas coherentes desde on-chain */
function deriveNumbers(s) {
  const total = s?.maxSupply ?? 1000;
  const burned = s?.burned ?? 0;
  const live = s?.supplyLive ?? 0;
  const minted = burned + live;
  const available = total - minted;
  return { total, burned, live, minted, available };
}

/* 🔁 Esperar a que modals-tenio.js esté cargado */
async function waitForModalsReady() {
  let retries = 30; // ~3s
  while (retries-- > 0) {
    if (
      window.showMintSuccessModal &&
      window.showBurnConfirmModal &&
      window.showBurnCompleteModal
    ) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.warn("TENIO modals not ready");
  return false;
}

export default function App() {
  // ---- idioma ----
  const [lang, setLang] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("lang") || "es"
      : "es"
  );
  const tr = T[lang] || T.es;

  function changeLang(newLang) {
    setLang(newLang);
    try {
      localStorage.setItem("lang", newLang);
    } catch {}
  }

  // ---- blockchain state ----
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

  const [isOwner, setIsOwner] = useState(false);

  /* Cargar URL del vídeo (gateway) */
  useEffect(() => {
    (async () => {
      const raw = await getHeroVideoHttp();
      setVideoUrl(ipfsToHttp(raw));
    })();
  }, []);

  /* Suscripción a cambios de cuenta/red */
  useEffect(() => {
    if (!hasWindowEthereum()) return;

    const onAcc = (acc) => {
      const a = (acc && acc[0]) || "";
      setAccount(a);
      setConnected(!!a);
    };
    const onChain = (id) => setChainId(id);

    window.ethereum
      .request({ method: "eth_accounts" })
      .then(onAcc)
      .catch(() => {});
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
        setStatsError(e?.message || "Error loading stats.");
      } finally {
        setLoadingStats(false);
      }

      if (account) {
        try {
          setOwned(await getOwnedFragments(activeContract, account));
          setOwnedError("");
        } catch (e) {
          setOwned([]);
          setOwnedError(e?.message || "Cannot get your fragments.");
        }
      } else {
        setOwned([]);
        setOwnedError("");
      }
    })();
  }, [activeContract, account]);

  /* Polling cada 15s para refrescar stats/owned */
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
    tick();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [activeContract, account]);

  /* detectar owner on-chain (Ownable.owner()) */
  useEffect(() => {
    (async () => {
      try {
        if (!activeContract || !account || !hasWindowEthereum()) {
          setIsOwner(false);
          return;
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
          activeContract,
          ABI,
          await provider
        );
        const ownerAddr = await contract.owner();
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

  // siguiente número visual
  const nextMintNumber = useMemo(() => {
    return derived.minted + 1 + (counterOffset || 0);
  }, [derived.minted, counterOffset]);

  // Helpers idioma y red para los modales
  function currentNetworkName() {
    if (forceNet === "sepolia") return "Sepolia";
    if (forceNet === "mainnet") return "Ethereum Mainnet";
    // fallback según chainId
    const hex = (chainId || "").toLowerCase();
    if (hex === "0xaa36a7") return "Sepolia";
    if (hex === "0x1") return "Ethereum Mainnet";
    return "Ethereum";
  }

  // ----- MINT -----
  const handleMint = async () => {
    try {
      setMinting(true);

      const beforeStats = await getStats(activeContract);
      const beforeMinted =
        beforeStats?.mintedHistoric ??
        (beforeStats?.minted ?? derived.minted);

      const receipt = await mintNext(activeContract, "metadata.json");

      const afterStats = await getStats(activeContract);
      setStats(afterStats);
      if (account) {
        setOwned(await getOwnedFragments(activeContract, account));
      }

      const tokenId =
        (afterStats?.mintedHistoric ??
          (afterStats?.minted ?? derived.minted + 1)) ||
        beforeMinted + 1;

      const txHash = receipt?.hash || receipt?.transactionHash || "";

      // ✅ esperamos a que modals-tenio.js haya expuesto las funciones
      await waitForModalsReady();

      window.showMintSuccessModal?.({
        tokenId,
        txHash,
        networkName: currentNetworkName(),
        wallet: account,
        lang,
      });
    } catch (e) {
      alert(`Error mint: ${e?.message || e}`);
    } finally {
      setMinting(false);
    }
  };

  // ----- BURN -----
  const reallyBurn = async (id) => {
    try {
      const receipt = await burnTx(activeContract, id);

      const afterStats = await getStats(activeContract);
      setStats(afterStats);
      if (account) {
        setOwned(await getOwnedFragments(activeContract, account));
      }

      const txHash = receipt?.hash || receipt?.transactionHash || "";
      const refundEth = afterStats?.burnRefund ?? stats?.burnRefund ?? 0;

      // ✅ esperamos a que modals-tenio.js esté listo
      await waitForModalsReady();

      window.showBurnCompleteModal?.({
        tokenId: id,
        txHash,
        networkName: currentNetworkName(),
        wallet: account,
        refundEth,
        lang,
      });
    } catch (e) {
      alert(`Error burn: ${e?.message || e}`);
    } finally {
      setBurning(false);
    }
  };

  const handleBurn = async () => {
    const id = Number(burnId);
    if (!id || Number.isNaN(id)) return;

    setBurning(true);

    // ✅ esperamos a que modals-tenio.js esté listo ANTES del confirm modal
    await waitForModalsReady();

    window.showBurnConfirmModal?.({
      tokenId: id,
      networkName: currentNetworkName(),
      lang,
      onConfirm: async () => {
        await reallyBurn(id);
        setBurnId("");
      },
      onCancel: () => {
        setBurning(false);
      },
    });
  };

  // ----- metamask add -----
  const handleAddToMM = async (id) => {
    try {
      const uri = await getTokenURI(activeContract, id);
      await addToMetamask(activeContract, id, uri);
    } catch (e) {
      alert(`MetaMask error: ${e?.message || e}`);
    }
  };

  // OWNER withdrawals
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
        <div className="brand">{tr.brand}</div>
        <h1>{tr.title}</h1>

        {/* selector de idioma */}
        <div className="langSwitch">
          <button
            className={lang === "es" ? "active" : ""}
            onClick={() => changeLang("es")}
          >
            {tr.lang_es}
          </button>
          <button
            className={lang === "en" ? "active" : ""}
            onClick={() => changeLang("en")}
          >
            {tr.lang_en}
          </button>
        </div>
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
            {connected ? tr.connectedYes(account) : tr.connectedNo}
          </div>

          <div className="addr">{activeContract || "<sin contrato>"}</div>

          <div className="row">
            <button onClick={handleUseSepolia}>{tr.btnSepolia}</button>
            <button onClick={handleUseMainnet}>{tr.btnMainnet}</button>
            <button onClick={handleConnect}>{tr.btnConnect}</button>
          </div>

          <div className="stats">
            <div>
              <b>{tr.statsTotal}:</b> {derived.total}
            </div>
            <div>
              🧮 <b>{tr.statsMintedHist}:</b> {derived.minted}
            </div>
            <div>
              🥓 <b>{tr.statsBurned}:</b> {derived.burned}
            </div>
            <div>
              🟢 <b>{tr.statsLive}:</b> {derived.live}
            </div>
            <div>
              🪙 <b>{tr.statsAvail}:</b> {derived.available}
            </div>

            <div className="mt8">
              <b>{tr.mintPrice}:</b> {stats?.mintPrice ?? 0} ETH
            </div>
            <div>
              <b>{tr.burnRefund}:</b> {stats?.burnRefund ?? 0} ETH
            </div>
            <div>
              <b>{tr.reserveReq}:</b>{" "}
              {(stats?.requiredReserveEth ?? 0).toFixed(3)} ETH
            </div>

            {isOwner && (
              <div>
                <b>{tr.withdrawable}:</b>{" "}
                {(stats?.withdrawableEth ?? 0).toFixed(3)} ETH
              </div>
            )}

            {loadingStats && <div className="note">{tr.loadingStats}</div>}
            {statsError && <div className="warn">{statsError}</div>}
          </div>

          <div className="row">
            <button onClick={handleMint} disabled={minting || !connected}>
              {minting ? tr.minting : tr.mintAction(nextMintNumber)}
            </button>
          </div>

          <div className="row">
            <input
              placeholder={tr.burnInputPH}
              value={burnId}
              onChange={(e) => setBurnId(e.target.value)}
            />
            <button onClick={handleBurn} disabled={burning || !connected}>
              {burning ? tr.burning : tr.burnBtn}
            </button>
          </div>

          <div className="note small">
            {tr.burnNotePrefix} {stats?.burnRefund ?? 0} {tr.burnNoteSuffix}
          </div>

          <div className="owned">
            <div>
              <b>{tr.yourFrags(owned.length)}</b>
            </div>
            {owned.length === 0 ? (
              <div className="muted">{tr.noFrags}</div>
            ) : (
              <ul>
                {owned.map((id) => (
                  <li key={id}>
                    #{id}{" "}
                    <button className="ghost" onClick={() => handleAddToMM(id)}>
                      {tr.addMM}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ownedError && <div className="warn">{ownedError}</div>}
          </div>

          {isOwner && (
            <div className="owner">
              <div className="owner-title">{tr.ownerPanel}</div>
              <div className="row">
                <button onClick={handleWithdrawAll} disabled={withdrawing}>
                  {tr.withdrawAll}
                </button>
                <input
                  placeholder={tr.withdrawPartialPH}
                  value={withdrawPartialAmt}
                  onChange={(e) => setWithdrawPartialAmt(e.target.value)}
                />
                <button
                  onClick={handleWithdrawPartial}
                  disabled={withdrawing}
                >
                  {tr.withdrawPartialBtn}
                </button>
              </div>
              <div className="muted">
                {tr.ownerExcess}: {(stats?.withdrawableEth ?? 0).toFixed(3)} ETH
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
