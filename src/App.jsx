import { useEffect, useState } from "react";
import {
  connectWallet,
  mintFragment,
  burnFragment,
  getOwnedFragments,
  getContract,
} from "./web3/TENIOFragmentConnection";
import FragmentStats from "./components/FragmentStats";
import EsferaFragmento from "./components/EsferaFragmento";
import "./App.css";

function App() {
  const [account, setAccount] = useState("");
  const [fragments, setFragments] = useState([]);
  const [burnId, setBurnId] = useState("");
  const [contractInstance, setContractInstance] = useState(null);
  const [fragmentPreviews, setFragmentPreviews] = useState({});

  useEffect(() => {
    handleConnect();
  }, []);

  async function handleConnect() {
    try {
      const acc = await connectWallet();
      setAccount(acc);

      const frags = await getOwnedFragments(acc);
      setFragments(frags);

      const contract = await getContract();
      setContractInstance(contract);
    } catch (err) {
      console.error("Error al conectar:", err);
    }
  }

  useEffect(() => {
    const loadPreviews = async () => {
      const previews = {};
      for (const frag of fragments) {
        const uri = frag.uri.startsWith("ipfs://")
          ? `https://ipfs.io/ipfs/${frag.uri.replace("ipfs://", "")}`
          : frag.uri;

        try {
          const res = await fetch(uri);
          const data = await res.json();

          let imageUrl = data.image || "";
          if (imageUrl.startsWith("ipfs://")) {
            imageUrl = `https://ipfs.io/ipfs/${imageUrl.replace("ipfs://", "")}`;
          }

          previews[frag.id] = imageUrl;
        } catch (e) {
          console.warn(`Error cargando imagen del fragmento ${frag.id}`, e);
        }
      }
      setFragmentPreviews(previews);
    };

    if (fragments.length > 0) {
      loadPreviews();
    }
  }, [fragments]);

  async function handleMint() {
    try {
      await mintFragment();
      await handleConnect();
    } catch (err) {
      console.error("Error al mintear:", err);
    }
  }

  async function handleBurn() {
    try {
      if (!burnId) return alert("Introduce el ID a quemar");
      await burnFragment(burnId);
      setBurnId("");
      await handleConnect();
    } catch (err) {
      console.error("Error al quemar:", err);
    }
  }

  return (
    <div className="app">
      <h1 className="titulo">TEN.IO Fragmentos</h1>
      <p className="wallet">🦊 Conectado: {account || "No conectado"}</p>

      <div className="dashboard-grid">
        <div className="stats-box">
          <FragmentStats contractInstance={contractInstance} account={account} />
        </div>

        <div className="esfera-box">
          <EsferaFragmento />
          <p style={{ marginTop: "0.5rem" }}>Fragmento: Crack in the Silence</p>
        </div>

        <div className="actions-box">
          <button onClick={handleMint}>Mintear fragmento</button>
          <input
            type="text"
            placeholder="ID del fragmento a quemar"
            value={burnId}
            onChange={(e) => setBurnId(e.target.value)}
          />
          <button onClick={handleBurn}>Quemar fragmento</button>
        </div>
      </div>

      <h2 style={{ marginTop: "3rem" }}>Tus fragmentos:</h2>
      {fragments.length === 0 ? (
        <p>No tienes fragmentos.</p>
      ) : (
        <div className="fragment-list">
          {fragments.map((frag) => (
            <div className="fragment-card" key={frag.id}>
              <p><strong>ID:</strong> {frag.id}</p>
              {fragmentPreviews[frag.id] ? (
                <img
                  src={fragmentPreviews[frag.id]}
                  alt={`Fragmento ${frag.id}`}
                />
              ) : (
                <p>Cargando...</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
