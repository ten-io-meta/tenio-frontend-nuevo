// Protege el provider para que MetaMask no se pelee con otras extensiones
if (typeof window !== "undefined" && window.ethereum) {
  try {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      writable: false,
      value: window.ethereum
    });
  } catch (e) {
    console.warn("Ethereum provider conflict ignored:", e);
  }
}

// TENIOFragmentConnection.js
// v7.3 – añade post-mint modal + protección provider + helpers red/tokenId
// Mantiene toda la lógica anterior (stats, burn, withdraw, etc.)

import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import ABI from "./UmbralFragment.json";

// ---------- ENV ----------
const FIXED_ADDR   = import.meta.env.VITE_CONTRACT_ADDRESS?.trim();
const ADDR_SEPOLIA = import.meta.env.VITE_CONTRACT_SEPOLIA?.trim();
const ADDR_MAINNET = import.meta.env.VITE_CONTRACT_MAINNET?.trim();

const OFFSET_MAINNET = Number(import.meta.env.VITE_MINT_OFFSET_MAINNET ?? 0);
const OFFSET_SEPOLIA = Number(import.meta.env.VITE_MINT_OFFSET_SEPOLIA ?? 0);

const DEFAULT_IMAGE_IPFS = import.meta.env.VITE_DEFAULT_NFT_IMAGE_IPFS?.trim();
const VIDEO_IPFS         = import.meta.env.VITE_UMBRAL_VIDEO_IPFS?.trim();

// ---------- Utils ----------
const toNum = (v, d = 0) => {
  try {
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "number") return Number.isFinite(v) ? v : d;
    if (v == null) return d;
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  } catch {
    return d;
  }
};

const clampMin = (x, m = 0) => (x < m ? m : x);

function ipfsPath(ipfsUrl) {
  if (!ipfsUrl) return "";
  return ipfsUrl.startsWith("ipfs://") ? ipfsUrl.slice(7) : ipfsUrl;
}

// Devuelve "Sepolia", "Ethereum"… según chainId
async function getNetworkName() {
  if (!hasWindowEthereum()) return "Ethereum";
  try {
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const hex = (chainIdHex || "").toLowerCase();
    if (hex === "0xaa36a7") return "Sepolia"; // 11155111
    if (hex === "0x1")      return "Ethereum";
    return "Ethereum";
  } catch {
    return "Ethereum";
  }
}

// Intenta sacar la dirección de la wallet conectada
async function getActiveWalletAddress() {
  if (!hasWindowEthereum()) return "0x????";
  try {
    const accts = await window.ethereum.request({ method: "eth_accounts" });
    if (accts && accts[0]) return accts[0];
  } catch {}
  try {
    if (window.ethereum.selectedAddress) return window.ethereum.selectedAddress;
  } catch {}
  return "0x????";
}

// Extrae tokenId del receipt usando evento Transfer(from=0x0 → user)
function extractMintedTokenIdFromReceipt(receipt, contractInstance) {
  try {
    if (!receipt || !receipt.logs || !contractInstance || !contractInstance.interface) {
      return "—";
    }
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    for (const log of receipt.logs) {
      if (
        log.address &&
        contractInstance.address &&
        log.address.toLowerCase() === contractInstance.address.toLowerCase()
      ) {
        // ethers v6: interface.parseLog(log)
        const parsed = contractInstance.interface.parseLog(log);
        if (
          parsed &&
          parsed.name === "Transfer" &&
          parsed.args &&
          parsed.args.from &&
          parsed.args.tokenId &&
          parsed.args.from.toLowerCase() === zeroAddr.toLowerCase()
        ) {
          return parsed.args.tokenId.toString();
        }
      }
    }
  } catch (err) {
    console.warn("No pude extraer tokenId desde receipt:", err);
  }
  return "—";
}

// ---------- Video ----------
export async function getHeroVideoHttp() {
  const path = ipfsPath(VIDEO_IPFS);
  if (!path) return "";
  const candidates = [
    `https://ipfs.io/ipfs/${path}`,
    `https://cloudflare-ipfs.com/ipfs/${path}`,
    `https://gateway.pinata.cloud/ipfs/${path}`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) return url;
    } catch {}
  }
  // fallback al primero aunque no hayamos podido HEAD-ok
  return candidates[0];
}

