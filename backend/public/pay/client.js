"use strict";
const byId = id => document.getElementById(id);
const token = location.pathname.split("/").pop();
const endpoint = `/api/v1/requests/${encodeURIComponent(token)}`;
let request, busy = false;
const statusText = text => { byId("status").textContent = text; };
async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Service indisponible, réessaie plus tard.");
  return data;
}
function saveReceipt(hash) { byId("hash").value = hash; try { sessionStorage.setItem(`atara-payment-${token}`, hash); } catch {} }
async function load() {
  request = await fetchJson(endpoint);
  byId("network").textContent = request.chainId === 84532 ? "Base Sepolia · Fonds de test uniquement" : "Base · Fonds réels";
  byId("amount").textContent = `${request.amount} USDC`;
  byId("note").textContent = request.note;
  byId("recipient").textContent = request.recipientAddress;
  byId("expiry").textContent = `Valable jusqu’au ${new Date(request.expiresAt).toLocaleString("fr-FR")}`;
  byId("receipt").hidden = false;
  if (request.status !== "OPEN") {
    statusText({ PAID: "Paiement confirmé.", EXPIRED: "Demande expirée. Ne lance pas de nouveau paiement.", CANCELLED: "Demande annulée. Ne lance pas de nouveau paiement." }[request.status]);
    byId("connect").disabled = true; byId("copy").disabled = true; byId("qr").hidden = true;
    if (request.txHash) saveReceipt(request.txHash);
    return;
  }
  try { const saved = sessionStorage.getItem(`atara-payment-${token}`); if (saved) saveReceipt(saved); } catch {}
  byId("connect").disabled = !!byId("hash").value;
  byId("copy").disabled = false;
  byId("qr").src = `${endpoint}/qr`; byId("qr").hidden = false;
  if (byId("hash").value) statusText("Un paiement a déjà été envoyé. Vérifie sa confirmation ci-dessous.");
}
byId("copy").onclick = async () => { try { await navigator.clipboard.writeText(request.uri); statusText("Demande copiée. Vérifie tous les détails dans ton portefeuille."); } catch { statusText("Copie indisponible. Utilise le QR ou copie l’adresse et le montant affichés."); } };
byId("connect").onclick = async () => {
  if (busy) return;
  busy = true; byId("connect").disabled = true;
  try {
    await load(); byId("connect").disabled = true;
    if (request.status !== "OPEN" || Date.now() >= Date.parse(request.expiresAt) || byId("hash").value) throw new Error("Cette demande ne doit plus être payée. Vérifie le reçu.");
    if (!window.ethereum?.request) throw new Error("Ouvre ce lien depuis le navigateur de ton portefeuille Base, ou scanne le QR compatible EIP-681.");
    const chain = `0x${request.chainId.toString(16)}`;
    if (await window.ethereum.request({ method: "eth_chainId" }) !== chain) await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain }] });
    const [from] = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (await window.ethereum.request({ method: "eth_chainId" }) !== chain) throw new Error("Réseau incorrect.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(request.recipientAddress) || !/^0x[0-9a-fA-F]{40}$/.test(request.tokenAddress)) throw new Error("Adresse invalide.");
    const [whole, fraction = ""] = String(request.amount).split(".");
    const raw = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
    const data = `0xa9059cbb${request.recipientAddress.slice(2).padStart(64, "0")}${raw.toString(16).padStart(64, "0")}`;
    const hash = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from, to: request.tokenAddress, data, value: "0x0" }] });
    saveReceipt(hash); statusText("Paiement envoyé. Vérifie-le après deux confirmations réseau. Ne paie pas à nouveau.");
  } catch (error) { statusText(error.message || "Paiement non terminé."); }
  finally { busy = false; byId("connect").disabled = !!byId("hash").value || request?.status !== "OPEN"; }
};
byId("confirm").onclick = async () => {
  const hash = byId("hash").value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return statusText("Saisis le hash du paiement : 0x suivi de 64 caractères.");
  if (busy) return; busy = true; byId("confirm").disabled = true;
  try {
    if (!window.ethereum?.request) throw new Error("Ouvre ce lien dans le portefeuille qui a payé pour signer le reçu de confirmation.");
    const [payerAddress] = await window.ethereum.request({ method: "eth_requestAccounts" });
    const message = `${request.confirmationMessage}\nTransaction: ${hash.toLowerCase()}`;
    const hex = '0x' + [...new TextEncoder().encode(message)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const signature = await window.ethereum.request({ method: "personal_sign", params: [hex, payerAddress] });
    await fetchJson(`${endpoint}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: hash, payerAddress, signature }) });
    saveReceipt(hash); await load();
  } catch (error) { statusText(error.message || "Vérification indisponible. Conserve le reçu."); }
  finally { busy = false; byId("confirm").disabled = false; }
};
load().catch(error => statusText(error.message));
