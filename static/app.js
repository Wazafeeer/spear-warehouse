/**
 * Spear Stream Z - Python Edition Frontend Logic
 * Communicates with Python Flask Backend & SQLite Database
 */

// App State
const state = {
  activeTab: 'scanner',       // 'scanner' | 'catalog' | 'history'
  activeScanMode: 'camera',   // 'camera' | 'qr_external' | 'barcode_external' | 'rfid'
  products: [],
  history: [],
  cameraScanner: null,
  isCameraRunning: false,
  availableCameras: [],
  selectedCameraId: null,
  externalBuffer: '',
  lastKeyTime: 0
};

// ==========================================
// 1. AUDIO & HAPTIC FEEDBACK (Web Audio API)
// ==========================================

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(type = 'success') {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'success') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1800, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.16);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.16);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.25);
  }

  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(type === 'success' ? [70, 40, 70] : [200]);
    } catch (e) {}
  }
}

// ==========================================
// 2. FETCH FROM PYTHON BACKEND
// ==========================================

async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    state.products = await res.json();
    renderCatalog();
  } catch (err) {
    console.error('Failed to fetch products:', err);
  }
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/transactions');
    state.history = await res.json();
    renderHistory();
  } catch (err) {
    console.error('Failed to fetch history:', err);
  }
}

// ==========================================
// 3. SCAN PROCESSING (CALLS PYTHON /api/scan)
// ==========================================

async function processScannedCode(rawCode, sourceMode) {
  const cleanCode = rawCode.trim();
  if (!cleanCode) return;

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode, source: sourceMode })
    });
    const data = await res.json();

    playBeep(data.found ? 'success' : 'warning');
    populateForm(cleanCode, data.product || null, sourceMode);

    if (data.found) {
      showToast(`Scanned: ${data.product.name} (${data.product.sku})`, 'success');
    } else {
      showToast(`Unregistered Code: "${cleanCode}"`, 'warning');
    }
  } catch (e) {
    console.error('Scan error:', e);
  }
}

function populateForm(code, product, sourceMode) {
  const form = document.getElementById('scanned-product-form');
  if (!form) return;

  const modeLabels = {
    'camera': 'Option 1: Camera Scanner',
    'qr_external': 'Option 2: External QR Scanner',
    'barcode_external': 'Option 3: External Barcode Scanner',
    'rfid': 'Option 4: RFID Reader'
  };

  const banner = document.getElementById('scan-match-banner');
  const bannerText = document.getElementById('banner-content-text');

  if (product) {
    banner.className = 'matched-banner';
    bannerText.innerHTML = `<strong>Matched in Python SQLite:</strong> ${escapeHtml(product.name)} <span class="brand-badge">${escapeHtml(product.sku)}</span>`;
  } else {
    banner.className = 'matched-banner unmatched';
    bannerText.innerHTML = `<strong>Unregistered Code:</strong> "${escapeHtml(code)}" &mdash; You can fill details below to register into SQLite.`;
  }

  setFieldValue('form-scan-source', modeLabels[sourceMode] || sourceMode);
  setFieldValue('form-timestamp', new Date().toLocaleString());
  setFieldValue('form-sku', product ? product.sku : code);
  setFieldValue('form-name', product ? product.name : '');
  setFieldValue('form-category', product ? product.category : '');
  setFieldValue('form-shelf', product ? product.shelf : '');
  setFieldValue('form-price', product ? product.price : '');
  setFieldValue('form-stock', product ? product.stock : '');
  setFieldValue('form-rfid', product ? product.rfid : (sourceMode === 'rfid' ? code : ''));
  setFieldValue('form-desc', product ? product.description : '');

  // Animation pulse
  ['form-sku', 'form-name', 'form-category', 'form-shelf', 'form-price', 'form-stock', 'form-rfid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('highlight-pulse');
      void el.offsetWidth;
      el.classList.add('highlight-pulse');
    }
  });

  if (window.innerWidth < 1024) {
    document.getElementById('product-form-card').scrollIntoView({ behavior: 'smooth' });
  }
}

function setFieldValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== undefined && val !== null ? val : '';
}

// ==========================================
// 4. SCAN OPTIONS & VIEWS
// ==========================================

