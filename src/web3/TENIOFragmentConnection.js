import { ethers } from "ethers";
import ABI from "./ABI.json";

const CONTRACT_ADDRESS = "0xD360714b72796dC812A0c177B9Be45022D1f3f5B"; // Dirección de Sepolia

export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask no está instalado");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

export async function mintFragment() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  const tx = await contract.mintFragment(
    "https://ipfs.io/ipfs/bafkreidacdfc6dk3pwrsi7sgjd7wcacbsjvla4zbewdp54tknsjeyzpfvm",
    {
      value: ethers.parseEther("0.12"),
    }
  );
  await tx.wait();
}

export async function burnFragment(tokenId) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  const tx = await contract.burn(tokenId);
  await tx.wait();
}

export async function getOwnedFragments(account) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  const fragments = [];
  const total = await contract.tokenIds();

  for (let i = 1; i <= total; i++) {
    try {
      const owner = await contract.ownerOf(i);
      if (
        typeof owner === "string" &&
        typeof account === "string" &&
        owner.toLowerCase() === account.toLowerCase()
      ) {
        const uri = await contract.tokenURI(i);
        fragments.push({ id: i, uri });
      }
    } catch (err) {
      // Token no existe o fue quemado
      continue;
    }
  }

  return fragments;
}
