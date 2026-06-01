import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG — change this to your deployed backend URL ─────────────────────
// const API = "https://meghanas-kitchen-backend.up.railway.app";
// During local dev use:
//const API = "http://localhost:5000"; // for local development
const API = "https://meghanas-kitchen-backend.onrender.com"; //render

const TABLES = [1, 2, 3, 4, 5, 6, 7, 8];
const RESTAURANT = "Meghana's Kitchen";
const CATEGORIES = ["Starters", "Mains", "Breads", "Drinks", "Desserts"];

// ─── API helpers ────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const token = localStorage.getItem("owner_token");
  const res = await fetch(API + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function fmtDT(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function tax(n) {
  return Math.round(n * 0.05);
}
function dateKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function isValidPhone(p) {
  return /^[6-9]\d{9}$/.test(p.replace(/\s/g, ""));
}

function buildReceiptHTML(tableNo, phone, items, subtotal, billedAt) {
  const gst = tax(subtotal),
    grand = subtotal + gst;
  const rows = items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">₹${i.price * i.qty}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>Bill – Table ${tableNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600&display=swap');
    body{font-family:'DM Sans',sans-serif;background:#fff;color:#1a1206;margin:0;padding:0;}
    .page{max-width:340px;margin:0 auto;padding:32px 24px;}
    .logo{text-align:center;margin-bottom:20px;}
    .logo h1{font-family:'Playfair Display',serif;font-size:22px;color:#1a1206;margin:0;}
    .logo p{font-size:11px;color:#666;margin:4px 0 0;}
    .divider{border:none;border-top:1px dashed #ccc;margin:14px 0;}
    .meta{font-size:12px;color:#555;margin-bottom:14px;}
    .meta div{margin:2px 0;}
    table{width:100%;border-collapse:collapse;font-size:13px;}
    thead th{font-size:11px;color:#888;text-align:left;padding:4px 0;border-bottom:1px solid #eee;}
    tbody td{padding:5px 0;border-bottom:1px solid #f5f5f5;vertical-align:top;}
    .totals{margin-top:12px;font-size:13px;}
    .totals div{display:flex;justify-content:space-between;padding:3px 0;}
    .grand{font-size:16px;font-weight:700;color:#1a1206;border-top:1px solid #1a1206;padding-top:8px;margin-top:4px;}
    .footer{text-align:center;margin-top:24px;font-size:12px;color:#888;}
    @media print{.page{padding:12px;}}
  </style></head><body>
  <div class="page">
    <div class="logo">
      <h1>${RESTAURANT}</h1>
      <p>Fine Indian Cuisine</p>
    </div>
    <hr class="divider"/>
    <div class="meta">
      <div><strong>Table:</strong> ${tableNo}</div>
      <div><strong>Phone:</strong> ${phone || "—"}</div>
      <div><strong>Date:</strong> ${fmtDate(billedAt || new Date())}</div>
      <div><strong>Time:</strong> ${fmtTime(billedAt || new Date())}</div>
    </div>
    <hr class="divider"/>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>₹${subtotal}</span></div>
      <div style="color:#888"><span>GST (5%)</span><span>₹${gst}</span></div>
      <div class="grand"><span>Total</span><span>₹${grand}</span></div>
    </div>
    <hr class="divider"/>
    <div class="footer">
      Thank you for dining with us!<br/>We hope to see you again soon.
    </div>
  </div>
  <script>window.onload=()=>{window.print();}</script>
  </body></html>`;
}

// ─── SOUND ALERT ────────────────────────────────────────────────────────────
function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 150, 300].forEach((delay) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0, ctx.currentTime + delay / 1000);
      g.gain.linearRampToValueAtTime(
        0.4,
        ctx.currentTime + delay / 1000 + 0.05,
      );
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + delay / 1000 + 0.3);
      o.start(ctx.currentTime + delay / 1000);
      o.stop(ctx.currentTime + delay / 1000 + 0.35);
    });
  } catch {}
}

// ─── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700;800&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  font-family: 'DM Sans', sans-serif;
  background: #FDFBF7;
  color: #1A2821;
  min-height: 100vh;
}
:root {
  --forest: #062C1B;
  --forest-light: #0A3B24;
  --forest-dark: #041E12;
  --orange: #D67C19;
  --orange-hover: #BF6B11;
  --gold-logo: #E8C875;
  --beige: #FDFBF7;
  --beige-dark: #F5F1E8;
  --card: #FFFFFF;
  --text: #1A2821;
  --muted: #607369;
  --border: #E8E2D5;
  --green: #1D8A50;
  --red: #D93838;
  --blue: #2B6CB0;
  --purple: #6B46C1;
  --shadow: rgba(6, 44, 27, 0.05) 0 4px 12px;
  --shadow-lg: rgba(6, 44, 27, 0.08) 0 10px 25px;
}

.brand-logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.logo-title-sub {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  margin-top: 8px;
}
.logo-title-main {
  font-family: 'Playfair Display', serif;
  font-size: 34px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  line-height: 1;
  margin-top: 4px;
}
.logo-tagline {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-top: 8px;
}
.logo-separator {
  margin-top: 10px;
  display: flex;
  justify-content: center;
  width: 100%;
}

.app { min-height: 100vh; display: flex; flex-direction: column; background: var(--beige); }

/* GLOBAL PREVIEW NAV BAR */
.nav {
  background: var(--forest);
  border-bottom: 1px solid var(--forest-light);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  justify-content: flex-end;
}
.brand-text h1 {
  font-family: 'Playfair Display', serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--beige);
  line-height: 1.1;
}
.brand-text p {
  font-size: 9px;
  color: var(--orange);
  letter-spacing: 1px;
  text-transform: uppercase;
  font-weight: 600;
}
.nav-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.nav-tab {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.25s ease;
}
.nav-menu-btn {
  display: none;
}
.nav-more {
  display: none;
  width: 100%;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.nav-more.open {
  display: flex;
}
.nav-more-item {
  width: 100%;
  justify-content: center;
}

@media (max-width: 720px) {
  .nav-right {
    justify-content: flex-start;
    align-items: flex-start;
    padding: 14px 16px;
  }
  .brand-text {
    width: 100%;
    text-align: center;
  }
  .nav-tabs {
    width: 100%;
    justify-content: center;
  }
  .nav-tab {
    flex: 1 1 auto;
    min-width: 110px;
  }
  .nav-menu-btn {
    display: inline-flex;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: white;
    font-size: 20px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }
  .nav-menu-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .nav-tab-more {
    display: none;
  }
}
.nav-tab:hover { color: var(--beige); background: rgba(255, 255, 255, 0.05); }
.nav-tab.active { background: var(--orange); color: white; box-shadow: 0 4px 12px rgba(214, 124, 25, 0.25); }

/* AUTH SCREENS */
.auth-page {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(circle at top, var(--forest-light) 0%, var(--forest-dark) 100%);
}
.auth-card {
  background: white;
  border-radius: 18px;
  padding: 36px 32px;
  width: 100%;
  max-width: 380px;
  box-shadow: var(--shadow-lg);
}
.auth-logo { text-align: center; margin-bottom: 28px; }
.auth-logo h1 { font-family: 'Playfair Display', serif; font-size: 28px; color: var(--forest); font-weight: 900; }
.auth-logo p { font-size: 11px; color: var(--orange); margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.auth-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 800; color: var(--forest); margin-bottom: 20px; }
.field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field-group label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
.input {
  width: 100%;
  background: white;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 12px 16px;
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  transition: all 0.2s ease;
}
.input:focus { outline: none; border-color: var(--orange); box-shadow: 0 0 0 3px rgba(214, 124, 25, 0.15); }
.input.err { border-color: var(--red); box-shadow: 0 0 0 3px rgba(217, 56, 56, 0.15); }
.err-msg { color: var(--red); font-size: 12px; margin-top: 4px; font-weight: 500; }
.btn-primary {
  width: 100%;
  padding: 14px;
  border-radius: 8px;
  background: var(--orange);
  border: none;
  color: white;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.25s ease;
  margin-top: 8px;
  box-shadow: 0 4px 15px rgba(214, 124, 25, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-primary:hover { background: var(--orange-hover); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(214, 124, 25, 0.35); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
.link-btn { background: none; border: none; color: var(--orange); font-size: 13px; cursor: pointer; text-decoration: underline; padding: 0; font-weight: 600; }
.link-btn:hover { color: var(--orange-hover); }
.auth-switch { text-align: center; margin-top: 18px; font-size: 13px; color: var(--muted); }
.otp-hint { background: rgba(214, 168, 67, .08); border: 1px dashed var(--orange); border-radius: 8px; padding: 12px; font-size: 12px; color: var(--orange); margin: 12px 0; line-height: 1.4; }

/* GATE SCREEN */
.gate {
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  gap: 24px;
  background: radial-gradient(circle at top, var(--forest-light) 0%, var(--forest-dark) 100%);
  color: white;
}
.gate-logo { text-align: center; margin-bottom: 8px; }
.gate-logo h1 { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 900; color: white; letter-spacing: 0.5px; margin-top: 12px; }
.gate-logo p { font-size: 13px; color: var(--orange); letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
.chef-logo-svg { color: var(--orange); filter: drop-shadow(0 2px 8px rgba(214, 124, 25, 0.3)); }
.select-table-hdr { display: flex; align-items: center; width: 100%; max-width: 320px; margin: 12px 0 0; }
.select-table-hdr::before, .select-table-hdr::after { content: ""; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.15); }
.tables-label { font-size: 12px; color: rgba(255, 255, 255, 0.8); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; padding: 0 12px; }
.tbl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; max-width: 320px; }
.tbl-btn {
  aspect-ratio: 1;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.tbl-btn small { font-size: 8px; font-weight: 600; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; }
.tbl-btn:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.3); }
.tbl-btn.sel { background: var(--orange) !important; border-color: var(--orange) !important; color: white !important; box-shadow: 0 4px 15px rgba(214, 124, 25, 0.4); }
.tbl-btn.occ { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.15); color: var(--orange); }
.tbl-btn.occ small { color: var(--orange); font-weight: 700; }
.gate-form { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 320px; }
.phone-hint { font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 4px; }
.occ-box { background: rgba(214, 124, 25, 0.1); border: 1px dashed var(--orange); border-radius: 8px; padding: 14px; font-size: 13px; color: var(--orange); text-align: center; width: 100%; max-width: 320px; line-height: 1.5; }

/* CUSTOMER VIEW */
.customer { max-width: 540px; margin: 0 auto; padding: 0 0 100px; background: var(--beige); min-height: calc(100vh - 60px); display: flex; flex-direction: column; }
.table-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--forest);
  color: white;
  position: sticky;
  top: 0;
  z-index: 90;
  box-shadow: 0 4px 12px rgba(6, 44, 33, 0.1);
}
.th-left { display: flex; align-items: center; gap: 12px; }
.back-arrow-btn { background: transparent; border: none; color: white; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; transition: background 0.2s; }
.back-arrow-btn:hover { background: rgba(255, 255, 255, 0.1); }
.th-main { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: white; }
.th-sub { font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 1px; }
.th-phone { font-size: 12px; color: var(--orange); font-weight: 600; background: rgba(255, 255, 255, 0.05); padding: 4px 10px; border-radius: 20px; }
.header-cart-btn { position: relative; background: transparent; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 50%; transition: background 0.2s; }
.header-cart-btn:hover { background: rgba(255, 255, 255, 0.1); }
.cart-badge { position: absolute; top: -4px; right: -4px; background: var(--red); color: white; font-size: 10px; font-weight: 700; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid var(--forest); }

.search-box-container { padding: 16px 20px 8px; background: var(--beige); }
.search-input-wrapper { position: relative; display: flex; align-items: center; }
.search-icon-svg { position: absolute; left: 14px; color: var(--muted); pointer-events: none; }
.search-input { width: 100%; background: white; border: 1px solid var(--border); border-radius: 24px; padding: 11px 16px 11px 40px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--text); transition: all 0.2s ease; }
.search-input:focus { outline: none; border-color: var(--orange); box-shadow: 0 0 0 3px rgba(214, 124, 25, 0.1); }

.cat-strip { display: flex; gap: 8px; overflow-x: auto; padding: 8px 20px 16px; background: var(--beige); scrollbar-width: none; }
.cat-strip::-webkit-scrollbar { display: none; }
.cat-pill { white-space: nowrap; padding: 8px 18px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: white; color: var(--muted); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.cat-pill:hover { border-color: var(--orange); color: var(--orange); }
.cat-pill.on { background: var(--orange); color: white; border-color: var(--orange); box-shadow: 0 3px 10px rgba(214, 124, 25, 0.2); }

.sec-hdr { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 800; color: var(--forest); margin: 16px 20px 8px; display: flex; align-items: center; gap: 8px; }
.sec-hdr::after { content: ""; flex: 1; height: 1px; background: var(--border); }

.menu-grid { display: flex; flex-direction: column; gap: 12px; padding: 0 20px; margin-bottom: 24px; }
.menu-item { background: white; border-radius: 12px; border: 1px solid var(--border); padding: 12px; display: flex; align-items: center; gap: 12px; transition: all 0.25s ease; box-shadow: var(--shadow); }
.menu-item:hover { transform: translateY(-1px); box-shadow: rgba(6, 44, 27, 0.08) 0 6px 16px; }
.menu-item.na { opacity: 0.55; }
.mi-img { width: 72px; height: 72px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: var(--beige-dark); border: 1px solid rgba(0, 0, 0, 0.03); }
.mi-info { flex: 1; min-width: 0; }
.mi-name { font-weight: 700; font-size: 15px; color: var(--text); display: flex; align-items: center; gap: 6px; }
.mi-desc { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mi-price { font-weight: 800; color: var(--text); font-size: 15px; margin-top: 4px; }
.na-badge { font-size: 9px; font-weight: 700; background: rgba(217, 56, 56, 0.1); color: var(--red); padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }

.qty-ctrl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.q-btn { width: 32px; height: 32px; border-radius: 50%; background: white; border: 1px solid var(--border); color: var(--text); font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.q-btn:hover { border-color: var(--orange); color: var(--orange); background: var(--beige); }
.q-btn.add { background: var(--orange); border-color: var(--orange); color: white; }
.q-btn.add:hover { background: var(--orange-hover); color: white; }
.q-num { min-width: 20px; text-align: center; font-weight: 700; font-size: 14px; color: var(--text); }
.add-btn { padding: 8px 16px; border-radius: 8px; background: var(--orange); border: none; color: white; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(214, 124, 25, 0.15); }
.add-btn:hover { background: var(--orange-hover); transform: scale(1.03); }

/* CART BAR */
.cart-bar {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 508px;
  background: var(--forest);
  border-radius: 12px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 200;
  box-shadow: var(--shadow-lg), 0 8px 30px rgba(6, 44, 33, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.cb-left small { font-size: 11px; color: rgba(255, 255, 255, 0.6); text-transform: uppercase; letter-spacing: 0.5px; }
.cb-left strong { display: block; font-family: 'DM Sans', sans-serif; font-size: 20px; font-weight: 800; color: white; }
.btn-view-order { background: var(--orange); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(214, 124, 25, 0.2); }
.btn-view-order:hover { background: var(--orange-hover); transform: translateY(-1px); }

/* OVERLAYS & SHEETS */
.overlay { position: fixed; inset: 0; background: rgba(4, 30, 18, 0.6); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; z-index: 300; animation: fadeIn 0.25s ease-out; }
.sheet { background: white; border-radius: 20px 20px 0 0; width: 100%; max-width: 540px; padding: 24px 20px 40px; max-height: 85vh; overflow-y: auto; box-shadow: 0 -10px 30px rgba(0,0,0,0.15); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.sheet-title { font-family: 'Playfair Display', serif; color: var(--forest); font-size: 20px; font-weight: 800; margin-bottom: 16px; }
.order-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 14px; color: var(--text); }
.order-row span:first-child { font-weight: 600; }
.order-total { display: flex; justify-content: space-between; padding: 16px 0; font-weight: 800; font-size: 16px; color: var(--forest); border-bottom: 2px solid var(--border); }
.note-inp { width: 100%; background: var(--beige-dark); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 12px 14px; font-size: 13px; margin: 16px 0; resize: none; font-family: 'DM Sans', sans-serif; transition: border 0.2s; }
.note-inp:focus { outline: none; border-color: var(--orange); background: white; }
.row-btns { display: flex; gap: 12px; }
.btn-ghost { flex: 1; padding: 13px; border-radius: 8px; background: var(--beige-dark); border: 1px solid var(--border); color: var(--muted); font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.2s ease; }
.btn-ghost:hover { background: var(--border); color: var(--text); }
.btn-gold { flex: 2; padding: 13px; border-radius: 8px; background: var(--forest); border: none; color: white; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.25s ease; box-shadow: 0 4px 12px rgba(6, 44, 27, 0.15); }
.btn-gold:hover { background: var(--forest-light); box-shadow: 0 6px 18px rgba(6, 44, 27, 0.25); }

/* SUCCESS & TIMELINE */
.success-pg { min-height: calc(100vh - 60px); display: flex; align-items: center; justify-content: center; background: var(--beige); padding: 24px 20px; }
.success-box { background: white; border-radius: 16px; border: 1px solid var(--border); padding: 32px 24px; width: 100%; max-width: 380px; text-align: center; box-shadow: var(--shadow-lg); }
.checkmark-circle { width: 56px; height: 56px; border-radius: 50%; background: var(--green); color: white; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px; box-shadow: 0 4px 10px rgba(29, 138, 80, 0.2); }
.success-box h3 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; color: var(--forest); margin-bottom: 6px; }
.success-box p.success-sub { color: var(--muted); font-size: 13px; margin-bottom: 20px; line-height: 1.5; }
.order-details-card { background: var(--beige); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 20px; text-align: left; }
.details-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; color: var(--muted); border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 10px; }
.details-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: var(--text); }
.details-row strong { color: var(--forest); font-weight: 700; }
.chef-notify-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 20px 0; padding-top: 12px; border-top: 1px dashed var(--border); color: var(--muted); font-size: 12px; font-weight: 600; }
.thank-you-msg { font-family: 'Playfair Display', serif; font-size: 18px; font-style: italic; color: var(--forest); margin-bottom: 16px; }
.back-btn-orange { width: 100%; padding: 12px; background: var(--orange); border: none; border-radius: 8px; color: white; font-weight: 700; font-size: 14px; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 10px rgba(214, 124, 25, 0.2); }
.back-btn-orange:hover { background: var(--orange-hover); }

.timeline-container { margin-top: 24px; text-align: left; border-top: 1px solid var(--border); padding-top: 20px; }
.timeline-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); font-weight: 700; margin-bottom: 16px; }
.timeline { display: flex; flex-direction: column; gap: 20px; position: relative; padding-left: 20px; }
.timeline::before { content: ""; position: absolute; left: 4px; top: 6px; bottom: 6px; width: 2px; background: var(--border); z-index: 0; }
.timeline-step { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; font-size: 13px; }
.timeline-node { position: absolute; left: -20px; width: 10px; height: 10px; border-radius: 50%; background: var(--border); border: 2px solid white; transition: all 0.3s; }
.timeline-step.active .timeline-node { background: var(--green); box-shadow: 0 0 0 4px rgba(29, 138, 80, 0.2); }
.timeline-label { font-weight: 600; color: var(--muted); }
.timeline-step.active .timeline-label { color: var(--forest); font-weight: 700; }
.timeline-time { color: var(--muted); font-size: 11px; }
.timeline-step.active .timeline-time { color: var(--green); font-weight: 600; }

/* CHEF & OWNER PORTAL */
.pin-pg { min-height: calc(100vh - 60px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; background: var(--beige); padding: 24px; }
.pin-pg h2 { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 800; color: var(--forest); text-align: center; }
.pin-pg p { color: var(--muted); font-size: 13px; text-align: center; }
.pin-dots { display: flex; gap: 16px; margin-bottom: 8px; }
.dot { width: 14px; height: 14px; border-radius: 50%; background: var(--beige-dark); border: 2px solid var(--border); transition: all 0.2s; }
.dot.f { background: var(--forest); border-color: var(--forest); transform: scale(1.1); }
.pin-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; max-width: 250px; }
.pkey { aspect-ratio: 1; border-radius: 50%; background: white; border: 1px solid var(--border); color: var(--text); font-size: 20px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
.pkey:hover { background: var(--forest); color: white; border-color: var(--forest); box-shadow: 0 4px 10px rgba(6, 44, 27, 0.2); }
.pkey.del { font-size: 16px; color: var(--muted); background: var(--beige-dark); }

.dashboard-container { display: flex; min-height: calc(100vh - 60px); background: var(--beige); }
.sidebar { width: 240px; background: var(--forest); padding: 24px 16px; display: flex; flex-direction: column; gap: 8px; border-right: 1px solid rgba(255, 255, 255, 0.05); flex-shrink: 0; }
.sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 12px; color: white; }
.sidebar-brand h2 { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--beige); }
.sidebar-link { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; color: rgba(255, 255, 255, 0.7); font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; background: transparent; text-align: left; width: 100%; }
.sidebar-link:hover { background: rgba(255, 255, 255, 0.04); color: white; }
.sidebar-link.active { background: var(--orange); color: white; box-shadow: 0 4px 12px rgba(214, 124, 25, 0.2); }
.main-content { flex: 1; min-width: 0; padding: 24px; overflow-y: auto; }

.dash { padding: 24px; max-width: 1200px; margin: 0 auto; background: var(--beige); }
.dash-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
.dash-title { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 900; color: var(--forest); }
.dash-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
.dash-actions { display: flex; gap: 8px; align-items: center; }
.btn-sm { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; background: white; border: 1px solid var(--border); color: var(--text); cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
.btn-sm:hover { border-color: var(--orange); color: var(--orange); }
.btn-sm.danger { color: var(--red); border-color: rgba(217, 56, 56, 0.15); background: rgba(217, 56, 56, 0.02); }
.btn-sm.danger:hover { background: var(--red); color: white; border-color: var(--red); }
.refresh { width: 34px; height: 34px; border-radius: 50%; background: white; border: 1px solid var(--border); color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; }
.refresh:hover { border-color: var(--orange); color: var(--orange); }

.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.stat { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 6px; }
.stat:nth-child(1) { border-top: 4px solid var(--green); }
.stat:nth-child(2) { border-top: 4px solid var(--blue); }
.stat:nth-child(3) { border-top: 4px solid var(--purple); }
.stat-v { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 800; color: var(--forest); }
.stat-l { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }

.owner-tabs { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
.o-tab { padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: white; color: var(--muted); transition: all 0.2s; }
.o-tab:hover { border-color: var(--orange); color: var(--orange); }
.o-tab.on { background: var(--orange); color: white; border-color: var(--orange); box-shadow: 0 4px 10px rgba(214, 124, 25, 0.2); }

.filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.f-btn { padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; background: white; border: 1px solid var(--border); color: var(--muted); cursor: pointer; transition: all 0.15s; }
.f-btn:hover { border-color: var(--orange); color: var(--orange); }
.f-btn.on { background: var(--forest); color: white; border-color: var(--forest); }

/* CHEF CARDS */
.cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.oc { background: white; border: 1px solid var(--border); border-radius: 14px; padding: 18px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
.oc.pending { border-left: 4px solid var(--red); }
.oc.cooking { border-left: 4px solid var(--orange); }
.oc.ready { border-left: 4px solid var(--green); }
.oc.billed { border-left: 4px solid var(--muted); opacity: .6; }
.oc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.oc-tbl { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 800; color: var(--forest); }
.oc-ph { font-size: 12px; color: var(--muted); margin-top: 2px; }
.badge { font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: .5px; }
.b-pending { background: rgba(217, 56, 56, 0.1); color: var(--red); }
.b-cooking { background: rgba(214, 124, 25, 0.1); color: var(--orange); }
.b-ready { background: rgba(29, 138, 80, 0.1); color: var(--green); }
.b-billed { background: rgba(96, 115, 105, 0.1); color: var(--muted); }
.oc-items { font-size: 13px; color: var(--text); margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 10px; }
.oc-item { display: flex; justify-content: space-between; padding: 3px 0; }
.oc-note { font-size: 12px; font-style: italic; color: var(--orange); margin-bottom: 12px; background: rgba(214, 124, 25, 0.05); padding: 6px 10px; border-radius: 6px; }
.oc-times { font-size: 11px; color: var(--muted); margin-bottom: 14px; display: flex; flex-direction: column; gap: 3px; }
.oc-acts { display: flex; gap: 8px; flex-wrap: wrap; }
.action-btn { padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; transition: all 0.15s; white-space: nowrap; }
.ab-cook { background: var(--orange); color: white; box-shadow: 0 2px 6px rgba(214, 124, 25, 0.2); }
.ab-cook:hover { background: var(--orange-hover); }
.ab-rdy { background: var(--green); color: white; box-shadow: 0 2px 6px rgba(29, 138, 80, 0.2); }
.ab-rdy:hover { background: #187343; }
.ab-bill { background: var(--forest); color: white; box-shadow: 0 2px 6px rgba(6, 44, 27, 0.2); }
.ab-bill:hover { background: var(--forest-light); }

/* TABLES CARDS */
.tables-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 16px; }
.tc { background: white; border: 1px solid var(--border); border-radius: 14px; padding: 18px; box-shadow: var(--shadow); }
.tc.active { border-color: var(--orange); box-shadow: rgba(214, 124, 25, 0.05) 0 4px 15px; }
.tc.billed { border-color: var(--border); opacity: .7; }
.tc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.tc-name { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 800; color: var(--forest); }
.tc-phone { font-size: 12px; color: var(--muted); margin-top: 2px; }
.tc-since { font-size: 11px; color: var(--muted); }
.tc-items { font-size: 13px; color: var(--text); margin-bottom: 12px; }
.tc-item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(0,0,0,0.02); }
.tc-total { font-weight: 800; color: var(--forest); font-size: 15px; margin-bottom: 14px; padding-top: 10px; border-top: 1px solid var(--border); }
.tc-acts { display: flex; gap: 8px; flex-wrap: wrap; }

/* BILL MODALS */
.ov-center { position: fixed; inset: 0; background: rgba(4, 30, 18, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; }
.bill-card { background: white; border-radius: 16px; border: 1px solid var(--border); padding: 28px; max-width: 400px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
.bill-card h3 { font-family: 'Playfair Display', serif; color: var(--forest); font-size: 22px; font-weight: 900; margin-bottom: 4px; }
.divider { border: none; border-top: 1px solid var(--border); margin: 12px 0; }
.bill-row { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; color: var(--text); }
.bill-row.muted { color: var(--muted); }
.bill-row.grand { font-weight: 800; font-size: 17px; color: var(--forest); padding-top: 10px; border-top: 1px solid var(--border); }
.send-row { display: flex; gap: 8px; margin-top: 14px; margin-bottom: 20px; }
.btn-wa { background: #25D366; color: white; border: none; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; flex: 1; transition: opacity 0.2s; }
.btn-wa:hover { opacity: 0.9; }
.btn-sms { background: var(--blue); color: white; border: none; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; flex: 1; transition: opacity 0.2s; }
.btn-sms:hover { opacity: 0.9; }
.btn-print { background: var(--beige-dark); border: 1px solid var(--border); color: var(--text); padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
.btn-print:hover { background: var(--border); }
.confirm-row { display: flex; gap: 10px; }

/* MENU MANAGER */
.add-form { background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 24px; box-shadow: var(--shadow); }
.add-form h4 { color: var(--forest); font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 800; margin-bottom: 14px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
.ff { display: flex; flex-direction: column; gap: 6px; }
.ff label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
.fi, .fsel { background: white; border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; width: 100%; transition: border 0.2s; }
.fi:focus, .fsel:focus { outline: none; border-color: var(--orange); }
.btn-add { background: var(--orange); color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 6px rgba(214, 124, 25, 0.2); }
.btn-add:hover { background: var(--orange-hover); }

.mm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.mc { background: white; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); display: flex; flex-direction: column; transition: all 0.2s; }
.mc:hover { transform: translateY(-1px); box-shadow: rgba(6, 44, 27, 0.08) 0 6px 16px; }
.mc.na { opacity: .6; }
.mc-img { width: 100%; height: 140px; object-fit: cover; background: var(--beige-dark); }
.mc-body { padding: 16px; display: flex; flex-direction: column; flex: 1; }
.mc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.mc-name { font-weight: 700; font-size: 14px; color: var(--text); }
.mc-cat { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
.mc-price { font-weight: 800; color: var(--forest); font-size: 15px; }
.mc-desc { font-size: 12px; color: var(--muted); margin-bottom: 14px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 34px; }
.mc-acts { display: flex; gap: 8px; margin-top: auto; }
.btn-avail { background: rgba(29, 138, 80, 0.1); color: var(--green); padding: 8px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: none; flex: 1; }
.btn-avail:hover { background: var(--green); color: white; }
.btn-unav { background: rgba(214, 124, 25, 0.1); color: var(--orange); padding: 8px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: none; flex: 1; }
.btn-unav:hover { background: var(--orange); color: white; }
.btn-del { background: rgba(217, 56, 56, 0.08); color: var(--red); padding: 8px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: none; }
.btn-del:hover { background: var(--red); color: white; }

/* ORDER LOG */
.log-day { margin-bottom: 28px; }
.log-day-hdr { display: flex; align-items: center; justify-content: space-between; background: white; border: 1px solid var(--border); border-radius: 12px; padding: 14px 20px; margin-bottom: 12px; box-shadow: var(--shadow); }
.log-day-title { font-family: 'Playfair Display', serif; color: var(--forest); font-size: 16px; font-weight: 800; }
.log-day-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
.log-entry { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 10px; box-shadow: var(--shadow); }
.log-tags { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.ltag { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
.lt-table { background: rgba(6, 44, 27, 0.05); color: var(--forest); }
.lt-phone { background: rgba(43, 108, 176, 0.08); color: var(--blue); }
.lt-billed { background: rgba(29, 138, 80, 0.08); color: var(--green); }
.lt-total { margin-left: auto; font-size: 14px; font-weight: 800; color: var(--forest); }
.log-order { border-top: 1px solid var(--border); padding: 10px 0; font-size: 13px; }
.log-o-hdr { display: flex; justify-content: space-between; color: var(--muted); margin-bottom: 6px; font-weight: 600; }
.log-o-item { display: flex; justify-content: space-between; padding: 2px 0; color: var(--text); }
.log-times { display: flex; gap: 12px; font-size: 11px; color: var(--muted); margin-top: 8px; flex-wrap: wrap; }
.log-note { font-size: 12px; color: var(--orange); font-style: italic; margin-top: 6px; background: rgba(214, 124, 25, 0.04); padding: 4px 8px; border-radius: 4px; }
.log-footer { font-weight: 800; color: var(--forest); font-size: 14px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; }
.date-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.date-inp { background: white; border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 8px 12px; font-size: 13px; font-family: 'DM Sans', sans-serif; transition: border 0.2s; }
.date-inp:focus { outline: none; border-color: var(--orange); }

/* SETTINGS & SYSTEM */
.settings-card { background: white; border: 1px solid var(--border); border-radius: 14px; padding: 24px; margin-bottom: 16px; max-width: 440px; box-shadow: var(--shadow); }
.settings-card h4 { color: var(--forest); font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 800; margin-bottom: 16px; }

.loading { min-height: calc(100vh - 60px); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; background: var(--beige); }
.spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--orange); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }

.toast { position: fixed; top: 76px; right: 20px; z-index: 999; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; box-shadow: var(--shadow-lg); animation: slideIn .25s ease; display: flex; align-items: center; gap: 8px; }
.toast.ok { background: #E6FFFA; color: var(--green); border: 1px solid #B2F5EA; }
.toast.er { background: #FFF5F5; color: var(--red); border: 1px solid #FEB2B2; }
@keyframes slideIn { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: translateY(0) } }

/* ─── TRACK ORDER PAGE ─────────────────────────────────────────────────── */
.track-page {
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  gap: 24px;
  background: radial-gradient(circle at top, var(--forest-light) 0%, var(--forest-dark) 100%);
  color: white;
}
.track-logo { text-align: center; margin-bottom: 8px; }
.track-logo h1 { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 900; color: white; letter-spacing: 0.5px; margin-top: 12px; }
.track-logo p { font-size: 13px; color: var(--orange); letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
.track-form { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 360px; }
.track-form .field-group label { color: rgba(255,255,255,0.8); }
.track-form .input { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.2); color: white; }
.track-form .input::placeholder { color: rgba(255,255,255,0.35); }
.track-form .input:focus { border-color: var(--orange); background: rgba(255,255,255,0.1); }
.track-form .phone-hint { color: rgba(255,255,255,0.4); }

.track-results {
  min-height: calc(100vh - 60px);
  max-width: 600px;
  margin: 0 auto;
  padding: 0 0 60px;
  background: var(--beige);
}
.track-results-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--forest);
  color: white;
  position: sticky;
  top: 0;
  z-index: 90;
  box-shadow: 0 4px 12px rgba(6, 44, 33, 0.1);
}
.track-hdr-left { display: flex; align-items: center; gap: 12px; }
.track-hdr-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: white; }
.track-hdr-sub { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 1px; }
.track-hdr-phone { font-size: 12px; color: var(--orange); font-weight: 600; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px; }

.track-section { padding: 0 20px; }
.track-sec-title {
  font-family: 'Playfair Display', serif;
  font-size: 16px;
  font-weight: 800;
  color: var(--forest);
  margin: 20px 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.track-sec-title::after { content: ""; flex: 1; height: 1px; background: var(--border); }

.track-order-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 14px;
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
}
.track-order-card.active-card { border-left: 4px solid var(--orange); }
.track-order-card.billed-card { border-left: 4px solid var(--muted); opacity: 0.85; }

.track-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.track-card-table { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 800; color: var(--forest); }
.track-card-time { font-size: 11px; color: var(--muted); margin-top: 2px; }

.track-card-items { font-size: 13px; color: var(--text); margin-bottom: 14px; border-bottom: 1px dashed var(--border); padding-bottom: 10px; }
.track-card-item { display: flex; justify-content: space-between; padding: 3px 0; }
.track-card-note { font-size: 12px; font-style: italic; color: var(--orange); margin-bottom: 12px; background: rgba(214, 124, 25, 0.05); padding: 6px 10px; border-radius: 6px; }

.track-card-total { font-weight: 800; color: var(--forest); font-size: 14px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; }

.track-timeline { margin-top: 14px; }

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(214, 124, 25, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(214, 124, 25, 0); }
}
.track-timeline .timeline-step.current .timeline-node {
  background: var(--orange);
  animation: pulse-dot 2s infinite;
}

.track-empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--muted);
}
.track-empty-icon { font-size: 48px; margin-bottom: 12px; }
.track-empty p { font-size: 14px; line-height: 1.6; }
.track-empty .btn-primary { max-width: 240px; margin: 20px auto 0; }

.track-billed-total { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: var(--text); }
.track-billed-total.grand { font-weight: 800; font-size: 14px; color: var(--forest); padding-top: 8px; border-top: 1px solid var(--border); margin-top: 4px; }

.track-refresh-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(214, 124, 25, 0.05);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--muted);
}
.track-refresh-bar .live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse-dot 2s infinite;
}

/* RESPONSIVE DESIGN */
@media(max-width: 768px) {
  .dashboard-container { flex-direction: column; }
  .sidebar { width: 100%; border-right: none; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 16px; }
  .sidebar-brand { padding-bottom: 12px; margin-bottom: 8px; border-bottom: none; }
  .sidebar-link { font-size: 12px; padding: 8px 12px; }
}

@media(max-width: 500px) {
  .dash { padding: 12px; }
  .cards-grid, .tables-grid, .mm-grid { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: 1fr; gap: 12px; }
  .nav-tab { padding: 6px 10px; font-size: 12px; }
  .form-grid { grid-template-columns: 1fr; }
  .btn-primary { padding: 12px; font-size: 14px; }
  .th-main { font-size: 16px; }
  .cat-pill { padding: 6px 14px; font-size: 12px; }
}
`;

// ─── TOAST ──────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []);
  return <div className={`toast ${type}`}>{msg}</div>;
}

// ─── LOADING ─────────────────────────────────────────────────────────────────
function Loading() {
  return (
    <div className="loading">
      <div className="spinner" />
      <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
    </div>
  );
}

// ─── PIN SCREEN ───────────────────────────────────────────────────────────────
function PinScreen({ role, correctPin, onSuccess, onForgot }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const press = (k) => {
    if (pin.length >= 4) return;
    const n = pin + k;
    setPin(n);
    setErr("");
    if (n.length === 4) {
      if (n === correctPin) onSuccess();
      else
        setTimeout(() => {
          setPin("");
          setErr("Wrong PIN");
        }, 300);
    }
  };
  return (
    <div className="pin-pg">
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>👨‍🍳</div>
        <h2>Kitchen Dashboard</h2>
        <p style={{ marginTop: 4 }}>{RESTAURANT}</p>
      </div>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`dot ${i < pin.length ? "f" : ""}`} />
        ))}
      </div>
      {err && <p style={{ color: "var(--red)", fontSize: 12 }}>{err}</p>}
      <div className="pin-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} className="pkey" onClick={() => press(String(n))}>
            {n}
          </button>
        ))}
        <div />
        <button className="pkey" onClick={() => press("0")}>
          0
        </button>
        <button
          className="pkey del"
          onClick={() => {
            setPin((p) => p.slice(0, -1));
            setErr("");
          }}
        >
          ⌫
        </button>
      </div>
      <button className="link-btn" onClick={onForgot} style={{ fontSize: 12 }}>
        Forgot PIN?
      </button>
    </div>
  );
}

// ─── AUTH PAGES ───────────────────────────────────────────────────────────────
function AuthPages({ onAuth }) {
  const [page, setPage] = useState("loading"); // loading | login | register | forgot | reset
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpData, setOtpData] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api("/api/auth/exists")
      .then((d) => setPage(d.exists ? "login" : "register"))
      .catch(() => setPage("login"));
  }, []);

  const submit = async (action) => {
    setErr("");
    setLoading(true);
    try {
      if (action === "login") {
        const d = await api("/api/auth/login", {
          method: "POST",
          body: { username: form.username, password: form.password },
        });
        localStorage.setItem("owner_token", d.token);
        onAuth(d);
      } else if (action === "register") {
        if (!form.username || !form.password || !form.chefPin) {
          setErr("All fields required");
          return;
        }
        if (form.password.length < 6) {
          setErr("Password min 6 chars");
          return;
        }
        if (!/^\d{4}$/.test(form.chefPin)) {
          setErr("Chef PIN must be 4 digits");
          return;
        }
        const d = await api("/api/auth/register", {
          method: "POST",
          body: {
            username: form.username,
            password: form.password,
            chefPin: form.chefPin,
          },
        });
        localStorage.setItem("owner_token", d.token);
        onAuth(d);
      } else if (action === "forgot") {
        const d = await api("/api/auth/forgot-password", {
          method: "POST",
          body: { username: form.username },
        });
        setOtpData(d);
        setPage("reset");
      } else if (action === "reset") {
        await api("/api/auth/reset-password", {
          method: "POST",
          body: {
            username: form.username,
            otp: form.otp,
            newPassword: form.newPassword,
          },
        });
        setPage("login");
        setErr("");
        setForm({});
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (page === "loading") return <Loading />;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>{RESTAURANT}</h1>
          <p>Owner Portal</p>
        </div>

        {page === "login" && (
          <>
            <p className="auth-title">Sign In</p>
            <div className="field-group">
              <label>Username</label>
              <input
                className="input"
                value={form.username || ""}
                onChange={(e) => set("username", e.target.value)}
                placeholder="your_username"
              />
            </div>
            <div className="field-group">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={form.password || ""}
                onChange={(e) => set("password", e.target.value)}
                placeholder="••••••"
              />
            </div>
            {err && <p className="err-msg">{err}</p>}
            <button
              className="btn-primary"
              disabled={loading}
              onClick={() => submit("login")}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <div className="auth-switch">
              <button
                className="link-btn"
                onClick={() => {
                  setPage("forgot");
                  setErr("");
                }}
              >
                Forgot password?
              </button>
            </div>
          </>
        )}

        {page === "register" && (
          <>
            <p className="auth-title">Create Owner Account</p>
            <div className="field-group">
              <label>Username</label>
              <input
                className="input"
                value={form.username || ""}
                onChange={(e) => set("username", e.target.value)}
                placeholder="choose a username"
              />
            </div>
            <div className="field-group">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={form.password || ""}
                onChange={(e) => set("password", e.target.value)}
                placeholder="min 6 characters"
              />
            </div>
            <div className="field-group">
              <label>Chef PIN (4 digits)</label>
              <input
                className="input"
                value={form.chefPin || ""}
                onChange={(e) => set("chefPin", e.target.value)}
                placeholder="e.g. 1234"
                maxLength={4}
              />
            </div>
            {err && <p className="err-msg">{err}</p>}
            <button
              className="btn-primary"
              disabled={loading}
              onClick={() => submit("register")}
            >
              {loading ? "Creating…" : "Create Account"}
            </button>
          </>
        )}

        {page === "forgot" && (
          <>
            <p className="auth-title">Reset Password</p>
            <div className="field-group">
              <label>Username</label>
              <input
                className="input"
                value={form.username || ""}
                onChange={(e) => set("username", e.target.value)}
                placeholder="your username"
              />
            </div>
            {err && <p className="err-msg">{err}</p>}
            <button
              className="btn-primary"
              disabled={loading}
              onClick={() => submit("forgot")}
            >
              {loading ? "Sending…" : "Get OTP"}
            </button>
            <div className="auth-switch">
              <button
                className="link-btn"
                onClick={() => {
                  setPage("login");
                  setErr("");
                }}
              >
                Back to login
              </button>
            </div>
          </>
        )}

        {page === "reset" && (
          <>
            <p className="auth-title">Enter OTP</p>
            {otpData?.otp && (
              <div className="otp-hint">
                DEV: Your OTP is <strong>{otpData.otp}</strong>
                <br />
                <small>(Configure SMTP in .env to email it)</small>
              </div>
            )}
            <div className="field-group">
              <label>OTP Code</label>
              <input
                className="input"
                value={form.otp || ""}
                onChange={(e) => set("otp", e.target.value)}
                placeholder="6-digit OTP"
                maxLength={6}
              />
            </div>
            <div className="field-group">
              <label>New Password</label>
              <input
                className="input"
                type="password"
                value={form.newPassword || ""}
                onChange={(e) => set("newPassword", e.target.value)}
                placeholder="min 6 characters"
              />
            </div>
            {err && <p className="err-msg">{err}</p>}
            <button
              className="btn-primary"
              disabled={loading}
              onClick={() => submit("reset")}
            >
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── BILL MODAL ───────────────────────────────────────────────────────────────
function BillModal({ tableNo, phone, items, subtotal, onClose, onConfirm }) {
  const gst = tax(subtotal),
    grand = subtotal + gst;
  const openWA = () => {
    const lines = [
      `${RESTAURANT}\nTable: ${tableNo} | Ph: ${phone}\n`,
      ...items.map((i) => `${i.name} x${i.qty}  ₹${i.price * i.qty}`),
      `\nSubtotal: ₹${subtotal}\nGST 5%: ₹${gst}\nTotal: ₹${grand}\n\nThank you!`,
    ];
    window.open(
      `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
    );
  };
  const openSMS = () => {
    const txt = `${RESTAURANT} | Table ${tableNo} | Total ₹${grand} | Thank you!`;
    window.open(`sms:${phone}?body=${encodeURIComponent(txt)}`, "_blank");
  };
  const print = () => {
    const html = buildReceiptHTML(tableNo, phone, items, subtotal, new Date());
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) {
      alert("Allow popups to print.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };
  return (
    <div
      className="ov-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bill-card">
        <h3>Bill — Table {tableNo}</h3>
        <p style={{ fontSize: 11, color: "var(--muted)" }}>
          {phone} · {fmtDT(new Date())}
        </p>
        <hr className="divider" />
        {items.map((i, k) => (
          <div key={k} className="bill-row">
            <span>
              {i.name} ×{i.qty}
            </span>
            <span>₹{i.price * i.qty}</span>
          </div>
        ))}
        <hr className="divider" />
        <div className="bill-row muted">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>
        <div className="bill-row muted">
          <span>GST 5%</span>
          <span>₹{gst}</span>
        </div>
        <div className="bill-row grand">
          <span>Grand Total</span>
          <span>₹{grand}</span>
        </div>
        <hr className="divider" />
        <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
          Send to customer:
        </p>
        <div className="send-row">
          <button className="btn-wa" onClick={openWA}>
            WhatsApp
          </button>
          <button className="btn-sms" onClick={openSMS}>
            SMS
          </button>
          <button className="btn-print" onClick={print}>
            Print
          </button>
        </div>
        <div className="confirm-row">
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="action-btn ab-bill"
            style={{ flex: 2 }}
            onClick={onConfirm}
          >
            Confirm Billed
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerView() {
  const [step, setStep] = useState("gate");
  const [tableNo, setTableNo] = useState(null);
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [sessions, setSessions] = useState([]);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [cat, setCat] = useState("All");
  const [showCart, setShowCart] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api("/api/menu")
      .then(setMenu)
      .catch(() => {});
    api("/api/tables")
      .then(setSessions)
      .catch(() => {});

    // Poll tables session status periodically to support live tracking updates
    const t = setInterval(() => {
      api("/api/tables")
        .then(setSessions)
        .catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const isOccupied = (no) =>
    sessions.find(
      (s) => s.tableNo === no && s.status === "open" && s.orders?.length > 0,
    );
  const availMenu = menu.filter((m) => m.available);
  const categories = ["All", ...new Set(availMenu.map((m) => m.category))];
  const filtered = availMenu.filter((m) => {
    const matchesCat = cat === "All" || m.category === cat;
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.desc.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const proceed = async () => {
    const clean = phone.replace(/\s/g, "");
    if (!isValidPhone(clean)) {
      setPhoneErr("Enter valid 10-digit mobile number");
      return;
    }
    setPhoneErr("");
    setLoading(true);
    try {
      // Check phone not on another table
      const ck = await api(`/api/tables/check-phone/${clean}`);
      if (ck.occupied && ck.tableNo !== tableNo) {
        setPhoneErr(`This number is already active on Table ${ck.tableNo}`);
        setLoading(false);
        return;
      }
      await api(`/api/tables/${tableNo}/open`, {
        method: "POST",
        body: { phone: clean },
      });
      setStep("menu");
    } catch (e) {
      setPhoneErr(e.message);
    }
    setLoading(false);
  };

  const continueExisting = async () => {
    const s = isOccupied(tableNo);
    if (s) {
      setPhone(s.phone);
      setStep("menu");
    }
  };

  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const rem = (id) =>
    setCart((c) => {
      if (!c[id]) return c;
      const n = { ...c };
      n[id]--;
      if (!n[id]) delete n[id];
      return n;
    });
  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ ...availMenu.find((m) => m._id === id), qty }))
    .filter((i) => i.name);
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cartItems.reduce((s, i) => s + i.qty, 0);
  const sessionPhone = isOccupied(tableNo)?.phone || phone;

  const placeOrder = async () => {
    setLoading(true);
    try {
      const items = cartItems.map((i) => ({
        menuItemId: i._id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        imageUrl: i.imageUrl || "",
      }));
      await api("/api/orders", {
        method: "POST",
        body: { tableNo, phone: sessionPhone, items, note },
      });
      setCart({});
      setNote("");
      setShowCart(false);
      setStep("done");
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  };

  // ── GATE ──
  if (step === "gate")
    return (
      <div className="gate">
        <div className="gate-logo">
          <svg
            className="chef-logo-svg"
            viewBox="0 0 100 100"
            width="80"
            height="80"
          >
            <path
              d="M20,65 C20,55 25,50 35,50 C32,45 30,38 30,32 C30,18 40,12 50,12 C60,12 70,18 70,32 C70,38 68,45 65,50 C75,50 80,55 80,65 C80,72 75,75 68,75 L32,75 C25,75 20,72 20,65 Z"
              fill="none"
              stroke="var(--orange)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M30,82 L70,82"
              stroke="var(--orange)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M35,88 L65,88"
              stroke="var(--orange)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <h1>{RESTAURANT}</h1>
          <p>QR Table Ordering</p>
        </div>

        <div className="select-table-hdr">
          <p className="tables-label">Select Your Table</p>
        </div>

        <div className="tbl-grid">
          {TABLES.map((t) => {
            const occ = isOccupied(t);
            return (
              <button
                key={t}
                className={`tbl-btn${tableNo === t ? " sel" : ""}${occ && tableNo !== t ? " occ" : ""}`}
                onClick={() => setTableNo(t)}
              >
                {t}
                <small>{occ ? "active" : ""}</small>
              </button>
            );
          })}
        </div>
        {tableNo && isOccupied(tableNo) ? (
          <>
            <div className="occ-box">
              Table {tableNo} has an active session
              <br />
              <small>Phone: {isOccupied(tableNo).phone}</small>
            </div>
            <button
              className="btn-primary"
              style={{ maxWidth: 320 }}
              onClick={continueExisting}
            >
              Continue Ordering
            </button>
          </>
        ) : tableNo ? (
          <div className="gate-form">
            <div className="field-group">
              <label>WhatsApp / Mobile Number</label>
              <input
                className={`input ${phoneErr ? "err" : ""}`}
                type="tel"
                placeholder="Enter your mobile number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneErr("");
                }}
                maxLength={10}
              />
              {phoneErr ? (
                <p className="err-msg">{phoneErr}</p>
              ) : (
                <p className="phone-hint">10-digit mobile number</p>
              )}
            </div>
            <button
              className="btn-primary"
              disabled={loading || phone.length < 10}
              onClick={proceed}
            >
              {loading ? "Checking…" : "View Menu"}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    );

  // ── DONE ──
  if (step === "done") {
    const activeSession = sessions.find(
      (s) => s.tableNo === tableNo && s.status === "open",
    );
    const sortedOrders = activeSession?.orders || [];
    const latestOrder = sortedOrders[0];
    const orderStatus = latestOrder?.status || "pending";
    const dateFormatted = fmtDT(latestOrder?.orderedAt || new Date());

    return (
      <div className="success-pg">
        <div className="success-box">
          <div className="checkmark-circle">✓</div>
          <h3>Order Placed!</h3>
          <p className="success-sub">
            Your order has been sent to the kitchen.
          </p>

          <div className="order-details-card">
            <div className="details-title">Order Details</div>
            <div className="details-row">
              <span>Table Number</span>
              <strong>{tableNo}</strong>
            </div>
            <div className="details-row">
              <span>Phone Number</span>
              <strong>{sessionPhone}</strong>
            </div>
            <div className="details-row">
              <span>Order Time</span>
              <strong>{dateFormatted}</strong>
            </div>
          </div>

          <div className="chef-notify-row">
            <span>🍳</span>
            <span>We will notify you when your order is ready.</span>
          </div>

          <div className="thank-you-msg">Thank you!</div>

          <button className="back-btn-orange" onClick={() => setStep("menu")}>
            Back to Menu
          </button>

          <div className="timeline-container">
            <p className="timeline-title">Track Order</p>
            <div className="timeline">
              <div
                className={`timeline-step ${["pending", "cooking", "ready", "delivered", "billed"].includes(orderStatus) ? "active" : ""}`}
              >
                <div className="timeline-node" />
                <span className="timeline-label">Order Placed</span>
                <span className="timeline-time">
                  {latestOrder ? fmtTime(latestOrder.orderedAt) : ""}
                </span>
              </div>
              <div
                className={`timeline-step ${["cooking", "ready", "delivered", "billed"].includes(orderStatus) ? "active" : ""}`}
              >
                <div className="timeline-node" />
                <span className="timeline-label">Cooking</span>
                <span className="timeline-time">
                  {latestOrder?.cookingAt ? fmtTime(latestOrder.cookingAt) : ""}
                </span>
              </div>
              <div
                className={`timeline-step ${["ready", "delivered", "billed"].includes(orderStatus) ? "active" : ""}`}
              >
                <div className="timeline-node" />
                <span className="timeline-label">Ready</span>
                <span className="timeline-time">
                  {latestOrder?.readyAt ? fmtTime(latestOrder.readyAt) : ""}
                </span>
              </div>
              <div
                className={`timeline-step ${["delivered", "billed"].includes(orderStatus) ? "active" : ""}`}
              >
                <div className="timeline-node" />
                <span className="timeline-label">Delivered</span>
                <span className="timeline-time">
                  {latestOrder?.deliveredAt
                    ? fmtTime(latestOrder.deliveredAt)
                    : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MENU ──
  const grouped = [...new Set(availMenu.map((m) => m.category))];
  return (
    <div className="customer">
      <div className="table-hdr">
        <div className="th-left">
          <button
            className="back-arrow-btn"
            onClick={() => setStep("gate")}
            title="Back to table selection"
          >
            ←
          </button>
          <div>
            <div className="th-main">Table {tableNo}</div>
            <div className="th-sub">{RESTAURANT}</div>
          </div>
        </div>
        <div className="th-phone">{sessionPhone}</div>
        <button
          className="header-cart-btn"
          onClick={() => count > 0 && setShowCart(true)}
          title="View cart"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          {count > 0 && <span className="cart-badge">{count}</span>}
        </button>
      </div>

      <div className="search-box-container">
        <div className="search-input-wrapper">
          <svg
            className="search-icon-svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="cat-strip">
        {categories.map((c) => (
          <button
            key={c}
            className={`cat-pill ${cat === c ? "on" : ""}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {cat === "All" && !search ? (
        grouped.map((g) => {
          const itemsInCat = availMenu.filter((m) => m.category === g);
          if (itemsInCat.length === 0) return null;
          return (
            <div key={g}>
              <p className="sec-hdr">{g}</p>
              <div className="menu-grid">
                {itemsInCat.map((item) => (
                  <MenuItem
                    key={item._id}
                    item={item}
                    qty={cart[item._id] || 0}
                    onAdd={() => add(item._id)}
                    onRem={() => rem(item._id)}
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="menu-grid" style={{ marginTop: 16 }}>
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <MenuItem
                key={item._id}
                item={item}
                qty={cart[item._id] || 0}
                onAdd={() => add(item._id)}
                onRem={() => rem(item._id)}
              />
            ))
          ) : (
            <div
              className="empty"
              style={{ gridColumn: "1/-1", paddingTop: 40 }}
            >
              <p>No items match your search.</p>
            </div>
          )}
        </div>
      )}

      {count > 0 && (
        <div className="cart-bar">
          <div className="cb-left">
            <small>
              {count} item{count > 1 ? "s" : ""}
            </small>
            <strong>₹{total}</strong>
          </div>
          <button className="btn-view-order" onClick={() => setShowCart(true)}>
            Review Order →
          </button>
        </div>
      )}

      {showCart && (
        <div
          className="overlay"
          onClick={(e) => e.target === e.currentTarget && setShowCart(false)}
        >
          <div className="sheet">
            <p className="sheet-title">Your Order · Table {tableNo}</p>
            {cartItems.map((i) => (
              <div key={i._id} className="order-row">
                <span>
                  {i.name} ×{i.qty}
                </span>
                <span>₹{i.price * i.qty}</span>
              </div>
            ))}
            <div className="order-total">
              <span>Total</span>
              <span>₹{total}</span>
            </div>
            <textarea
              className="note-inp"
              rows={2}
              placeholder="Special instructions? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="row-btns">
              <button className="btn-ghost" onClick={() => setShowCart(false)}>
                Back
              </button>
              <button
                className="btn-gold"
                disabled={loading}
                onClick={placeOrder}
              >
                {loading ? "Placing…" : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ item, qty, onAdd, onRem }) {
  return (
    <div className={`menu-item${!item.available ? " na" : ""}`}>
      <img
        className="mi-img"
        src={
          item.imageUrl ||
          `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80`
        }
        alt={item.name}
        loading="lazy"
        onError={(e) => {
          e.target.src =
            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80";
        }}
      />
      <div className="mi-info">
        <div className="mi-name">
          {item.name}
          {!item.available && <span className="na-badge">Unavailable</span>}
        </div>
        <div className="mi-desc">{item.desc}</div>
        <div className="mi-price">₹{item.price}</div>
      </div>
      <div className="qty-ctrl">
        {qty > 0 ? (
          <>
            <button className="q-btn" onClick={onRem}>
              −
            </button>
            <span className="q-num">{qty}</span>
            <button className="q-btn add" onClick={onAdd}>
              +
            </button>
          </>
        ) : (
          <button className="add-btn" onClick={onAdd}>
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// ─── TRACK ORDER VIEW ─────────────────────────────────────────────────────────
function TrackOrderView() {
  const [step, setStep] = useState("input"); // "input" | "results"
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [billedHistory, setBilledHistory] = useState([]);
  const [showPast, setShowPast] = useState(false);

  const fetchTracking = useCallback(async (ph) => {
    try {
      const data = await api(`/api/track/${ph}`);
      setActiveOrders(data.activeOrders || []);
      setBilledHistory(data.billedHistory || []);
    } catch {}
  }, []);

  // Auto-refresh active orders every 4s when viewing results
  useEffect(() => {
    if (step !== "results" || !phone) return;
    const t = setInterval(() => fetchTracking(phone.replace(/\s/g, "")), 4000);
    return () => clearInterval(t);
  }, [step, phone, fetchTracking]);

  const handleTrack = async () => {
    const clean = phone.replace(/\s/g, "");
    if (!isValidPhone(clean)) {
      setPhoneErr("Enter a valid 10-digit mobile number");
      return;
    }
    setPhoneErr("");
    setLoading(true);
    try {
      await fetchTracking(clean);
      setStep("results");
    } catch (e) {
      setPhoneErr(e.message);
    }
    setLoading(false);
  };

  const getStatusLabel = (status) => {
    const map = {
      pending: "Pending",
      cooking: "Cooking",
      ready: "Ready",
      delivered: "Delivered",
    };
    return map[status] || status;
  };

  const getCurrentStep = (status) => {
    const steps = ["pending", "cooking", "ready", "delivered"];
    return steps.indexOf(status);
  };

  // ── PHONE INPUT ──
  if (step === "input") {
    return (
      <div className="track-page">
        <div className="track-logo">
          <svg
            viewBox="0 0 24 24"
            width="56"
            height="56"
            fill="none"
            stroke="var(--orange)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 2px 8px rgba(214, 124, 25, 0.3))" }}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <h1>Track Your Order</h1>
          <p>{RESTAURANT}</p>
        </div>

        <div className="track-form">
          <div className="field-group">
            <label>Mobile Number</label>
            <input
              className={`input ${phoneErr ? "err" : ""}`}
              type="tel"
              placeholder="Enter your mobile number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneErr("");
              }}
              maxLength={10}
              onKeyDown={(e) => e.key === "Enter" && handleTrack()}
            />
            {phoneErr ? (
              <p className="err-msg">{phoneErr}</p>
            ) : (
              <p className="phone-hint">
                Enter the phone number used while ordering
              </p>
            )}
          </div>
          <button
            className="btn-primary"
            disabled={loading || phone.replace(/\s/g, "").length < 10}
            onClick={handleTrack}
          >
            {loading ? "Searching…" : "Track Order"}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  const hasActive = activeOrders.length > 0;
  const hasBilled = billedHistory.length > 0;
  const hasNothing = !hasActive && !hasBilled;

  return (
    <div className="track-results">
      <div className="track-results-hdr">
        <div className="track-hdr-left">
          <button
            className="back-arrow-btn"
            onClick={() => {
              setStep("input");
              setActiveOrders([]);
              setBilledHistory([]);
              setShowPast(false);
            }}
            title="Search again"
          >
            ←
          </button>
          <div>
            <div className="track-hdr-title">Order Tracker</div>
            <div className="track-hdr-sub">{RESTAURANT}</div>
          </div>
        </div>
        <span className="track-hdr-phone">{phone}</span>
      </div>

      {hasActive && (
        <div className="track-refresh-bar">
          <span className="live-dot" />
          <span>Live tracking · auto-refreshes every 4s</span>
        </div>
      )}

      {hasNothing && (
        <div className="track-empty">
          <div className="track-empty-icon">🔍</div>
          <p>
            No orders found for <strong>{phone}</strong>
            <br />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Make sure you entered the correct number used during ordering.
            </span>
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              setStep("input");
              setPhone("");
            }}
          >
            Try Another Number
          </button>
        </div>
      )}

      {/* ACTIVE ORDERS */}
      {hasActive && (
        <div className="track-section">
          <p className="track-sec-title">
            Active Orders ({activeOrders.length})
          </p>
          {activeOrders.map((o) => {
            const currentIdx = getCurrentStep(o.status);
            const timelineSteps = [
              { key: "pending", label: "Order Placed", time: o.orderedAt },
              { key: "cooking", label: "Cooking", time: o.cookingAt },
              { key: "ready", label: "Ready", time: o.readyAt },
              { key: "delivered", label: "Delivered", time: o.deliveredAt },
            ];
            return (
              <div key={o._id} className="track-order-card active-card">
                <div className="track-card-top">
                  <div>
                    <div className="track-card-table">Table {o.tableNo}</div>
                    <div className="track-card-time">
                      Ordered {fmtDT(o.orderedAt)}
                    </div>
                  </div>
                  <span className={`badge b-${o.status}`}>
                    {getStatusLabel(o.status)}
                  </span>
                </div>
                <div className="track-card-items">
                  {o.items.map((i, k) => (
                    <div key={k} className="track-card-item">
                      <span>
                        {i.name} ×{i.qty}
                      </span>
                      <span>₹{i.price * i.qty}</span>
                    </div>
                  ))}
                </div>
                {o.note && <div className="track-card-note">{o.note}</div>}
                <div className="track-timeline">
                  <div className="timeline">
                    {timelineSteps.map((ts, idx) => {
                      const isActive = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <div
                          key={ts.key}
                          className={`timeline-step${isActive ? " active" : ""}${isCurrent ? " current" : ""}`}
                        >
                          <div className="timeline-node" />
                          <span className="timeline-label">{ts.label}</span>
                          <span className="timeline-time">
                            {ts.time ? fmtTime(ts.time) : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAST ORDERS */}
      {hasBilled && (
        <div className="track-section">
          <p
            className="track-sec-title"
            style={{ cursor: "pointer" }}
            onClick={() => setShowPast(!showPast)}
          >
            Past Orders ({billedHistory.length}) {showPast ? "▾" : "▸"}
          </p>
          {showPast &&
            billedHistory.map((bill) => (
              <div key={bill._id} className="track-order-card billed-card">
                <div className="track-card-top">
                  <div>
                    <div className="track-card-table">Table {bill.tableNo}</div>
                    <div className="track-card-time">
                      {fmtDT(bill.billedAt)}
                    </div>
                  </div>
                  <span className="badge b-billed">Billed</span>
                </div>
                <div className="track-card-items">
                  {bill.orders
                    .flatMap((o) => o.items || [])
                    .map((i, k) => (
                      <div key={k} className="track-card-item">
                        <span>
                          {i.name} ×{i.qty}
                        </span>
                        <span>₹{i.price * i.qty}</span>
                      </div>
                    ))}
                </div>
                <div className="track-card-total">
                  <div>
                    <div className="track-billed-total">
                      <span>Subtotal</span>
                      <span>₹{bill.subtotal}</span>
                    </div>
                    <div
                      className="track-billed-total"
                      style={{ color: "var(--muted)" }}
                    >
                      <span>GST 5%</span>
                      <span>₹{bill.gst}</span>
                    </div>
                    <div className="track-billed-total grand">
                      <span>Total</span>
                      <span>₹{bill.grandTotal}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── CHEF DASHBOARD ───────────────────────────────────────────────────────────
function ChefDashboard({ chefPin, onLogout }) {
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("active");
  const prevCountRef = useRef(0);
  const [forgotPin, setForgotPin] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/orders?status=pending,cooking,ready,billed");
      // Sound alert on new pending orders
      const pendingCount = data.filter((o) => o.status === "pending").length;
      if (authed && pendingCount > prevCountRef.current) {
        playAlert();
        // Push notification if supported
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`${RESTAURANT} — New Order!`, {
            body: `${pendingCount} order(s) waiting`,
            icon: "/favicon.ico",
          });
        }
      }
      prevCountRef.current = pendingCount;
      setOrders(data);
    } catch {}
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [authed, load]);

  const updateStatus = async (id, status) => {
    try {
      await api(`/api/orders/${id}/status`, {
        method: "PUT",
        body: { status },
      });
      setToast({ msg: `Order marked ${status}`, type: "ok" });
      load();
    } catch (e) {
      setToast({ msg: e.message, type: "er" });
    }
  };

  if (!authed) {
    if (forgotPin)
      return (
        <div className="pin-pg">
          <h2>Forgot Chef PIN?</h2>
          <p
            style={{
              textAlign: "center",
              maxWidth: 260,
              color: "var(--muted)",
            }}
          >
            Ask the restaurant owner to check and share the Chef PIN from the
            Owner Dashboard → Settings.
          </p>
          <button
            className="btn-primary"
            style={{ maxWidth: 200 }}
            onClick={() => setForgotPin(false)}
          >
            Back to PIN
          </button>
        </div>
      );
    return (
      <PinScreen
        role="chef"
        correctPin={chefPin}
        onSuccess={() => setAuthed(true)}
        onForgot={() => setForgotPin(true)}
      />
    );
  }

  const visible = orders.filter((o) =>
    filter === "active"
      ? ["pending", "cooking"].includes(o.status)
      : filter === "ready"
        ? o.status === "ready"
        : true,
  );

  return (
    <div className="dash">
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
      <div className="dash-hdr">
        <div>
          <div className="dash-title">Kitchen — {RESTAURANT}</div>
          <div className="dash-sub">
            Live orders · auto-refresh 3s · sound alerts on
          </div>
        </div>
        <div className="dash-actions">
          <button className="refresh" onClick={load} title="Refresh">
            ↻
          </button>
          <button className="btn-sm danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
      <div className="filter-bar">
        {[
          ["active", "Active"],
          ["ready", "Ready"],
          ["all", "All"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={`f-btn ${filter === v ? "on" : ""}`}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
        <span
          style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}
        >
          {visible.length} orders
        </span>
      </div>
      {visible.length === 0 ? (
        <div className="empty">
          <div className="ic">👨‍🍳</div>
          <p>No orders here.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {visible.map((o) => (
            <div key={o._id} className={`oc ${o.status}`}>
              <div className="oc-top">
                <div>
                  <div className="oc-tbl">Table {o.tableNo}</div>
                  <div className="oc-ph">{o.phone}</div>
                </div>
                <span className={`badge b-${o.status}`}>{o.status}</span>
              </div>
              <div className="oc-items">
                {o.items.map((i, k) => (
                  <div key={k} className="oc-item">
                    <span>{i.name}</span>
                    <span>×{i.qty}</span>
                  </div>
                ))}
              </div>
              {o.note && <div className="oc-note">{o.note}</div>}
              <div className="oc-times">
                <span>Ordered: {fmtTime(o.orderedAt)}</span>
                {o.cookingAt && <span>Cooking: {fmtTime(o.cookingAt)}</span>}
                {o.readyAt && <span>Ready: {fmtTime(o.readyAt)}</span>}
              </div>
              <div className="oc-acts">
                {o.status === "pending" && (
                  <button
                    className="action-btn ab-cook"
                    onClick={() => updateStatus(o._id, "cooking")}
                  >
                    Start Cooking
                  </button>
                )}
                {o.status === "cooking" && (
                  <button
                    className="action-btn ab-rdy"
                    onClick={() => updateStatus(o._id, "ready")}
                  >
                    Mark Ready
                  </button>
                )}
                {o.status === "ready" && (
                  <span style={{ fontSize: 11, color: "var(--green)" }}>
                    Waiting for pickup
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── OWNER DASHBOARD ──────────────────────────────────────────────────────────
function OwnerDashboard({ ownerData, onLogout }) {
  const [tab, setTab] = useState("tables");
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logDates, setLogDates] = useState([]);
  const [logDate, setLogDate] = useState(dateKey(new Date()));
  const [stats, setStats] = useState({});
  const [billTable, setBillTable] = useState(null);
  const [billData, setBillData] = useState(null);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "Starters",
    price: "",
    imageUrl: "",
    desc: "",
  });
  const [toast, setToast] = useState(null);
  const [chefPin, setChefPin] = useState(ownerData.chefPin);
  const [pwForm, setPwForm] = useState({});
  const [pwMsg, setPwMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const toast_ = (msg, type = "ok") => setToast({ msg, type });

  const loadAll = useCallback(async () => {
    const [t, o, s] = await Promise.all([
      api("/api/tables"),
      api("/api/orders"),
      api("/api/stats/today"),
    ]);
    setTables(t);
    setOrders(o);
    setStats(s);
  }, []);

  const loadMenu = useCallback(() => api("/api/menu").then(setMenu), []);
  const loadLogs = useCallback(() => {
    api(`/api/logs?date=${logDate}`).then(setLogs);
    api("/api/logs/dates").then(setLogDates);
  }, [logDate]);

  useEffect(() => {
    loadAll();
    loadMenu();
  }, []);
  useEffect(() => {
    if (tab === "log") loadLogs();
  }, [tab, logDate]);
  useEffect(() => {
    const t = setInterval(loadAll, 5000);
    return () => clearInterval(t);
  }, [loadAll]);

  // Prepare table summary
  const tableCards = TABLES.map((no) => {
    const s = tables.find((t) => t.tableNo === no) || {
      tableNo: no,
      phone: "",
      status: "open",
      orders: [],
    };
    // const populated = (s.orders || [])
    //   .map((id) => orders.find((o) => o._id === id || o === id))
    //   .filter(Boolean);
    const populated = (s.orders || [])
      .map((o) => (typeof o === "object" ? o : orders.find((x) => x._id === o)))
      .filter(Boolean);
    const allItems = {};
    populated.forEach((o) =>
      o.items?.forEach((i) => {
        if (allItems[i.name]) allItems[i.name].qty += i.qty;
        else allItems[i.name] = { ...i };
      }),
    );
    const items = Object.values(allItems);
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    return { no, s, items, subtotal };
  });

  // const openBill = (no, items, subtotal, phone) => {
  //   setBillTable(no);
  //   setBillData({ items, subtotal, phone });
  // };
  const openBill = (no, items, subtotal, phone) => {
    const tableNo = Number(no);
    setBillTable(tableNo);
    setBillData({ tableNo, items, subtotal, phone });
  };

  // const confirmBill = async () => {
  //   setLoading(true);
  //   try {
  //     await api(`/api/tables/${billTable}/bill`, { method: "POST" });
  //     toast_("Table billed successfully");
  //     setBillTable(null);
  //     setBillData(null);
  //     loadAll();
  //   } catch (e) {
  //     toast_(e.message, "er");
  //   }
  //   setLoading(false);
  // };
  const confirmBill = async () => {
    setLoading(true);
    try {
      const tableNo = Number(billData?.tableNo || billTable);

      await api(`/api/tables/${tableNo}/bill`, {
        method: "POST",
      });

      toast_("Table billed successfully", "ok");
      setBillTable(null);
      setBillData(null);
      loadAll();
    } catch (e) {
      toast_(e.message, "er");
    }
    setLoading(false);
  };

  const clearTable = async (no) => {
    await api(`/api/tables/${no}/clear`, { method: "POST" });
    toast_("Table cleared");
    loadAll();
  };

  const toggleAvail = async (id, available) => {
    await api(`/api/menu/${id}`, { method: "PUT", body: { available } });
    loadMenu();
  };
  const delItem = async (id) => {
    if (!confirm("Delete this menu item?")) return;
    await api(`/api/menu/${id}`, { method: "DELETE" });
    toast_("Item deleted");
    loadMenu();
  };
  const addItem = async () => {
    if (!newItem.name || !newItem.price) {
      toast_("Name and price required", "er");
      return;
    }
    await api("/api/menu", {
      method: "POST",
      body: { ...newItem, price: Number(newItem.price) },
    });
    setNewItem({
      name: "",
      category: "Starters",
      price: "",
      imageUrl: "",
      desc: "",
    });
    toast_("Item added");
    loadMenu();
  };

  const saveChefPin = async () => {
    if (!/^\d{4}$/.test(chefPin)) {
      toast_("PIN must be 4 digits", "er");
      return;
    }
    await api("/api/auth/chef-pin", { method: "PUT", body: { chefPin } });
    toast_("Chef PIN updated");
  };
  const changePassword = async () => {
    setPwMsg("");
    try {
      await api("/api/auth/change-password", {
        method: "PUT",
        body: { currentPassword: pwForm.cur, newPassword: pwForm.nw },
      });
      setPwMsg("Password updated");
      setPwForm({});
    } catch (e) {
      setPwMsg(e.message);
    }
  };

  const printDayLog = () => {
    if (!logs.length) return;
    const dayRevenue = logs.reduce((s, l) => s + l.grandTotal, 0);
    const rows = logs
      .map(
        (l) => `
      <div class="entry">
        <div class="entry-hdr"><strong>Table ${l.tableNo}</strong> &nbsp;|&nbsp; ${l.phone} &nbsp;|&nbsp; Billed: ${fmtDT(l.billedAt)}</div>
        ${l.orders
          .map(
            (o) => `
          <div class="order-block">
            <div class="o-meta">Order #${o.id || ""} &nbsp; Placed: ${fmtTime(o.orderedAt)}${o.cookingAt ? ` · Cooking: ${fmtTime(o.cookingAt)}` : ""}${o.readyAt ? ` · Ready: ${fmtTime(o.readyAt)}` : ""}${o.deliveredAt ? ` · Delivered: ${fmtTime(o.deliveredAt)}` : ""}</div>
            ${o.items.map((i) => `<div class="item-row"><span>${i.name} ×${i.qty}</span><span>₹${i.price * i.qty}</span></div>`).join("")}
            ${o.note ? `<div class="note">Note: ${o.note}</div>` : ""}
          </div>`,
          )
          .join("")}
        <div class="entry-footer">Subtotal ₹${l.subtotal} + GST ₹${l.gst} = <strong>₹${l.grandTotal}</strong></div>
      </div>`,
      )
      .join("");

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/><title>Order Log ${logDate}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600&display=swap');
        body{font-family:'DM Sans',sans-serif;color:#111;padding:28px 24px;max-width:680px;margin:0 auto;}
        h1{font-family:'Playfair Display',serif;font-size:22px;margin-bottom:2px;}
        .meta{font-size:12px;color:#666;margin-bottom:18px;}
        .entry{border:1px solid #ddd;border-radius:8px;padding:14px;margin-bottom:12px;}
        .entry-hdr{font-weight:600;font-size:13px;margin-bottom:8px;}
        .order-block{border-top:1px solid #eee;padding:8px 0;}
        .o-meta{font-size:11px;color:#666;margin-bottom:4px;}
        .item-row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0;}
        .note{font-size:11px;color:#888;font-style:italic;margin-top:3px;}
        .entry-footer{border-top:1px solid #ddd;padding-top:8px;margin-top:8px;font-size:13px;text-align:right;}
        .summary{background:#f9f9f9;border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:13px;}
        @media print{body{padding:10px;}}
      </style></head><body>
      <h1>${RESTAURANT}</h1>
      <div class="meta">Order Log — ${logDate} &nbsp;|&nbsp; Generated: ${fmtDT(new Date())}</div>
      <div class="summary">Tables Billed: <strong>${logs.length}</strong> &nbsp;|&nbsp; Total Revenue: <strong>₹${dayRevenue}</strong></div>
      ${rows}
      <script>window.onload=()=>window.print();</script>
    </body></html>`;
    const w = window.open("", "_blank", "width=680,height=800");
    if (!w) {
      alert("Allow popups to print.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="dash">
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
      <div className="dash-hdr">
        <div>
          <div className="dash-title">{RESTAURANT} — Owner</div>
          <div className="dash-sub">
            {fmtDate(new Date())} · {ownerData.username}
          </div>
        </div>
        <div className="dash-actions">
          <button className="refresh" onClick={loadAll}>
            ↻
          </button>
          <button className="btn-sm danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-v">₹{(stats.revenue || 0).toLocaleString()}</div>
          <div className="stat-l">Today Revenue</div>
        </div>
        <div className="stat">
          <div className="stat-v">{stats.billedTables || 0}</div>
          <div className="stat-l">Billed Today</div>
        </div>
        <div className="stat">
          <div className="stat-v">{stats.totalBills || 0}</div>
          <div className="stat-l">All-Time Bills</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: "var(--red)" }}>
            {stats.activeOrders || 0}
          </div>
          <div className="stat-l">Active Orders</div>
        </div>
      </div>

      <div className="owner-tabs">
        {[
          ["tables", "Tables & Bills"],
          ["menu", "Menu Manager"],
          ["log", "Order Log"],
          ["settings", "Settings"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={`o-tab ${tab === v ? "on" : ""}`}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── TABLES ── */}
      {tab === "tables" && (
        <div className="tables-grid">
          {tableCards.map(({ no, s, items, subtotal }) => {
            const gst = tax(subtotal),
              isBilled = s.status === "billed";
            return (
              <div
                key={no}
                className={`tc ${isBilled ? "billed" : items.length > 0 ? "active" : ""}`}
              >
                <div className="tc-top">
                  <div>
                    <div className="tc-name">Table {no}</div>
                    {s.phone && <div className="tc-phone">{s.phone}</div>}
                    {s.openedAt && (
                      <div className="tc-since">
                        Since {fmtTime(s.openedAt)}
                      </div>
                    )}
                  </div>
                  <span
                    className={`badge ${isBilled ? "b-billed" : items.length > 0 ? "b-cooking" : "b-ready"}`}
                  >
                    {isBilled
                      ? "Billed"
                      : items.length > 0
                        ? "Active"
                        : "Empty"}
                  </span>
                </div>
                {items.length > 0 ? (
                  <>
                    <div className="tc-items">
                      {items.map((i, k) => (
                        <div key={k} className="tc-item">
                          <span>
                            {i.name} ×{i.qty}
                          </span>
                          <span>₹{i.price * i.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="tc-total">
                      ₹{subtotal} + ₹{gst} GST = ₹{subtotal + gst}
                    </div>
                    <div className="tc-acts">
                      {!isBilled && (
                        <button
                          className="action-btn ab-bill"
                          onClick={() => openBill(no, items, subtotal, s.phone)}
                        >
                          Send Bill
                        </button>
                      )}
                      {isBilled && (
                        <button
                          className="action-btn"
                          style={{
                            background: "var(--border)",
                            color: "var(--muted)",
                          }}
                          onClick={() => clearTable(no)}
                        >
                          Clear Table
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>
                    No orders yet
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MENU MANAGER ── */}
      {tab === "menu" && (
        <div>
          <div className="add-form">
            <h4>Add New Item</h4>
            <div className="form-grid">
              <div className="ff" style={{ flex: 2, minWidth: 140 }}>
                <label>Item Name</label>
                <input
                  className="fi"
                  value={newItem.name}
                  placeholder="e.g. Masala Dosa"
                  onChange={(e) =>
                    setNewItem((n) => ({ ...n, name: e.target.value }))
                  }
                />
              </div>
              <div className="ff" style={{ minWidth: 90 }}>
                <label>Price ₹</label>
                <input
                  className="fi"
                  type="number"
                  value={newItem.price}
                  placeholder="150"
                  onChange={(e) =>
                    setNewItem((n) => ({ ...n, price: e.target.value }))
                  }
                />
              </div>
              <div className="ff" style={{ minWidth: 110 }}>
                <label>Category</label>
                <select
                  className="fsel"
                  value={newItem.category}
                  onChange={(e) =>
                    setNewItem((n) => ({ ...n, category: e.target.value }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-grid" style={{ marginTop: 9 }}>
              <div className="ff" style={{ flex: 2 }}>
                <label>Image URL (Unsplash or direct link)</label>
                <input
                  className="fi"
                  value={newItem.imageUrl}
                  placeholder="https://images.unsplash.com/..."
                  onChange={(e) =>
                    setNewItem((n) => ({ ...n, imageUrl: e.target.value }))
                  }
                />
              </div>
              <div className="ff" style={{ flex: 1 }}>
                <label>Description</label>
                <input
                  className="fi"
                  value={newItem.desc}
                  placeholder="Short description"
                  onChange={(e) =>
                    setNewItem((n) => ({ ...n, desc: e.target.value }))
                  }
                />
              </div>
            </div>
            <button className="btn-add" onClick={addItem}>
              Add to Menu
            </button>
          </div>

          <div className="mm-grid">
            {menu.map((m) => (
              <div key={m._id} className={`mc${!m.available ? " na" : ""}`}>
                <img
                  className="mc-img"
                  src={
                    m.imageUrl ||
                    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80"
                  }
                  alt={m.name}
                  onError={(e) => {
                    e.target.src =
                      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80";
                  }}
                />
                <div className="mc-body">
                  <div className="mc-top">
                    <div>
                      <div className="mc-name">{m.name}</div>
                      <div className="mc-cat">{m.category}</div>
                    </div>
                    <div className="mc-price">₹{m.price}</div>
                  </div>
                  <div className="mc-desc">{m.desc}</div>
                  <div className="mc-acts">
                    <button
                      className={m.available ? "btn-avail" : "btn-unav"}
                      onClick={() => toggleAvail(m._id, !m.available)}
                    >
                      {m.available ? "Available" : "Unavailable"}
                    </button>
                    <button className="btn-del" onClick={() => delItem(m._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LOG ── */}
      {tab === "log" && (
        <div>
          <div className="date-row">
            <input
              type="date"
              className="date-inp"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
            <button
              className="f-btn on"
              onClick={() => setLogDate(dateKey(new Date()))}
            >
              Today
            </button>
            {logDates.slice(0, 7).map((d) => (
              <button
                key={d}
                className={`f-btn ${logDate === d ? "on" : ""}`}
                onClick={() => setLogDate(d)}
              >
                {new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })}
              </button>
            ))}
          </div>
          {logs.length === 0 ? (
            <div className="empty">
              <div className="ic">📋</div>
              <p>No billed orders for this date.</p>
            </div>
          ) : (
            <div className="log-day">
              <div className="log-day-hdr">
                <div>
                  <div className="log-day-title">
                    {new Date(logDate + "T00:00:00").toLocaleDateString(
                      "en-IN",
                      {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      },
                    )}
                  </div>
                  <div className="log-day-meta">
                    {logs.length} tables · ₹
                    {logs.reduce((s, l) => s + l.grandTotal, 0)} revenue
                  </div>
                </div>
                <button className="btn-sm" onClick={printDayLog}>
                  Print Log
                </button>
              </div>
              {logs.map((l) => (
                <div key={l._id} className="log-entry">
                  <div className="log-tags">
                    <span className="ltag lt-table">Table {l.tableNo}</span>
                    <span className="ltag lt-phone">{l.phone}</span>
                    <span className="ltag lt-billed">
                      Billed {fmtTime(l.billedAt)}
                    </span>
                    <span className="lt-total">₹{l.grandTotal}</span>
                  </div>
                  {l.orders.map((o, k) => (
                    <div key={k} className="log-order">
                      <div className="log-o-hdr">
                        <span>Order #{k + 1}</span>
                        <span>{fmtTime(o.orderedAt)}</span>
                      </div>
                      {o.items.map((i, j) => (
                        <div key={j} className="log-o-item">
                          <span>
                            {i.name} ×{i.qty}
                          </span>
                          <span>₹{i.price * i.qty}</span>
                        </div>
                      ))}
                      {o.note && <div className="log-note">{o.note}</div>}
                      <div className="log-times">
                        <span>Ordered: {fmtTime(o.orderedAt)}</span>
                        {o.cookingAt && (
                          <span>Cooking: {fmtTime(o.cookingAt)}</span>
                        )}
                        {o.readyAt && <span>Ready: {fmtTime(o.readyAt)}</span>}
                        {o.deliveredAt && (
                          <span>Delivered: {fmtTime(o.deliveredAt)}</span>
                        )}
                        {o.billedAt && (
                          <span>Billed: {fmtTime(o.billedAt)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="log-footer">
                    Subtotal ₹{l.subtotal} + GST ₹{l.gst} = Total ₹
                    {l.grandTotal}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab === "settings" && (
        <div>
          <div className="settings-card">
            <h4>Chef PIN</h4>
            <div className="field-group">
              <label>Current Chef PIN</label>
              <input
                className="input"
                value={chefPin}
                maxLength={4}
                onChange={(e) => setChefPin(e.target.value)}
                placeholder="4 digits"
              />
            </div>
            <button className="btn-primary" onClick={saveChefPin}>
              Save PIN
            </button>
          </div>
          <div className="settings-card">
            <h4>Change Password</h4>
            <div className="field-group">
              <label>Current Password</label>
              <input
                className="input"
                type="password"
                value={pwForm.cur || ""}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, cur: e.target.value }))
                }
              />
            </div>
            <div className="field-group">
              <label>New Password</label>
              <input
                className="input"
                type="password"
                value={pwForm.nw || ""}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, nw: e.target.value }))
                }
              />
            </div>
            {pwMsg && (
              <p
                style={{
                  fontSize: 12,
                  color: pwMsg.includes("updated")
                    ? "var(--green)"
                    : "var(--red)",
                  margin: "6px 0",
                }}
              >
                {pwMsg}
              </p>
            )}
            <button className="btn-primary" onClick={changePassword}>
              Update Password
            </button>
          </div>
        </div>
      )}

      {billTable !== null && billData && (
        <BillModal
          tableNo={billTable}
          phone={billData.phone}
          items={billData.items}
          subtotal={billData.subtotal}
          onClose={() => {
            setBillTable(null);
            setBillData(null);
          }}
          onConfirm={confirmBill}
        />
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("customer");
  const [ownerData, setOwnerData] = useState(null);
  const [chefLogout, setChefLogout] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Restore owner session
  useEffect(() => {
    const token = localStorage.getItem("owner_token");
    if (token) {
      api("/api/auth/me")
        .then((d) => setOwnerData({ ...d, chefPin: d.chefPin }))
        .catch(() => {
          localStorage.removeItem("owner_token");
        });
    }
  }, []);

  const handleAuth = (data) => setOwnerData(data);
  const handleLogout = () => {
    localStorage.removeItem("owner_token");
    setOwnerData(null);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <nav className="nav">
          <div className="brand">
            <div className="brand-text">
              <h1>Meghana's Kitchen</h1>
              <p>Table Ordering System</p>
            </div>
          </div>
          <div className="nav-right">
            <div className="nav-tabs">
              <button
                className={`nav-tab ${view === "customer" ? "active" : ""}`}
                onClick={() => {
                  setView("customer");
                  setShowMore(false);
                }}
              >
                Menu
              </button>
              <button
                className={`nav-tab ${view === "track" ? "active" : ""}`}
                onClick={() => {
                  setView("track");
                  setShowMore(false);
                }}
              >
                Track
              </button>
              <button
                className={`nav-tab nav-tab-more ${view === "chef" ? "active" : ""}`}
                onClick={() => setView("chef")}
              >
                Chef
              </button>
              <button
                className={`nav-tab nav-tab-more ${view === "owner" ? "active" : ""}`}
                onClick={() => setView("owner")}
              >
                Owner
              </button>
            </div>
            <button
              className="nav-menu-btn"
              onClick={() => setShowMore((open) => !open)}
              aria-label="More options"
            >
              ☰
            </button>
          </div>
          <div className={`nav-more ${showMore ? "open" : ""}`}>
            <button
              className={`nav-tab nav-more-item ${view === "chef" ? "active" : ""}`}
              onClick={() => {
                setView("chef");
                setShowMore(false);
              }}
            >
              Chef
            </button>
            <button
              className={`nav-tab nav-more-item ${view === "owner" ? "active" : ""}`}
              onClick={() => {
                setView("owner");
                setShowMore(false);
              }}
            >
              Owner
            </button>
          </div>
        </nav>

        {view === "customer" && <CustomerView />}

        {view === "track" && <TrackOrderView />}

        {view === "chef" &&
          (ownerData ? (
            <ChefDashboard
              chefPin={ownerData.chefPin}
              onLogout={() => setChefLogout(true)}
            />
          ) : (
            <div className="empty" style={{ paddingTop: 80 }}>
              <div className="ic">🔒</div>
              <p>
                Owner must be logged in to enable Chef dashboard.
                <br />
                Switch to Owner tab to sign in.
              </p>
            </div>
          ))}

        {view === "owner" &&
          (ownerData ? (
            <OwnerDashboard ownerData={ownerData} onLogout={handleLogout} />
          ) : (
            <AuthPages onAuth={handleAuth} />
          ))}
      </div>
    </>
  );
}
