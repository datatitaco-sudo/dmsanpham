document.addEventListener('DOMContentLoaded', () => {
    const sectionsContainer = document.getElementById('productSections');
    const searchInput = document.getElementById('searchInput');
    const noResults = document.getElementById('noResults');
    const modal = document.getElementById('productModal');
    const closeBtn = document.querySelector('.close-btn');

    // CẤU HÌNH GOOGLE SHEETS
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTV_GtZzTm4iDRw2HZgVArJxo_b5qbGRontZ9HHBZDJIS_e3EmycnozG2thb8dwhAJ_g7q7RPyow2ZA/pub?gid=0&single=true&output=csv';

    let allProducts = typeof products !== 'undefined' ? products : [];

    /**
     * Hàm parse CSV mạnh mẽ hơn để xử lý multi-line và dấu ngoặc kép
     */
    function parseCSV(csvText) {
        const result = [];
        let i = 0;
        const rows = [];
        let currentRow = [];
        let currentCell = '';
        let inQuotes = false;

        csvText = csvText.replace(/^\uFEFF/, '');

        while (i < csvText.length) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (currentCell || currentRow.length > 0) {
                    currentRow.push(currentCell.trim());
                    rows.push(currentRow);
                    currentCell = '';
                    currentRow = [];
                }
                if (char === '\r' && nextChar === '\n') i++;
            } else {
                currentCell += char;
            }
            i++;
        }

        if (currentCell || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
        }

        if (rows.length < 2) return [];

        const headers = rows[0].map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/gi, ''));

        const idx = {
            hinhAnh: headers.findIndex(h => h.includes('hinhanh')),
            nhom: headers.findIndex(h => h.includes('nhom')),
            tenSp: headers.findIndex(h => h.includes('tensp')),
            hoatChat: headers.findIndex(h => h.includes('hoatchat')),
            dungTich: headers.findIndex(h => h.includes('dungtich')),
            congDung: headers.findIndex(h => h.includes('congdung')),
            lieuPhun: headers.findIndex(h => h.includes('lieuphun'))
        };

        for (let j = 1; j < rows.length; j++) {
            const r = rows[j];
            if (r.length < 3) continue;

            result.push({
                hinhAnh: r[idx.hinhAnh] || '',
                nhom: r[idx.nhom] || '',
                tenSp: r[idx.tenSp] || '',
                hoatChat: r[idx.hoatChat] || '',
                dungTich: r[idx.dungTich] || '',
                congDung: r[idx.congDung] || '',
                lieuPhun: r[idx.lieuPhun] || ''
            });
        }
        return result;
    }

    // LOGIC CHAT GEMINI
    const geminiBtn = document.getElementById('geminiBtn');
    const geminiChat = document.getElementById('geminiChat');
    const closeChat = document.querySelector('.close-chat');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    if (geminiBtn) {
        geminiBtn.addEventListener('click', () => {
            const isVisible = geminiChat.style.display === 'flex';
            geminiChat.style.display = isVisible ? 'none' : 'flex';
        });
    }

    if (closeChat) {
        closeChat.addEventListener('click', () => {
            geminiChat.style.display = 'none';
        });
    }

    function addMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `message ${type}`;
        msg.innerText = text;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function handleChat() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        chatInput.value = '';

        setTimeout(() => {
            let response = "Chào bạn! Mình là trợ lý AI nông nghiệp của Titaco. Mình có thể giúp gì cho bạn?";
            if (text.toLowerCase().includes('giá')) {
                response = "Hiện tại bảng giá đang được cập nhật. Bạn vui lòng liên hệ hotline để biết giá chi tiết nhé!";
            } else if (text.toLowerCase().includes('thấm') || text.toLowerCase().includes('loang')) {
                response = "Sản phẩm SIÊU THẤM - SIÊU LOANG giúp thuốc bám dính tốt và loang nhanh trên mặt lá.";
            }
            addMessage(response, 'bot');
        }, 800);
    }

    if (sendBtn) sendBtn.addEventListener('click', handleChat);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleChat();
        });
    }

    // Hàm lấy dữ liệu từ Google Sheets
    async function loadDataFromSheets() {
        if (!GOOGLE_SHEET_CSV_URL) {
            renderProducts(allProducts);
            return;
        }

        const finalUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(GOOGLE_SHEET_CSV_URL)}&_=${Date.now()}`;

        try {
            console.log('Đang tải dữ liệu từ Google Sheets (via Proxy)...');
            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error('Không thể tải dữ liệu');
            const data = await response.text();
            const parsedData = parseCSV(data);
            if (parsedData.length > 0) {
                allProducts = parsedData;
            }
            renderProducts(allProducts);
        } catch (error) {
            console.error('Lỗi tải Sheets:', error);
            renderProducts(allProducts);
        }
    }

    // Hàm render danh sách sản phẩm
    function renderProducts(filteredProducts) {
        sectionsContainer.innerHTML = '';

        if (filteredProducts.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        noResults.style.display = 'none';

        const groups = {};
        filteredProducts.forEach(product => {
            if (!groups[product.nhom]) {
                groups[product.nhom] = [];
            }
            groups[product.nhom].push(product);
        });

        for (const [groupName, groupItems] of Object.entries(groups)) {
            const section = document.createElement('section');
            section.className = 'category-section';

            section.innerHTML = `
                <h2 class="category-title">
                    <i class="fas fa-layer-group"></i> ${groupName}
                </h2>
                <div class="product-grid">
                    ${groupItems.map((p) => `
                        <div class="product-card" data-id="${p.tenSp}">
                            <div class="product-img-container">
                                <img src="${p.hinhAnh}" alt="${p.tenSp}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x250?text=No+Image'">
                            </div>
                            <div class="product-info">
                                <div class="product-meta">
                                    <span class="badge">${p.dungTich}</span>
                                </div>
                                <h3 class="product-name">${p.tenSp}</h3>
                                <div class="product-details">
                                    <p><strong>Hoạt chất:</strong> ${p.hoatChat}</p>
                                    <p><strong>Công dụng:</strong> ${p.congDung}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            sectionsContainer.appendChild(section);
        }

        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const productName = card.getAttribute('data-id');
                const product = allProducts.find(p => p.tenSp === productName);
                if (product) openModal(product);
            });
        });
    }

    function openModal(product) {
        const modalImg = document.getElementById('modalImg');
        const modalInfo = document.getElementById('modalInfo');

        modalImg.innerHTML = `<img src="${product.hinhAnh}" alt="${product.tenSp}" onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">`;
        modalInfo.innerHTML = `
            <h2>${product.tenSp}</h2>
            <div class="info-item">
                <label>Nhóm:</label>
                <div>${product.nhom}</div>
            </div>
            <div class="info-item">
                <label>Quy cách:</label>
                <div>${product.dungTich}</div>
            </div>
            <div class="info-item">
                <label>Hoạt chất:</label>
                <div>${product.hoatChat}</div>
            </div>
            <div class="info-item">
                <label>Công dụng:</label>
                <div>${product.congDung}</div>
            </div>
            <div class="info-item">
                <label>Liều lượng & Cách dùng:</label>
                <div>${product.lieuPhun || ''}</div>
            </div>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    const closeModal = () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = allProducts.filter(p =>
            p.tenSp.toLowerCase().includes(term) ||
            (p.hoatChat && p.hoatChat.toLowerCase().includes(term)) ||
            (p.nhom && p.nhom.toLowerCase().includes(term))
        );
        renderProducts(filtered);
    });

    loadDataFromSheets();
});
