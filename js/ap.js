
// ==========================================================================
// ⚙️ 4. 系統初始化
// ==========================================================================
document.addEventListener("DOMContentLoaded", function() {
    initCategoryDropdown(); 
    initSmartCats();        
});

function switchPage(evt, tabId) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) {
        contents[i].classList.remove("active");
        contents[i].style.display = "none";
    }
    const btns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < btns.length; i++) { btns[i].classList.remove("active"); }
    
    document.getElementById(tabId).classList.add("active");
    document.getElementById(tabId).style.display = "block";
    evt.currentTarget.classList.add("active");
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function zoomImg(url) { 
    if(!url) return; 
    document.getElementById("zoomedImg").src = url; 
    document.getElementById("imgOverlay").style.display = "flex"; 
}

// ==========================================================================
// 📍 5. 經緯度與配送分店核心運算邏輯
// ==========================================================================
function getDistKM(lat1, lon1, lat2, lon2) {
    const p = 0.017453292519943295; const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a)); 
}

async function calculateNearest() {
    let addr = document.getElementById('custAddr').value.trim();
    const resDiv = document.getElementById('finalResultList');
    if (!addr) { alert("請輸入地址"); return; }
    
    resDiv.innerHTML = "<p style='color:#666;'>🔍 計算中，請稍候...</p>";
    if(!addr.includes("台灣") && !addr.includes("台")) { addr = "台灣 " + addr; }
    
    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=3`);
        const data = await resp.json();
        if (data.length > 0) {
const uLat = parseFloat(data[0].lat); const uLng = parseFloat(data[0].lon);
const sorted = storeDatabase.map(s => ({ ...s, dist: getDistKM(uLat, uLng, s.lat, s.lng) }))
                            .sort((a, b) => a.dist - b.dist);

// 核心修改：只取前三筆
const topThree = sorted.slice(0, 3);
            
let html = '';
// 修改為遍歷 topThree
topThree.forEach((s, index) => {
    const prefix = index === 0 ? `🏆 最近分店：${s.name}` : `🏪 鄰近分店：${s.name}`;
    
    // 修正導航網址：改為標準 Google Maps 連結，並修正字串模板拼接錯誤
    const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`;

    html += `
    <div class="store-result-card">
        <div class="store-header">${prefix} <span style="font-size:0.9rem; color:#666; font-weight:normal;">(約 ${s.dist.toFixed(1)} km)</span></div>
        <div class="store-address">📍 ${s.addr}</div>
        
        <div class="store-btn-row">
            <button class="store-action-btn btn-call" onclick="askBeforeCall('${s.name}')">📞 撥電話</button>
            <button class="store-action-btn btn-nav" onclick="window.open('${googleMapUrl}', '_blank')">🗺️ 導航</button>
            <button class="store-action-btn btn-fee-trigger" onclick="showShippingModal('${s.name}')">💰 跨區費</button>
        </div>
    </div>`;
});
            resDiv.innerHTML = html;
        } else { resDiv.innerHTML = "<p style='color:red;'>❌ 找不到該地址，請輸入更具體的路名或區名</p>"; }
    } catch (e) { resDiv.innerHTML = "<p style='color:red;'>⚠️ 連線失敗，請檢查網路狀態。</p>"; }
}

function askBeforeCall(storeName) {
    const store = storeDatabase.find(s => s.name === storeName);
    if (!store) return;
    const confirmDial = confirm(`【${store.name}】\n電話號碼為： ${store.phone}\n\n是否要立即撥打此電話？\n(若要用公司桌機撥號，直接看上方號碼輸入即可，請按取消)`);
    if (confirmDial) { location.href = `tel:${store.phone.replace(/-/g, '')}`; }
}

function showFeeDetail(storeName) {
    const titleEl = document.getElementById("feeTitle"); 
    const contentEl = document.getElementById("feeContent");
    const store = storeDatabase.find(s => s.name === storeName);
    const feeText = store ? store.feeDetail : "暫裝該店詳細運費資料。";
    titleEl.innerText = `【${storeName}】運費標準`; 
    contentEl.innerHTML = `<div style='background:#fff; padding:15px; border-radius:10px; line-height:1.6;'>${feeText}</div>`;
    document.getElementById("feeOverlay").style.display = "flex";
}

