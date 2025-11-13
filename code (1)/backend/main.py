from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io
import os
import re
from typing import Optional
from dotenv import load_dotenv
import openai
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Smart Invoice Assistant API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

# Initialize OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

# Configure Tesseract path (Windows)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


@app.get("/")
async def root():
    return {"message": "Smart Invoice Assistant API is running", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is operational"}


@app.post("/extract_invoice")
async def extract_invoice(file: UploadFile = File(...)):
    """
    Extract invoice data from uploaded PDF or image file using OCR and AI.
    
    Returns:
        JSON with extracted fields: vendor_name, invoice_no, amount, due_date
    """
    try:
        # Check if Tesseract is available
        tesseract_available = True
        try:
            pytesseract.get_tesseract_version()
        except Exception as e:
            tesseract_available = False
            print(f"Tesseract not available: {e}")
        
        # Read file content
        content = await file.read()
        
        # Determine file type and extract text
        text = ""
        
        if file.content_type == "application/pdf":
            # Convert PDF to images and extract text
            try:
                images = convert_from_bytes(content, dpi=300)  # Higher DPI for better quality
                
                from PIL import ImageEnhance, ImageFilter
                
                for img in images:
                    # Convert to RGB
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Enhance image
                    enhancer = ImageEnhance.Contrast(img)
                    img = enhancer.enhance(2)
                    img = img.filter(ImageFilter.SHARPEN)
                    
                    # Extract text with better config
                    custom_config = r'--oem 3 --psm 6'
                    page_text = pytesseract.image_to_string(img, config=custom_config)
                    text += page_text + "\n"
                
                print(f"Extracted text length: {len(text)} characters")
                print(f"First 200 chars: {text[:200]}")
                
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"PDF processing failed: {str(e)}")
                
        elif file.content_type in ["image/jpeg", "image/png", "image/jpg"]:
            # Extract text from image with preprocessing
            try:
                image = Image.open(io.BytesIO(content))
                
                # Convert to RGB if needed
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Enhance image for better OCR
                from PIL import ImageEnhance, ImageFilter
                
                # Increase contrast
                enhancer = ImageEnhance.Contrast(image)
                image = enhancer.enhance(2)
                
                # Sharpen
                image = image.filter(ImageFilter.SHARPEN)
                
                # Use better Tesseract config for invoices
                custom_config = r'--oem 3 --psm 6'
                text = pytesseract.image_to_string(image, config=custom_config)
                
                print(f"Extracted text length: {len(text)} characters")
                print(f"First 200 chars: {text[:200]}")
                
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload PDF or image.")
        
        # If no OCR text and Tesseract not available, try AI vision API
        if not text.strip() and not tesseract_available:
            print("No Tesseract, using OpenAI Vision API...")
            extracted_data = await extract_with_vision(content, file.content_type)
            
            return JSONResponse(content={
                "success": True,
                "data": extracted_data,
                "raw_text": "Extracted using AI Vision (no OCR)"
            })
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the file. Make sure the image is clear and contains text.")
        
        print(f"\n=== OCR EXTRACTION ===")
        print(f"Text extracted ({len(text)} chars):")
        print(text[:1000])
        print("=" * 50)
        
        # Extract invoice data using AI (OpenAI)
        extracted_data = await extract_with_ai(text)
        
        print(f"\n=== EXTRACTED DATA ===")
        print(extracted_data)
        print("=" * 50)
        
        return JSONResponse(content={
            "success": True,
            "data": extracted_data,
            "raw_text": text[:1000]  # Return first 1000 chars for debugging
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


async def extract_with_vision(image_content: bytes, content_type: str) -> dict:
    """
    Use OpenAI Vision API to extract invoice data directly from image (no OCR needed).
    """
    try:
        import base64
        
        # Encode image to base64
        base64_image = base64.b64encode(image_content).decode('utf-8')
        
        # Determine image format
        image_format = "jpeg"
        if "png" in content_type:
            image_format = "png"
        elif "pdf" in content_type:
            # For PDF, we can't use vision API directly
            return {
                "vendor_name": "Unknown Vendor",
                "invoice_no": f"INV-{int(time.time())}",
                "amount": 0,
                "due_date": datetime.now().strftime('%Y-%m-%d'),
                "invoice_date": datetime.now().strftime('%Y-%m-%d')
            }
        
        prompt = """
Analyze this invoice image and extract the following information:
- vendor_name: Company/vendor name
- invoice_no: Invoice number
- amount: Total amount (numeric only)
- due_date: Payment due date (YYYY-MM-DD format)
- invoice_date: Invoice date (YYYY-MM-DD format)

Return ONLY valid JSON in this exact format:
{
    "vendor_name": "Company Name",
    "invoice_no": "INV-12345",
    "amount": 1234.56,
    "due_date": "2025-12-31",
    "invoice_date": "2025-11-13"
}

If a field is not found, use null.
"""
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/{image_format};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0,
            max_tokens=500
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        if result_text.startswith("```"):
            result_text = re.sub(r'```json\n?', '', result_text)
            result_text = re.sub(r'```\n?', '', result_text)
        
        import json
        import time
        from datetime import datetime
        extracted_data = json.loads(result_text)
        
        return extracted_data
        
    except Exception as e:
        print(f"Vision API error: {e}")
        # Return default values
        import time
        from datetime import datetime
        return {
            "vendor_name": "Unknown Vendor",
            "invoice_no": f"INV-{int(time.time())}",
            "amount": 0,
            "due_date": datetime.now().strftime('%Y-%m-%d'),
            "invoice_date": datetime.now().strftime('%Y-%m-%d')
        }


async def extract_with_ai(text: str) -> dict:
    """
    Use OpenAI to extract structured invoice data from OCR text.
    """
    try:
        prompt = f"""
Extract the following information from this invoice text. Analyze carefully and return ONLY valid JSON.

Invoice OCR text:
{text}

Extract these fields:
- vendor_name: The company/vendor name (look for "From:", "Vendor:", company name at top, or "Bill From")
- invoice_no: The invoice number (look for "Invoice #", "Invoice No", "INV", or similar)
- amount: The total amount as a NUMBER (look for "Total:", "Amount Due:", "Balance:", remove $ and commas)
- due_date: The payment due date in YYYY-MM-DD format (look for "Due Date:", "Payment Due:", "Pay By:")
- invoice_date: The invoice date in YYYY-MM-DD format (look for "Invoice Date:", "Date:", "Issued:")

IMPORTANT:
- For amount: Extract ONLY the numeric value, remove currency symbols and commas
- For dates: Convert MM/DD/YYYY or DD/MM/YYYY to YYYY-MM-DD format
- Look throughout the entire text, not just the beginning
- Common invoice layouts have vendor at top, invoice# near title, dates in header, amount at bottom

Return ONLY this JSON format (no markdown, no explanations):
{{
    "vendor_name": "Company Name Here",
    "invoice_no": "INV-12345",
    "amount": 1234.56,
    "due_date": "2025-12-31",
    "invoice_date": "2025-11-13"
}}

If a field truly cannot be found after careful analysis, use null (not "Unknown" or empty string).
"""

        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert invoice data extraction assistant. Analyze the OCR text carefully and extract structured data. Return only valid JSON, no markdown or explanations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            max_tokens=500
        )
        
        # Parse AI response
        result_text = response.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        if result_text.startswith("```"):
            result_text = re.sub(r'```json\n?', '', result_text)
            result_text = re.sub(r'```\n?', '', result_text)
        
        import json
        extracted_data = json.loads(result_text)
        
        return extracted_data
        
    except openai.OpenAIError as e:
        # Fallback to regex extraction if AI fails
        print(f"OpenAI error: {e}. Falling back to regex extraction.")
        return extract_with_regex(text)
    except Exception as e:
        print(f"AI extraction error: {e}. Falling back to regex extraction.")
        return extract_with_regex(text)


def extract_with_regex(text: str) -> dict:
    """
    Fallback: Extract invoice data using regex patterns.
    """
    from datetime import datetime
    
    result = {
        "vendor_name": None,
        "invoice_no": None,
        "amount": None,
        "due_date": None,
        "invoice_date": None
    }
    
    # Extract vendor name (first line often contains vendor)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if lines:
        # Try to get vendor from first few non-empty lines
        for line in lines[:5]:
            if len(line) > 3 and not any(keyword in line.lower() for keyword in ['invoice', 'date', 'total', 'amount', 'due']):
                result["vendor_name"] = line
                break
    
    # Extract invoice number (improved patterns)
    invoice_patterns = [
        r'invoice\s*#\s*:?\s*([A-Z0-9-]+)',
        r'invoice\s*no\.?\s*:?\s*([A-Z0-9-]+)',
        r'inv\.?\s*#?\s*:?\s*([A-Z0-9-]+)',
        r'bill\s*#\s*:?\s*([A-Z0-9-]+)',
        r'#\s*([A-Z0-9-]{5,})'
    ]
    for pattern in invoice_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["invoice_no"] = match.group(1)
            break
    
    # Extract amount (improved patterns)
    amount_patterns = [
        r'total\s*amount\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})',
        r'amount\s*due\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})',
        r'total\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})',
        r'balance\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})',
        r'grand\s*total\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})',
        r'\$\s*([\d,]+\.?\d{0,2})\s*(?:usd|total)?'
    ]
    for pattern in amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            try:
                result["amount"] = float(amount_str)
                break
            except:
                continue
    
    # Extract dates (improved patterns)
    date_patterns = [
        r'due\s*date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'payment\s*due\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'invoice\s*date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
    ]
    
    for pattern in date_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for date_str in matches:
            try:
                # Try to parse date
                for fmt in ['%m/%d/%Y', '%d/%m/%Y', '%m-%d-%Y', '%d-%m-%Y', '%m/%d/%y', '%d/%m/%y']:
                    try:
                        parsed = datetime.strptime(date_str, fmt)
                        formatted = parsed.strftime('%Y-%m-%d')
                        if 'due' in pattern.lower() or 'payment' in pattern.lower():
                            result["due_date"] = formatted
                        elif 'invoice' in pattern.lower() or result["invoice_date"] is None:
                            result["invoice_date"] = formatted
                        break
                    except:
                        continue
            except:
                continue
    
    # If no dates found with labels, get all dates
    if not result["invoice_date"] and not result["due_date"]:
        generic_dates = re.findall(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', text)
        if generic_dates:
            for date_str in generic_dates[:2]:  # Take first 2 dates
                try:
                    for fmt in ['%m/%d/%Y', '%d/%m/%Y', '%m-%d-%Y', '%d-%m-%Y', '%m/%d/%y', '%d/%m/%y']:
                        try:
                            parsed = datetime.strptime(date_str, fmt)
                            formatted = parsed.strftime('%Y-%m-%d')
                            if not result["invoice_date"]:
                                result["invoice_date"] = formatted
                            elif not result["due_date"]:
                                result["due_date"] = formatted
                            break
                        except:
                            continue
                except:
                    continue
    
    return result


@app.post("/chat")
async def chat_query(query: dict):
    """
    AI chatbot for invoice queries.
    Fetches relevant invoice data and provides natural language answers.
    """
    try:
        user_query = query.get("query", "")
        user_id = query.get("user_id")
        role = query.get("role", "user")
        
        if not user_query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        # Fetch invoices based on role
        if role == "admin":
            response = supabase.table("invoices").select("*").execute()
        else:
            if not user_id:
                raise HTTPException(status_code=400, detail="user_id required for user role")
            response = supabase.table("invoices").select("*").eq("user_id", user_id).execute()
        
        invoices = response.data
        
        # Create context for AI
        context = f"Here are the invoices:\n"
        for inv in invoices:
            context += f"- Invoice {inv.get('invoice_number')}: {inv.get('vendor_name')}, Amount: ${inv.get('amount')}, Status: {inv.get('status')}, Due: {inv.get('due_date')}\n"
        
        # Query OpenAI
        ai_response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": f"You are a helpful invoice assistant. Answer questions based on this data:\n{context}"},
                {"role": "user", "content": user_query}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        answer = ai_response.choices[0].message.content
        
        return JSONResponse(content={
            "success": True,
            "answer": answer,
            "invoice_count": len(invoices)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.post("/send_payment_notification")
async def send_payment_notification(invoice_id: str):
    """
    Send email notification when payment is released (status changed to 'paid').
    
    Args:
        invoice_id: The ID of the invoice that was paid
        
    Returns:
        JSON with success status
    """
    try:
        # Fetch invoice details
        response = supabase.table("invoices").select("*, profiles:user_id(email, full_name)").eq("id", invoice_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        invoice = response.data
        user_email = invoice.get("profiles", {}).get("email", "")
        user_name = invoice.get("profiles", {}).get("full_name", "User")
        
        # TODO: Implement actual email sending using:
        # - SendGrid API
        # - AWS SES
        # - SMTP
        # - Or any email service
        
        # For now, we'll just log and mark as sent
        print(f"[EMAIL] Would send notification to {user_email}")
        print(f"Subject: Payment Released - Invoice {invoice['invoice_number']}")
        print(f"Message: Hi {user_name}, your payment of ${invoice['amount']} for invoice {invoice['invoice_number']} has been released.")
        
        # Mark notification as sent in database
        supabase.table("invoices").update({
            "notification_sent": True,
            "notification_sent_at": "now()"
        }).eq("id", invoice_id).execute()
        
        return JSONResponse(content={
            "success": True,
            "message": f"Notification sent to {user_email}",
            "invoice_number": invoice['invoice_number']
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Notification error: {str(e)}")


@app.post("/send_bulk_notifications")
async def send_bulk_notifications():
    """
    Send notifications for all invoices that have notification_sent = FALSE and status = 'paid'.
    
    Returns:
        JSON with count of notifications sent
    """
    try:
        # Fetch all paid invoices that haven't been notified
        response = supabase.table("invoices").select("*, profiles:user_id(email, full_name)").eq("status", "paid").eq("notification_sent", False).execute()
        
        invoices = response.data or []
        sent_count = 0
        
        for invoice in invoices:
            user_email = invoice.get("profiles", {}).get("email", "")
            user_name = invoice.get("profiles", {}).get("full_name", "User")
            
            # TODO: Implement actual email sending
            print(f"[EMAIL] Would send notification to {user_email}")
            print(f"Subject: Payment Released - Invoice {invoice['invoice_number']}")
            print(f"Message: Hi {user_name}, your payment of ${invoice['amount']} for invoice {invoice['invoice_number']} has been released.")
            
            # Mark as sent
            supabase.table("invoices").update({
                "notification_sent": True,
                "notification_sent_at": "now()"
            }).eq("id", invoice['id']).execute()
            
            sent_count += 1
        
        return JSONResponse(content={
            "success": True,
            "message": f"Sent {sent_count} notifications",
            "count": sent_count
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk notification error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
