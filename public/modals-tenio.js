// public/modals-tenio.js
// TEN.IO modals: mint success, burn confirm, burn complete
// Inserta elementos flotantes sobre la página. No depende de React.

/* ---------- helpers comunes ---------- */

function shorten(addr = "", left = 6, right = 4) {
  if (!addr) return "—";
  if (addr.length <= left + right) return addr;
  return addr.slice(0, left) + "…" + addr.slice(-right);
}

function openEtherscanTx(txHash, networkName) {
  if (!txHash) return "#";
  // mainnet vs sepolia
  const isSepolia =
    /sepolia/i.test(networkName || "") ||
    /testnet/i.test(networkName || "") ||
    /sep/i.test(networkName || "");
  const base = isSepolia
    ? "https://sepolia.etherscan.io/tx/"
    : "https://etherscan.io/tx/";
  return base + txHash;
}

function nowISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}, ${hh}:${mi}:${ss}`;
}

// descarga .txt
function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// crea overlay + caja base estilada
function createBaseModal() {
  // overlay
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = 0;
  overlay.style.top = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.background =
    "radial-gradient(circle at 50% 50%, rgba(30,30,60,0.4) 0%, rgba(0,0,0,0.9) 70%)";
  overlay.style.backdropFilter = "blur(4px)";
  overlay.style.zIndex = 999999;
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "2rem";

  // card
  const card = document.createElement("div");
  card.style.width = "100%";
  card.style.maxWidth = "600px";
  card.style.background =
    "radial-gradient(circle at 20% 20%, rgba(30,30,60,0.3) 0%, rgba(10,10,20,0.95) 60%)";
  card.style.border = "1px solid rgba(120,120,255,0.3)";
  card.style.boxShadow =
    "0 30px 120px rgba(120,80,255,0.6), 0 0 40px rgba(120,80,255,0.3) inset";
  card.style.borderRadius = "12px";
  card.style.padding = "24px 24px 16px";
  card.style.fontFamily =
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";
  card.style.color = "#fff";
  card.style.maxHeight = "90vh";
  card.style.overflowY = "auto";

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return { overlay, card };
}

// estilos pequeños reutilizables
function pillBtn(text, onClick) {
  const b = document.createElement("button");
  b.textContent = text;
  b.style.background =
    "linear-gradient(90deg, rgba(98,90,255,1) 0%, rgba(150,103,255,1) 100%)";
  b.style.border = "0";
  b.style.borderRadius = "8px";
  b.style.padding = "10px 16px";
  b.style.fontSize = "14px";
  b.style.color = "#fff";
  b.style.cursor = "pointer";
  b.style.fontWeight = "600";
  b.style.whiteSpace = "nowrap";
  b.addEventListener("click", onClick);
  return b;
}
function ghostBtn(text, onClick) {
  const b = document.createElement("button");
  b.textContent = text;
  b.style.background = "rgba(0,0,0,0.4)";
  b.style.border = "1px solid rgba(255,255,255,0.2)";
  b.style.color = "#fff";
  b.style.borderRadius = "8px";
  b.style.padding = "10px 16px";
  b.style.fontSize = "14px";
  b.style.cursor = "pointer";
  b.style.fontWeight = "600";
  b.addEventListener("click", onClick);
  return b;
}

// texto multilinea helper
function addP(parent, txt, opts = {}) {
  const p = document.createElement("p");
  p.textContent = txt;
  p.style.margin = opts.margin || "0 0 12px";
  p.style.fontSize = opts.fontSize || "15px";
  p.style.lineHeight = opts.lineHeight || "1.4";
  p.style.color = opts.color || "rgba(255,255,255,0.9)";
  p.style.textAlign = opts.textAlign || "center";
  if (opts.fontWeight) p.style.fontWeight = opts.fontWeight;
  parent.appendChild(p);
  return p;
}

function addSmallRowBox(parent, rowsArr) {
  const box = document.createElement("div");
  box.style.background = "rgba(0,0,0,0.3)";
  box.style.border = "1px solid rgba(255,255,255,0.15)";
  box.style.borderRadius = "8px";
  box.style.padding = "16px";
  box.style.margin = "0 auto 16px";
  box.style.width = "100%";
  box.style.maxWidth = "520px";
  box.style.fontSize = "14px";
  box.style.lineHeight = "1.5";
  box.style.color = "#fff";
  box.style.wordBreak = "break-word";

  rowsArr.forEach((row) => {
    const line = document.createElement("div");
    line.style.marginBottom = "6px";

    const label = document.createElement("div");
    label.style.fontWeight = "600";
    label.style.display = "inline";
    label.textContent = row.label + " ";
    line.appendChild(label);

    if (row.valueLink) {
      const a = document.createElement("a");
      a.href = row.valueLink;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = row.valueText;
      a.style.color = "#7aa5ff";
      a.style.textDecoration = "none";
      a.style.wordBreak = "break-all";
      line.appendChild(a);
    } else {
      const span = document.createElement("span");
      span.textContent = row.valueText;
      span.style.wordBreak = "break-all";
      line.appendChild(span);
    }

    box.appendChild(line);
  });

  parent.appendChild(box);
  return box;
}

/* ---------- i18n strings ---------- */

function getStrings(lang) {
  const L = (lang === "en") ? "en" : "es";

  const dict = {
    es: {
      // Mint success (Mainnet)
      mintTitle: "Has cruzado el Umbral.",
      mintSubtitle: "Tu fragmento ya forma parte de TEN.IO.",
      mintFrag: "Fragmento:",
      mintNet: "Red:",
      mintTx: "Tx:",
      mintWallet: "Wallet:",
      mintStatus: "Estado:",
      mintStatusOk: "Confirmado ✅",

      // Texto Mainnet (real)
      mintBody1:
        "Esta pieza es uno de los 1.000 fragmentos originales de EL UMBRAL. " +
        "Contiene ETH embebido y vive como contrato dentro de Ethereum. " +
        "Desde ahora eres custodio, no espectador.",
      mintBody2a: "Fragmento #",
      mintBody2b: "/ 1000",
      mintBody3:
        "Este número no se repite. Si algún día se quema, desaparece del total " +
        "y la tensión se concentra en los que quedan.",
      tagline: "La tensión es lo único que necesitas.",

      // Texto Sepolia (simulación)
      mintBodySepolia1:
        "Esta es una simulación en una red pública de pruebas (Sepolia).",
      mintBodySepolia2:
        "Reproduce el proceso real de mint / colateral / quema " +
        "sin poner ETH real en riesgo.",
      mintBodySepolia3:
        "Si estás listo, ahora puedes hacerlo de verdad en Ethereum Mainnet.",
      mintBodySepoliaHeader: "Simulación completada.",

      btnDownloadCert: "Descargar certificado",
      btnSeeOnchain: "Ver on-chain",
      btnShareX: "Compartir en X",
      btnClose: "Cerrar",
      networkPrefix: "Red:",

      // burn confirm (mainnet vs sepolia)
      burnConfirmTitleMainnet: "Vas a quemar este fragmento",
      burnConfirmTitleSepolia: "Vas a simular la quema de este fragmento",

      burnConfirmIntroMainnet: (id) => `Vas a quemar el fragmento #${id}.`,
      burnConfirmIntroSepolia: (id) =>
        `Vas a ejecutar la simulación de quema del fragmento #${id} en red de prueba.`,

      burnConfirmLabelFrag: "Fragmento:",
      burnConfirmLabelNet: "Red:",
      burnConfirmLabelAction: "Acción:",
      burnConfirmActionFinalMainnet: "Quema definitiva",
      burnConfirmActionFinalSepolia: "Simulación de quema",

      // épico mainnet
      burnConfirmWarningMainnet1: "Esta acción es irreversible.",
      burnConfirmWarningMainnet2:
        "El fragmento saldrá del suministro del Capítulo 0 para siempre.",
      burnConfirmWarningMainnet3:
        "Recuperarás el colateral definido en el contrato directamente en tu wallet.",
      burnConfirmWarningMainnet4:
        "Nadie podrá volver a mintear este fragmento.",

      // educativo sepolia
      burnConfirmWarningSepolia1:
        "Esto es una simulación en una red pública de pruebas (Sepolia).",
      burnConfirmWarningSepolia2:
        "Nada aquí afecta al suministro real ni mueve ETH real.",
      burnConfirmWarningSepolia3:
        "Esta prueba existe para que entiendas cómo funciona la quema y la recuperación de colateral.",
      burnConfirmWarningSepolia4:
        "Si completas este paso, estás listo para hacerlo en Mainnet (donde sí es definitivo).",

      burnConfirmQuestion: "¿Quieres continuar?",
      burnConfirmYes: "Sí, quemar",
      burnConfirmCancel: "Cancelar",

      // burn complete
      burnDoneTitleSepolia: "Simulación de quema completada",
      burnDoneIntroSepolia: "Esto se ha ejecutado en red de prueba (Sepolia).",
      burnDoneExplainSepolia:
        "Esta simulación te muestra el proceso real sin riesgo económico.",
      burnDoneTitleMainnet: "Quema confirmada",
      burnDoneIntroMainnet:
        "Tu fragmento ha sido quemado y retirado del suministro.",
      burnDoneExplainMainnet:
        "Has recuperado el colateral directamente en tu wallet.",
      burnBoxFrag: "Fragmento:",
      burnBoxNet: "Red:",
      burnBoxTx: "Tx:",
      burnBoxWallet: "Wallet:",
      burnBoxRefund: "Colateral devuelto:",
      burnShareTextSepolia: (id, refund, url) =>
        `Probando la quema en TEN.IO (Sepolia).\nFragmento #${id} · Refund ${refund ?? "—"} ETH\n${url}`,
      burnShareTextMainnet: (id, refund, url) =>
        `He quemado el fragmento #${id} de EL UMBRAL (TEN.IO).\nRefund ${refund ?? "—"} ETH\n${url}`,
      burnBodySepolia:
        "Esta simulación reproduce la lógica real de mint, colateral " +
        "y quema, sin poner ETH en riesgo.",
      burnBodyMainnet:
        "Este fragmento contenía ETH embebido y vivía como contrato dentro de Ethereum.",

      txtCertHeaderSepolia:
        "TEN.IO — Simulación en red de prueba (Sepolia)",
      txtCertHeaderMainnet:
        "TEN.IO / Capítulo 0 • EL UMBRAL",
      txtCertLinesMainnet1:
        "Este fragmento contiene ETH embebido y vive como contrato dentro de Ethereum.",
      txtCertLinesMainnet2:
        "Si se quema, desaparece para siempre y reduce el suministro total.",
    },

    en: {
      // Mint success (Mainnet)
      mintTitle: "You have crossed the Threshold.",
      mintSubtitle: "Your fragment is now part of TEN.IO.",
      mintFrag: "Fragment:",
      mintNet: "Network:",
      mintTx: "Tx:",
      mintWallet: "Wallet:",
      mintStatus: "Status:",
      mintStatusOk: "Confirmed ✅",

      // Texto Mainnet (real)
      mintBody1:
        "This piece is one of the 1,000 original fragments of THE THRESHOLD. " +
        "It embeds ETH and lives as a contract inside Ethereum. " +
        "From now on you are a custodian, not a spectator.",
      mintBody2a: "Fragment #",
      mintBody2b: "/ 1000",
      mintBody3:
        "This number does not repeat. If one day it is burned, it disappears " +
        "from the total and tension concentrates in the ones that remain.",
      tagline: "Tension is all you need.",

      // Texto Sepolia (simulación)
      mintBodySepolia1:
        "This is a simulation on a public test network (Sepolia).",
      mintBodySepolia2:
        "It mimics the real mint / collateral / burn process " +
        "without putting real ETH at risk.",
      mintBodySepolia3:
        "If you’re ready, you can now do it for real on Ethereum Mainnet.",
      mintBodySepoliaHeader: "Simulation complete.",

      btnDownloadCert: "Download certificate",
      btnSeeOnchain: "View on-chain",
      btnShareX: "Share on X",
      btnClose: "Close",
      networkPrefix: "Network:",

      // burn confirm
      burnConfirmTitleMainnet: "You are about to burn this fragment",
      burnConfirmTitleSepolia: "You are about to simulate a burn",

      burnConfirmIntroMainnet: (id) => `You are about to burn fragment #${id}.`,
      burnConfirmIntroSepolia: (id) =>
        `You are about to run a burn simulation for fragment #${id} on a test network.`,

      burnConfirmLabelFrag: "Fragment:",
      burnConfirmLabelNet: "Network:",
      burnConfirmLabelAction: "Action:",
      burnConfirmActionFinalMainnet: "Final burn",
      burnConfirmActionFinalSepolia: "Burn simulation",

      // mainnet = irreversible, solemn
      burnConfirmWarningMainnet1: "This action is irreversible.",
      burnConfirmWarningMainnet2:
        "The fragment will be removed from Chapter 0 supply forever.",
      burnConfirmWarningMainnet3:
        "You will receive the defined collateral from the contract " +
        "directly in your wallet.",
      burnConfirmWarningMainnet4:
        "No one will be able to mint this fragment again.",

      // sepolia = educational, not final
      burnConfirmWarningSepolia1:
        "This is a simulation on a public test network (Sepolia).",
      burnConfirmWarningSepolia2:
        "Nothing here touches real supply or moves real ETH.",
      burnConfirmWarningSepolia3:
        "This run exists so you understand burn + collateral recovery.",
      burnConfirmWarningSepolia4:
        "If you can do this, you're ready to do it on Mainnet (where it becomes final).",

      burnConfirmQuestion: "Do you want to continue?",
      burnConfirmYes: "Yes, burn",
      burnConfirmCancel: "Cancel",

      // burn complete
      burnDoneTitleSepolia: "Burn simulation complete",
      burnDoneIntroSepolia: "This was executed on a test network (Sepolia).",
      burnDoneExplainSepolia:
        "This simulation shows you the real process with no economic risk.",
      burnDoneTitleMainnet: "Burn confirmed",
      burnDoneIntroMainnet:
        "Your fragment has been burned and removed from supply.",
      burnDoneExplainMainnet:
        "You recovered the collateral directly in your wallet.",
      burnBoxFrag: "Fragment:",
      burnBoxNet: "Network:",
      burnBoxTx: "Tx:",
      burnBoxWallet: "Wallet:",
      burnBoxRefund: "Collateral returned:",
      burnShareTextSepolia: (id, refund, url) =>
        `Testing burn on TEN.IO (Sepolia).\nFragment #${id} · Refund ${refund ?? "—"} ETH\n${url}`,
      burnShareTextMainnet: (id, refund, url) =>
        `I burned fragment #${id} from THE THRESHOLD (TEN.IO).\nRefund ${refund ?? "—"} ETH\n${url}`,
      burnBodySepolia:
        "This simulation reproduces the real mint / collateral / burn logic " +
        "without putting ETH at risk.",
      burnBodyMainnet:
        "This fragment contained embedded ETH and lived as a contract inside Ethereum.",

      txtCertHeaderSepolia:
        "TEN.IO — Testnet simulation (Sepolia)",
      txtCertHeaderMainnet:
        "TEN.IO / Chapter 0 • THE THRESHOLD",
      txtCertLinesMainnet1:
        "This fragment contains embedded ETH and lives as a contract inside Ethereum.",
      txtCertLinesMainnet2:
        "If it is burned, it disappears forever and reduces total supply.",
    },
  };

  return dict[L];
}

