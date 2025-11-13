"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import InvoiceList from "@/components/invoices/invoice-list"
import ChatBot from "@/components/chatbot/chat-bot"
import UploadInvoice from "@/components/invoices/upload-invoice"
import ManualInvoiceCreate from "@/components/invoices/manual-invoice-create"
import { InvoiceViewer } from "@/components/invoices/invoice-viewer"

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([])
  const [vendorSearch, setVendorSearch] = useState("")
  const [viewingInvoice, setViewingInvoice] = useState<any>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push("/auth/login")
        return
      }

      setUser(user)

      // Fetch user role - select all fields to debug
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      // If profile doesn't exist, create it
      if (profileError && profileError.code === 'PGRST116') {
        console.log("Profile not found, creating...")
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            role: "vendor",
            full_name: user.email?.split("@")[0]
          })
          .select()
          .single()
        
        if (!createError) {
          profile = newProfile
        } else {
          console.error("Failed to create profile:", createError)
        }
      }

      setUserRole(profile?.role || "vendor")
      setLoading(false)
    }

    checkAuth()
  }, [router])

  // Fetch invoices when user and role are ready
  useEffect(() => {
    if (user && userRole) {
      fetchInvoices()
    }
  }, [user, userRole])

  // Separate effect for filtering
  useEffect(() => {
    // Filter invoices by vendor name
    if (vendorSearch.trim() === "") {
      setFilteredInvoices(invoices)
    } else {
      const filtered = invoices.filter((invoice) =>
        invoice.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase())
      )
      setFilteredInvoices(filtered)
    }
  }, [invoices, vendorSearch])

  const fetchInvoices = async () => {
    const supabase = createClient()
    
    // Check if user exists before querying
    if (!user) {
      console.error("User not loaded yet")
      return
    }
    
    // Vendors see only their own invoices, admins see all
    let query = supabase.from("invoices").select("*")
    
    if (userRole !== "admin") {
      // All non-admin users are vendors - show only their invoices
      query = query.eq("user_id", user.id)
    }
    
    const { data: invoicesData } = await query.order("created_at", { ascending: false })
    
    // Auto-update overdue invoices
    if (invoicesData) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const overdueUpdates = invoicesData
        .filter((invoice) => {
          const dueDate = new Date(invoice.due_date)
          dueDate.setHours(0, 0, 0, 0)
          return (
            (invoice.status === "unpaid" || invoice.status === "pending") &&
            dueDate < today
          )
        })
        .map((invoice) => invoice.id)

      if (overdueUpdates.length > 0) {
        await supabase
          .from("invoices")
          .update({ status: "overdue" })
          .in("id", overdueUpdates)
        
        // Re-fetch invoices after update
        const { data: updatedInvoices } = await supabase
          .from("invoices")
          .select("*")
          .order("created_at", { ascending: false })
        
        setInvoices(updatedInvoices || [])
      } else {
        setInvoices(invoicesData || [])
      }
    }
  }

  const handleViewInvoice = (invoice: any) => {
    setViewingInvoice(invoice)
    setIsViewDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-slate-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-50">Invoice Manager</h1>
            <span
              className={`px-3 py-1 rounded text-xs font-semibold ${
                userRole === "admin"
                  ? "bg-red-900/30 text-red-200 border border-red-800"
                  : "bg-green-900/30 text-green-200 border border-green-800"
              }`}
            >
              {userRole === "admin" ? "ADMIN" : "VENDOR"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-300">{user?.email}</span>
            
            {userRole === "admin" && (
              <Button
                variant="outline"
                onClick={() => {
                  router.push("/admin")
                }}
              >
                Admin Panel
              </Button>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push("/")
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="invoices" className="text-slate-300 data-[state=active]:text-slate-50">
              Invoices
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-slate-300 data-[state=active]:text-slate-50">
              Upload
            </TabsTrigger>
            <TabsTrigger value="create" className="text-slate-300 data-[state=active]:text-slate-50">
              Create Manually
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-slate-300 data-[state=active]:text-slate-50">
              AI Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            {/* Vendor Search Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by vendor name..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <InvoiceList invoices={filteredInvoices} onView={handleViewInvoice} />
          </TabsContent>

          <TabsContent value="upload">
            <UploadInvoice onUploadSuccess={fetchInvoices} />
          </TabsContent>

          <TabsContent value="create">
            <ManualInvoiceCreate onCreateSuccess={fetchInvoices} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatBot />
          </TabsContent>
        </Tabs>
      </main>

      {/* View Invoice Dialog */}
      {viewingInvoice && (
        <InvoiceViewer
          invoice={viewingInvoice}
          open={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
        />
      )}
    </div>
  )
}
