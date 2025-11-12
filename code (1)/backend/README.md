# Smart Invoice Assistant - Backend Setup Guide

## 📋 Prerequisites

1. **Python 3.10+** installed
2. **Tesseract OCR** installed:
   - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
   - Default path: `C:\Program Files\Tesseract-OCR\tesseract.exe`
3. **Poppler** for PDF processing:
   - Windows: Download from https://github.com/oschwartz10612/poppler-windows/releases
   - Add to PATH

## 🚀 Setup Instructions

### 1. Create Virtual Environment
```powershell
cd "d:\QuantBit\code (1)\backend"
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 3. Configure Environment
```powershell
copy .env.example .env
# Edit .env and add your API keys
```

### 4. Run the Server
```powershell
python main.py
# Or use uvicorn directly:
uvicorn main:app --reload --port 8000
```

## 📡 API Endpoints

### Health Check
```
GET http://localhost:8000/health
```

### Extract Invoice
```
POST http://localhost:8000/extract_invoice
Content-Type: multipart/form-data
Body: file (PDF or Image)

Response:
{
  "success": true,
  "data": {
    "vendor_name": "Acme Corp",
    "invoice_no": "INV-12345",
    "amount": 5600.00,
    "due_date": "2025-11-20",
    "invoice_date": "2025-11-01"
  }
}
```

### Chat Query
```
POST http://localhost:8000/chat
Content-Type: application/json
Body:
{
  "query": "What are my unpaid invoices?",
  "user_id": "uuid-here",
  "role": "user"
}

Response:
{
  "success": true,
  "answer": "You have 3 unpaid invoices...",
  "invoice_count": 5
}
```

## 🔧 Troubleshooting

### Tesseract Not Found
```python
# In main.py, uncomment and set:
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### PDF Conversion Error
Make sure Poppler is installed and in PATH.

### OpenAI API Error
Check your API key is valid and has credits.

## ✅ Testing

```powershell
# Test with curl
curl http://localhost:8000/health

# Test file upload (PowerShell)
$file = Get-Item "path\to\invoice.pdf"
Invoke-RestMethod -Uri "http://localhost:8000/extract_invoice" -Method Post -Form @{file=$file}
```
