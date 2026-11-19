import { Contract, getAddress, keccak256 } from "ethers";

// Not wired to the public UI. No ERC-8060 deployment is whitelisted yet.
// A future application must supply an independently audited deployment
// (address, chain ID and exact executable runtime hash) before use.
const STRICT_READ_ABI = [
  "function supportsInterface(bytes4) view returns (bool)",
  "function ownerOf(uint256) view returns (address)",
  "function valueOf(uint256) view returns (uint256)",
  "function burn(uint256)",
];
const STRICT_ERC8060_ID = "0x88495fe7";

export async function createVerifiedStrict8060Reader(provider, deployment) {
  if (!deployment?.address || !deployment?.chainId || !deployment?.runtimeHash) {
    throw new Error("ERC-8060: independently verified deployment configuration required");
  }
  const address = getAddress(deployment.address);
  const network = await provider.getNetwork();
  if (BigInt(network.chainId) !== BigInt(deployment.chainId)) {
    throw new Error("ERC-8060: wrong network; no data was read");
  }
  const code = await provider.getCode(address);
  if (!code || code === "0x" || keccak256(code).toLowerCase() !== deployment.runtimeHash.toLowerCase()) {
    throw new Error("ERC-8060: contract executable does not match pinned evidence");
  }
  const contract = new Contract(address, STRICT_READ_ABI, provider);
  if (await contract.supportsInterface(STRICT_ERC8060_ID) !== true) {
    throw new Error("ERC-8060: strict IERC721Value interface not advertised");
  }
  // An advertised ERC-165 interface and exact runtime pin do NOT themselves
  // establish redeemability, constructor provenance, or collateral solvency.
  return Object.freeze({
    address,
    chainId: BigInt(deployment.chainId),
    async readToken(tokenId) {
      const [owner, value] = await Promise.all([
        contract.ownerOf(tokenId),
        contract.valueOf(tokenId),
      ]);
      return { tokenId: BigInt(tokenId), owner, valueWei: value };
    },
  });
}

// Intentionally no mint, burn, approve or withdraw action in this adapter.
// A separate future product release must be explicitly reviewed before writes.
