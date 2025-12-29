# 🧾 Smart Invoice Assistant

A full-stack invoice management system with AI-powered OCR extraction, role-based admin panel, and real-time analytics.

## ✨ Features

### 🎯 Core Functionality
- **AI-Powered OCR** - Extract invoice data from images/PDFs using Tesseract + OpenAI GPT
- **Smart Invoice Management** - Upload, view, edit, delete invoices with full CRUD operations
- **Role-Based Access Control** - Admin and User roles with different permissions
- **Real-time Search & Filters** - Filter by status, vendor, search across all fields
- **Excel Export** - Download filtered invoice data as Excel spreadsheet
- **Vendor Analytics** - Track invoice counts and amounts per vendor
- **Chat Assistant** - AI chatbot to query invoice data (coming soon)

### 👑 Admin Panel Features
- 📊 **Dashboard with Stats** - Total, unpaid, paid invoices with amount tracking
- 📝 **Invoice Management** - Edit, delete, filter, search all invoices
- 👥 **User Management** - Promote/demote users, view all accounts
- 📈 **Vendor Statistics** - See invoice counts and payment breakdowns per vendor
- 💾 **Bulk Export** - Export filtered data to Excel
- 🎨 **Dark Theme UI** - Professional design with Tailwind CSS

### 🔐 Security
- Supabase Authentication with email verification
- Row Level Security (RLS) policies
- Admin-only access controls
- Secure file storage with user-specific folders

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** (App Router with Turbopack)
- **React 19.2** 
- **TypeScript**
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component library
- **Supabase JS** - Authentication & Database client
- **XLSX** - Excel export
- **Sonner** - Toast notifications

### Backend
- **Python 3.12**
- **FastAPI** - REST API framework
- **Tesseract OCR** - Text extraction from images
- **OpenAI GPT-3.5** - Intelligent field extraction
- **Supabase Python Client** - Database operations
- **PDF2Image** - PDF processing

### Infrastructure
- **Supabase** - PostgreSQL database, authentication, storage
- **Vercel** - Frontend deployment (optional)
- **Railway/Render** - Backend deployment (optional)

## 📁 Project Structure

```
code (1)/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin panel page
│   ├── dashboard/         # User dashboard
│   ├── auth/              # Authentication pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── invoices/         # Invoice-specific components
│   └── chatbot/          # Chat assistant
├── backend/              # Python FastAPI backend
│   ├── main.py          # Main API server
│   ├── requirements.txt # Python dependencies
│   └── .env.example     # Environment template
├── lib/                  # Utility libraries
│   ├── supabase/        # Supabase clients
│   └── api/             # API service layer
└── scripts/             # SQL setup scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Python 3.12+
- Supabase account (free tier works)
- OpenAI API key (optional, uses regex fallback)

### 1️⃣ Clone Repository

```bash
git clone <your-repo-url>
cd "code (1)"
```

### 2️⃣ Setup Frontend

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Add your Supabase credentials to .env.local
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

### 3️⃣ Setup Database

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Run SQL scripts in order:
   - `scripts/03-fix-rls-policies.sql`
   - `scripts/04-admin-policies.sql`
   - `scripts/05-complete-schema-update.sql`
   - `scripts/06-storage-bucket-setup.sql`

### 4️⃣ Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Add your credentials to .env
# SUPABASE_URL=...
# SUPABASE_SERVICE_KEY=...
# OPENAI_API_KEY=...  # Optional
```

### 5️⃣ Run Development Servers

**Frontend (Terminal 1):**
```bash
pnpm dev
# Opens at http://localhost:3000
```

**Backend (Terminal 2):**
```bash
cd backend
.\venv\Scripts\activate
python main.py
# Opens at http://localhost:8000
```

### 6️⃣ Create Admin User

1. Sign up at http://localhost:3000/auth/sign-up
2. Verify email (check Supabase inbox)
3. In Supabase Dashboard → Table Editor → `profiles`
4. Find your user and change `role` from `user` to `admin`
5. Refresh and access http://localhost:3000/admin

## 📖 Usage Guide

