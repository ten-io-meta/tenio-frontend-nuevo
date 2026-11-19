# Umbral V2: source-to-runtime reproducibility, chain-provenance boundaries

**Research verification, 2026-11-19. No wallet, transaction, deployment, withdrawal, burn or mint was executed.**

## Identified deployments

| Property | Mainnet | Sepolia |
|---|---|---|
| Contract | 0x841c6a8e1858fd7daf25824e4d305ff06bd7a525 | 0x47C049d0441dae4D06fd7E8d512e4E91B7E92e77 |
| Observed historical block | 26,450,345 | 12,169,588 |
| Actual deployed runtime | 7,160 bytes | 7,160 bytes |
| Keccak256 deployed runtime | 0x4ea55e352e81d0a52669ec97cc6d7ab871315cf54c0060ba615b30e932d0f74f | Same |
| Solidity version extracted from deployed CBOR | 0.8.30 | 0.8.30 |
| Onchain metadata IPFS CID | QmW1sJd5hKbWZnsSLqq1N7JSgboQDdfoeQxBHXKpinXJkL | Same |
| Strict ERC-8060 interface | false | false |

## Actual source reproduction

- The repository's original `contracts/UmbralFragmentV2.sol` file is **empty**. The original 147k-character `contracts/UmbralFragmentV2_flat.sol` is encoded **UTF-16LE with BOM**, not UTF-8. A naive UTF-8 compiler invocation produces a parser error.
- The deployed CBOR identifies solc **0.8.30**. Compiling the decoded flattened Solidity source with **solc 0.8.30, optimizer enabled, 200 runs, no viaIR and Cancun EVM** produces **exactly the same 7,107 executable bytes** as both deployed runtimes.
- The 53-byte Solidity CBOR metadata suffix differs. Therefore **full 7,160-byte byte-for-byte identity is NOT established**; rebuilding the original source path tree and compiler metadata would be needed for that stronger claim. This does not negate the demonstrated identical runtime executable instructions.
- Source-to-runtime comparison evidence: GitHub Actions on [PR #3](https://github.com/ten-io-meta/tenio-frontend-nuevo/pull/3). Network availability occasionally prevents a second RPC from responding in the same run; independent dual-provider equality of both network runtime hashes and reserves was previously established in [read-only frontend PR #2](https://github.com/ten-io-meta/tenio-frontend-nuevo/pull/2) / [Actions 44567371617](https://github.com/ten-io-meta/tenio-frontend-nuevo/actions/runs/44567371617).
- A metadata IPFS content identifier is extracted from onchain CBOR, but external gateways have not confirmed availability of its original JSON. The exact original build input, source paths and creation transaction/constructor input are **not authenticated by this executable-match result**.

## Deployed financial interface and existing users

Read-only snapshot from frontend [Action 44567371617](https://github.com/ten-io-meta/tenio-frontend-nuevo/actions/runs/44567371617):

| View | Mainnet | Sepolia |
|---|---:|---:|
| Live NFTs | 7 | 7 |
| Ever minted | 11 | 26 |
| Mint amount | 0.012 ETH | 0.012 test ETH |
| Burn refund | 0.010 ETH | 0.010 test ETH |
| Contract balance | 0.086 ETH | 0.076 test ETH |
| Self-reported required reserve | 0.070 ETH | 0.070 test ETH |
| Self-reported withdrawable surplus | 0.016 ETH | 0.006 test ETH |

- Published V2 logic has `onlyOwner` withdrawals of computed surplus (not a function that can intentionally withdraw collateral while `totalSupply*BURN_REFUND` is accurate); `burn` is owner-only and uses a reverting ETH transfer so a rejected payout restores the NFT. It has `setBaseURI` available to its administrator for future mints. The full script match justifies this as deployed runtime behavior; **this is not a full proof of all historical state or a security certification**.
- `valueOf(uint256)` is absent, so the deployed code is NOT strict draft ERC-8060 despite its ETH-backed burn. There is NO in-place modification possible via GitHub PRs.
- The seven live Mainnet tokens are real holders' assets. **No old address should be retired or transparently redirected to a new no-admin ERC-8060 contract**. Keep a verified legacy adapter and clear old-vs-new contract/version badges in the frontend. Any future migration must be opt-in and separately reviewed.

## Safe next checks

1. Confirm full deployment constructor transaction and the original source compiler metadata by another authenticated source, where available.
2. Read token owners and tokenURIs by independent onchain calls at a pinned block, and reconcile mint/burn and owner-withdraw events without changing state.
3. Verify that the frontend's legacy ABI maps exactly to these contracts; fail closed on `valueOf` absence rather than advertising ERC-8060 strict compatibility.
4. Execute local adversarial tests and, before production funds, independent security review; do not test historical Mainnet by withdrawing or burning.

**Evidence policy:** an exact executable match is not full source metadata equality, EVM runtime does not by itself prove historical constructor storage contents, and self-reported balances are snapshots, not future financial guarantees.
