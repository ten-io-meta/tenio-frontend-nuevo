// Inyecta estilos del modal en el <head> si aún no están
(function injectTenioModalStyles() {
  if (document.getElementById('tenio-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'tenio-modal-styles';
  style.textContent = `
    .tenio-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(8, 10, 15, .75);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
      animation: tenio-fadeIn .4s ease;
    }
    .tenio-modal {
      background: linear-gradient(180deg, rgba(30,40,72,.35), rgba(18,22,34,.75));
      border: 1px solid #1e2636;
      border-radius: 18px;
      padding: 28px 26px;
      max-width: 460px;
      width: calc(100% - 32px);
      box-shadow: 0 8px 40px rgba(107,143,255,.25);
      color: #e8eefc;
      text-align: center;
      font-family: ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;
    }
    .tenio-modal h2 {
      margin-top: 0;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: .02em;
      color: #9b7dff;
    }
    .tenio-modal .subtitle {
      color: #a5b1c2;
      margin-bottom: 14px;
      font-size: 16px;
    }
    .tenio-modal .info-card {
      border: 1px solid #213054;
      background: rgba(18,22,34,.45);
      border-radius: 12px;
      padding: 12px 14px;
      text-align: left;
      font-size: 15px;
      margin-bottom: 18px;
      line-height: 1.5;
    }
    .tenio-modal .info-card-row {
      margin-bottom: 6px;
    }
    .tenio-modal .info-card-row b {
      font-weight: 600;
      color: #e8eefc;
    }
    .tenio-modal .info-card-row a {
      color: #6aa9ff;
      text-decoration: none;
      word-break: break-all;
      font-size: 14px;
    }
    .tenio-modal .description {
      font-size: 16px;
      line-height: 1.7;
      opacity: .9;
      margin-bottom: 22px;
    }
    .tenio-modal .cta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .tenio-modal .btn {
      appearance: none;
      border: none;
      border-radius: 10px;
      padding: 10px 16px;
      font-weight: 700;
      letter-spacing: .01em;
      cursor: pointer;
      color: #071019;
      background: linear-gradient(90deg, #6aa9ff, #9b7dff);
      box-shadow: 0 8px 30px rgba(107,143,255,.25);
      font-size: 15px;
    }
    .tenio-modal .btn.secondary {
      background: #121a2e;
      color: #e8eefc;
      border: 1px solid #213054;
      box-shadow: 0 8px 30px rgba(0,0,0,.4);
    }
    @keyframes tenio-fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
})();

/**
 * Muestra el modal post-mint:
 * - tokenId        => número de fragmento (ej: 42)
 * - txHash         => hash de la transacción
 * - networkName    => "Sepolia" | "Ethereum" | etc
 * - wallet         => address del usuario
 */
function showMintSuccessModal({ tokenId, txHash, networkName, wallet }) {
  // fallback defensivos por si algo viene undefined
  tokenId      = tokenId      ?? '—';
  txHash       = txHash       ?? '—';
  networkName  = networkName  ?? 'Ethereum';
  wallet       = wallet       ?? '0x????';

  // acortamos hash y wallet para mostrar bonito
  const shortTx    = txHash.length > 12 ? txHash.slice(0,10) + '…' : txHash;
  const shortWallet = wallet.length > 12 ? wallet.slice(0,6) + '…' + wallet.slice(-4) : wallet;

  // resolvemos link a etherscan / sepolia.etherscan
  const explorerBase = networkName.toLowerCase().includes('sepolia')
    ? 'https://sepolia.etherscan.io/tx/'
    : 'https://etherscan.io/tx/';

  // creamos overlay
  const overlay = document.createElement('div');
  overlay.className = 'tenio-modal-overlay';

  overlay.innerHTML = `
    <div class="tenio-modal">
      <h2>Has cruzado el Umbral.</h2>
      <p class="subtitle">Tu fragmento ya forma parte de TEN.IO.</p>

      <div class="info-card">
        <div class="info-card-row"><b>Fragmento:</b> #${tokenId}</div>
        <div class="info-card-row"><b>Red:</b> ${networkName}</div>
        <div class="info-card-row">
          <b>Tx:</b> 
          <a href="${explorerBase + txHash}" target="_blank" rel="noopener noreferrer">
            ${shortTx}
          </a>
        </div>
        <div class="info-card-row"><b>Wallet:</b> ${shortWallet}</div>
        <div class="info-card-row"><b>Estado:</b> Confirmado ✅</div>
      </div>

      <p class="description">
        Este fragmento contiene ETH embebido y vive como un contrato dentro de Ethereum.<br>
        Desde ahora eres custodio, no espectador.<br><br>
        <i>La tensión es lo único que necesitas.</i>
      </p>

      <div class="cta">
        <button class="btn" id="tenio-downloadCert">Descargar certificado</button>
        <a class="btn secondary" id="tenio-viewOnChain"
           href="${explorerBase + txHash}"
           target="_blank" rel="noopener noreferrer">
           Ver on-chain
        </a>
        <button class="btn secondary" id="tenio-closeModal">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // handler descarga "certificado"
  // (por ahora generamos .txt local; más tarde lo cambiamos a PDF bonito)
  overlay.querySelector('#tenio-downloadCert').onclick = () => {
    const text = [
      'TEN.IO / Capítulo 0 · El Umbral',
      `Fragmento #${tokenId}`,
      `Red: ${networkName}`,
      `Wallet: ${wallet}`,
      `Tx: ${txHash}`,
      `Fecha: ${new Date().toLocaleString()}`,
      '',
      '“La tensión es lo único que necesitas.”'
    ].join('\n');

    const blob = new Blob([ text ], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TENIO_Fragmento_${tokenId}.txt`;
    link.click();
  };

  // handler cerrar modal
  overlay.querySelector('#tenio-closeModal').onclick = () => {
    overlay.remove();
  };
}
