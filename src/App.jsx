import { useState, useEffect } from 'react';
import {
  connectWallet,
  mintFragment,
  burnFragment,
  getOwnedFragments,
} from './web3/TENIOFragmentConnection';

function App() {
  const [account, setAccount] = useState('');
  const [fragments, setFragments] = useState([]);
  const [burnId, setBurnId] = useState('');

  const handleConnect = async () => {
    try {
      const address = await connectWallet();
      setAccount(address);
      const frags = await getOwnedFragments();
      setFragments(frags);
    } catch (error) {
      console.error('Error al conectar:', error);
    }
  };

  const handleMint = async () => {
    try {
      await mintFragment();
      const frags = await getOwnedFragments();
      setFragments(frags);
    } catch (error) {
      console.error('Error al mintear:', error);
    }
  };

  const handleBurn = async () => {
    if (!burnId) return;
    try {
      await burnFragment(burnId);
      const frags = await getOwnedFragments();
      setFragments(frags);
    } catch (error) {
      console.error('Error al quemar:', error);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <div style={{ backgroundColor: '#121212', color: 'white', minHeight: '100vh', padding: '2rem', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ fontSize: '3rem' }}>TEN.IO Fragmentos</h1>

      {account ? (
        <p>🦊 Conectado: <span style={{ color: '#aaa' }}>{account}</span></p>
      ) : (
        <button onClick={handleConnect}>Conectar billetera</button>
      )}

      {account && (
        <div style={{ marginTop: '1.5rem' }}>
          <button onClick={handleMint}>Mintear fragmento</button>

          <div style={{ marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="ID del fragmento a quemar"
              value={burnId}
              onChange={(e) => setBurnId(e.target.value)}
            />
            <button onClick={handleBurn}>Quemar fragmento</button>
          </div>
        </div>
      )}

      {account && (
        <div style={{ marginTop: '3rem' }}>
          <h2>Tus fragmentos:</h2>
          {fragments.length === 0 ? (
            <p>No tienes fragmentos.</p>
          ) : (
            <ul>
              {fragments.map((frag) => (
                <li key={frag.id} style={{ marginBottom: '1rem' }}>
                  <p>ID: {frag.id}</p>
                  <img
                    src={frag.uri}
                    alt={`Fragmento ${frag.id}`}
                    style={{ width: 150 }}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/150?text=Sin+imagen';
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