// ---------- Provider ----------
export function hasWindowEthereum() {
  return typeof window !== "undefined" && window.ethereum;
}
export async function getAccounts() {
  if (!hasWindowEthereum()) throw new Error("No Ethereum provider");
  return await window.ethereum.request({ method: "eth_requestAccounts" });
}
export async function getChainId() {
  if (!hasWindowEthereum()) return null;
  return await window.ethereum.request({ method: "eth_chainId" });
}

// ---------- Net helpers ----------
function inferExpectedNetworkFromAddress(addr) {
  if (!addr) return null;
  const a = addr.toLowerCase();
  if (ADDR_SEPOLIA && a === ADDR_SEPOLIA.toLowerCase()) return "sepolia";
  if (ADDR_MAINNET && a === ADDR_MAINNET.toLowerCase()) return "mainnet";
  return null;
}

export async function ensureNetwork(expected /* "sepolia" | "mainnet" */) {
  if (!expected) return;
  if (!hasWindowEthereum()) throw new Error("No provider");
  const wanted = expected === "sepolia" ? "0xaa36a7" : "0x1";
  const current = (
    await window.ethereum.request({ method: "eth_chainId" })
  )?.toLowerCase();
  if (current !== wanted) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: wanted }],
      });
    } catch {
      throw new Error(`Cambia la red en MetaMask a ${expected} para continuar.`);
    }
  }
}

// ---------- Dirección activa por red ----------
export function getActiveAddressFromChain(chainIdHex, explicit = null) {
  if (FIXED_ADDR) return FIXED_ADDR;
  if (explicit === "sepolia") return ADDR_SEPOLIA;
  if (explicit === "mainnet") return ADDR_MAINNET;

  const hex = (chainIdHex || "").toLowerCase();
  if (hex === "0xaa36a7") return ADDR_SEPOLIA;
  if (hex === "0x1")      return ADDR_MAINNET;
  return ADDR_SEPOLIA;
}

// ---------- Offsets ----------
export function getCounterOffset(chainIdHex, explicit = null) {
  if (explicit === "sepolia") return OFFSET_SEPOLIA;
  if (explicit === "mainnet") return OFFSET_MAINNET;
  const hex = (chainIdHex || "").toLowerCase();
  if (hex === "0xaa36a7") return OFFSET_SEPOLIA;
  if (hex === "0x1")      return OFFSET_MAINNET;
  return 0;
}

function visualOffset(activeAddr, chainIdHex, explicit) {
  if (explicit === "sepolia") return OFFSET_SEPOLIA;
  if (explicit === "mainnet") return OFFSET_MAINNET;

  const a = (activeAddr || "").toLowerCase();
  if (ADDR_SEPOLIA && a === (ADDR_SEPOLIA || "").toLowerCase()) return OFFSET_SEPOLIA;
  if (ADDR_MAINNET && a === (ADDR_MAINNET || "").toLowerCase()) return OFFSET_MAINNET;

  const hex = (chainIdHex || "").toLowerCase();
  if (hex === "0xaa36a7") return OFFSET_SEPOLIA;
  if (hex === "0x1")      return OFFSET_MAINNET;
  return 0;
}

function requireAddress(addr, label = "contract") {
  if (
    !addr ||
    addr === "0x0000000000000000000000000000000000000000"
  ) {
    throw new Error(`Falta dirección de ${label}`);
  }
  return addr;
}

// ---------- Instancias (LECTURAS ahora también aseguran red) ----------
export async function getReadContract(activeAddr, expectedNet = null) {
  requireAddress(activeAddr);
  if (!hasWindowEthereum()) throw new Error("No provider");
  if (expectedNet) await ensureNetwork(expectedNet);
  const provider = new BrowserProvider(window.ethereum);
  return new Contract(activeAddr, ABI, await provider);
}