function setupOptionSelector() {
  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      setScanMode(card.dataset.mode);
    });
  });

  document.querySelectorAll('.wedge-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value.trim();
        if (val) {
          processScannedCode(val, state.activeScanMode);
          input.value = '';
        }
      }
    });
  });
}

function setScanMode(mode) {
  state.activeScanMode = mode;

  document.querySelectorAll('.option-card').forEach(card => {
    card.classList.toggle('active', card.dataset.mode === mode);
  });

  const cameraView = document.getElementById('camera-scanner-view');
  const externalQrView = document.getElementById('external-qr-view');
  const externalBarcodeView = document.getElementById('external-barcode-view');
  const externalRfidView = document.getElementById('external-rfid-view');

  cameraView.style.display = 'none';
  externalQrView.style.display = 'none';
  externalBarcodeView.style.display = 'none';
  externalRfidView.style.display = 'none';

  if (mode !== 'camera' && state.isCameraRunning) {
    stopCamera();
  }

  if (mode === 'camera') {
    cameraView.style.display = 'flex';
    startCamera();
  } else if (mode === 'qr_external') {
    externalQrView.style.display = 'flex';
    focusWedge('qr-wedge-input');
  } else if (mode === 'barcode_external') {
    externalBarcodeView.style.display = 'flex';
    focusWedge('barcode-wedge-input');
  } else if (mode === 'rfid') {
    externalRfidView.style.display = 'flex';
    focusWedge('rfid-wedge-input');
  }

  const modeNames = {
    'camera': 'Option 1: Device Camera Scanner',
    'qr_external': 'Option 2: External QR Scanner (Gobbler / 2D USB)',
    'barcode_external': 'Option 3: External Barcode Scanner (Gobbler / 1D USB)',
    'rfid': 'Option 4: External RFID Reader / NFC'
  };
  const badge = document.getElementById('current-mode-badge');
  if (badge) badge.textContent = modeNames[mode] || mode;
}

function focusWedge(id) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.focus();
  }, 100);
}

// ==========================================
// 5. CAMERA SCANNER (Html5Qrcode)
// ==========================================

async function refreshCameraList() {
  const select = document.getElementById('camera-select');
  if (!select) return;
  try {
    const devices = await Html5Qrcode.getCameras();
    if (devices && devices.length > 0) {
      select.innerHTML = '';
      devices.forEach((cam, idx) => {
        const opt = document.createElement('option');
        opt.value = cam.id;
        opt.textContent = cam.label || `Camera ${idx + 1}`;
        select.appendChild(opt);
      });
      if (state.selectedCameraId) select.value = state.selectedCameraId;
    }
  } catch (e) {
    // Silent fail if cameras cannot be listed yet
  }
}

async function initCamera() {
  const select = document.getElementById('camera-select');
  if (!select) return;

  try {
    const devices = await Html5Qrcode.getCameras();
    state.availableCameras = devices || [];
    select.innerHTML = '';

    if (devices && devices.length > 0) {
      devices.forEach((cam, idx) => {
        const opt = document.createElement('option');
        opt.value = cam.id;
        opt.textContent = cam.label || `Camera ${idx + 1}`;
        select.appendChild(opt);
      });
      const backCam = devices.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear') || c.label.toLowerCase().includes('environment'));
      state.selectedCameraId = backCam ? backCam.id : devices[0].id;
      select.value = state.selectedCameraId;
    } else {
      select.innerHTML = '<option value="">Default Rear Camera</option>';
    }
  } catch (e) {
    select.innerHTML = '<option value="">Default Rear Camera</option>';
  }

  select.addEventListener('change', () => {
    state.selectedCameraId = select.value;
    if (state.isCameraRunning) {
      stopCamera().then(() => startCamera());
    }
  });
}

