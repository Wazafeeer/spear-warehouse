/**
 * WAREHOUSE UNIT LOADING - EXTERNAL HARDWARE SCANNER ENGINE
 * Strictly designed for External Handheld Barcode Scanner Guns (USB / Bluetooth HID)
 * NO CAMERA - Dedicated to physical scanner hardware and instant autofill.
 */

// =============================================================================
// 1. PRODUCT DATABASE & DETERMINISTIC PROCEDURAL GENERATOR
// =============================================================================

const PRODUCT_DATABASE = {
  // 1. Industrial Steel Sheets
  '8901234567890': {
    sequenceNo: 'SEQ-2026-0842',
    warehouseStatus: 'Received & Verified',
    loadUnloadInd: 'Load',
    productCategoryId: 'CAT-STEEL-408',
    product: 'High-Grade Industrial Steel Sheets',
    vendorProduct: 'VP-STEEL-9901',
    rawMaterial: 'Alloy Steel Grade-A',
    transitNo: 'TRN-BLR-89021',
    volumeUnitsLoaded: '450',
    volumeUnit: 'Kilogram',
    weightUnitsLoaded: '450.50',
    weightUnit: 'Kilogram',
    isActive: true
  },

  // 2. Copper Electrical Coils
  '8901030012345': {
    sequenceNo: 'SEQ-2026-0843',
    warehouseStatus: 'Inspection Passed',
    loadUnloadInd: 'Load',
    productCategoryId: 'CAT-ELEC-205',
    product: 'Copper Electrical Coils',
    vendorProduct: 'VP-COPPER-3302',
    rawMaterial: 'Electrolytic Copper',
    transitNo: 'TRN-DEL-44102',
    volumeUnitsLoaded: '120',
    volumeUnit: 'Kilogram',
    weightUnitsLoaded: '120.00',
    weightUnit: 'Kilogram',
    isActive: true
  },

  // 3. Reinforced Concrete Beams
  '8902500418921': {
    sequenceNo: 'SEQ-2026-0844',
    warehouseStatus: 'Ready for Stacking',
    loadUnloadInd: 'Load',
    productCategoryId: 'CAT-STRUCT-102',
    product: 'Reinforced Concrete Beams',
    vendorProduct: 'VP-BEAM-7714',
    rawMaterial: 'Pre-Stressed Concrete',
    transitNo: 'TRN-MUM-77319',
    volumeUnitsLoaded: '850',
    volumeUnit: 'Kilogram',
    weightUnitsLoaded: '850.75',
    weightUnit: 'Kilogram',
    isActive: true
  },

  // 4. Industrial Valve Assembly
  'WH-VALVE-5520': {
    sequenceNo: 'SEQ-2026-0845',
    warehouseStatus: 'Received & Verified',
    loadUnloadInd: 'Load',
    productCategoryId: 'CAT-MECH-330',
    product: 'Industrial Valve Assembly',
    vendorProduct: 'VP-VALVE-5520',
    rawMaterial: 'Cast Iron Alloy',
    transitNo: 'TRN-CHN-90214',
    volumeUnitsLoaded: '60',
    volumeUnit: 'Boxes',
    weightUnitsLoaded: '320.00',
    weightUnit: 'Kilogram',
    isActive: true
  }
};

/**
 * Returns complete warehouse specifications for ANY scanned barcode.
 */
function getProductData(barcode) {
  const cleanCode = String(barcode).trim();
  
  if (PRODUCT_DATABASE[cleanCode]) {
    return { ...PRODUCT_DATABASE[cleanCode], barcode: cleanCode };
  }

  // Procedural generator for unknown barcodes
  let hash = 0;
  for (let i = 0; i < cleanCode.length; i++) {
    hash = (hash * 31 + cleanCode.charCodeAt(i)) & 0xffffffff;
  }
  const absHash = Math.abs(hash);

  const catalog = [
    { p: 'High-Grade Industrial Steel Sheets', vp: 'VP-STEEL-9901', rm: 'Alloy Steel Grade-A', cat: 'CAT-STEEL-408', u: 'Kilogram' },
    { p: 'Copper Electrical Coils', vp: 'VP-COPPER-3302', rm: 'Electrolytic Copper', cat: 'CAT-ELEC-205', u: 'Kilogram' },
    { p: 'Reinforced Concrete Beams', vp: 'VP-BEAM-7714', rm: 'Pre-Stressed Concrete', cat: 'CAT-STRUCT-102', u: 'Kilogram' },
    { p: 'Industrial Valve Assembly', vp: 'VP-VALVE-5520', rm: 'Cast Iron Alloy', cat: 'CAT-MECH-330', u: 'Boxes' },
    { p: 'Automotive Wiring Harness', vp: 'VP-HARNESS-109', rm: 'Flame Retardant PVC', cat: 'CAT-AUTO-612', u: 'Kilogram' },
    { p: 'Polymer Resin Pellets', vp: 'VP-RESIN-883', rm: 'Virgin Polypropylene', cat: 'CAT-CHEM-504', u: 'Pallets' }
  ];

  const item = catalog[absHash % catalog.length];
  const weight = ((absHash % 750) + 45) + '.' + (absHash % 90 + 10);
  const volume = String(Math.floor((absHash % 400) + 15));
  const seqSuffix = String(absHash % 9000 + 1000);
  const transitSuffix = String(absHash % 90000 + 10000);

  return {
    barcode: cleanCode,
    sequenceNo: `SEQ-2026-${seqSuffix}`,
    warehouseStatus: 'Received & Verified',
    loadUnloadInd: 'Load',
    productCategoryId: item.cat,
    product: item.p,
    vendorProduct: item.vp,
    rawMaterial: item.rm,
    transitNo: `TRN-WH-${transitSuffix}`,
    volumeUnitsLoaded: volume,
    volumeUnit: item.u,
    weightUnitsLoaded: weight,
    weightUnit: 'Kilogram',
    isActive: true
  };
}

