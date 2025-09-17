// deploy.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");

// ============ CONFIG ============
const RPC_URL = "https://rpc.ankr.com/monad_testnet"; // Monad testnet
const CHAIN_ID = 10143;
const PRIVATE_KEY = "0x488374a49b940858401234d6171339b85639f956bb1f3cf6f14ceccb538d0edd"; // funded wallet

// Path to artifact JSON file
const ARTIFACT_PATH = path.join(__dirname, "artifacts", "contracts", "MyToken.sol", "MyToken.json");

// ============ HELPERS ============
function readNames(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).map(line => {
    const parts = line.split(",").map(s => s.trim());
    return { name: parts[0], symbol: (parts[1] || "").toUpperCase() };
  }).filter(x => x.name && x.symbol);
}

function pickRandom(arr) {
  const i = crypto.randomInt(0, arr.length);
  return arr[i];
}

// ============ MAIN ============
async function main() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error("Artifact not found. Compile MyToken.sol first.");
  }

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
  if (!artifact.abi || !artifact.bytecode) {
    throw new Error("Artifact missing abi/bytecode.");
  }

  // v5 provider + wallet
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const balance = await wallet.getBalance();
  if (balance.isZero()) throw new Error("Wallet has no MON.");

  console.log("Deployer:", wallet.address, "Balance:", ethers.utils.formatEther(balance));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  const namesFile = path.join(__dirname, "names.txt");
  const entries = readNames(namesFile);
  if (!entries.length) throw new Error("names.txt is missing or empty.");

  let deployed = 0;

  for (let i = 0; i < entries.length; i++) {
    try {
      const entry = pickRandom(entries);
      console.log(`[${i+1}] Deploying ${entry.name} (${entry.symbol})...`);
      const supply = ethers.utils.parseUnits("1000000000", 18); // 1B
      const token = await factory.deploy(entry.name, entry.symbol, supply);
      const receipt = await token.deployTransaction.wait(1);
      console.log(`   -> Address: ${token.address}`);
      console.log(`   -> Tx: ${receipt.transactionHash}`);
      deployed++;
    } catch (err) {
      console.error("Deploy error:", err.message || err);
      break;
    }
  }

  console.log(`Done. ${deployed} tokens deployed.`);
}

main().catch(err => {
  console.error("FATAL:", err.message || err);
  process.exit(1);
});