async function startCamera() {
  if (state.isCameraRunning) return;

  const readerElement = document.getElementById('camera-reader');
  const statusText = document.getElementById('camera-status-text');
  const toggleBtn = document.getElementById('toggle-camera-btn');

  if (!readerElement) return;

  if (statusText) statusText.innerHTML = '<span style="color: var(--accent-cyan);">⏳ Opening camera... Please tap "Allow" if prompted.</span>';

  // Ensure clean reader container
  readerElement.innerHTML = '';

  if (!state.cameraScanner) {
    state.cameraScanner = new Html5Qrcode("camera-reader", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A
      ],
      verbose: false
    });
  }

  let cameraConfig = state.selectedCameraId;
  if (!cameraConfig || cameraConfig === "") {
    cameraConfig = { facingMode: "environment" };
  }

  try {
    await state.cameraScanner.start(
      cameraConfig,
      { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      (decodedText) => {
        handleCameraScan(decodedText);
      },
      () => {}
    );
    state.isCameraRunning = true;
    if (statusText) statusText.innerHTML = '<span style="color: var(--accent-green);">🟢 Camera Active &mdash; Point at any QR / Barcode</span>';
    if (toggleBtn) toggleBtn.textContent = "Stop Camera";
    refreshCameraList();
  } catch (err) {
    console.warn("Rear camera start failed, attempting user-facing camera...", err);
    try {
      await state.cameraScanner.start(
        { facingMode: "user" },
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          handleCameraScan(decodedText);
        },
        () => {}
      );
      state.isCameraRunning = true;
      if (statusText) statusText.innerHTML = '<span style="color: var(--accent-green);">🟢 Camera Active &mdash; Point at any QR / Barcode</span>';
      if (toggleBtn) toggleBtn.textContent = "Stop Camera";
      refreshCameraList();
    } catch (fallbackErr) {
      console.error("Camera completely blocked or requires gesture:", fallbackErr);
      state.isCameraRunning = false;
      if (toggleBtn) toggleBtn.textContent = "Start Camera";

      readerElement.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 220px; padding: 1.5rem; text-align: center; background: #0b1120; border-radius: 8px;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📷</div>
          <p style="font-size: 0.95rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.25rem;">Camera Permission Needed</p>
          <p style="font-size: 0.78rem; color: #94a3b8; margin-bottom: 1rem; max-width: 280px; line-height: 1.4;">
            Tap the button below and tap <strong>"Allow"</strong> when your mobile browser prompts for camera access.
          </p>
          <button class="btn btn-primary btn-sm" id="btn-manual-camera-grant" style="padding: 0.65rem 1.25rem; font-size: 0.9rem; cursor: pointer;">
            📷 Tap to Turn On Camera
          </button>
        </div>
      `;

      const manualBtn = document.getElementById('btn-manual-camera-grant');
      if (manualBtn) {
        manualBtn.addEventListener('click', () => {
          readerElement.innerHTML = '';
          state.cameraScanner = null;
          startCamera();
        });
      }

      if (statusText) {
        statusText.innerHTML = '<span style="color: var(--accent-amber);">⚠️ Tap the button above to grant camera permission</span>';
      }
    }
  }
}

async function stopCamera() {
  if (state.cameraScanner && state.isCameraRunning) {
    try {
      await state.cameraScanner.stop();
      state.isCameraRunning = false;
      const statusText = document.getElementById('camera-status-text');
      if (statusText) statusText.textContent = "Camera paused";
      const toggleBtn = document.getElementById('toggle-camera-btn');
      if (toggleBtn) toggleBtn.textContent = "Start Camera";
    } catch (e) {}
  }
}

let lastScanTime = 0;
let lastCode = '';

function handleCameraScan(text) {
  const now = Date.now();
  if (text === lastCode && (now - lastScanTime) < 2000) return;
  lastScanTime = now;
  lastCode = text;
  processScannedCode(text, 'camera');
}

// ==========================================
// 6. HARDWARE SCANNER KEYBOARD WEDGE LISTENER
// ==========================================

function setupHardwareListener() {
  window.addEventListener('keydown', (e) => {
    const targetTag = e.target.tagName.toLowerCase();
    const isWedge = e.target.classList.contains('wedge-input');
    const isNormalInput = (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') && !isWedge;

    if (isNormalInput) return;

    const currentTime = Date.now();
    if (currentTime - state.lastKeyTime > 250) {
      state.externalBuffer = '';
    }
    state.lastKeyTime = currentTime;

    if (e.key === 'Enter') {
      if (state.externalBuffer.length >= 2) {
        e.preventDefault();
        const code = state.externalBuffer.trim();
        state.externalBuffer = '';
        processScannedCode(code, state.activeScanMode);
      }
    } else if (e.key.length === 1) {
      state.externalBuffer += e.key;
    }
  });
}

// ==========================================
// 7. FORM SUBMISSION (SAVES TO PYTHON SQLITE)
// ==========================================

function setupForm() {
  const form = document.getElementById('scanned-product-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      sku: document.getElementById('form-sku').value.trim(),
      name: document.getElementById('form-name').value.trim(),
      shelf: document.getElementById('form-shelf').value.trim(),
      category: document.getElementById('form-category').value.trim(),
      price: parseFloat(document.getElementById('form-price').value) || 0.0,
      action: document.getElementById('form-action-type').value,
      quantity: parseInt(document.getElementById('form-quantity-action').value) || 1,
      operator: document.getElementById('form-operator').value.trim() || 'Worker-01',
      notes: document.getElementById('form-notes').value.trim(),
      source: document.getElementById('form-scan-source').value || state.activeScanMode
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        playBeep('success');
        showToast(`Saved to Python SQLite: ${payload.action} (${payload.quantity} units)`, 'success');
        document.getElementById('form-stock').value = data.new_stock;
        fetchProducts();
        fetchHistory();
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  });

  document.getElementById('btn-clear-form').addEventListener('click', () => {
    form.reset();
    document.getElementById('form-timestamp').value = new Date().toLocaleString();
    const banner = document.getElementById('scan-match-banner');
    banner.className = 'matched-banner';
    document.getElementById('banner-content-text').innerHTML = `<em>Ready for scan. Select an option on the left.</em>`;
  });
}

// ==========================================
// 8. PRODUCT CATALOG (PYTHON-GENERATED CODES)
// ==========================================

function renderCatalog() {
  const container = document.getElementById('catalog-cards-container');
  if (!container) return;

  container.innerHTML = '';

  state.products.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'product-item-card';

    // The QR code and Barcode images are served directly by Python endpoints:
    // /api/qrcode/<sku> and /api/barcode/<sku>
    card.innerHTML = `
      <div class="product-item-top">
        <div>
          <h3 class="product-item-title">${escapeHtml(prod.name)}</h3>
          <span class="product-item-sku">${escapeHtml(prod.sku)}</span>
        </div>
        <span class="brand-badge">${escapeHtml(prod.category || 'General')}</span>
      </div>

      <div class="product-item-meta">
        <div class="meta-row">
          <span class="meta-label">Shelf Location</span>
          <span class="meta-value">${escapeHtml(prod.shelf || 'N/A')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Stock / Price</span>
          <span class="meta-value">${prod.stock} units &bull; $${Number(prod.price).toFixed(2)}</span>
        </div>
        <div class="meta-row col-span-2" style="grid-column: 1 / -1;">
          <span class="meta-label">RFID UID</span>
          <span class="meta-value" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-cyan);">${escapeHtml(prod.rfid || 'None')}</span>
        </div>
      </div>

      <!-- Python Generated Codes -->
      <div class="codes-preview-box">
        <div class="qr-preview-wrapper">
          <img src="/api/qrcode/${encodeURIComponent(prod.sku)}" alt="QR Code" style="width: 85px; height: 85px; object-fit: contain;">
        </div>
        <div class="barcode-preview-wrapper" style="width: 100%; text-align: center;">
          <img src="/api/barcode/${encodeURIComponent(prod.sku)}" alt="Barcode" style="max-width: 100%; height: 44px; object-fit: contain;">
        </div>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: auto;">
        <button class="btn btn-outline btn-sm btn-full" onclick="openPrintModal('${prod.sku}')">
          🖨️ View / Print Label
        </button>
        <button class="btn btn-accent btn-sm" onclick="quickFill('${prod.sku}')" title="Test Auto-fill in Form">
          ⚡ Auto-Fill
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteProd('${prod.sku}')" title="Delete Product">
          🗑️
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

window.quickFill = function(sku) {
  const prod = state.products.find(p => p.sku === sku);
  if (prod) {
    switchTab('scanner');
    populateForm(prod.sku, prod, state.activeScanMode);
    playBeep('success');
  }
};

window.deleteProd = async function(sku) {
  if (confirm(`Delete product ${sku}?`)) {
    await fetch(`/api/products/${encodeURIComponent(sku)}`, { method: 'DELETE' });
    fetchProducts();
    showToast('Deleted from Python SQLite.', 'warning');
  }
};

window.openPrintModal = function(sku) {
  const prod = state.products.find(p => p.sku === sku);
  if (!prod) return;

  const modal = document.getElementById('label-print-modal');
  const printArea = document.getElementById('printable-area');

  printArea.innerHTML = `
    <div class="printable-label">
      <div style="width: 100%; border-bottom: 2px solid #000; padding-bottom: 0.5rem; display: flex; justify-content: space-between;">
        <span style="font-weight: 800; font-size: 1rem;">SPEAR STREAM Z (PYTHON)</span>
        <span class="meta-badge">${escapeHtml(prod.shelf || 'STORAGE')}</span>
      </div>

      <h2 style="font-size: 1.25rem; font-weight: 700;">${escapeHtml(prod.name)}</h2>

      <div style="display: flex; gap: 1.5rem; align-items: center; justify-content: center; margin: 0.75rem 0;">
        <img src="/api/qrcode/${encodeURIComponent(prod.sku)}" style="width: 110px; height: 110px; border: 1px solid #ccc; padding: 4px;">
        <div style="text-align: left; font-size: 0.85rem;">
          <div><strong>SKU:</strong> <span style="font-family: monospace;">${escapeHtml(prod.sku)}</span></div>
          <div><strong>Category:</strong> ${escapeHtml(prod.category || 'General')}</div>
          <div><strong>Price:</strong> $${Number(prod.price).toFixed(2)}</div>
          <div><strong>RFID:</strong> <span style="font-family: monospace; font-size: 0.75rem;">${escapeHtml(prod.rfid || 'N/A')}</span></div>
        </div>
      </div>

      <div style="width: 100%; display: flex; justify-content: center;">
        <img src="/api/barcode/${encodeURIComponent(prod.sku)}" style="max-width: 100%; height: 50px;">
      </div>
      <p style="font-size: 0.7rem; color: #555;">Generated by Python Backend &bull; Ready for Gobbler 2D or Camera Scan</p>
    </div>
  `;

  modal.classList.add('active');
};

function setupCatalog() {
  const modal = document.getElementById('new-product-modal');
  document.getElementById('btn-open-new-product-modal').addEventListener('click', () => modal.classList.add('active'));
  document.getElementById('btn-close-product-modal').addEventListener('click', () => modal.classList.remove('active'));

  document.getElementById('new-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      sku: document.getElementById('new-sku').value.trim(),
      name: document.getElementById('new-name').value.trim(),
      category: document.getElementById('new-category').value.trim() || 'General',
      shelf: document.getElementById('new-shelf').value.trim() || 'Unassigned',
      price: parseFloat(document.getElementById('new-price').value) || 0.0,
      stock: parseInt(document.getElementById('new-stock').value) || 0,
      rfid: document.getElementById('new-rfid').value.trim() || 'RFID-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
      description: document.getElementById('new-desc').value.trim()
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        modal.classList.remove('active');
        document.getElementById('new-product-form').reset();
        fetchProducts();
        playBeep('success');
        showToast(`Product "${payload.name}" saved to Python SQLite!`, 'success');
      } else {
        showToast(data.error || 'Failed to save product', 'warning');
      }
    } catch (err) {
      console.error(err);
    }
  });

  document.getElementById('btn-close-print-modal').addEventListener('click', () => {
    document.getElementById('label-print-modal').classList.remove('active');
  });

  document.getElementById('btn-execute-print').addEventListener('click', () => {
    window.print();
  });
}