/* ---------- MINT SUCCESS MODAL ---------- */

function showMintSuccessModal({ tokenId, txHash, networkName, wallet, lang }) {
  const S = getStrings(lang);

  const isSepolia =
    /sepolia/i.test(networkName || "") ||
    /testnet/i.test(networkName || "") ||
    /sep/i.test(networkName || "");

  const { overlay, card } = createBaseModal();

  // Título
  const h = document.createElement("h2");
  h.textContent = isSepolia ? S.mintBodySepoliaHeader : S.mintTitle;
  h.style.margin = "0 0 12px";
  h.style.fontSize = "24px";
  h.style.fontWeight = "700";
  h.style.lineHeight = "1.3";
  h.style.color = "rgb(180,160,255)";
  h.style.textAlign = "center";
  card.appendChild(h);

  // Subtítulo
  addP(card, S.mintSubtitle, {
    margin: "0 0 16px",
    fontSize: "15px",
    color: "rgba(255,255,255,0.8)",
  });

  // Cajita datos (Fragment / Network / Tx / Wallet / Status)
  const rows = [
    { label: S.mintFrag,   valueText: `#${tokenId ?? "—"}` },
    { label: S.mintNet,    valueText: networkName || "—" },
    {
      label: S.mintTx,
      valueText: shorten(txHash || "", 10, 10),
      valueLink: openEtherscanTx(txHash, networkName),
    },
    { label: S.mintWallet, valueText: shorten(wallet || "") },
    { label: S.mintStatus, valueText: S.mintStatusOk },
  ];
  addSmallRowBox(card, rows);

  // Bloque de texto según red
  if (isSepolia) {
    // Sepolia: texto de simulación
    addP(card, S.mintBodySepolia1, {
      fontSize: "15px",
      lineHeight: "1.5",
      margin: "0 0 12px",
    });
    addP(card, S.mintBodySepolia2, {
      fontSize: "15px",
      lineHeight: "1.5",
      margin: "0 0 12px",
    });
    addP(card, S.mintBodySepolia3, {
      fontSize: "15px",
      lineHeight: "1.5",
      margin: "0 0 16px",
    });
  } else {
    // Mainnet: el texto solemne + número del fragmento /1000
    addP(card, S.mintBody1, {
      fontSize: "15px",
      lineHeight: "1.5",
      margin: "0 0 16px",
    });

    const fragNumLine =
      `${S.mintBody2a}${String(tokenId || "—").padStart(4, "0")} ${S.mintBody2b}`;
    addP(card, fragNumLine, {
      fontSize: "15px",
      lineHeight: "1.5",
      margin: "0 0 8px",
      textAlign: "center",
    });

    addP(card, S.mintBody3, {
      fontSize: "15px",
      lineHeight: "1.5",
      margin: "0 0 16px",
      textAlign: "center",
    });
  }

  // tagline (igual en ambos casos)
  const tag = document.createElement("div");
  tag.textContent = S.tagline;
  tag.style.fontStyle = "italic";
  tag.style.textAlign = "center";
  tag.style.fontSize = "14px";
  tag.style.color = "#fff";
  tag.style.marginBottom = "20px";
  card.appendChild(tag);

  // fila de botones
  const rowBtns = document.createElement("div");
  rowBtns.style.display = "flex";
  rowBtns.style.flexWrap = "wrap";
  rowBtns.style.gap = "10px";
  rowBtns.style.justifyContent = "center";
  rowBtns.style.marginBottom = "12px";
  card.appendChild(rowBtns);

  // Descargar certificado
  const certBtn = pillBtn(S.btnDownloadCert, () => {
    const lines = [];
    if (isSepolia) {
      // certificado versión testnet
      lines.push(S.txtCertHeaderSepolia);
      lines.push(`${S.mintFrag} #${String(tokenId || "—")}`);
      lines.push(`Wallet: ${wallet || "—"}`);
      lines.push(`Tx: ${txHash || "—"}`);
      lines.push(`${S.networkPrefix} ${networkName || "—"}`);
      lines.push(`Fecha: ${nowISO()}`);
      lines.push("");
      lines.push(S.mintBodySepolia1);
      lines.push(S.mintBodySepolia2);
      lines.push(S.mintBodySepolia3);
      lines.push("");
      lines.push(`“${S.tagline}”`);
    } else {
      // certificado versión mainnet
      lines.push(S.txtCertHeaderMainnet);
      lines.push(
        `${S.mintFrag} #${String(tokenId || "—").padStart(4, "0")} / 1000`
      );
      lines.push(`Wallet: ${wallet || "—"}`);
      lines.push(`Tx: ${txHash || "—"}`);
      lines.push(`${S.networkPrefix} ${networkName || "—"}`);
      lines.push(`Fecha: ${nowISO()}`);
      lines.push("");
      lines.push(S.mintBody1);
      lines.push(S.mintBody3);
      lines.push("");
      lines.push(`“${S.tagline}”`);
    }

    downloadTextFile(
      `TENIO-fragmento-${tokenId || "X"}.txt`,
      lines.join("\n")
    );
  });
  rowBtns.appendChild(certBtn);

  // Ver on-chain
  const onChainBtn = ghostBtn(S.btnSeeOnchain, () => {
    const url = openEtherscanTx(txHash, networkName);
    window.open(url, "_blank", "noopener,noreferrer");
  });
  rowBtns.appendChild(onChainBtn);

  // Compartir en X
  const shareBtn = ghostBtn(S.btnShareX, () => {
    const url = openEtherscanTx(txHash, networkName);
    const text =
      `${S.mintTitle}\n${S.mintFrag} #${tokenId} · ` +
      `${S.networkPrefix} ${networkName}\n${url}`;
    const intent =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(text);
    window.open(intent, "_blank", "noopener,noreferrer");
  });
  rowBtns.appendChild(shareBtn);

  // Cerrar
  const closeBtn = ghostBtn(S.btnClose, () => {
    overlay.remove();
  });
  rowBtns.appendChild(closeBtn);
}

