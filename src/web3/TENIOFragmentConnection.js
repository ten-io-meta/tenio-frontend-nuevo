// TENIOFragmentConnection.js
// v4 – redes conmutables, offset de contador y vídeo sin DNS issues

import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import ABI from "./ABI.json";

// ---------- ENV ----------
const FIXED_ADDR = import.meta.env.VITE_CONTRACT_ADDRESS?.trim();

const ADDR_SEPOLIA = import.meta.env.VITE_CONTRACT_SEPOLIA?.trim();
const ADDR_MAINNET = import.meta.env.VITE_CONTRACT_MAINNET?.trim();

const OFFSET_MAINNET = Number(import.meta.env.VITE_MINT_OFFSET_MAINNET ?? 0);
const OFFSET_SEPOLIA = Number(import.meta.env.VITE_MINT_OFFSET_SEPOLIA ?? 0);

const DEFAULT_IMAGE_IPFS = import.meta.env.VITE_DEFAULT_NFT_IMAGE_IPFS?.trim();
const VIDEO_IPFS = import.meta.env.VITE_UMBRAL_VIDEO_IPFS?.trim();

// ---------- IPFS helpers ----------
function ipfsPath(ipfsUrl) {
  if (!ipfsUrl) return "";
  return ipfsUrl.startsWith("ipfs://") ? ipfsUrl.slice(7) : ipfsUrl;
}

export async function getHeroVideoHttp() {
  const path = ipfsPath(VIDEO_IPFS);
  if (!path) return "";
  const candidates = [
    `https://ipfs.io/ipfs/${path}`,                    // <-- primero ipfs.io
    `https://cloudflare-ipfs.com/ipfs/${path}`,
    `https://gateway.pinata.cloud/ipfs/${path}`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) return url;
    } catch {}
  }
  return candidates[0];
}

// ---------- Provider / Contract ----------
export function hasWindowEthereum() {
  return typeof window !== "undefined" && window.ethereum;
}

export async function getAccounts() {
  if (!hasWindowEthereum()) throw new Error("No Ethereum provider");
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  return accounts;
}

export async function getChainId() {
  if (!hasWindowEthereum()) return null;
  const id = await window.ethereum.request({ method: "eth_chainId" });
  return id;
}

// `explicit` puede ser "sepolia" | "mainnet" para forzar red desde UI
export function getActiveAddressFromChain(chainIdHex, explicit = null) {
  if (FIXED_ADDR) return FIXED_ADDR;
  if (explicit === "sepolia") return ADDR_SEPOLIA;
  if (explicit === "mainnet") return ADDR_MAINNET;

  const hex = (chainIdHex || "").toLowerCase();
  if (hex === "0xaa36a7") return ADDR_SEPOLIA; // Sepolia
  if (hex === "0x1") return ADDR_MAINNET;      // Mainnet
  return ADDR_SEPOLIA; // fallback
}

// offset visual según red
export function getCounterOffset(chainIdHex, explicit = null) {
  if (explicit === "sepolia") return OFFSET_SEPOLIA;
  if (explicit === "mainnet") return OFFSET_MAINNET;
  const hex = (chainIdHex || "").toLowerCase();
  if (hex === "0xaa36a7") return OFFSET_SEPOLIA;
  if (hex === "0x1") return OFFSET_MAINNET;
  return 0;
}

