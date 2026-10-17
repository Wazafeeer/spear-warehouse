"""
Spear Stream Z - Python-Powered Smart Warehouse Scanner & Entry System
Backend powered by Flask, SQLite3, python-barcode, and qrcode.
"""

import os
import io
import csv
import socket
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_file, Response
import qrcode
import barcode
from barcode.writer import ImageWriter

app = Flask(__name__, template_folder='templates', static_folder='static')
DB_FILE = os.path.join(os.path.dirname(__file__), 'warehouse.db')

# ==========================================
# 1. SQLITE DATABASE SETUP & INITIALIZATION
# ==========================================

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Products Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            shelf TEXT,
            price REAL DEFAULT 0.0,
            stock INTEGER DEFAULT 0,
            rfid TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Transactions Log Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            source TEXT NOT NULL,
            sku TEXT NOT NULL,
            name TEXT NOT NULL,
            action TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            shelf TEXT,
            operator TEXT,
            notes TEXT
        )
    ''')

    # Seed Initial Products if empty
    cursor.execute('SELECT COUNT(*) FROM products')
    count = cursor.fetchone()[0]
    if count == 0:
        initial_items = [
            ('SKU-DRIL-8801', 'Industrial Cordless Hammer Drill 20V', 'Power Tools', 'Aisle 3 - Bay B - Shelf 02', 189.99, 24, 'RFID-E200-9901-A1', 'High-torque brushless motor with 2x 4.0Ah Li-ion battery pack.'),
            ('SKU-HLMT-4402', 'ANSI High-Visibility Hard Hat (Yellow)', 'Safety Equipment', 'Aisle 1 - Bay A - Shelf 04', 34.50, 110, 'RFID-E200-4402-B2', 'Type 1 Class E ratchet suspension safety helmet with chin strap.'),
            ('SKU-CLPR-1093', 'Precision Digital Vernier Caliper 150mm', 'Measurement Tools', 'Aisle 2 - Bay C - Shelf 01', 49.00, 18, 'RFID-E200-1093-C3', 'Stainless steel construction, 0.01mm resolution with LCD readout.'),
            ('SKU-PLUG-7724', 'Heavy Duty Industrial Plug 32A 415V', 'Electrical', 'Aisle 4 - Bay D - Shelf 05', 16.75, 65, 'RFID-E200-7724-D4', 'IP67 waterproof 5-pin industrial male connector socket.')
        ]
        cursor.executemany('''
            INSERT INTO products (sku, name, category, shelf, price, stock, rfid, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', initial_items)
        conn.commit()

    conn.close()

# Auto-initialize database on startup (for both local and cloud Gunicorn)
init_db()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

# ==========================================
# 2. WEB ROUTES
# ==========================================

@app.route('/')
def index():
    return render_template('index.html')

# ==========================================
# 3. BARCODE & QR CODE GENERATION IN PYTHON
# ==========================================

@app.route('/api/qrcode/<sku>')
def generate_qrcode_image(sku):
    """Generates dynamic PNG QR Code for any SKU in Python"""
    img = qrcode.make(sku)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return send_file(buf, mimetype='image/png')

@app.route('/api/barcode/<sku>')
def generate_barcode_image(sku):
    """Generates dynamic PNG 1D Barcode (Code128) for any SKU in Python"""
    try:
        Code128 = barcode.get_barcode_class('code128')
        rv = io.BytesIO()
        writer = ImageWriter()
        writer.font_size = 10
        writer.text_distance = 3.0
        code = Code128(sku, writer=writer)
        code.write(rv, options={'write_text': True, 'module_height': 12.0, 'module_width': 0.28})
        rv.seek(0)
        return send_file(rv, mimetype='image/png')
    except Exception as e:
        # Fallback to simple image on format error
        img = qrcode.make(sku)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return send_file(buf, mimetype='image/png')

# ==========================================
# 4. PRODUCT CATALOG REST APIS
# ==========================================

@app.route('/api/products', methods=['GET'])
def get_products():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products ORDER BY id DESC')
    rows = cursor.fetchall()
    products = [dict(row) for row in rows]
    conn.close()
    return jsonify(products)

@app.route('/api/products', methods=['POST'])
def add_product():
    data = request.json or {}
    sku = data.get('sku', '').strip()
    name = data.get('name', '').strip()

    if not sku or not name:
        return jsonify({'error': 'SKU and Product Name are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            INSERT INTO products (sku, name, category, shelf, price, stock, rfid, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            sku,
            name,
            data.get('category', 'General'),
            data.get('shelf', 'Unassigned'),
            float(data.get('price', 0.0) or 0.0),
            int(data.get('stock', 0) or 0),
            data.get('rfid', ''),
            data.get('description', '')
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({'success': True, 'id': new_id, 'sku': sku})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': f'Product with SKU "{sku}" already exists'}), 409

@app.route('/api/products/<sku>', methods=['DELETE'])
def delete_product(sku):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM products WHERE sku = ?', (sku,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==========================================
# 5. SCAN PROCESSING & MATCHING ENGINE
# ==========================================

@app.route('/api/scan', methods=['POST'])
def process_scan():
    data = request.json or {}
    raw_code = data.get('code', '').strip()
    source_mode = data.get('source', 'camera')

    if not raw_code:
        return jsonify({'found': False, 'message': 'No code received'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Search by SKU, Barcode, or RFID UID
    cursor.execute('''
        SELECT * FROM products 
        WHERE LOWER(sku) = LOWER(?) OR LOWER(rfid) = LOWER(?) OR LOWER(name) = LOWER(?)
        LIMIT 1
    ''', (raw_code, raw_code, raw_code))
    row = cursor.fetchone()
    conn.close()

    if row:
        product = dict(row)
        return jsonify({
            'found': True,
            'code': raw_code,
            'source': source_mode,
            'product': product
        })
    else:
        return jsonify({
            'found': False,
            'code': raw_code,
            'source': source_mode,
            'message': f'Code "{raw_code}" is not registered in SQLite warehouse database'
        })

# ==========================================
# 6. TRANSACTIONS & INVENTORY LOGGING
# ==========================================

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM transactions ORDER BY id DESC')
    rows = cursor.fetchall()
    txs = [dict(row) for row in rows]
    conn.close()
    return jsonify(txs)

@app.route('/api/transactions', methods=['POST'])
def record_transaction():
    data = request.json or {}
    sku = data.get('sku', '').strip()
    name = data.get('name', '').strip()
    action = data.get('action', 'Inventory Audit / Check')
    quantity = int(data.get('quantity', 1) or 1)
    shelf = data.get('shelf', '')
    operator = data.get('operator', 'Worker-01')
    notes = data.get('notes', '')
    source = data.get('source', 'Manual Entry')
    timestamp = datetime.now().strftime('%Y-%m-%d %I:%M:%S %p')

    if not sku:
        return jsonify({'error': 'SKU is required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Record in transaction history
    cursor.execute('''
        INSERT INTO transactions (timestamp, source, sku, name, action, quantity, shelf, operator, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (timestamp, source, sku, name, action, quantity, shelf, operator, notes))

    # Update current stock level in SQLite
    cursor.execute('SELECT stock FROM products WHERE sku = ?', (sku,))
    prod = cursor.fetchone()
    new_stock = 0
    if prod:
        curr_stock = prod['stock']
        if 'In' in action:
            new_stock = curr_stock + quantity
        elif 'Out' in action:
            new_stock = max(0, curr_stock - quantity)
        else:
            new_stock = curr_stock
        cursor.execute('UPDATE products SET stock = ?, shelf = ? WHERE sku = ?', (new_stock, shelf, sku))
    else:
        # Auto-create item in SQLite if newly introduced
        new_stock = quantity if 'In' in action else 0
        cursor.execute('''
            INSERT INTO products (sku, name, shelf, stock, price, category)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (sku, name, shelf, new_stock, float(data.get('price', 0.0) or 0.0), data.get('category', 'General')))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'new_stock': new_stock,
        'timestamp': timestamp
    })

@app.route('/api/export/csv')
def export_csv():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM transactions ORDER BY id DESC')
    rows = cursor.fetchall()
    conn.close()

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['ID', 'Timestamp', 'Scan Source', 'SKU', 'Product Name', 'Action', 'Quantity', 'Shelf', 'Operator', 'Notes'])
    for r in rows:
        cw.writerow([r['id'], r['timestamp'], r['source'], r['sku'], r['name'], r['action'], r['quantity'], r['shelf'], r['operator'], r['notes']])

    output = Response(si.getvalue(), mimetype='text/csv')
    output.headers["Content-Disposition"] = f"attachment; filename=spear_warehouse_log_{int(datetime.now().timestamp())}.csv"
    return output

@app.route('/api/network-info')
def network_info():
    ip = get_local_ip()
    port = 5000
    return jsonify({
        'ip': ip,
        'port': port,
        'url': f'http://{ip}:{port}'
    })

# ==========================================
# 7. SERVER RUNNER
# ==========================================

if __name__ == '__main__':
    init_db()
    ip = get_local_ip()
    port = 5000
    print('================================================================')
    print('>> Spear Stream Z - Python (Flask + SQLite) Server Running!')
    print('================================================================')
    print(f'-- Computer Access:  http://localhost:{port}')
    print(f'-- Mobile / Wi-Fi:   http://{ip}:{port}')
    print('================================================================\n')
    app.run(host='0.0.0.0', port=port, debug=False)