// ==========================================
// 9. TRANSACTION LOG HISTORY
// ==========================================

function renderHistory() {
  const tbody = document.getElementById('history-table-body');
  const emptyState = document.getElementById('history-empty-state');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (state.history.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  state.history.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 0.75rem;">${escapeHtml(item.timestamp)}</td>
      <td><span class="brand-badge">${escapeHtml(item.source)}</span></td>
      <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">${escapeHtml(item.sku)}</td>
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td><span style="color: ${item.action.includes('In') ? 'var(--accent-green)' : item.action.includes('Out') ? 'var(--accent-rose)' : 'var(--accent-amber)'}; font-weight: 600;">${escapeHtml(item.action)}</span></td>
      <td><strong>${item.quantity}</strong></td>
      <td>${escapeHtml(item.shelf || 'N/A')}</td>
      <td>${escapeHtml(item.operator || 'Worker')}</td>
      <td style="color: var(--text-muted); font-size: 0.75rem;">${escapeHtml(item.notes || '-')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function setupHistory() {
  document.getElementById('btn-export-history').addEventListener('click', () => {
    window.location.href = '/api/export/csv';
  });
}

// ==========================================
// 10. NAVIGATION TABS
// ==========================================

function setupNavTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.getElementById('view-scanner').style.display = tabId === 'scanner' ? 'grid' : 'none';
  document.getElementById('view-catalog').style.display = tabId === 'catalog' ? 'flex' : 'none';
  document.getElementById('view-history').style.display = tabId === 'history' ? 'flex' : 'none';

  if (tabId === 'scanner' && state.activeScanMode === 'camera') {
    startCamera();
  } else if (state.isCameraRunning) {
    stopCamera();
  }

  if (tabId === 'catalog') fetchProducts();
  if (tabId === 'history') fetchHistory();
}

// ==========================================
// 11. SIMULATION BUTTONS
// ==========================================

function setupSimulations() {
  document.getElementById('btn-sim-qr').addEventListener('click', () => {
    const s = state.products[0] ? state.products[0].sku : 'SKU-DRIL-8801';
    processScannedCode(s, 'qr_external');
  });

  document.getElementById('btn-sim-barcode').addEventListener('click', () => {
    const s = state.products[1] ? state.products[1].sku : 'SKU-HLMT-4402';
    processScannedCode(s, 'barcode_external');
  });

  document.getElementById('btn-sim-rfid').addEventListener('click', () => {
    const s = state.products[0] ? state.products[0].rfid : 'RFID-E200-9901-A1';
    processScannedCode(s, 'rfid');
  });

  document.getElementById('toggle-camera-btn').addEventListener('click', () => {
    if (state.isCameraRunning) stopCamera();
    else startCamera();
  });
}

// ==========================================
// 12. UTILITIES
// ==========================================

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; max-width: 380px; width: 90%;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bgColors = { 'success': '#065f46', 'warning': '#92400e', 'info': '#1e293b' };
  const borderColors = { 'success': '#10b981', 'warning': '#f59e0b', 'info': '#38bdf8' };

  toast.style.cssText = `
    background: ${bgColors[type] || bgColors.info};
    border-left: 4px solid ${borderColors[type] || borderColors.info};
    color: #fff;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 0.85rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.25s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// 12b. MOBILE CONNECT MODAL
// ==========================================

function setupMobileModal() {
  const modal = document.getElementById('mobile-connect-modal');
  const btnOpen = document.getElementById('btn-open-mobile-modal');
  const btnClose = document.getElementById('btn-close-mobile-modal');
  const qrBox = document.getElementById('mobile-qr-code-box');
  const inputUrl = document.getElementById('mobile-url-input');
  const btnCopy = document.getElementById('btn-copy-mobile-url');

  if (!modal || !btnOpen) return;

  btnOpen.addEventListener('click', () => {
    modal.classList.add('active');
    const url = inputUrl ? inputUrl.value : window.location.origin;
    if (qrBox && typeof QRCode !== 'undefined') {
      qrBox.innerHTML = '';
      new QRCode(qrBox, {
        text: url,
        width: 150,
        height: 150,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  });

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

  if (btnCopy && inputUrl) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(inputUrl.value);
      btnCopy.textContent = '✅ Copied!';
      setTimeout(() => { btnCopy.textContent = '📋 Copy'; }, 2000);
    });
  }
}

// ==========================================
// 13. BOOTSTRAP
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  setupNavTabs();
  setupOptionSelector();
  setupHardwareListener();
  setupForm();
  setupCatalog();
  setupHistory();
  setupSimulations();
  setupMobileModal();

  const ts = document.getElementById('form-timestamp');
  if (ts) ts.value = new Date().toLocaleString();

  await initCamera();
  await fetchProducts();
  await fetchHistory();

  setScanMode('camera');
});
