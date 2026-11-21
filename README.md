# Warehouse Unit Loading - External Scanner System

A dedicated, enterprise-grade Warehouse Management Terminal designed specifically for **External Barcode Scanner Guns** (Handheld USB / Bluetooth HID scanners).

---

## ⚡ What Changed

1. **Removed the slide presentation elements**:
   - Stripped away the "06" circular slide badge, bullet points box, and decorative scanner graphic.
   - Built a clean, professional, enterprise Warehouse Management System (WMS) terminal.

2. **No Camera Activation**:
   - When you click the **`📷 Scan`** button, **the camera does NOT turn on**.
   - Instead, the system activates the **External Hardware Scanner Receiver**:
     - Highlights and arms the barcode input zone.
     - Displays live status: *"External Scanner: Listening (Gun Ready)..."*.
     - Opens the hardware scanner radar dialog.
     - Waits for the physical handheld barcode gun to transmit data.

3. **External Scanner Gun Integration**:
   - Listens for high-speed hardware keystroke bursts sent by USB or Bluetooth barcode scanner guns followed by Enter / CR.
   - Works continuously whether the dialog is open or closed — warehouse operators can simply aim their gun and scan anytime.
   - Also includes instant simulation trigger buttons inside the dialog (`8901234567890`, `8901030012345`, `8902500418921`, `WH-VALVE-5520`) for easy desk verification without a physical scanner connected.

4. **Instant Auto-Fill for All Options**:
   - When an item is scanned with the external scanner gun:
     1. Sounds a crisp 1400 Hz POS confirmation beep.
     2. Populates `Scan Barcode` with the scanned barcode.
     3. Populates `Product RFID` with the barcode ("Populates Product RFID above").
     4. **Completely and automatically fills all other 12 form fields**:
        - Sequence No
        - Warehouse Status
        - Load / Unload Ind
        - Product Category ID
        - Product
        - Vendor Product
        - Raw Material
        - Transit No
        - Volume Units Loaded
        - Volume Unit
        - Weight Units Loaded
        - Weight Unit
        - Is Active (toggled to `Yes`)
     5. Applies a green pulse glow animation across all newly populated fields.

---

## 🏃 Running the Application

### 1. View in Browser
- **PC / Laptop**: [http://localhost:3000](http://localhost:3000)
- **Local Network / Tablet**: `http://<YOUR-IP>:3000`

### 2. Standalone
You can also directly double-click [index.html](file:///c:/Users/wazafeer/Desktop/Spear%20Stream%20Z/index.html) in any browser.

### 3. Restart Server
Double-click [start.bat](file:///c:/Users/wazafeer/Desktop/Spear%20Stream%20Z/start.bat) or run `node server.js`.
