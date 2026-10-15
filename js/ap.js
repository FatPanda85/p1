// ==========================================================================
// 📚 ap.js 目錄
//   1. 系統初始化與共用工具（切換分頁、關閉視窗、圖片放大）
//   2. 跨店出貨查詢（經緯度計算、分店卡片、撥電話）
//   3. 贈品活動查詢（第一頁：搜尋與下拉選單）
//   4. 家電商品查詢（第二頁：搜尋與三層下拉選單）
//   5. 商品卡片產生器 renderGiftCards（兩頁共用）
//   6. 條碼與 QR Code 視窗
//
// 📌 依賴（定義在 index.html 與其他 js 檔）：
//   rawData / smartRawData / storeDatabase / feeDatabase
//   showShippingModal(name)  ← 定義在 stor.js
// ==========================================================================


// ==========================================================================
// ⚙️ 1. 系統初始化與共用工具
// ==========================================================================

// 網頁載入完成後，先把兩頁的「分類」下拉選單填好
document.addEventListener("DOMContentLoaded", function () {
    initCategoryDropdown();   // 第一頁分類
    initSmartCats();          // 第二頁分類
});

// 切換分頁：隱藏全部內容 → 取消所有按鈕高亮 → 顯示目標頁並高亮按下的按鈕
function switchPage(evt, tabId) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) {
        contents[i].classList.remove("active");
        contents[i].style.display = "none";
    }
    const btns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < btns.length; i++) { btns[i].classList.remove("active"); }

    const target = document.getElementById(tabId);
    target.classList.add("active");
    target.style.display = "block";
    evt.currentTarget.classList.add("active");
}

// 關閉彈出視窗（全站唯一一份）
// 有傳 id → 關閉該視窗；沒傳 id → 關閉所有視窗（避免舊程式 closeModal() 沒帶參數而出錯）
function closeModal(id) {
    if (id) {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    } else {
        document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
    }
}

// 點圖片放大
function zoomImg(url) {
    if (!url) return;
    document.getElementById("zoomedImg").src = url;
    document.getElementById("imgOverlay").style.display = "flex";
}


// ==========================================================================
// 📍 2. 跨店出貨查詢（第三頁）
// ==========================================================================

// 計算兩組經緯度的直線距離（公里），Haversine 公式
function getDistKM(lat1, lon1, lat2, lon2) {
    const p = 0.017453292519943295;   // π / 180，角度轉弧度
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p) / 2
            + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p)) / 2;
    return 12742 * Math.asin(Math.sqrt(a));   // 12742 = 地球直徑(km)
}