// ==========================================================================
// 🛠️ 6. 快查主要條碼連動下拉選單 (第二頁邏輯)
// ==========================================================================
function initCategoryDropdown() {
    const catSelect = document.getElementById('categorySelect');
    if (!catSelect) return;
    const cats = [...new Set(rawData.map(d => d.cat))];
    catSelect.innerHTML = '<option value="">-- 1. 選擇分類 --</option>';
    cats.forEach(c => { catSelect.innerHTML += `<option value="${c}">${c}</option>`; });
}
function updateBrands() {
    const catVal = document.getElementById('categorySelect').value;
    const brandSelect = document.getElementById('brandSelect');
    brandSelect.innerHTML = '<option value="">-- 2. 選擇品牌 --</option>';
    if (!catVal) { brandSelect.disabled = true; return; }
    const brands = [...new Set(rawData.filter(d => d.cat === catVal).map(d => d.brand))];
    brands.forEach(b => { brandSelect.innerHTML += `<option value="${b}">${b}</option>`; });
    brandSelect.disabled = false;
}
function showGiftsBySelect() {
    const catVal = document.getElementById('categorySelect').value;
    const brandVal = document.getElementById('brandSelect').value;
    if (!brandVal) return;
    const results = rawData.filter(d => d.cat === catVal && d.brand === brandVal);
    renderGiftCards(results, document.getElementById('giftContainer'));
}
function searchModel() {
    const term = document.getElementById('searchInput').value.trim().toUpperCase();
    if (term === "") { alert("請輸入型號關鍵字"); return; }
    const results = rawData.filter(d => (d.model && d.model.toUpperCase().includes(term)) || d.brand.toUpperCase().includes(term) || d.name.toUpperCase().includes(term));
    renderGiftCards(results, document.getElementById('giftContainer'));
}
function handleKeyPress(event) { if (event.key === "Enter") searchModel(); }

