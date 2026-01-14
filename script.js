document.addEventListener('DOMContentLoaded', () => {
    const sectionsContainer = document.getElementById('productSections');
    const searchInput = document.getElementById('searchInput');
    const noResults = document.getElementById('noResults');
    const modal = document.getElementById('productModal');
    const closeBtn = document.querySelector('.close-btn');

    // ADMIN ELEMENTS
    const adminBtn = document.getElementById('adminBtn');
    const adminModal = document.getElementById('adminModal');
    const closeAdmin = document.querySelector('.close-admin');
    const addNewBtn = document.getElementById('addNewBtn');
    const adminProductList = document.getElementById('adminProductList');

    // FORM ELEMENTS
    const formModal = document.getElementById('formModal');
    const productForm = document.getElementById('productForm');
    const closeForm = document.querySelector('.close-form');
    const formTitle = document.getElementById('formTitle');
    const editOriginalName = document.getElementById('editOriginalName');

    // EXPORT ELEMENTS
    const exportPngBtn = document.getElementById('exportPngBtn');
    const exportTemplate = document.getElementById('exportTemplate');

    let currentModalProduct = null;

    // CẤU HÌNH GOOGLE SHEETS
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTV_GtZzTm4iDRw2HZgVArJxo_b5qbGRontZ9HHBZDJIS_e3EmycnozG2thb8dwhAJ_g7q7RPyow2ZA/pub?gid=0&single=true&output=csv';

    let sheetProducts = []; // Dữ liệu từ Google Sheets
    let localProducts = JSON.parse(localStorage.getItem('titaco_local_products') || '[]'); // Dữ liệu thêm tay
    let allProducts = []; // Tổng hợp

    /**
     * Hàm parse CSV
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
                lieuPhun: r[idx.lieuPhun] || '',
                source: 'sheet'
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

    if (geminiBtn) geminiBtn.addEventListener('click', () => geminiChat.style.display = geminiChat.style.display === 'flex' ? 'none' : 'flex');
    if (closeChat) closeChat.addEventListener('click', () => geminiChat.style.display = 'none');

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
            if (text.toLowerCase().includes('giá')) response = "Giá sản phẩm có thể thay đổi tùy số lượng. Bạn để lại SĐT mình báo giá nhé!";
            else if (text.toLowerCase().includes('thấm') || text.toLowerCase().includes('loang')) response = "SIÊU THẤM - SIÊU LOANG giúp tăng hiệu quả thuốc bảo vệ thực vật rõ rệt.";
            addMessage(response, 'bot');
        }, 800);
    }
    if (sendBtn) sendBtn.addEventListener('click', handleChat);
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChat(); });

    // HÀM QUẢN LÝ DỮ LIỆU TỔNG HỢP
    function refreshData() {
        // Gộp dữ liệu: local ưu tiên ghi đè nếu trùng tênSp
        const localNames = localProducts.map(p => p.tenSp);
        const filteredSheet = sheetProducts.filter(p => !localNames.includes(p.tenSp));
        allProducts = [...filteredSheet, ...localProducts];

        renderProducts(allProducts);
        renderAdminList();
        updateNhomDatalist();
    }

    async function loadDataFromSheets() {
        try {
            const urlWithTimestamp = `${GOOGLE_SHEET_CSV_URL}&_=${Date.now()}`;
            const response = await fetch(urlWithTimestamp);
            if (response.ok) {
                const data = await response.text();
                sheetProducts = parseCSV(data);
            }
        } catch (error) {
            console.error('Lỗi khi tải Google Sheets:', error);
        }
        refreshData();
    }

    function renderProducts(filteredProducts) {
        sectionsContainer.innerHTML = '';
        if (filteredProducts.length === 0) {
            noResults.style.display = 'block';
            return;
        }
        noResults.style.display = 'none';

        const groups = {};
        filteredProducts.forEach(product => {
            if (!groups[product.nhom]) groups[product.nhom] = [];
            groups[product.nhom].push(product);
        });

        for (const [groupName, groupItems] of Object.entries(groups)) {
            const section = document.createElement('section');
            section.className = 'category-section';
            section.innerHTML = `
                <div class="category-header">
                    <h2 class="category-title"><i class="fas fa-layer-group"></i> ${groupName} <span class="product-count">(${groupItems.length} sản phẩm)</span></h2>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="category-content"><div class="product-grid">${groupItems.map(p => `
                    <div class="product-card" data-id="${p.tenSp}">
                        <div class="product-img-container"><img src="${p.hinhAnh}" alt="${p.tenSp}" onerror="this.src='https://via.placeholder.com/300x250?text=No+Image'"></div>
                        <div class="product-info">
                            <div class="product-meta"><span class="badge">${p.dungTich}</span></div>
                            <h3 class="product-name">${p.tenSp}</h3>
                            <div class="product-details">
                                <p><strong>Hoạt chất:</strong> ${p.hoatChat}</p>
                                <p><strong>Công dụng:</strong> ${p.congDung}</p>
                            </div>
                        </div>
                    </div>`).join('')}</div></div>`;
            section.querySelector('.category-header').addEventListener('click', () => section.classList.toggle('collapsed'));
            sectionsContainer.appendChild(section);
        }

        document.querySelectorAll('.product-grid .product-card').forEach(card => {
            card.addEventListener('click', () => {
                const product = allProducts.find(p => p.tenSp === card.dataset.id);
                if (product) openModal(product);
            });
        });
    }

    function openModal(product) {
        currentModalProduct = product;
        document.getElementById('modalImg').innerHTML = `<img src="${product.hinhAnh}" onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">`;
        document.getElementById('modalInfo').innerHTML = `
            <h2>${product.tenSp}</h2>
            <div class="info-item"><label>Nhóm:</label><div>${product.nhom}</div></div>
            <div class="info-item"><label>Quy cách:</label><div>${product.dungTich}</div></div>
            <div class="info-item"><label>Hoạt chất:</label><div>${product.hoatChat}</div></div>
            <div class="info-item"><label>Công dụng:</label><div>${product.congDung}</div></div>
            <div class="info-item"><label>Liều lượng & Cách dùng:</label><div>${product.lieuPhun || ''}</div></div>`;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    const closeModal = () => { modal.style.display = 'none'; document.body.style.overflow = 'auto'; };
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // LOGIC ADMIN & CRUD
    adminBtn.addEventListener('click', () => adminModal.style.display = 'flex');
    closeAdmin.addEventListener('click', () => adminModal.style.display = 'none');

    addNewBtn.addEventListener('click', () => {
        formTitle.innerText = "Thêm sản phẩm mới";
        productForm.reset();
        editOriginalName.value = "";
        formModal.style.display = 'flex';
    });

    closeForm.addEventListener('click', () => formModal.style.display = 'none');

    function renderAdminList() {
        adminProductList.innerHTML = allProducts.map(p => `
            <tr>
                <td><img src="${p.hinhAnh}" class="admin-img-preview" onerror="this.src='https://via.placeholder.com/50x50'"></td>
                <td><strong>${p.tenSp}</strong><br><small>${p.source === 'sheet' ? '(Google Sheet)' : '(Đã thêm trực tiếp)'}</small></td>
                <td>${p.nhom}</td>
                <td>${p.dungTich}</td>
                <td>
                    <button class="btn-edit" onclick="editProduct('${p.tenSp}')"><i class="fas fa-edit"></i> Sửa</button>
                    ${p.source !== 'sheet' ? `<button class="btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="deleteProduct('${p.tenSp}')"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `).join('');
    }

    window.editProduct = (name) => {
        const p = allProducts.find(x => x.tenSp === name);
        if (!p) return;
        formTitle.innerText = "Chỉnh sửa sản phẩm";
        editOriginalName.value = p.tenSp;
        document.getElementById('formTenSp').value = p.tenSp;
        document.getElementById('formNhom').value = p.nhom;
        document.getElementById('formHoatChat').value = p.hoatChat;
        document.getElementById('formDungTich').value = p.dungTich;
        document.getElementById('formHinhAnh').value = p.hinhAnh;
        document.getElementById('formCongDung').value = p.congDung;
        document.getElementById('formLieuPhun').value = p.lieuPhun || "";
        formModal.style.display = 'flex';
    };

    window.deleteProduct = (name) => {
        if (confirm(`Bạn có chắc muốn xóa sản phẩm "${name}"?`)) {
            localProducts = localProducts.filter(p => p.tenSp !== name);
            localStorage.setItem('titaco_local_products', JSON.stringify(localProducts));
            refreshData();
        }
    };

    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newProduct = {
            tenSp: document.getElementById('formTenSp').value,
            nhom: document.getElementById('formNhom').value,
            hoatChat: document.getElementById('formHoatChat').value,
            dungTich: document.getElementById('formDungTich').value,
            hinhAnh: document.getElementById('formHinhAnh').value,
            congDung: document.getElementById('formCongDung').value,
            lieuPhun: document.getElementById('formLieuPhun').value,
            source: 'local'
        };

        const originalName = editOriginalName.value;
        if (originalName) {
            localProducts = localProducts.filter(p => p.tenSp !== originalName);
        }
        localProducts.push(newProduct);
        localStorage.setItem('titaco_local_products', JSON.stringify(localProducts));

        formModal.style.display = 'none';
        refreshData();
    });

    function updateNhomDatalist() {
        const nhoms = [...new Set(allProducts.map(p => p.nhom))];
        document.getElementById('nhomList').innerHTML = nhoms.map(n => `<option value="${n}">`).join('');
    }

    // XUẤT ẢNH PNG
    exportPngBtn.addEventListener('click', async () => {
        if (!currentModalProduct) return;
        const p = currentModalProduct;

        // Render nội dung công dụng thành list
        const congDungLines = p.congDung.split('\n').filter(l => l.trim() !== "");
        const icons = ['fa-fire', 'fa-shield-halved', 'fa-leaf', 'fa-water', 'fa-bullseye'];

        exportTemplate.innerHTML = `
            <div class="export-header">
                <div class="export-product-name">${p.tenSp}</div>
                <div class="export-dungtich">
                    <span>Dung tích</span>
                    <div><i class="fas fa-tint"></i> ${p.dungTich}</div>
                </div>
            </div>
            <div class="export-main-body">
                <div class="export-img-card">
                    <img src="${p.hinhAnh}" onerror="this.src='https://via.placeholder.com/500x500'">
                </div>
                <div class="export-side-info">
                    <div class="export-label-small"><i class="fas fa-flask"></i> Hoạt chất chính</div>
                    <div class="export-hoatchat-text">${p.hoatChat}</div>
                </div>
            </div>
            <div class="export-congdung-box">
                <div class="export-label-small" style="color: #1b75bc; margin-bottom: 40px;">Công dụng đặc hiệu</div>
                <div class="export-congdung-list">
                    ${congDungLines.map((line, idx) => `
                        <div class="export-congdung-item">
                            <i class="fas ${icons[idx % icons.length]}"></i>
                            <span>${line}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="export-lieuluong-box">
                <i class="fas fa-bolt"></i>
                <div class="export-lieuluong-content">
                    <h4>Liều lượng khuyến nghị</h4>
                    <p>${p.lieuPhun || 'Theo hướng dẫn trên bao bì'}</p>
                </div>
            </div>
            <div class="export-footer-text">Titaco Agri Catalogue System</div>
        `;

        // Chờ ảnh load xong
        const img = exportTemplate.querySelector('img');
        if (img.complete) {
            generatePNG(p.tenSp);
        } else {
            img.onload = () => generatePNG(p.tenSp);
        }
    });

    async function generatePNG(name) {
        exportPngBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        try {
            const canvas = await html2canvas(exportTemplate, {
                useCORS: true,
                scale: 2, // Tăng chất lượng ảnh
                backgroundColor: "#ffffff"
            });
            const link = document.createElement('a');
            link.download = `Catalogue-${name}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error(err);
            alert("Lỗi khi xuất ảnh. Vui lòng thử lại!");
        }
        exportPngBtn.innerHTML = '<i class="fas fa-file-image"></i> Xuất ảnh Catalogue PNG';
    }

    // TÌM KIẾM
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = allProducts.filter(p =>
            p.tenSp.toLowerCase().includes(term) ||
            p.hoatChat.toLowerCase().includes(term) ||
            p.nhom.toLowerCase().includes(term)
        );
        renderProducts(filtered);
    });

    loadDataFromSheets();
});