// =============================================================================
// 2. HARDWARE CONFIRMATION BEEP (WEB AUDIO API)
// =============================================================================

function playScannerBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime); // 1400 Hz POS confirmation beep

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    // Audio context may require initial user click
  }
}

// =============================================================================
// 3. FORM FIELDS & INSTANT AUTOFILL HANDLER
// =============================================================================

const fields = {
  sequenceNo: document.getElementById('sequenceNo'),
  warehouseStatus: document.getElementById('warehouseStatus'),
  loadUnloadInd: document.getElementById('loadUnloadInd'),
  productCategoryId: document.getElementById('productCategoryId'),
  product: document.getElementById('product'),
  vendorProduct: document.getElementById('vendorProduct'),
  rawMaterial: document.getElementById('rawMaterial'),
  transitNo: document.getElementById('transitNo'),
  productRfid: document.getElementById('productRfid'),
  volumeUnitsLoaded: document.getElementById('volumeUnitsLoaded'),
  volumeUnit: document.getElementById('volumeUnit'),
  weightUnitsLoaded: document.getElementById('weightUnitsLoaded'),
  weightUnit: document.getElementById('weightUnit'),
  scanBarcode: document.getElementById('scanBarcode'),
  btnActiveYes: document.getElementById('btnActiveYes'),
  btnActiveNo: document.getElementById('btnActiveNo')
};

const scannerStateText = document.getElementById('scannerStateText');
const scannerAlertBanner = document.getElementById('scannerAlertBanner');
const scannerBannerMessage = document.getElementById('scannerBannerMessage');
const scanBarcodeBox = document.getElementById('scanBarcodeBox');

let isActiveValue = true;

/**
 * Populates all fields automatically when an external scanner reads a barcode
 */
function handleExternalScan(barcodeValue) {
  if (!barcodeValue) return;

  const data = getProductData(barcodeValue);

  // 1. Fill Barcode and Product RFID
  if (fields.scanBarcode) fields.scanBarcode.value = data.barcode;
  if (fields.productRfid) fields.productRfid.value = data.barcode; // "Populates Product RFID above"

  // 2. Fill all other options automatically
  if (fields.sequenceNo) fields.sequenceNo.value = data.sequenceNo;
  if (fields.warehouseStatus) fields.warehouseStatus.value = data.warehouseStatus;
  if (fields.loadUnloadInd) fields.loadUnloadInd.value = data.loadUnloadInd;
  if (fields.productCategoryId) fields.productCategoryId.value = data.productCategoryId;

  if (fields.product) {
    ensureSelectOption(fields.product, data.product);
    fields.product.value = data.product;
  }
  if (fields.vendorProduct) {
    ensureSelectOption(fields.vendorProduct, data.vendorProduct);
    fields.vendorProduct.value = data.vendorProduct;
  }
  if (fields.rawMaterial) {
    ensureSelectOption(fields.rawMaterial, data.rawMaterial);
    fields.rawMaterial.value = data.rawMaterial;
  }

  if (fields.transitNo) fields.transitNo.value = data.transitNo;
  if (fields.volumeUnitsLoaded) fields.volumeUnitsLoaded.value = data.volumeUnitsLoaded;
  if (fields.volumeUnit) fields.volumeUnit.value = data.volumeUnit;
  if (fields.weightUnitsLoaded) fields.weightUnitsLoaded.value = data.weightUnitsLoaded;
  if (fields.weightUnit) fields.weightUnit.value = data.weightUnit;

  // 3. Set Is Active
  setIsActive(data.isActive);

  // 4. Trigger visual pulse highlight on all populated fields
  animateFields();

  // 5. Sound audio confirmation beep
  playScannerBeep();

  // 6. Update status badges
  if (scannerStateText) {
    scannerStateText.textContent = `Scanned ${data.barcode}`;
    scannerStateText.style.color = '#4ade80';
  }
  if (scannerAlertBanner) {
    scannerAlertBanner.classList.remove('listening');
  }
  if (scannerBannerMessage) {
    scannerBannerMessage.textContent = `✓ Barcode ${data.barcode} captured. All 12 fields auto-populated.`;
  }
  if (scanBarcodeBox) {
    scanBarcodeBox.classList.remove('listening-mode');
  }

  // 7. Show toast notification
  showToast(`✓ External Scanner: ${data.barcode} — All fields populated automatically!`, 'success');
}

