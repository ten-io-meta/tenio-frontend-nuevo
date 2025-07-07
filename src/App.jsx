import { useEffect, useState } from "react";
import {
  connectWallet,
  mintFragment,
  burnFragment,
  getOwnedFragments,
  getContract,
} from "./web3/TENIOFragmentConnection";
import FragmentStats from "./components/FragmentStats";
import "./App.css"; // Aplica el nuevo CSS

function App() {
  const [account, setAccount] = useState("");
  const [fragments, setFragments] = useState([]);
  const [burnId, setBurnId] = useState("");
  const [contractInstance, setContractInstance] = useState(null);

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
      <h1>TEN.IO Fragmentos</h1>
      <p>🦊 Conectado: {account}</p>

      {contractInstance && account && (
        <FragmentStats contractInstance={contractInstance} account={account} />
      )}

      <div>
        <button onClick={handleMint} style={{ marginRight: "1rem" }}>
          Mintear fragmento
        </button>

        <input
          type="text"
          placeholder="ID del fragmento a quemar"
          value={burnId}
          onChange={(e) => setBurnId(e.target.value)}
          style={{ marginRight: "0.5rem" }}
        />
        <button onClick={handleBurn}>Quemar fragmento</button>
      </div>

      <h2 style={{ marginTop: "2rem" }}>Tus fragmentos:</h2>
      {fragments.length === 0 ? (
        <p>No tienes fragmentos.</p>
      ) : (
        <div className="fragment-list">
          {fragments.map((frag) => {
            const displayUri = frag.uri.startsWith("ipfs://")
              ? `https://ipfs.io/ipfs/${frag.uri.replace("ipfs://", "")}`
              : frag.uri;

            return (
              <div className="fragment-card" key={frag.id}>
                <p><strong>ID:</strong> {frag.id}</p>
                <img
                  src={displayUri}
                  alt={`Fragmento ${frag.id}`}
                  style={{ width: "100%", height: "auto", marginTop: "0.5rem" }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "";
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;
