"use strict";
const byId = id => document.getElementById(id);
const token = location.pathname.split("/").pop();
const endpoint = `/api/v1/requests/${encodeURIComponent(token)}`;
let request, busy = false;
const statusText = text => { byId("status").textContent = text; };
async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Service unavailable. Try again later.");
  return data;
}
function saveReceipt(hash) { byId("hash").value = hash; try { sessionStorage.setItem(`atara-payment-${token}`, hash); } catch {} }
async function load() {
  request = await fetchJson(endpoint);
  byId("network").textContent = request.chainId === 84532 ? "Base Sepolia · Test funds only" : "Base · Real funds";
  byId("amount").textContent = `${request.amount} USDC`;
  byId("note").textContent = request.note;
  byId("recipient").textContent = request.recipientAddress;
  byId("expiry").textContent = `Valid until ${new Date(request.expiresAt).toLocaleString("en-US")}`;
  byId("receipt").hidden = false;
  if (request.status !== "OPEN") {
    statusText({ PAID: "Payment confirmed.", EXPIRED: "Request expired. Do not send another payment.", CANCELLED: "Request canceled. Do not send another payment." }[request.status]);
    byId("connect").disabled = true; byId("copy").disabled = true; byId("qr").hidden = true;
    if (request.txHash) saveReceipt(request.txHash);
    return;
  }
  try { const saved = sessionStorage.getItem(`atara-payment-${token}`); if (saved) saveReceipt(saved); } catch {}
  byId("connect").disabled = !!byId("hash").value;
  byId("copy").disabled = false;
  byId("qr").src = `${endpoint}/qr`; byId("qr").hidden = false;
  if (byId("hash").value) statusText("A payment was already sent. Check its confirmation below.");
}
byId("copy").onclick = async () => { try { await navigator.clipboard.writeText(request.uri); statusText("Request copied. Check every detail in your wallet."); } catch { statusText("Copy unavailable. Use the QR code or copy the address and amount shown."); } };
byId("connect").onclick = async () => {
  if (busy) return;
  busy = true; byId("connect").disabled = true;
  try {
    await load(); byId("connect").disabled = true;
    if (request.status !== "OPEN" || Date.now() >= Date.parse(request.expiresAt) || byId("hash").value) throw new Error("Do not pay this request again. Check the receipt.");
    if (!window.ethereum?.request) throw new Error("Open this link in your Base wallet browser or scan the EIP-681 QR code.");
    const chain = `0x${request.chainId.toString(16)}`;
    if (await window.ethereum.request({ method: "eth_chainId" }) !== chain) await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain }] });
    const [from] = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (await window.ethereum.request({ method: "eth_chainId" }) !== chain) throw new Error("Wrong network.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(request.recipientAddress) || !/^0x[0-9a-fA-F]{40}$/.test(request.tokenAddress)) throw new Error("Invalid address.");
    const [whole, fraction = ""] = String(request.amount).split(".");
    const raw = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
    const data = `0xa9059cbb${request.recipientAddress.slice(2).padStart(64, "0")}${raw.toString(16).padStart(64, "0")}`;
    const hash = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from, to: request.tokenAddress, data, value: "0x0" }] });
    saveReceipt(hash); statusText("Payment sent. Check it after two network confirmations. Do not pay again.");
  } catch (error) { statusText(error.message || "Payment incomplete."); }
  finally { busy = false; byId("connect").disabled = !!byId("hash").value || request?.status !== "OPEN"; }
};
byId("confirm").onclick = async () => {
  const hash = byId("hash").value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return statusText("Enter the transaction hash: 0x followed by 64 characters.");
  if (busy) return; busy = true; byId("confirm").disabled = true;
  try {
    if (!window.ethereum?.request) throw new Error("Open this link in the wallet that paid to sign the confirmation receipt.");
    const [payerAddress] = await window.ethereum.request({ method: "eth_requestAccounts" });
    const message = `${request.confirmationMessage}\nTransaction: ${hash.toLowerCase()}`;
    const hex = '0x' + [...new TextEncoder().encode(message)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const signature = await window.ethereum.request({ method: "personal_sign", params: [hex, payerAddress] });
    await fetchJson(`${endpoint}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: hash, payerAddress, signature }) });
    saveReceipt(hash); await load();
  } catch (error) { statusText(error.message || "Verification unavailable. Keep your receipt."); }
  finally { busy = false; byId("confirm").disabled = false; }
};
load().catch(error => statusText(error.message));