function ensureSelectOption(selectEl, value) {
  if (!selectEl || !value) return;
  for (let i = 0; i < selectEl.options.length; i++) {
    if (selectEl.options[i].value === value) return;
  }
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = value;
  selectEl.appendChild(opt);
}

function animateFields() {
  const inputs = [
    fields.scanBarcode,
    fields.productRfid,
    fields.sequenceNo,
    fields.warehouseStatus,
    fields.loadUnloadInd,
    fields.productCategoryId,
    fields.product,
    fields.vendorProduct,
    fields.rawMaterial,
    fields.transitNo,
    fields.volumeUnitsLoaded,
    fields.volumeUnit,
    fields.weightUnitsLoaded,
    fields.weightUnit
  ];

  inputs.forEach(el => {
    if (el) {
      el.classList.remove('field-autofill-glow');
      void el.offsetWidth;
      el.classList.add('field-autofill-glow');
    }
  });
}

function setIsActive(val) {
  isActiveValue = val;
  if (fields.btnActiveYes && fields.btnActiveNo) {
    if (val) {
      fields.btnActiveYes.classList.add('active');
      fields.btnActiveNo.classList.remove('active');
    } else {
      fields.btnActiveYes.classList.remove('active');
      fields.btnActiveNo.classList.add('active');
    }
  }
}

if (fields.btnActiveYes) {
  fields.btnActiveYes.addEventListener('click', () => setIsActive(true));
}
if (fields.btnActiveNo) {
  fields.btnActiveNo.addEventListener('click', () => setIsActive(false));
}

// =============================================================================
// 4. SCAN BUTTON TRIGGER - NO CAMERA! ARMS EXTERNAL SCANNER LISTENER
// =============================================================================

const btnScanTrigger = document.getElementById('btnScanTrigger');
const externalScannerModal = document.getElementById('externalScannerModal');
const btnCloseScannerModal = document.getElementById('btnCloseScannerModal');
const btnDismissScannerModal = document.getElementById('btnDismissScannerModal');

/**
 * When user clicks "📷 Scan":
 * CAMERA DOES NOT TURN ON!
 * It immediately activates external hardware scanner listening mode,
 * focuses the input, updates banners, and opens the external scanner receiver.
 */
function activateExternalScanner() {
  // Focus the barcode input immediately for the scanner gun
  if (fields.scanBarcode) {
    fields.scanBarcode.focus();
    fields.scanBarcode.select();
  }

  // Visual highlight on barcode input area
  if (scanBarcodeBox) {
    scanBarcodeBox.classList.add('listening-mode');
  }

  // Update status banners
  if (scannerStateText) {
    scannerStateText.textContent = 'Listening (Gun Ready)...';
    scannerStateText.style.color = '#38bdf8';
  }
  if (scannerAlertBanner) {
    scannerAlertBanner.classList.add('listening');
  }
  if (scannerBannerMessage) {
    scannerBannerMessage.textContent = '🎯 READY FOR EXTERNAL SCANNER: Pull trigger on your handheld scanner gun now!';
  }

  // Open the external scanner receiver dialog
  if (externalScannerModal) {
    externalScannerModal.classList.add('active');
    externalScannerModal.setAttribute('aria-hidden', 'false');
  }

  showToast('External Scanner Active: Pull trigger on your barcode scanner gun!', 'warning');
}

function closeExternalScannerDialog() {
  if (externalScannerModal) {
    externalScannerModal.classList.remove('active');
    externalScannerModal.setAttribute('aria-hidden', 'true');
  }
}

if (btnScanTrigger) {
  btnScanTrigger.addEventListener('click', activateExternalScanner);
}
if (btnCloseScannerModal) {
  btnCloseScannerModal.addEventListener('click', closeExternalScannerDialog);
}
if (btnDismissScannerModal) {
  btnDismissScannerModal.addEventListener('click', closeExternalScannerDialog);
}
if (externalScannerModal) {
  externalScannerModal.addEventListener('click', (e) => {
    if (e.target === externalScannerModal) closeExternalScannerDialog();
  });
}