/* ---------- BURN CONFIRM MODAL ---------- */

function showBurnConfirmModal({ tokenId, networkName, lang, onConfirm, onCancel }) {
  const S = getStrings(lang);

  const isSepolia =
    /sepolia/i.test(networkName || "") ||
    /testnet/i.test(networkName || "") ||
    /sep/i.test(networkName || "");

  const { overlay, card } = createBaseModal();

  const h = document.createElement("h2");
  h.textContent = isSepolia ? S.burnConfirmTitleSepolia : S.burnConfirmTitleMainnet;
  h.style.margin = "0 0 12px";
  h.style.fontSize = "24px";
  h.style.fontWeight = "700";
  h.style.lineHeight = "1.3";
  h.style.color = "rgb(180,160,255)";
  h.style.textAlign = "center";
  card.appendChild(h);

  addP(
    card,
    isSepolia
      ? S.burnConfirmIntroSepolia(tokenId)
      : S.burnConfirmIntroMainnet(tokenId),
    {
      margin: "0 0 16px",
      fontSize: "15px",
      color: "rgba(255,255,255,0.8)",
    }
  );

  const rows = [
    { label: S.burnConfirmLabelFrag, valueText: `#${tokenId}` },
    { label: S.burnConfirmLabelNet, valueText: networkName || "—" },
    {
      label: S.burnConfirmLabelAction,
      valueText: isSepolia
        ? S.burnConfirmActionFinalSepolia
        : S.burnConfirmActionFinalMainnet,
    },
  ];
  addSmallRowBox(card, rows);

  if (isSepolia) {
    addP(card, S.burnConfirmWarningSepolia1, {
      fontWeight: "600",
      margin: "0 0 8px",
    });
    addP(card, S.burnConfirmWarningSepolia2, { margin: "0 0 8px" });
    addP(card, S.burnConfirmWarningSepolia3, { margin: "0 0 8px" });
    addP(card, S.burnConfirmWarningSepolia4, { margin: "0 0 16px" });
  } else {
    addP(card, S.burnConfirmWarningMainnet1, {
      fontWeight: "600",
      margin: "0 0 8px",
    });
    addP(card, S.burnConfirmWarningMainnet2, { margin: "0 0 8px" });
    addP(card, S.burnConfirmWarningMainnet3, { margin: "0 0 8px" });
    addP(card, S.burnConfirmWarningMainnet4, { margin: "0 0 16px" });
  }

  const ask = document.createElement("div");
  ask.textContent = S.burnConfirmQuestion;
  ask.style.textAlign = "center";
  ask.style.marginBottom = "16px";
  ask.style.fontSize = "15px";
  ask.style.color = "#fff";
  card.appendChild(ask);

  const rowBtns = document.createElement("div");
  rowBtns.style.display = "flex";
  rowBtns.style.flexWrap = "wrap";
  rowBtns.style.justifyContent = "center";
  rowBtns.style.gap = "10px";
  card.appendChild(rowBtns);

  const yesBtn = pillBtn(S.burnConfirmYes, async () => {
    overlay.remove();
    try {
      await onConfirm?.();
    } catch (err) {
      console.error("onConfirm error:", err);
    }
  });
  rowBtns.appendChild(yesBtn);

  const cancelBtn = ghostBtn(S.burnConfirmCancel, () => {
    overlay.remove();
    onCancel?.();
  });
  rowBtns.appendChild(cancelBtn);
}

