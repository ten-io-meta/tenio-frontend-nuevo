import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0xD360714b72796dC812A0c177B9Be45022D1f3f5B';

const ABI = [
  {
    inputs: [{ internalType: 'string', name: 'uri', type: 'string' }],
    name: 'mintFragment',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
];

let provider;
let signer;
let contract;

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask no está disponible');

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  const address = await signer.getAddress();
  return address;
}

export async function mintFragment() {
  if (!contract) throw new Error('No conectado');

  const uri = 'ipfs://bafkreidacdfc6dk3pwrsi7sgjd7wcacbsjvla4zbewdp54tknsjeyzpfvm';
  const tx = await contract.mintFragment(uri, {
    value: ethers.parseEther('0.12'),
  });

  await tx.wait();
  return tx.hash;
}

export async function burnFragment(tokenId) {
  if (!contract) throw new Error('No conectado');

  const tx = await contract.burn(tokenId);
  await tx.wait();
  return tx.hash;
}

export async function getOwnedFragments() {
  if (!contract || !signer) throw new Error('No conectado');

  const address = await signer.getAddress();
  const balance = await contract.balanceOf(address);
  const fragments = [];

  for (let i = 0; i < balance; i++) {
    const tokenId = await contract.tokenOfOwnerByIndex(address, i);
    const uri = await contract.tokenURI(tokenId);
    fragments.push({ id: tokenId.toString(), uri });
  }

  return fragments;
}