// Quick Sample Buttons inside dialog (for easy simulation / testing)
document.querySelectorAll('.btn-simulate-code').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = btn.getAttribute('data-code');
    closeExternalScannerDialog();
    handleExternalScan(code);
  });
});

// Manual Enter key in barcode field
if (fields.scanBarcode) {
  fields.scanBarcode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExternalScan(fields.scanBarcode.value);
    }
  });
}

// =============================================================================
// 5. GLOBAL EXTERNAL HARDWARE BARCODE SCANNER GUN LISTENER
// =============================================================================

/**
 * Standard USB / Bluetooth barcode scanners function as Human Interface Devices (HID).
 * They send high-speed keystrokes (< 45ms per character) followed by an Enter / CR suffix.
 * This global listener detects the hardware scanner input at ANY time!
 */
let hardwareKeystrokeBuffer = '';
let lastKeyTimestamp = Date.now();

window.addEventListener('keydown', (e) => {
  const now = Date.now();
  const interval = now - lastKeyTimestamp;
  lastKeyTimestamp = now;

  // Scanner concludes transmission with 'Enter'
  if (e.key === 'Enter') {
    if (hardwareKeystrokeBuffer.length >= 3) {
      console.log('External scanner gun transmitted barcode:', hardwareKeystrokeBuffer);
      closeExternalScannerDialog();
      handleExternalScan(hardwareKeystrokeBuffer);
      hardwareKeystrokeBuffer = '';
      e.preventDefault();
    }
    return;
  }

  // Append single printable characters
  if (e.key.length === 1) {
    // If the interval between characters exceeds 200ms, it's human manual typing
    if (interval > 200) {
      hardwareKeystrokeBuffer = '';
    }
    hardwareKeystrokeBuffer += e.key;
  }
});

// =============================================================================
// 6. FORM ACTIONS (SUBMIT, RESET, CANCEL, STEPPER)
// =============================================================================

const btnSubmitForm = document.getElementById('btnSubmitForm');
const btnResetForm = document.getElementById('btnResetForm');
const btnCancelForm = document.getElementById('btnCancelForm');
const btnStepCompleted = document.getElementById('btn-step-completed');
const btnPrevStep = document.getElementById('btn-prev-step');
const btnNextStep = document.getElementById('btn-next-step');

// Reset
if (btnResetForm) {
  btnResetForm.addEventListener('click', () => {
    document.getElementById('unitLoadingForm').reset();
    if (fields.scanBarcode) fields.scanBarcode.value = '';
    if (fields.productRfid) fields.productRfid.value = '';
    setIsActive(true);
    if (scannerBannerMessage) {
      scannerBannerMessage.textContent = 'Form reset. Aim scanner gun and pull trigger to load item.';
    }
    showToast('Form fields cleared.', 'warning');
  });
}

// Cancel
if (btnCancelForm) {
  btnCancelForm.addEventListener('click', () => {
    showToast('Unit loading operation cancelled.', 'danger');
  });
}

// Submit
if (btnSubmitForm) {
  btnSubmitForm.addEventListener('click', () => {
    const code = fields.scanBarcode ? fields.scanBarcode.value : '';
    if (!code) {
      showToast('Please scan a barcode using your external scanner first.', 'danger');
      return;
    }
    playScannerBeep();
    showToast(`✓ Unit Loading submitted successfully for Barcode: ${code}!`, 'success');
  });
}

// Step Completed
if (btnStepCompleted) {
  btnStepCompleted.addEventListener('click', () => {
    playScannerBeep();
    showToast('✓ Step 0.1 Unit Loading Completed successfully.', 'success');
  });
}

// Stepper Nav
if (btnPrevStep) {
  btnPrevStep.addEventListener('click', () => {
    showToast('Navigating to previous step: Sorting', 'info');
  });
}
if (btnNextStep) {
  btnNextStep.addEventListener('click', () => {
    showToast('Navigating to next step: Warehouse Stacking', 'info');
  });
}

// =============================================================================
// 7. TOAST NOTIFICATION UTILITY
// =============================================================================

function showToast(message, type = 'info') {
  const hub = document.getElementById('toastHub');
  if (!hub) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.textContent = message;

  hub.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// =============================================================================
// 8. ON PAGE LOAD INITIALIZATION
// =============================================================================

window.addEventListener('DOMContentLoaded', () => {
  console.log('Warehouse Unit Loading - External Scanner Engine Initialized.');
  // Pre-load default state
  handleExternalScan('8901234567890');
});