export async function getWriteContract(activeAddr, explicitExpected = null) {
  requireAddress(activeAddr);
  if (!hasWindowEthereum()) throw new Error("No provider");
  const inferred = inferExpectedNetworkFromAddress(activeAddr);
  await ensureNetwork(explicitExpected || inferred);
  const browser = new BrowserProvider(window.ethereum);
  const signer  = await browser.getSigner();
  return new Contract(activeAddr, ABI, signer);
}

// ---------- Fallback: conteo por eventos ----------
async function countMintsViaEvents(contract) {
  try {
    // Transfer(from=0x0 → to=buyer) es el mint
    const filter = contract.filters.Transfer(
      "0x0000000000000000000000000000000000000000"
    );
    const events = await contract.queryFilter(filter, 0, "latest");
    return events.length;
  } catch {
    return null;
  }
}

// ---------- Lecturas ----------
export async function getStats(activeAddr, chainIdHex = null, explicit = null) {
  const expected = explicit || inferExpectedNetworkFromAddress(activeAddr);
  const c = await getReadContract(activeAddr, expected);

  const [
    totalSupplyRaw,
    mintPriceRaw,
    burnRefundRaw,
    maxSupplyRaw,
    requiredReserveRaw,
    contractEthBalanceRaw,
  ] = await Promise.all([
    c.totalSupply?.().catch(() => 0n),
    c.MINT_PRICE?.().catch(() => 0n),
    c.BURN_REFUND?.().catch(() => 0n),
    c.MAX_SUPPLY?.().catch(() => 1000n),
    c.requiredReserve?.().catch?.(() => 0n) ?? 0n,
    (async () => {
      try {
        const addr = await c.getAddress();
        const p = new BrowserProvider(window.ethereum);
        return await p.getBalance(addr);
      } catch {
        return 0n;
      }
    })(),
  ]);

  let mintedHistoric = 0;
  try {
    const next =
      (await c._nextId?.().catch(() => null)) ??
      (await c.nextId?.().catch(() => null)) ??
      (await c.mintedEver?.().catch(() => null));
    if (next != null) {
      mintedHistoric = toNum(next) - 1;
    } else {
      const byEvents = await countMintsViaEvents(c);
      mintedHistoric =
        byEvents != null ? toNum(byEvents) : toNum(totalSupplyRaw);
    }
  } catch {
    const byEvents = await countMintsViaEvents(c);
    mintedHistoric =
      byEvents != null ? toNum(byEvents) : toNum(totalSupplyRaw);
  }
  mintedHistoric = clampMin(toNum(mintedHistoric, 0));

  const vivos        = clampMin(toNum(totalSupplyRaw, 0));
  const burned       = mintedHistoric >= vivos ? mintedHistoric - vivos : 0;
  const requiredEth  = toNum(Number(formatEther(requiredReserveRaw || 0n)), 0);
  const balanceEth   = toNum(Number(formatEther(contractEthBalanceRaw || 0n)), 0);
  const maxSupply    = clampMin(toNum(maxSupplyRaw, 1000));
  const excess       = clampMin(balanceEth - requiredEth, 0);

  const offset            = visualOffset(activeAddr, chainIdHex, explicit);
  const histWithOffset    = clampMin(mintedHistoric + offset, 0);
  const available         = clampMin(maxSupply - histWithOffset, 0);

  return {
    address: activeAddr,
    maxSupply,
    mintedHistoric: histWithOffset,
    supplyLive: vivos,
    burned,
    mintPrice: toNum(Number(formatEther(mintPriceRaw || 0n)), 0),
    burnRefund: toNum(Number(formatEther(burnRefundRaw || 0n)), 0),
    requiredReserveEth: requiredEth,
    contractBalanceEth: balanceEth,
    withdrawableEth: excess,
    availableToMint: available,
  };
}

// ---------- Owned / URI ----------
export async function getOwnedFragments(activeAddr, ownerAddr) {
  const c = await getReadContract(
    activeAddr,
    inferExpectedNetworkFromAddress(activeAddr)
  );
  const balance = toNum(
    await c.balanceOf(ownerAddr).catch(() => 0n),
    0
  );
  const ids = [];
  for (let i = 0; i < balance; i++) {
    try {
      ids.push(
        toNum(await c.tokenOfOwnerByIndex(ownerAddr, i), 0)
      );
    } catch {}
  }
  return ids;
}