// 主流程：地址 → 經緯度（OpenStreetMap）→ 排序 → 顯示最近 3 間分店
async function calculateNearest() {
    let addr = document.getElementById("custAddr").value.trim();
    const resDiv = document.getElementById("finalResultList");

    if (!addr) { alert("請輸入地址"); return; }
    if (storeDatabase.length === 0) {
        resDiv.innerHTML = "<p style='color:red;'>⚠️ 尚未載入分店資料（請檢查 stor.js）</p>";
        return;
    }

    resDiv.innerHTML = "<p style='color:#666;'>🔍 計算中，請稍候...</p>";

    // 地址沒寫「台灣」就自動補上，提高定位準確度
    if (!addr.includes("台灣") && !addr.includes("台")) { addr = "台灣 " + addr; }

    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=3`);
        const data = await resp.json();

        if (data.length === 0) {
            resDiv.innerHTML = "<p style='color:red;'>❌ 找不到該地址，請輸入更具體的路名或區名</p>";
            return;
        }

        const uLat = parseFloat(data[0].lat);
        const uLng = parseFloat(data[0].lon);

        // 每間分店算距離 → 由近到遠排序 → 只取前三間
        const topThree = storeDatabase
            .map(s => ({ ...s, dist: getDistKM(uLat, uLng, s.lat, s.lng) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3);

        let html = "";
        topThree.forEach((s, index) => {
            const prefix = index === 0 ? `🏆 最近分店：${s.name}` : `🏪 鄰近分店：${s.name}`;
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

    } catch (e) {
        resDiv.innerHTML = "<p style='color:red;'>⚠️ 連線失敗，請檢查網路狀態。</p>";
    }
}

// 撥電話前先確認（桌機可直接看號碼後按取消）
function askBeforeCall(storeName) {
    const store = storeDatabase.find(s => s.name === storeName);
    if (!store) return;
    const confirmDial = confirm(`【${store.name}】\n電話號碼為： ${store.phone}\n\n是否要立即撥打此電話？\n(若要用公司桌機撥號，直接看上方號碼輸入即可，請按取消)`);
    if (confirmDial) { location.href = `tel:${store.phone.replace(/-/g, "")}`; }
}

// 舊版運費視窗（讀 storeDatabase 內的 feeDetail）
// ※ 目前分店卡片按鈕用的是 stor.js 的 showShippingModal；此函式保留備用
function showFeeDetail(storeName) {
    const store = storeDatabase.find(s => s.name === storeName);
    const feeText = store ? store.feeDetail : "暫無該店詳細運費資料。";
    document.getElementById("feeTitle").innerText = `【${storeName}】運費標準`;
    document.getElementById("feeContent").innerHTML =
        `<div style='background:#fff; padding:15px; border-radius:10px; line-height:1.6;'>${feeText}</div>`;
    document.getElementById("feeOverlay").style.display = "flex";
}


// ==========================================================================
// 🔎 3. 贈品活動查詢（第一頁，資料：rawData）
// ==========================================================================

// 共用：型號 / 品牌 / 名稱 任一包含關鍵字就算符合（不分大小寫）
function matchTerm(d, term) {
    return (d.model && d.model.toUpperCase().includes(term))
        || (d.brand && d.brand.toUpperCase().includes(term))
        || (d.name  && d.name.toUpperCase().includes(term));
}

// 填入「分類」下拉選單（去除重複）
function initCategoryDropdown() {
    const catSelect = document.getElementById("categorySelect");
    if (!catSelect) return;
    const cats = [...new Set(rawData.map(d => d.cat))];
    catSelect.innerHTML = '<option value="">-- 1. 選擇分類 --</option>';
    cats.forEach(c => { catSelect.innerHTML += `<option value="${c}">${c}</option>`; });
}

// 選了分類後，更新「品牌」下拉選單
function updateBrands() {
    const catVal = document.getElementById("categorySelect").value;
    const brandSelect = document.getElementById("brandSelect");
    brandSelect.innerHTML = '<option value="">-- 2. 選擇品牌 --</option>';
    if (!catVal) { brandSelect.disabled = true; return; }

    const brands = [...new Set(rawData.filter(d => d.cat === catVal).map(d => d.brand))];
    brands.forEach(b => { brandSelect.innerHTML += `<option value="${b}">${b}</option>`; });
    brandSelect.disabled = false;
}

// 選了品牌後，顯示符合的卡片
function showGiftsBySelect() {
    const catVal = document.getElementById("categorySelect").value;
    const brandVal = document.getElementById("brandSelect").value;
    if (!brandVal) return;
    const results = rawData.filter(d => d.cat === catVal && d.brand === brandVal);
    renderGiftCards(results, document.getElementById("giftContainer"));
}

// 關鍵字搜尋
function searchModel() {
    const term = document.getElementById("searchInput").value.trim().toUpperCase();
    if (term === "") { alert("請輸入型號關鍵字"); return; }
    renderGiftCards(rawData.filter(d => matchTerm(d, term)), document.getElementById("giftContainer"));
}
function handleKeyPress(event) { if (event.key === "Enter") searchModel(); }


// ==========================================================================
// ⚡ 4. 家電商品查詢（第二頁，資料：smartRawData，分類→品牌→規格）
// ==========================================================================

function initSmartCats() {
    const catSelect = document.getElementById("smartCatSelect");
    if (!catSelect) return;
    const cats = [...new Set(smartRawData.map(d => d.cat))];
    catSelect.innerHTML = '<option value="">-- 1. 選擇分類 --</option>';
    cats.forEach(c => { catSelect.innerHTML += `<option value="${c}">${c}</option>`; });
}

// 選分類 → 更新品牌
function updateSmartTypes() {
    const catVal = document.getElementById("smartCatSelect").value;
    const brandSelect = document.getElementById("smartBrandSelectSub");
    brandSelect.innerHTML = '<option value="">-- 2. 選擇品牌 --</option>';
    if (!catVal) { brandSelect.disabled = true; return; }

    const brands = [...new Set(smartRawData.filter(d => d.cat === catVal).map(d => d.brand))];
    brands.forEach(b => { brandSelect.innerHTML += `<option value="${b}">${b}</option>`; });
    brandSelect.disabled = false;
}

// 選品牌 → 更新規格
function updateSmartSpecs() {
    const catVal = document.getElementById("smartCatSelect").value;
    const brandVal = document.getElementById("smartBrandSelectSub").value;
    const specSelect = document.getElementById("smartSpecSelect");
    specSelect.innerHTML = '<option value="">-- 3. 選擇規格 --</option>';
    if (!brandVal) { specSelect.disabled = true; return; }

    const specs = [...new Set(smartRawData.filter(d => d.cat === catVal && d.brand === brandVal).map(d => d.spec))];
    specs.forEach(s => { specSelect.innerHTML += `<option value="${s}">${s}</option>`; });
    specSelect.disabled = false;
}

// 選規格 → 顯示卡片
function showSmartGiftsBySelect() {
    const catVal = document.getElementById("smartCatSelect").value;
    const brandVal = document.getElementById("smartBrandSelectSub").value;
    const specVal = document.getElementById("smartSpecSelect").value;
    if (!specVal) return;
    const results = smartRawData.filter(d => d.cat === catVal && d.brand === brandVal && d.spec === specVal);
    renderGiftCards(results, document.getElementById("smartGiftContainer"));
}

// 關鍵字搜尋
function searchSmartModel() {
    const term = document.getElementById("smartSearchInput").value.trim().toUpperCase();
    if (term === "") { alert("請輸入型號關鍵字"); return; }
    renderGiftCards(smartRawData.filter(d => matchTerm(d, term)), document.getElementById("smartGiftContainer"));
}
function handleSmartKeyPress(event) { if (event.key === "Enter") searchSmartModel(); }


// ==========================================================================
// 🎨 5. 商品卡片產生器（兩頁共用）
// ==========================================================================

// QR 視窗內的說明文字（用真正的換行，視窗會以 pre-line 顯示）
const QR_HINTS = {
    activity: "請引導客人掃描前往登錄",
    tax: "請掃描 QR Code 進入退稅頁面\n申請貨物稅補助請準備以下資料:\n1.發票   2.存摺\n3.身分證  4.保證書\n※備註:請放在一起拍成一張照片上傳",
    old: "請掃描 QR Code 進入補助頁面\n申請舊機補助請準備以下資料:\n1.發票   2.存摺   3.身分證\n4.保證書  5.電費單\n6.回收單  7.能源效率表",
    scan: "供客人現場掃描"
};

// 把 "$1000" 這類金額包成紅字
function highlightPrice(text) {
    return text ? text.replace(/(\$\d+)/g, '<span class="price-red">$1</span>') : "";
}

// 產生「規格表格」HTML（兩欄格線）
//   - value 為空字串 → 當作小標題，橫跨兩欄
//   - label 為「運費資訊」→ 紅字，上方加分隔線
//   - 其他 → 左灰（項目）右藍（內容）
function buildSpecsHtml(specs) {
    let html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px 15px; margin: 10px 0; font-size: 0.9rem;">';

    if (Array.isArray(specs)) {
        specs.forEach(s => {
            if (s.label === "運費資訊") {
                html += `<div style="grid-column: span 2; font-weight: bold; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 5px; color: #d9534f;">${s.label}: ${s.value}</div>`;
            } else if (s.value === "") {
                html += `<div style="grid-column: span 2; font-weight: bold; margin-top: 5px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 2px;">${s.label}</div>`;
            } else {
                const val = s.value ? s.value.toString().replace(/\n/g, "<br>") : "";
                html += '<div style="display: flex; gap: 4px; overflow: hidden;">'
                      + '<span style="color: #666; white-space: nowrap;">' + s.label + ':</span>'
                      + '<span style="color: #007bff; font-weight: bold; word-break: break-all;">' + val + '</span>'
                      + '</div>';
            }
        });
    }
    return html + "</div>";
}

// 決定第 i 顆條碼按鈕要顯示什麼文字
// 優先順序：① 資料內的 customLabels → ② 依分類 / 品牌的固定順序 → ③ 依 type 判斷
function getBarcodeLabel(g, i) {
    // ① 自訂標籤
    if (g.customLabels && g.customLabels[i]) return g.customLabels[i];

    // ② 依分類套用固定順序的標籤；不夠長就用預設
    const defaultLabel = `🛒 結帳條碼(${i + 1})`;
    let label = defaultLabel;

    if (g.cat === "DM尾牙") {
        if (g.brand && g.brand.includes("電視")) {
            label = ["🎁 贈品", "➖ 品牌負載", "🎧 加碼贈品", "🚚 免運$10", "💰 收費$10"][i] || defaultLabel;
        } else if (g.brand === "冷氣") {
            label = ["🎁 贈品", "🚚 免運$100"][i] || defaultLabel;
        } else {
            label = ["🎁 贈品", "🚚 免運$10", "💰 收費$10"][i] || defaultLabel;
        }
    } else if (g.cat === "常用條碼") {
        label = ["🧾 主條碼", "🚚 免運$10", "💰 收費$10"][i] || defaultLabel;
    } else if (g.cat === "國際夏日有禮賞") {
        label = ["🎁 贈品", "🎁 贈品", "🚚 免運$10", "💰 收費$10"][i] || defaultLabel;
    }

    // ③ 還是預設的話，改看資料的 type
    if (label === defaultLabel) {
        const typeLabels = {
            gift: "🎁 贈品條碼",
            shipping: "🚚 免運$100",
            shipping1: "🚚 免運$10",
            shipping2: "🚚 收費$10",
            shipping3: "📦 商品條碼"
        };
        label = typeLabels[g.type] || defaultLabel;
    }
    return label;
}

// 產生條碼按鈕群
function buildBarcodeButtons(g) {
    if (!Array.isArray(g.barcode)) return "";
    const btnStyle = 'style="background-color: #374151; color: white; font-weight: bold; border-radius: 8px; padding: 8px 12px; border: none; cursor: pointer; margin-right: 5px; margin-bottom: 5px;"';
    let html = "";
    g.barcode.forEach((code, i) => {
        if (!code) return;   // 空條碼略過
        html += `<button class="action-btn" ${btnStyle} onclick="zoomBarcode('${code}')">${getBarcodeLabel(g, i)}</button>`;
    });
    return html;
}

// 產生卡片底部的連結按鈕（活動 / 退稅 / 補助 / 全本目錄 / 單台介紹）
//   全部都用 showInteractiveQr：客人掃 QR ＋ 服務人員直接點開網頁
//   （showQrCode 為純 QR 版，目前沒有按鈕使用，保留備用）
function buildLinkButtons(g) {
    let html = "";
    if (g.qrUrl)
        html += `<button class="action-btn btn-activity" onclick="showInteractiveQr('${g.qrUrl}','官方活動官網',QR_HINTS.activity)">📱 活動</button>`;
    if (g.taxUrl)
        html += `<button class="action-btn btn-tax" onclick="showInteractiveQr('${g.taxUrl}','貨物稅退稅申請',QR_HINTS.tax)">💰 退稅</button>`;
    if (g.oldUrl)
        html += `<button class="action-btn btn-old" onclick="showInteractiveQr('${g.oldUrl}','節能舊機補助',QR_HINTS.old)">♻️ 補助</button>`;
    if (g.catalogUrl)
        html += `<button class="action-btn" style="background-color: #1e3a8a; color: white;" onclick="showInteractiveQr('${g.catalogUrl}','📖 原廠全本目錄',QR_HINTS.scan)">📖 全本目錄</button>`;
    if (g.productUrl)
        html += `<button class="action-btn" style="background-color: #0369a1; color: white;" onclick="showInteractiveQr('${g.productUrl}','🌐 此台商品介紹',QR_HINTS.scan)">🌐 單台介紹</button>`;
    return html;
}

// 主函式：把符合的資料畫成卡片，放進指定容器
//   matches   ：符合條件的資料陣列
//   container ：要放卡片的元素（不傳則用第一頁的 giftContainer）
function renderGiftCards(matches, container) {
    const target = container || document.getElementById("giftContainer");
    target.innerHTML = "";

    if (matches.length === 0) {
        target.innerHTML = "<p style='color:#888; text-align:center;'>❌ 找不到符合的資料</p>";
        return;
    }

    let html = "";
    matches.forEach(g => {
        const name = highlightPrice(g.name);
        const desc = highlightPrice(g.desc);
        const imgStyle = 'width:60%; border:1px solid #eee; border-radius:8px; padding:5px;';

        html += `
        <div class="gift-card">
            <div class="product-images" style="display:flex; flex-direction:column; gap:10px; align-items:center;">
                ${g.img ? `<img src="${g.img}" class="gift-img" onclick="zoomImg('${g.img}')" onerror="this.src='https://via.placeholder.com/90?text=無圖片'">` : ""}
                ${g.giftImg ? `<img src="${g.giftImg}" class="gift-img" style="${imgStyle}" onclick="zoomImg('${g.giftImg}')">` : ""}
                ${g.giftImg2 ? `<img src="${g.giftImg2}" class="gift-img" style="${imgStyle}" onclick="zoomImg('${g.giftImg2}')">` : ""}
            </div>
            <div class="gift-info">
                <h4><span style="color:var(--model-blue);">[${g.brand}-${g.cat}]</span>${name}</h4>
                <p>${desc}</p>
                ${buildSpecsHtml(g.specs)}
                <div class="action-btns">
                    ${buildBarcodeButtons(g)}
                    ${buildLinkButtons(g)}
                </div>
            </div>
        </div>`;
    });

    target.innerHTML = html;   // 一次寫入，比逐筆 += 更快
}


// ==========================================================================
// 🔲 6. 條碼與 QR Code 視窗
// ==========================================================================

// 條碼放大：預設 EAN13，若碼長不符會報錯，則自動改用 CODE128 避免整個視窗壞掉
function zoomBarcode(code) {
    document.getElementById("barcodeModal").style.display = "flex";
    document.getElementById("barcodeNumBlue").innerText = code;

    const opts = { width: 3, height: 100, displayValue: true, fontSize: 24, textMargin: 0, margin: 0 };
    try {
        JsBarcode("#barcodeCanvas", code, { ...opts, format: "EAN13" });
    } catch (e) {
        JsBarcode("#barcodeCanvas", code, { ...opts, format: "CODE128" });
    }
}

// 內部共用：產生 QR Code 並填入標題與說明（兩種視窗都用它）
function fillQrDialog(url, title, hintHtml) {
    document.getElementById("qrTitle").innerText = title;
    document.getElementById("qrHint").innerHTML = hintHtml;

    const canvas = document.getElementById("qrCodeCanvas");
    canvas.innerHTML = "";   // 清掉上一次的 QR
    new QRCode(canvas, {
        text: url,
        width: 180,
        height: 180,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    document.getElementById("qrCodeOverlay").style.display = "flex";
}

// 【簡易版】只給客人掃描（例如：官方活動）
function showQrCode(url, title, hint) {
    fillQrDialog(url, title,
        `<div style="color:#555; line-height:1.6; white-space:pre-line;">${hint}</div>`);
}

// 【互動版】客人掃 QR ＋ 服務人員按按鈕直接開網頁
// 用於：退稅、舊機補助、全本目錄、單台介紹
function showInteractiveQr(url, title, hint) {
    fillQrDialog(url, title, `
        <div style="margin-bottom:12px; color:#555; line-height:1.5; white-space:pre-line;">${hint}</div>
        <hr style="border:0; border-top:1px solid #ddd; margin:12px 0;">
        <button onclick="window.open('${url}', '_blank'); closeModal('qrCodeOverlay');"
                style="width:100%; padding:13px; background-color:#333; color:white; border:none; border-radius:8px; font-size:1rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
            🔗 服務人員直接點此開啟網頁
        </button>`);
}
