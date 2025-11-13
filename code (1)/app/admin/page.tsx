"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Download, Edit, Trash2, Search, FileText, Users, TrendingUp, Eye, Upload, Bell, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import UploadInvoice from "@/components/invoices/upload-invoice"
import AdminUploadInvoice from "@/components/invoices/admin-upload-invoice"
import AdminInvoiceCreate from "@/components/invoices/admin-invoice-create"
import { InvoiceViewer } from "@/components/invoices/invoice-viewer"

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
}

interface Invoice {
  id: string
  user_id: string
  vendor_name: string
  invoice_number: string
  amount: number
  due_date: string
  invoice_date: string
  status: string
  description: string | null
  file_url: string | null
  created_at: string
  comments: string | null
  status_history: any[] | null
  notification_sent: boolean | null
  profiles?: {
    email: string
    full_name: string
    role: string
    company_name: string | null
  }
}

interface VendorStats {
  user_id: string
  vendor_name: string
  vendor_email: string
  invoice_count: number
  total_amount: number
  paid_amount: number
  unpaid_amount: number
}

export default function AdminPanelPage() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [vendorStats, setVendorStats] = useState<VendorStats[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [userSearchTerm, setUserSearchTerm] = useState("")
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [vendorFilter, setVendorFilter] = useState("all")
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null)
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false)
  const [commentingInvoice, setCommentingInvoice] = useState<Invoice | null>(null)
  const [commentText, setCommentText] = useState("")
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [summaryStats, setSummaryStats] = useState({
    totalAmount: 0,
    collected: 0,
    remaining: 0,
    overdue: 0,
    pending: 0,
  })
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user && userRole === "admin") {
      fetchAllData()
    }
  }, [user, userRole])

  useEffect(() => {
    filterInvoices()
  }, [invoices, searchTerm, statusFilter, vendorFilter])

  useEffect(() => {
    // Filter users by email or name
    if (userSearchTerm.trim() === "") {
      setFilteredUsers(users)
    } else {
      const filtered = users.filter(
        (user) =>
          user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
          user.full_name?.toLowerCase().includes(userSearchTerm.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }, [users, userSearchTerm])

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

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    setUserRole(profile?.role || "user")

    if (profile?.role !== "admin") {
      router.push("/dashboard")
      return
    }

    setLoading(false)
  }

  const fetchAllData = async () => {
    const supabase = createClient()
    // Fetch users
    const { data: usersData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
    setUsers(usersData || [])

    // Fetch invoices with user details
    const { data: invoicesData } = await supabase
      .from("invoices")
      .select(`
        *,
        profiles:user_id (
          email,
          full_name,
          role,
          company_name
        )
      `)
      .order("created_at", { ascending: false })

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
          .select(`
            *,
            profiles:user_id (
              email,
              full_name,
              role,
              company_name
            )
          `)
          .order("created_at", { ascending: false })
        
        setInvoices(updatedInvoices || [])
        
        // Calculate vendor stats with updated data
        if (updatedInvoices) {
          const stats = calculateVendorStats(updatedInvoices)
          setVendorStats(stats)
          calculateSummaryStats(updatedInvoices)
        }
      } else {
        setInvoices(invoicesData || [])
        
        // Calculate vendor stats
        if (invoicesData) {
          const stats = calculateVendorStats(invoicesData)
          setVendorStats(stats)
          calculateSummaryStats(invoicesData)
        }
      }
    }
  }

  const calculateVendorStats = (invoices: Invoice[]): VendorStats[] => {
    const statsMap = new Map<string, VendorStats>()

    invoices.forEach((invoice) => {
      // Group by user_id to avoid duplicates
      const userId = invoice.user_id
      const vendorName = invoice.profiles?.full_name || invoice.vendor_name || "Unknown"
      const vendorEmail = invoice.profiles?.email || "N/A"
      
      if (!statsMap.has(userId)) {
        statsMap.set(userId, {
          user_id: userId,
          vendor_name: vendorName,
          vendor_email: vendorEmail,
          invoice_count: 0,
          total_amount: 0,
          paid_amount: 0,
          unpaid_amount: 0,
        })
      }

      const stats = statsMap.get(userId)!
      stats.invoice_count++
      stats.total_amount += Number(invoice.amount)

      if (invoice.status === "paid") {
        stats.paid_amount += Number(invoice.amount)
      } else {
        stats.unpaid_amount += Number(invoice.amount)
      }
    })

    return Array.from(statsMap.values()).sort((a, b) => b.total_amount - a.total_amount)
  }

  const calculateSummaryStats = (invoices: Invoice[]) => {
    const stats = {
      totalAmount: 0,
      collected: 0,
      remaining: 0,
      overdue: 0,
      pending: 0,
    }

    invoices.forEach((invoice) => {
      const amount = Number(invoice.amount) || 0
      stats.totalAmount += amount

      if (invoice.status === "paid") {
        stats.collected += amount
      } else {
        stats.remaining += amount
        
        if (invoice.status === "overdue") {
          stats.overdue += amount
        } else if (invoice.status === "pending") {
          stats.pending += amount
        }
      }
    })

    setSummaryStats(stats)
  }

  const filterInvoices = () => {
    let filtered = [...invoices]

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((inv) => inv.status === statusFilter)
    }

    // Vendor filter
    if (vendorFilter !== "all") {
      filtered = filtered.filter((inv) => inv.vendor_name === vendorFilter)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredInvoices(filtered)
  }

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId)

      if (error) throw error

      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      toast.success(`User role updated to ${newRole}`)
    } catch (error: any) {
      toast.error("Failed to update role: " + error.message)
    }
  }

  const handleQuickStatusChange = async (invoiceId: string, newStatus: string) => {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: newStatus })
        .eq("id", invoiceId)

      if (error) throw error

      await fetchAllData()
      toast.success(`Invoice status updated to ${newStatus}`)
    } catch (error: any) {
      toast.error("Failed to update status: " + error.message)
    }
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice)
    setIsViewDialogOpen(true)
  }

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    setIsEditDialogOpen(true)
  }

  const handleSaveInvoice = async () => {
    if (!editingInvoice) return

    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          vendor_name: editingInvoice.vendor_name,
          invoice_number: editingInvoice.invoice_number,
          amount: editingInvoice.amount,
          due_date: editingInvoice.due_date,
          invoice_date: editingInvoice.invoice_date,
          status: editingInvoice.status,
          description: editingInvoice.description,
          comments: editingInvoice.comments,
        })
        .eq("id", editingInvoice.id)

      if (error) throw error

      await fetchAllData()
      setIsEditDialogOpen(false)
      toast.success("Invoice updated successfully")
    } catch (error: any) {
      toast.error("Failed to update invoice: " + error.message)
    }
  }

  const handleSendNotification = async (invoice: Invoice) => {
    try {
      const supabase = createClient()
      
      // Create notification for the vendor
      const { error } = await supabase.from("notifications").insert({
        user_id: invoice.user_id,
        invoice_id: invoice.id,
        title: `Invoice ${invoice.invoice_number} Status Update`,
        message: `Your invoice status is: ${invoice.status}`,
        type: "status_change",
      })

      if (error) throw error

      toast.success("Notification sent to vendor!")
    } catch (error: any) {
      console.error("Error sending notification:", error)
      toast.error("Failed to send notification")
    }
  }

  const handleAddComment = async () => {
    if (!commentingInvoice || !commentText.trim()) {
      toast.error("Please enter a comment")
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error("Not authenticated")

      // Add comment to invoice_comments table
      const { error } = await supabase.from("invoice_comments").insert({
        invoice_id: commentingInvoice.id,
        user_id: user.id,
        comment: commentText.trim(),
      })

      if (error) throw error

      // Create notification for vendor
      await supabase.from("notifications").insert({
        user_id: commentingInvoice.user_id,
        invoice_id: commentingInvoice.id,
        title: `New Comment on Invoice ${commentingInvoice.invoice_number}`,
        message: commentText.trim().substring(0, 100),
        type: "comment",
      })

      toast.success("Comment added successfully!")
      setIsCommentDialogOpen(false)
      setCommentText("")
      setCommentingInvoice(null)
    } catch (error: any) {
      console.error("Error adding comment:", error)
      toast.error("Failed to add comment")
    }
  }

  const handleDeleteInvoice = async () => {
    if (!deletingInvoiceId) return

    const supabase = createClient()
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", deletingInvoiceId)

      if (error) throw error

      await fetchAllData()
      setIsDeleteDialogOpen(false)
      setDeletingInvoiceId(null)
      toast.success("Invoice deleted successfully")
    } catch (error: any) {
      toast.error("Failed to delete invoice: " + error.message)
    }
  }

  const handleSendNotifications = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      const response = await fetch(`${backendUrl}/send_bulk_notifications`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to send notifications")
      }

      const data = await response.json()
      toast.success(`Successfully sent ${data.count} email notifications!`)
      await fetchAllData() // Refresh to show notification_sent updates
    } catch (error: any) {
      toast.error("Failed to send notifications: " + error.message)
    }
  }

  const handleExportCSV = () => {
    const exportData = filteredInvoices.map((inv) => ({
      "Invoice Number": inv.invoice_number,
      Vendor: inv.vendor_name,
      Amount: inv.amount,
      Status: inv.status,
      "Due Date": inv.due_date,
      "Invoice Date": inv.invoice_date,
      User: inv.profiles?.email || "",
      Description: inv.description || "",
      Comments: inv.comments || "",
      "Notification Sent": inv.notification_sent ? "Yes" : "No",
      "Created At": new Date(inv.created_at).toLocaleString(),
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Invoices")
    XLSX.writeFile(wb, `invoices-${new Date().toISOString().split("T")[0]}.xlsx`)
    toast.success("Excel export successful!")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "bg-blue-500/10 text-blue-500"
      case "approved":
        return "bg-cyan-500/10 text-cyan-500"
      case "paid":
        return "bg-green-500/10 text-green-500"
      case "rejected":
        return "bg-red-500/10 text-red-500"
      case "unpaid":
        return "bg-yellow-500/10 text-yellow-500"
      case "overdue":
        return "bg-orange-500/10 text-orange-500"
      case "pending":
        return "bg-purple-500/10 text-purple-500"
      default:
        return "bg-slate-500/10 text-slate-500"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center text-slate-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (userRole !== "admin") {
    return (
      <div className="min-h-screen bg-slate-950 p-4">
        <div className="container mx-auto">
          <Card className="bg-red-900/20 border-red-700">
            <CardContent className="p-6">
              <p className="text-red-300">Access denied. Admin privileges required.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-50">Admin Panel</h1>
          <div className="flex items-center gap-4">
            <span className="text-slate-300">{user?.email}</span>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              User View
            </Button>
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
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <Upload className="h-4 w-4" />
              Create Invoice
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="vendors" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Vendors
            </TabsTrigger>
          </TabsList>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-4">
            {/* Financial Summary Cards */}
            <div className="grid md:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-br from-blue-900 to-blue-800 border-blue-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-100">Total Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    ${summaryStats.totalAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-blue-200 mt-1">{invoices.length} invoices</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-900 to-green-800 border-green-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-100">Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    ${summaryStats.collected.toFixed(2)}
                  </div>
                  <p className="text-xs text-green-200 mt-1">
                    {invoices.filter((i) => i.status === "paid").length} invoices
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-yellow-900 to-yellow-800 border-yellow-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-yellow-100">Remaining</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    ${summaryStats.remaining.toFixed(2)}
                  </div>
                  <p className="text-xs text-yellow-200 mt-1">
                    {invoices.filter((i) => i.status !== "paid").length} unpaid
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-900 to-red-800 border-red-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-100">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    ${summaryStats.overdue.toFixed(2)}
                  </div>
                  <p className="text-xs text-red-200 mt-1">
                    {invoices.filter((i) => i.status === "overdue").length} invoices
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-white">Invoice Management</CardTitle>
                    <CardDescription className="text-slate-400">
                      Manage all invoices with filters and bulk operations
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendNotifications}
                      variant="outline"
                      className="gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Send Notifications
                    </Button>
                    <Button
                      onClick={() => setIsUploadDialogOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Invoice
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search invoices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] bg-slate-800 border-slate-600 text-white">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger className="w-[180px] bg-slate-800 border-slate-600 text-white">
                      <SelectValue placeholder="Filter by vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      {Array.from(new Set(invoices.map((i) => i.vendor_name))).map((vendor) => (
                        <SelectItem key={vendor} value={vendor}>
                          {vendor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleExportCSV} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>

                {/* Invoices Table */}
                <div className="rounded-md border border-slate-700 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-800">
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-200">Invoice #</TableHead>
                        <TableHead className="text-slate-200">Vendor</TableHead>
                        <TableHead className="text-slate-200">User</TableHead>
                        <TableHead className="text-slate-200">Amount</TableHead>
                        <TableHead className="text-slate-200">Due Date</TableHead>
                        <TableHead className="text-slate-200">Status</TableHead>
                        <TableHead className="text-slate-200">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                            No invoices found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInvoices.map((invoice) => (
                          <TableRow key={invoice.id} className="border-slate-700 hover:bg-slate-800/50">
                            <TableCell className="text-slate-100 font-mono">
                              {invoice.invoice_number}
                            </TableCell>
                            <TableCell className="text-slate-100">{invoice.vendor_name}</TableCell>
                            <TableCell className="text-slate-300 text-sm">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {invoice.profiles?.email || "N/A"}
                                  {invoice.profiles?.role === "vendor" && (
                                    <Badge className="bg-green-500/10 text-green-400 text-[10px] px-1.5 py-0">
                                      VENDOR
                                    </Badge>
                                  )}
                                </div>
                                {invoice.profiles?.company_name && (
                                  <span className="text-xs text-slate-500">{invoice.profiles.company_name}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-100 font-semibold">
                              ${Number(invoice.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {new Date(invoice.due_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={invoice.status}
                                onValueChange={(value) => handleQuickStatusChange(invoice.id, value)}
                              >
                                <SelectTrigger className="w-[140px] h-9 bg-slate-800 border-slate-600 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                  <SelectItem value="submitted" className="text-slate-300 focus:bg-slate-700">
                                    <span className="text-blue-400">● Submitted</span>
                                  </SelectItem>
                                  <SelectItem value="approved" className="text-slate-300 focus:bg-slate-700">
                                    <span className="text-cyan-400">● Approved</span>
                                  </SelectItem>
                                  <SelectItem value="paid" className="text-slate-300 focus:bg-slate-700">
                                    <span className="text-green-400">● Paid</span>
                                  </SelectItem>
                                  <SelectItem value="overdue" className="text-slate-300 focus:bg-slate-700">
                                    <span className="text-red-400">● Overdue</span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewInvoice(invoice)}
                                  className="h-8 w-8 p-0"
                                  title="View Invoice"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSendNotification(invoice)}
                                  className="h-8 w-8 p-0 border-blue-500/50 hover:bg-blue-500/20"
                                  title="Send Notification"
                                >
                                  <Bell className="h-4 w-4 text-blue-400" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCommentingInvoice(invoice)
                                    setIsCommentDialogOpen(true)
                                  }}
                                  className="h-8 w-8 p-0 border-purple-500/50 hover:bg-purple-500/20"
                                  title="Add Comment"
                                >
                                  <MessageSquare className="h-4 w-4 text-purple-400" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditInvoice(invoice)}
                                  className="h-8 w-8 p-0"
                                  title="Edit Invoice"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setDeletingInvoiceId(invoice.id)
                                    setIsDeleteDialogOpen(true)
                                  }}
                                  className="h-8 w-8 p-0"
                                  title="Delete Invoice"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CREATE INVOICE TAB */}
          <TabsContent value="create" className="space-y-4">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Create Invoice for Vendor</CardTitle>
                <CardDescription className="text-slate-400">
                  Admin can create invoices on behalf of any vendor in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminInvoiceCreate onCreateSuccess={fetchAllData} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">User Management</CardTitle>
                <CardDescription className="text-slate-400">
                  Total users: {users.length} | Vendors: {users.filter(u => u.role === 'vendor').length} | Admins: {users.filter(u => u.role === 'admin').length}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Bar */}
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search users by email or name..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="rounded-md border border-slate-700">
                  <Table>
                    <TableHeader className="bg-slate-800">
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-200">Email</TableHead>
                        <TableHead className="text-slate-200">Full Name</TableHead>
                        <TableHead className="text-slate-200">Role</TableHead>
                        <TableHead className="text-slate-200">Created</TableHead>
                        <TableHead className="text-slate-200">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                        <TableRow key={user.id} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-slate-200">{user.email}</TableCell>
                          <TableCell className="text-slate-200">{user.full_name || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                user.role === "admin"
                                  ? "bg-red-900/30 text-red-200"
                                  : "bg-green-900/30 text-green-200"
                              }
                            >
                              {user.role.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {user.role === "vendor" ? (
                              <Button size="sm" onClick={() => handleUpdateUserRole(user.id, "admin")}>
                                Make Admin
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleUpdateUserRole(user.id, "vendor")}>
                                Demote to Vendor
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VENDORS TAB */}
          <TabsContent value="vendors">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Vendor Statistics</CardTitle>
                <CardDescription className="text-slate-400">
                  Invoice counts and amounts by vendor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-slate-700">
                  <Table>
                    <TableHeader className="bg-slate-800">
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-200">Vendor</TableHead>
                        <TableHead className="text-slate-200">Invoice Count</TableHead>
                        <TableHead className="text-slate-200">Total Amount</TableHead>
                        <TableHead className="text-slate-200">Paid</TableHead>
                        <TableHead className="text-slate-200">Unpaid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorStats.map((vendor) => (
                        <TableRow key={vendor.user_id} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-slate-100">
                            <div className="font-medium">{vendor.vendor_name}</div>
                            <div className="text-sm text-slate-400">{vendor.vendor_email}</div>
                          </TableCell>
                          <TableCell className="text-slate-200">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/50">
                              {vendor.invoice_count} invoices
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-100 font-semibold">
                            ${vendor.total_amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-green-400">${vendor.paid_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-yellow-400">${vendor.unpaid_amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Invoice Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription className="text-slate-400">Make changes to the invoice details</DialogDescription>
          </DialogHeader>
          {editingInvoice && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={editingInvoice.invoice_number}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, invoice_number: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vendor_name">Vendor Name</Label>
                <Input
                  id="vendor_name"
                  value={editingInvoice.vendor_name}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, vendor_name: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={editingInvoice.amount || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, amount: parseFloat(e.target.value) || 0 })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="invoice_date">Invoice Date</Label>
                  <Input
                    id="invoice_date"
                    type="date"
                    value={editingInvoice.invoice_date}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, invoice_date: e.target.value })}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={editingInvoice.due_date}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, due_date: e.target.value })}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={editingInvoice.status}
                  onValueChange={(value) => setEditingInvoice({ ...editingInvoice, status: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingInvoice.description || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, description: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comments">Comments / Notes</Label>
                <Textarea
                  id="comments"
                  value={editingInvoice.comments || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, comments: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                  placeholder="Add clarification or rejection notes..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveInvoice}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this invoice? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteInvoice}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Invoice Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Upload Invoice for Vendor</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select vendor and upload invoice - AI will automatically extract data
            </DialogDescription>
          </DialogHeader>
          <AdminUploadInvoice
            onUploadSuccess={() => {
              setIsUploadDialogOpen(false)
              fetchAllData()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      {viewingInvoice && (
        <InvoiceViewer
          invoice={viewingInvoice}
          open={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
        />
      )}

      {/* Add Comment Dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Comment to Invoice</DialogTitle>
            <DialogDescription className="text-slate-400">
              {commentingInvoice && `Add a comment to invoice ${commentingInvoice.invoice_number}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {commentingInvoice && (
              <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                <div className="text-sm text-slate-300">
                  <span className="font-semibold">Invoice:</span> {commentingInvoice.invoice_number}
                </div>
                <div className="text-sm text-slate-300">
                  <span className="font-semibold">Vendor:</span> {commentingInvoice.vendor_name}
                </div>
                <div className="text-sm text-slate-300">
                  <span className="font-semibold">Status:</span>{" "}
                  <Badge className={getStatusColor(commentingInvoice.status)}>
                    {commentingInvoice.status}
                  </Badge>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="comment" className="text-slate-200">
                Comment / Reason
              </Label>
              <Textarea
                id="comment"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white min-h-[120px]"
                placeholder="Enter reason for status change or additional information..."
                rows={5}
              />
              <p className="text-xs text-slate-400">
                This comment will be visible to the vendor and saved in the invoice history.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCommentDialogOpen(false)
                setCommentText("")
                setCommentingInvoice(null)
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddComment}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!commentText.trim()}
            >
              Add Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
