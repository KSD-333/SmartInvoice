"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search, FileText, Upload, PenSquare, MessageSquare, Building2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import InvoiceList from "@/components/invoices/invoice-list"
import ChatBot from "@/components/chatbot/chat-bot"
import UploadInvoice from "@/components/invoices/upload-invoice"
import ManualInvoiceCreate from "@/components/invoices/manual-invoice-create"
import { InvoiceViewer } from "@/components/invoices/invoice-viewer"
import VendorHeader from "@/components/vendor/vendor-header"
import DashboardStats from "@/components/vendor/dashboard-stats"
import VendorCompanies from "@/components/vendor/vendor-companies"

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([])
  const [vendorSearch, setVendorSearch] = useState("")
  const [viewingInvoice, setViewingInvoice] = useState<any>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>("all")
  const router = useRouter()
  const searchParams = useSearchParams()

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
      fetchUnreadNotifications()
      if (userRole === "vendor") {
        fetchCompanies()
      }
    }
  }, [user, userRole])

  // Check for company filter in URL
  useEffect(() => {
    const companyId = searchParams?.get("company")
    if (companyId) {
      setSelectedCompany(companyId)
    }
  }, [searchParams])

  // Separate effect for filtering
  useEffect(() => {
    let filtered = invoices

    // Filter by company
    if (selectedCompany !== "all") {
      filtered = filtered.filter((invoice) => invoice.company_id === selectedCompany)
    }

    // Filter by vendor name
    if (vendorSearch.trim() !== "") {
      filtered = filtered.filter((invoice) =>
        invoice.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase())
      )
    }

    setFilteredInvoices(filtered)
  }, [invoices, vendorSearch, selectedCompany])

  const fetchInvoices = async () => {
    const supabase = createClient()
    
    // Check if user exists before querying
    if (!user) {
      console.error("User not loaded yet")
      return
    }
    
    // Vendors see only their own invoices, admins see all
    // Fetch invoices with latest comment
    let query = supabase
      .from("invoices")
      .select(`
        *,
        invoice_comments!inner(
          comment,
          created_at,
          user_id
        )
      `)
    
    if (userRole !== "admin") {
      // All non-admin users are vendors - show only their invoices
      query = query.eq("user_id", user.id)
    }
    
    const { data: invoicesWithComments } = await query.order("created_at", { ascending: false })
    
    // Also fetch invoices without comments
    let queryWithoutComments = supabase.from("invoices").select("*")
    if (userRole !== "admin") {
      queryWithoutComments = queryWithoutComments.eq("user_id", user.id)
    }
    const { data: invoicesWithoutComments } = await queryWithoutComments.order("created_at", { ascending: false })
    
    // Merge and deduplicate
    const invoiceMap = new Map()
    
    // Add invoices without comments first
    invoicesWithoutComments?.forEach(inv => {
      invoiceMap.set(inv.id, { ...inv, latest_comment: null })
    })
    
    // Update with invoices that have comments (get latest comment)
    invoicesWithComments?.forEach(inv => {
      const comments = Array.isArray(inv.invoice_comments) ? inv.invoice_comments : [inv.invoice_comments]
      const latestComment = comments.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      
      invoiceMap.set(inv.id, {
        ...inv,
        invoice_comments: undefined, // Remove the nested array
        latest_comment: latestComment
      })
    })
    
    const invoicesData = Array.from(invoiceMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    
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

  const fetchCompanies = async () => {
    const supabase = createClient()
    if (!user) return

    const { data: relationships } = await supabase
      .from("vendor_company_relationships")
      .select(`
        company_id,
        companies (
          id,
          name
        )
      `)
      .eq("vendor_id", user.id)
      .eq("status", "approved")

    if (relationships) {
      const companiesList = relationships
        .map((rel: any) => rel.companies)
        .filter(Boolean)
      setCompanies(companiesList)
    }
  }

  const fetchUnreadNotifications = async () => {
    if (!user) return
    const supabase = createClient()
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)
    
    setUnreadNotifications(count || 0)
  }

  const handleViewInvoice = (invoice: any) => {
    router.push(`/dashboard/invoices/${invoice.id}`)
  }

  const handleNotificationsClick = () => {
    router.push("/dashboard/notifications")
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
      {/* Enhanced Header */}
      <VendorHeader 
        user={user} 
        unreadCount={unreadNotifications}
        onNotificationsClick={handleNotificationsClick}
      />

      {userRole === "admin" && (
        <div className="bg-gradient-to-r from-red-900/20 to-red-800/10 border-b border-red-800/30">
          <div className="container mx-auto px-4 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-200">
                🔑 You have admin privileges
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/admin")}
                className="border-red-600 text-red-400 hover:bg-red-900/20"
              >
                Go to Admin Panel
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 lg:px-8 py-8">
        {/* Dashboard Stats */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-50 mb-4">Dashboard Overview</h2>
          <DashboardStats invoices={invoices} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700 p-1">
            <TabsTrigger 
              value="invoices" 
              className="text-slate-300 data-[state=active]:text-slate-50 data-[state=active]:bg-slate-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              My Invoices
            </TabsTrigger>
            {userRole === "vendor" && (
              <TabsTrigger 
                value="companies" 
                className="text-slate-300 data-[state=active]:text-slate-50 data-[state=active]:bg-slate-700"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Companies
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="upload" 
              className="text-slate-300 data-[state=active]:text-slate-50 data-[state=active]:bg-slate-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Send Invoice
            </TabsTrigger>
            <TabsTrigger 
              value="create" 
              className="text-slate-300 data-[state=active]:text-slate-50 data-[state=active]:bg-slate-700"
            >
              <PenSquare className="h-4 w-4 mr-2" />
              Create Manually
            </TabsTrigger>
            <TabsTrigger 
              value="chat" 
              className="text-slate-300 data-[state=active]:text-slate-50 data-[state=active]:bg-slate-700"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              AI Assistant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">
                {selectedCompany === "all" ? "All Invoices" : "Filtered Invoices"} ({filteredInvoices.length})
              </h3>
              <div className="flex items-center gap-3">
                {/* Company Filter (Vendors only) */}
                {userRole === "vendor" && companies.length > 0 && (
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger className="w-48 bg-slate-800 border-slate-600 text-slate-200">
                      <SelectValue placeholder="Filter by company" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="all" className="text-slate-200">All Companies</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id} className="text-slate-200">
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {/* Vendor Search Bar */}
                <div className="relative w-72">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by vendor name..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>
            <InvoiceList invoices={filteredInvoices} onView={handleViewInvoice} />
          </TabsContent>

          {userRole === "vendor" && (
            <TabsContent value="companies" className="space-y-4">
              <VendorCompanies />
            </TabsContent>
          )}

          <TabsContent value="upload" className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">Send Invoice to Company</h3>
              <p className="text-sm text-slate-400">
                Upload invoice to a company you supply to - AI will extract details automatically
              </p>
            </div>
            <UploadInvoice onUploadSuccess={fetchInvoices} />
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">Create Invoice Manually</h3>
              <p className="text-sm text-slate-400">
                Enter invoice details manually without uploading a file
              </p>
            </div>
            <ManualInvoiceCreate onCreateSuccess={fetchInvoices} />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">AI Assistant</h3>
              <p className="text-sm text-slate-400">
                Ask questions about your invoices and get instant answers
              </p>
            </div>
            <ChatBot />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