function requireAddress(addr, label = "contract") {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Falta dirección de ${label}`);
  }
  return addr;
}

export async function getReadContract(activeAddr) {
  requireAddress(activeAddr);
  if (!hasWindowEthereum()) throw new Error("No provider");
  const provider = new BrowserProvider(window.ethereum);
  return new Contract(activeAddr, ABI, await provider);
}

export async function getWriteContract(activeAddr) {
  requireAddress(activeAddr);
  if (!hasWindowEthereum()) throw new Error("No provider");
  const browser = new BrowserProvider(window.ethereum);
  const signer = await browser.getSigner();
  return new Contract(activeAddr, ABI, signer);
}

// ---------- Conteo de mints por eventos (fallback) ----------
async function countMintsViaEvents(contract) {
  try {
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
export async function getStats(activeAddr) {
  const c = await getReadContract(activeAddr);

  const [
    totalSupply,
    MINT_PRICE,
    BURN_REFUND,
    MAX_SUPPLY,
    requiredReserve,
    balance,
  ] = await Promise.all([
    c.totalSupply().catch(() => 0n),
    c.MINT_PRICE().catch(() => 0n),
    c.BURN_REFUND().catch(() => 0n),
    c.MAX_SUPPLY().catch(() => 0n),
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

  let mintedHistoric;
  try {
    const next = await c._nextId();
    mintedHistoric = Number(next) - 1;
  } catch {
    const byEvents = await countMintsViaEvents(c);
    mintedHistoric = byEvents ?? Number(totalSupply);
  }

  const vivos = Number(totalSupply);
  const burned = mintedHistoric >= vivos ? mintedHistoric - vivos : "—";

  const required = Number(formatEther(requiredReserve || 0n));
  const balanceEth = Number(formatEther(balance));
  const excess = Math.max(0, balanceEth - required);

  return {
    address: activeAddr,
    maxSupply: Number(MAX_SUPPLY),
    mintedHistoric,
    supplyLive: vivos,
    burned,
    mintPrice: Number(formatEther(MINT_PRICE)),
    burnRefund: Number(formatEther(BURN_REFUND)),
    requiredReserveEth: required,
    contractBalanceEth: balanceEth,
    withdrawableEth: excess,
    availableToMint: Math.max(0, Number(MAX_SUPPLY) - mintedHistoric),
  };
}

export async function getOwnedFragments(activeAddr, ownerAddr) {
  const c = await getReadContract(activeAddr);
  const balance = await c.balanceOf(ownerAddr).catch(() => 0n);
  const n = Number(balance);
  const ids = [];
  for (let i = 0; i < n; i++) {
    try {
      const id = await c.tokenOfOwnerByIndex(ownerAddr, i);
      ids.push(Number(id));
    } catch {}
  }
  return ids;
}

export async function getTokenURI(activeAddr, tokenId) {
  const c = await getReadContract(activeAddr);
  return await c.tokenURI(tokenId);
}

// ---------- Escrituras ----------
export async function mintNext(activeAddr, metadataCidOrPath) {
  const c = await getWriteContract(activeAddr);
  const price = await c.MINT_PRICE();
  const tx = await c.mintFragment(metadataCidOrPath, { value: price });
  return await tx.wait();
}

export async function burn(activeAddr, tokenId) {
  const c = await getWriteContract(activeAddr);
  const tx = await c.burn(tokenId);
  return await tx.wait();
}

export async function withdrawAllSurplus(activeAddr) {
  const c = await getWriteContract(activeAddr);
  const to = await c.signer.getAddress();
  const tx = await c.withdrawAllSurplus(to);
  return await tx.wait();
}

export async function withdrawSurplus(activeAddr, amountEth) {
  const c = await getWriteContract(activeAddr);
  const to = await c.signer.getAddress();
  const tx = await c.withdrawSurplus(to, parseEther(String(amountEth)));
  return await tx.wait();
}

// Añadir a MetaMask
export async function addToMetamask(activeAddr, tokenId, tokenUri) {
  if (!hasWindowEthereum()) throw new Error("No provider");
  const imgPath = ipfsPath(DEFAULT_IMAGE_IPFS);
  const image = imgPath ? `https://ipfs.io/ipfs/${imgPath}` : undefined;

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

export const __env = {
  FIXED_ADDR,
  ADDR_SEPOLIA,
  ADDR_MAINNET,
  OFFSET_MAINNET,
  OFFSET_SEPOLIA,
};