// ==========================================================================
// 🎨 7. 核心：智慧標籤判定與卡片 HTML 產生器
// ==========================================================================
function renderGiftCards(matches, container) {
    const targetContainer = container || document.getElementById('giftContainer');
    targetContainer.innerHTML = ''; 
    if (matches.length === 0) { 
        targetContainer.innerHTML = "<p style='color:#888; text-align:center;'>❌ 找不到符合的資料</p>"; 
        return; 
    }
    
    matches.forEach(g => {
        // 1. 處理名稱與描述
        let formattedName = g.name.replace(/(\$\d+)/g, '<span class="price-red">$1</span>');
        // 只有在 desc 需要替換 (如果 desc 內還有 \n 的話)
        let formattedDesc = g.desc ? g.desc.replace(/(\$\d+)/g, '<span class="price-red">$1</span>') : "";
        
// 2. 處理規格表格 (specsHtml)
let specsHtml = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px 15px; margin: 10px 0; font-size: 0.9rem;">';

if (g.specs && Array.isArray(g.specs)) {
    g.specs.forEach(s => {
        if (s.value === "" || s.label === "運費資訊") {
            let style = "grid-column: span 2; font-weight: bold; margin-top: 5px;";
            if (s.label === "運費資訊") {
    style += " border-top: 1px solid #ddd; padding-top: 5px; color: #d9534f;";
    // 改為同時顯示標籤與數值
    specsHtml += `<div style="${style}">${s.label}: ${s.value}</div>`; 
} else {
                style += " color: #333; border-bottom: 1px solid #ddd; padding-bottom: 2px;";
                specsHtml += `<div style="${style}">${s.label}</div>`;
            }
        } else {
            // 這裡使用單引號拼接字串，避免反引號在某些環境下的換行語法錯誤
            specsHtml += '<div style="display: flex; gap: 4px; overflow: hidden;">' +
                         '<span style="color: #666; white-space: nowrap;">' + s.label + ':</span>' +
                         '<span style="color: #007bff; font-weight: bold; word-break: break-all;">' + (s.value ? s.value.toString().replace(/\n/g, '<br>') : '') + '</span>' +
                         '</div>';
        }
    });
}
specsHtml += '</div>';

        // 3. 處理條碼按鈕 (barcodeBtns) - 整合了你原本的複雜邏輯
        let barcodeBtns = "";
        if (Array.isArray(g.barcode) && g.barcode.length > 0) {
            g.barcode.forEach((code, i) => {
                if (!code || code === "") return;

                let label;
                // 優先使用自訂標籤
                if (g.customLabels && g.customLabels[i]) {
                    label = g.customLabels[i];
                } else {
                    // 使用你原本的複雜判斷邏輯
                    label = `🛒 結帳條碼(${i+1})`;
                    if (g.cat === "DM尾牙") {
                        if (g.brand && g.brand.includes("電視")) {
                            const tvLabels = ["🎁 贈品", "➖ 品牌負載", "🎧 加碼贈品", "🚚 免運$10", "💰 收費$10"];
                            label = tvLabels[i] || label;
                        } else if (g.brand === "冷氣") {
                            const acLabels = ["🎁 贈品", "🚚 免運$100"];
                            label = acLabels[i] || label;
                        } else {
                            const generalLabels = ["🎁 贈品", "🚚 免運$10", "💰 收費$10"];
                            label = generalLabels[i] || label;
                        }
                    } else if (g.cat === "常用條碼") {
                        const commonLabels = ["🧾 主條碼", "🚚 免運$10", "💰 收費$10"];
                        label = commonLabels[i] || label;
                    } else if (g.cat === "國際夏日有禮賞") {
                        const labels = ["🎁 贈品", "🎁 贈品", "🚚 免運$10", "💰 收費$10"];
                        label = labels[i] || label;
                    }

                    if (label === `🛒 結帳條碼(${i+1})` || !label) {
                        if (g.type === 'gift') { label = "🎁 贈品條碼"; } 
                        else if (g.type === 'shipping') { label = "🚚 免運$100"; } 
                        else if (g.type === 'shipping1') { label = "🚚 免運$10"; } 
                        else if (g.type === 'shipping2') { label = "🚚 收費$10"; }
                        else if (g.type === 'shipping3') { label = "📦 商品條碼"; }
                    }
                }

                const customStyle = 'style="background-color: #374151 !important; color: white !important; font-weight: bold; border-radius: 8px; padding: 8px 12px; border: none; cursor: pointer; margin-right: 5px; margin-bottom: 5px;"';
                barcodeBtns += `<button class="action-btn" ${customStyle} onclick="zoomBarcode('${code}')">${label}</button>`;
            });
        }

        // 4. 最後渲染到畫面上
targetContainer.innerHTML += `
            <div class="gift-card">
                <div class="product-images" style="display:flex; flex-direction:column; gap:10px; align-items:center;">
                    ${g.img ? `<img src="${g.img}" class="gift-img" onclick="zoomImg('${g.img}')" onerror="this.src='https://via.placeholder.com/90?text=無圖片'">` : ''}
                    ${g.giftImg ? `<img src="${g.giftImg}" class="gift-img" style="width:60%; border:1px solid #eee; border-radius:8px; padding:5px;" onclick="zoomImg('${g.giftImg}')">` : ''}
                </div>
                <div class="gift-info">
                    <h4><span style="color:var(--model-blue);">[${g.brand}-${g.cat}]</span>${formattedName}</h4>
                    <p>${formattedDesc}</p>${specsHtml}
                    <div class="action-btns">
                        ${barcodeBtns}${g.qrUrl ? `<button class="action-btn btn-activity" onclick="showQrCode('${g.qrUrl}','官方活動官網','請引導客人掃描前往登錄')">📱 活動</button>` : ''}
                        ${g.taxUrl ? `<button class="action-btn btn-tax" onclick="showQrCode('${g.taxUrl}','貨物稅退稅申請','請掃描 QR Code 進入退稅頁面\\n申請貨物稅補助請準備以下資料:\\n1.發票   2.存摺\\n3.身分證  4.保證書\\n※備註:請放在一起拍成一張照片上傳')">💰 退稅</button>` : ''}
                        ${g.oldUrl ? `<button class="action-btn btn-old" onclick="showQrCode('${g.oldUrl}','節能舊機補助','請掃描 QR Code 進入補助頁面\\n申請舊機補助請準備以下資料:\\n1.發票   2.存摺   3.身分證\\n4.保證書  5.電費單\\n6.回收單  7.能源效率表')">♻️ 補助</button>` : ''}
                        ${g.catalogUrl ? `<button class="action-btn" style="background-color: #1e3a8a !important; color: white !important;" onclick="showInteractiveQr('${g.catalogUrl}','📖 原廠全本目錄','供客人現場掃描')">📖 全本目錄</button>` : ''}
                        ${g.productUrl ? `<button class="action-btn" style="background-color: #0369a1 !important; color: white !important;" onclick="showInteractiveQr('${g.productUrl}','🌐 此台商品介紹','供客人現場掃描')">🌐 單台介紹</button>` : ''}
                    </div>
                </div>
            </div>`;
    }); // 這裡只需要一個閉合括號
} // 這裡只需要一個閉合括號

// 1. 條碼放大功能
function zoomBarcode(code) {
    document.getElementById("barcodeModal").style.display = "flex";
    
    // 設定下方的藍色大數字
    document.getElementById("barcodeNumBlue").innerText = code;
    
    // 渲染條碼
    JsBarcode("#barcodeCanvas", code, { 
        format: "EAN13", 
        width: 3, 
        height: 100, 
        displayValue: true, 
        fontSize: 24, 
        textMargin: 0, 
        margin: 0 
    });
}