export async function getTokenURI(activeAddr, tokenId) {
  const c = await getReadContract(
    activeAddr,
    inferExpectedNetworkFromAddress(activeAddr)
  );
  return await c.tokenURI(tokenId);
}

// ---------- Modal helper tras mint ----------
async function postMintShowModal(receipt, contractInstance) {
  // 1. status ok?
  if (!receipt || receipt.status !== 1) return;

  // 2. datos contexto
  const walletAddr   = await getActiveWalletAddress();
  const networkName  = await getNetworkName();
  const minedTokenId = extractMintedTokenIdFromReceipt(receipt, contractInstance);
  const txHash       = receipt.transactionHash || "0x";

  // 3. dispara el modal global (definido en /public/modals-tenio.js)
  if (typeof window !== "undefined" && typeof window.showMintSuccessModal === "function") {
    window.showMintSuccessModal({
      tokenId: minedTokenId,
      txHash: txHash,
      networkName: networkName,
      wallet: walletAddr
    });
  } else if (typeof showMintSuccessModal === "function") {
    // fallback si showMintSuccessModal está global sin window.
    showMintSuccessModal({
      tokenId: minedTokenId,
      txHash: txHash,
      networkName: networkName,
      wallet: walletAddr
    });
  } else {
    console.warn(
      "Mint OK pero showMintSuccessModal no está cargado todavía."
    );
  }
}

// ---------- Escrituras ----------
export async function mintNext(activeAddr, metadataCidOrPath) {
  // 1. contrato en red correcta + signer
  const c = await getWriteContract(activeAddr);

  // 2. precio de mint
  const price = await c.MINT_PRICE();

  // 3. tx de mint (tu función puede llamarse distinto en tu contrato; aquí usamos mintFragment)
  const tx = await c.mintFragment(metadataCidOrPath, { value: price });

  // 4. esperamos a que mine
  const receipt = await tx.wait();

  // 5. disparamos el modal post-mint con datos reales
  try {
    await postMintShowModal(receipt, c);
  } catch (e) {
    console.warn("No se pudo lanzar el modal post-mint:", e);
  }

  // devolvemos el receipt por si tu UI ya lo usaba
  return receipt;
}

export async function burn(activeAddr, tokenId) {
  const c = await getWriteContract(activeAddr);
  const tx = await c.burn(tokenId);
  const receipt = await tx.wait();
  // Aquí luego meteremos el modal "atención, esto se destruye y recuperas colateral".
  // De momento lo dejamos limpio.
  return receipt;
}

export async function withdrawAllSurplus(activeAddr) {
  const c = await getWriteContract(activeAddr);
  const to = await c.runner.getAddress();
  const tx = await c.withdrawAllSurplus(to);
  return await tx.wait();
}

export async function withdrawSurplus(activeAddr, amountEth) {
  const c = await getWriteContract(activeAddr);
  const to = await c.runner.getAddress();
  const tx = await c.withdrawSurplus(
    to,
    parseEther(String(amountEth))
  );
  return await tx.wait();
}

// ---------- MetaMask: watch asset ----------
export async function addToMetamask(activeAddr, tokenId, tokenUri) {
  if (!hasWindowEthereum()) throw new Error("No provider");
  const imgPath = ipfsPath(DEFAULT_IMAGE_IPFS);
  const image   = imgPath
    ? `https://ipfs.io/ipfs/${imgPath}`
    : undefined;
  try {
    await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC721",
        options: {
          address: activeAddr,
          tokenId: String(tokenId),
          image,
        },
      },
    });
  } catch (e) {
    console.warn("watchAsset error", e);
  }
}

// ---------- Export env visible ----------
export const __env = {
  FIXED_ADDR,
  ADDR_SEPOLIA,
  ADDR_MAINNET,
  OFFSET_MAINNET,
  OFFSET_SEPOLIA,
};
