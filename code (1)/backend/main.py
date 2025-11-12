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
# Uncomment and set path if needed:
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


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
        # Read file content
        content = await file.read()
        
        # Determine file type and extract text
        text = ""
        
        if file.content_type == "application/pdf":
            # Convert PDF to images and extract text
            try:
                images = convert_from_bytes(content)
                for img in images:
                    text += pytesseract.image_to_string(img) + "\n"
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"PDF processing failed: {str(e)}")
                
        elif file.content_type in ["image/jpeg", "image/png", "image/jpg"]:
            # Extract text from image
            try:
                image = Image.open(io.BytesIO(content))
                text = pytesseract.image_to_string(image)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload PDF or image.")
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the file")
        
        # Extract invoice data using AI (OpenAI)
        extracted_data = await extract_with_ai(text)
        
        return JSONResponse(content={
            "success": True,
            "data": extracted_data,
            "raw_text": text[:500]  # Return first 500 chars for debugging
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


async def extract_with_ai(text: str) -> dict:
    """
    Use OpenAI to extract structured invoice data from OCR text.
    """
    try:
        prompt = f"""
Extract the following information from this invoice text. Return ONLY valid JSON.

Invoice text:
{text}

Extract these fields:
- vendor_name: The company/vendor name
- invoice_no: The invoice number
- amount: The total amount (numeric only, no currency symbols)
- due_date: The due date in YYYY-MM-DD format
- invoice_date: The invoice date in YYYY-MM-DD format

Return JSON format:
{{
    "vendor_name": "...",
    "invoice_no": "...",
    "amount": 0.00,
    "due_date": "YYYY-MM-DD",
    "invoice_date": "YYYY-MM-DD"
}}

If a field cannot be found, use null.
"""

        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an invoice data extraction assistant. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
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
    result = {
        "vendor_name": None,
        "invoice_no": None,
        "amount": None,
        "due_date": None,
        "invoice_date": None
    }
    
    # Extract invoice number (common patterns)
    invoice_patterns = [
        r'invoice\s*#?\s*:?\s*([A-Z0-9-]+)',
        r'inv\s*#?\s*:?\s*([A-Z0-9-]+)',
        r'bill\s*#?\s*:?\s*([A-Z0-9-]+)'
    ]
    for pattern in invoice_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["invoice_no"] = match.group(1)
            break
    
    # Extract amount (common patterns)
    amount_patterns = [
        r'total\s*:?\s*\$?\s*([\d,]+\.?\d*)',
        r'amount\s*:?\s*\$?\s*([\d,]+\.?\d*)',
        r'due\s*:?\s*\$?\s*([\d,]+\.?\d*)'
    ]
    for pattern in amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["amount"] = float(match.group(1).replace(',', ''))
            break
    
    # Extract dates
    date_pattern = r'\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}'
    dates = re.findall(date_pattern, text)
    if dates:
        result["invoice_date"] = dates[0] if len(dates) > 0 else None
        result["due_date"] = dates[1] if len(dates) > 1 else dates[0]
    
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