// 2. 統一的 showQrCode 函數 (只保留這一個即可)
function showQrCode(url, title, hint) {
    const overlay = document.getElementById("qrCodeOverlay");
    const canvas = document.getElementById("qrCodeCanvas");
    document.getElementById("qrTitle").innerText = title;
    document.getElementById("qrHint").innerHTML = `<div style="color:#555; line-height:1.6; white-space:pre-line;">${hint}</div>`;
    canvas.innerHTML = ""; 
    new QRCode(canvas, { text: url, width: 180, height: 180 });
    overlay.style.display = "flex";
}

// 3. 確保關閉功能正常
function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
}
// ==========================================================================
// ⚙️ 8. 雙向互動式 QR Code 視窗（支援客人掃碼 + 服務人員一鍵跳轉網頁）
// ==========================================================================
function showInteractiveQr(url, title, hint) {
    const overlay = document.getElementById("qrCodeOverlay");
    const canvas = document.getElementById("qrCodeCanvas");
    
    document.getElementById("qrTitle").innerText = title;
    
    document.getElementById("qrHint").innerHTML = `
        <div style="margin-bottom:12px; color:#555; line-height:1.5;">${hint}</div>
        <hr style="border:0; border-top:1px solid #ddd; margin:12px 0;">
        <button onclick="window.open('${url}', '_blank'); closeModal('qrCodeOverlay');" 
                style="width:100%; padding:13px; background-color:#333; color:white; border:none; border-radius:8px; font-size:1rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 6px rgba(37,99,235,0.2);">
            🔗 服務人員直接點此開啟網頁
        </button>
    `;
    
    canvas.innerHTML = ""; 
    new QRCode(canvas, {
        text: url,
        width: 180,
        height: 180,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
    
    overlay.style.display = "flex";
}

// ==========================================================================
// ⚡ 9. 第三頁：分級篩選連動控制邏輯
// ==========================================================================
function initSmartCats() {
    const catSelect = document.getElementById('smartCatSelect');
    if (!catSelect) return;
    const cats = [...new Set(smartRawData.map(d => d.cat))];
    catSelect.innerHTML = '<option value="">-- 1. 選擇分類 --</option>'; 
    cats.forEach(c => { catSelect.innerHTML += `<option value="${c}">${c}</option>`; });
}
function updateSmartTypes() {
    const catVal = document.getElementById('smartCatSelect').value;
    const brandSelect = document.getElementById('smartBrandSelectSub');
    brandSelect.innerHTML = '<option value="">-- 2. 選擇品牌 --</option>';
    if (!catVal) { brandSelect.disabled = true; return; }
    const brands = [...new Set(smartRawData.filter(d => d.cat === catVal).map(d => d.brand))];
    brands.forEach(b => { brandSelect.innerHTML += `<option value="${b}">${b}</option>`; });
    brandSelect.disabled = false;
}
function updateSmartSpecs() {
    const catVal = document.getElementById('smartCatSelect').value;
    const brandVal = document.getElementById('smartBrandSelectSub').value;
    const specSelect = document.getElementById('smartSpecSelect');
    specSelect.innerHTML = '<option value="">-- 3. 選擇規格 --</option>';
    if (!brandVal) { specSelect.disabled = true; return; }
    const specs = [...new Set(smartRawData.filter(d => d.cat === catVal && d.brand === brandVal).map(d => d.spec))];
    specs.forEach(s => { specSelect.innerHTML += `<option value="${s}">${s}</option>`; });
    specSelect.disabled = false;
}
function showSmartGiftsBySelect() {
    const catVal = document.getElementById('smartCatSelect').value;
    const brandVal = document.getElementById('smartBrandSelectSub').value;
    const specVal = document.getElementById('smartSpecSelect').value;
    if (!specVal) return;
    const results = smartRawData.filter(d => d.cat === catVal && d.brand === brandVal && d.spec === specVal);
    renderGiftCards(results, document.getElementById('smartGiftContainer'));
}
function searchSmartModel() {
    const term = document.getElementById('smartSearchInput').value.trim().toUpperCase();
    if (term === "") { alert("請輸入型號關鍵字"); return; }
    const results = smartRawData.filter(d => (d.model && d.model.toUpperCase().includes(term)) || d.brand.toUpperCase().includes(term) || d.name.toUpperCase().includes(term));
    renderGiftCards(results, document.getElementById('smartGiftContainer'));
}
function handleSmartKeyPress(event) { if (event.key === "Enter") searchSmartModel(); }
