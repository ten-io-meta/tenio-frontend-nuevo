// Deliberately do not render raw RPC / ethers exceptions in the public UI.
// They may contain large JSON payloads and do not mean the NFT balance is zero.
export function explainChainReadError(error, lang = "es", ownerList = false) {
  const technical = String(error?.shortMessage || error?.message || error || "").toLowerCase();
  let category = ownerList ? "ownership" : "rpc";
  if (/insufficient reserve|underfunded|reserva insuficiente/.test(technical))
    category = "insolvency";
  else if (/reserve|surplus|inconsistent|deficit|invalid .*supply|invalid .*id/.test(technical))
    category = "inconsistent";
  else if (/runtime unverified|executable does not match|unverified contract|codehash/.test(technical))
    category = "runtime";
  else if (/wrong wallet network|wrong network|network.address|unsupported chain|cambia la red en metamask/.test(technical))
    category = "network";

  const messages = {
    es: {
      rpc: "No se pudo consultar la blockchain. Datos no disponibles; revisa MetaMask o el RPC.",
      ownership: "No se pudo verificar qué NFT pertenecen a esta wallet. Operaciones bloqueadas.",
      runtime: "El código del contrato no coincide con el verificado. Operaciones bloqueadas.",
      network: "Red de wallet incorrecta. Selecciona Mainnet o Sepolia para continuar.",
      inconsistent: "La información de reservas o emisión no es coherente. Operaciones bloqueadas.",
      insolvency: "Reserva insuficiente detectada. No se puede garantizar el reembolso; operaciones bloqueadas.",
    },
    en: {
      rpc: "Blockchain could not be queried. Data unavailable; check MetaMask or your RPC.",
      ownership: "NFT ownership could not be verified. Financial actions are disabled.",
      runtime: "Contract code does not match the verified deployment. Financial actions disabled.",
      network: "Wrong wallet network. Select Mainnet or Sepolia to continue.",
      inconsistent: "Reserve or issuance data is inconsistent. Financial actions disabled.",
      insolvency: "Insufficient reserve detected. Redemption cannot be guaranteed; financial actions disabled.",
    },
  };
  return (messages[lang] || messages.es)[category];
}