/* ---------- BURN COMPLETE MODAL ---------- */

function showBurnCompleteModal({
  tokenId,
  txHash,
  networkName,
  wallet,
  refundEth,
  lang,
}) {
  const S = getStrings(lang);

  const isSepolia =
    /sepolia/i.test(networkName || "") ||
    /testnet/i.test(networkName || "");

  const { overlay, card } = createBaseModal();

  const h = document.createElement("h2");
  h.textContent = isSepolia ? S.burnDoneTitleSepolia : S.burnDoneTitleMainnet;
  h.style.margin = "0 0 12px";
  h.style.fontSize = "24px";
  h.style.fontWeight = "700";
  h.style.lineHeight = "1.3";
  h.style.color = "rgb(180,160,255)";
  h.style.textAlign = "center";
  card.appendChild(h);

  addP(card, isSepolia ? S.burnDoneIntroSepolia : S.burnDoneIntroMainnet, {
    margin: "0 0 8px",
    fontSize: "15px",
    color: "rgba(255,255,255,0.8)",
  });

  addSmallRowBox(card, [
    { label: S.burnBoxFrag, valueText: `#${tokenId ?? "—"}` },
    { label: S.burnBoxNet, valueText: networkName || "—" },
    {
      label: S.burnBoxTx,
      valueText: shorten(txHash || "", 10, 10),
      valueLink: openEtherscanTx(txHash, networkName),
    },
    { label: S.burnBoxWallet, valueText: wallet ? shorten(wallet) : "—" },
    {
      label: S.burnBoxRefund,
      valueText: `${refundEth ?? "—"} ETH`,
    },
  ]);

  addP(
    card,
    isSepolia ? S.burnDoneExplainSepolia : S.burnDoneExplainMainnet,
    {
      margin: "0 0 16px",
      fontSize: "15px",
      lineHeight: "1.5",
      textAlign: "center",
    }
  );

  addP(card, isSepolia ? S.burnBodySepolia : S.burnBodyMainnet, {
    margin: "0 0 16px",
    fontSize: "15px",
    lineHeight: "1.5",
    textAlign: "center",
  });

  const tagline = document.createElement("div");
  tagline.textContent = S.tagline;
  tagline.style.fontStyle = "italic";
  tagline.style.textAlign = "center";
  tagline.style.fontSize = "14px";
  tagline.style.color = "#fff";
  tagline.style.marginBottom = "20px";
  card.appendChild(tagline);

  const rowBtns = document.createElement("div");
  rowBtns.style.display = "flex";
  rowBtns.style.flexWrap = "wrap";
  rowBtns.style.gap = "10px";
  rowBtns.style.justifyContent = "center";
  rowBtns.style.marginBottom = "12px";
  card.appendChild(rowBtns);

  const certBtn = pillBtn(S.btnDownloadCert, () => {
    const lines = [];

    if (isSepolia) {
      lines.push(S.txtCertHeaderSepolia);
      lines.push(`${S.burnBoxFrag} #${tokenId ?? "—"}`);
      lines.push(`${S.burnBoxWallet} ${wallet || "—"}`);
      lines.push(`${S.burnBoxTx} ${txHash || "—"}`);
      lines.push(`${S.burnBoxNet} ${networkName || "—"}`);
      lines.push(`Fecha: ${nowISO()}`);
      lines.push("");
      lines.push(S.burnBodySepolia);
      lines.push("");
      lines.push(`“${S.tagline}”`);
    } else {
      lines.push(S.txtCertHeaderMainnet);
      lines.push(
        `Fragmento #${String(tokenId || "—").padStart(4, "0")} / 1000`
      );
      lines.push(`Wallet: ${wallet || "—"}`);
      lines.push(`Tx: ${txHash || "—"}`);
      lines.push(`${S.burnBoxNet} ${networkName || "—"}`);
      lines.push(`Fecha: ${nowISO()}`);
      lines.push("");
      lines.push(S.txtCertLinesMainnet1);
      lines.push(S.txtCertLinesMainnet2);
      lines.push("");
      lines.push(`“${S.tagline}”`);
    }

    downloadTextFile(
      `TENIO-burn-${tokenId || "X"}.txt`,
      lines.join("\n")
    );
  });
  rowBtns.appendChild(certBtn);

  const onChainBtn = ghostBtn(S.btnSeeOnchain, () => {
    const url = openEtherscanTx(txHash, networkName);
    window.open(url, "_blank", "noopener,noreferrer");
  });
  rowBtns.appendChild(onChainBtn);

  const shareBtn = ghostBtn(S.btnShareX, () => {
    const url = openEtherscanTx(txHash, networkName);

    const shareText = isSepolia
      ? S.burnShareTextSepolia(tokenId, refundEth, url)
      : S.burnShareTextMainnet(tokenId, refundEth, url);

    const intent =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(shareText);
    window.open(intent, "_blank", "noopener,noreferrer");
  });
  rowBtns.appendChild(shareBtn);

  const closeBtn = ghostBtn(S.btnClose, () => {
    overlay.remove();
  });
  rowBtns.appendChild(closeBtn);
}

/* ---------- EXPOSE TO WINDOW ---------- */

window.showMintSuccessModal = showMintSuccessModal;
window.showBurnConfirmModal = showBurnConfirmModal;
window.showBurnCompleteModal = showBurnCompleteModal;