### For Users
1. **Sign Up** - Create account with email verification
2. **Upload Invoices** - Upload invoice images/PDFs
3. **View Dashboard** - See your invoices with filters
4. **Chat Assistant** - Ask questions about your invoices

### For Admins
1. **Access Admin Panel** - Navigate to `/admin`
2. **Manage Invoices** - View all user invoices, edit, delete
3. **Manage Users** - Promote users to admin, view all accounts
4. **View Analytics** - See vendor statistics and payment tracking
5. **Export Data** - Download filtered invoices as Excel

### Key Features

#### Invoice Filters
- **Status**: Unpaid (default), Paid, Overdue, Pending, All
- **Vendor**: Filter by vendor name
- **Search**: Search invoice number, vendor, or user email

#### Vendor Tracking
Each vendor shows:
- Total invoice count (not duplicate entries)
- Total amount across all invoices
- Paid amount (green)
- Unpaid amount (yellow)

## 🔧 Configuration

### Frontend Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=          # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=         # Supabase service role key
NEXT_PUBLIC_BACKEND_URL=           # Backend API URL (default: http://localhost:8000)
```

### Backend Environment Variables
```env
SUPABASE_URL=                      # Your Supabase project URL
SUPABASE_SERVICE_KEY=              # Supabase service role key
OPENAI_API_KEY=                    # OpenAI API key (optional)
```

## 🗄️ Database Schema

### Tables
- **profiles** - User accounts with roles
- **invoices** - Invoice records with vendor, amount, dates, status
- **payments** - Payment tracking (future)
- **chat_messages** - Chat history (future)
- **audit_logs** - System audit trail (future)

### Storage Buckets
- **invoices** - Invoice file storage (private, 50MB limit)

## 🎨 UI Components

Built with Radix UI primitives:
- Dialogs, Dropdowns, Tabs
- Tables, Cards, Badges
- Forms, Inputs, Textareas
- Toast notifications
- Loading states

## 🧪 Development

### Install New Dependencies

**Frontend:**
```bash
pnpm add <package-name>
```

**Backend:**
```bash
.\venv\Scripts\activate
pip install <package-name>
pip freeze > requirements.txt
```

### Run Tests
```bash
# Frontend
pnpm test

# Backend
pytest
```

## 📝 API Documentation

### Backend Endpoints

#### Health Check
```
GET /
Returns: { "status": "ok", "message": "Invoice Assistant API" }
```

#### Extract Invoice (OCR + AI)
```
POST /extract_invoice
Body: multipart/form-data with 'file'
Returns: { invoice_number, vendor_name, amount, due_date, invoice_date }
```

#### Chat Assistant
```
POST /chat
Body: { "query": "...", "user_id": "...", "role": "user" }
Returns: { "response": "..." }
```

## 🚢 Deployment

### Frontend (Vercel)
1. Connect GitHub repo to Vercel
2. Add environment variables
3. Deploy

### Backend (Railway/Render)
1. Create new Python service
2. Add environment variables
3. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000
```

### Supabase RLS Errors
- Verify you ran all SQL scripts in order
- Check user role in `profiles` table
- Ensure `is_admin()` function exists

### OCR Not Working
- Install Tesseract: `choco install tesseract` (Windows)
- Verify Tesseract in PATH
- Check backend logs for errors

### Storage Bucket Not Found
- Run `scripts/06-storage-bucket-setup.sql`
- Verify bucket created in Supabase Dashboard → Storage

## 📚 Documentation

- [Admin Panel Guide](./ADMIN_PANEL_GUIDE.md) - Detailed admin features
- [Visual Layout](./ADMIN_PANEL_VISUAL.md) - UI structure reference
- [Setup Guide](./SETUP.md) - Original setup instructions
- [Project Status](./PROJECT_STATUS.md) - Development progress

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - feel free to use this project for learning or commercial purposes.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend-as-a-Service
- [Radix UI](https://www.radix-ui.com/) - Component library
- [Shadcn UI](https://ui.shadcn.com/) - UI components
- [FastAPI](https://fastapi.tiangolo.com/) - Python API framework
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - OCR engine

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review Supabase logs for database errors

---

**Built with ❤️ for efficient invoice management**
