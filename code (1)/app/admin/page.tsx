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
import { Download, Edit, Trash2, Search, FileText, Users, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"

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
  profiles?: {
    email: string
    full_name: string
  }
}

interface VendorStats {
  vendor_name: string
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
  const [statusFilter, setStatusFilter] = useState("unpaid")
  const [vendorFilter, setVendorFilter] = useState("all")
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

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

  const checkAuth = async () => {
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
          full_name
        )
      `)
      .order("created_at", { ascending: false })

    setInvoices(invoicesData || [])

    // Calculate vendor stats
    if (invoicesData) {
      const stats = calculateVendorStats(invoicesData)
      setVendorStats(stats)
    }
  }

  const calculateVendorStats = (invoices: Invoice[]): VendorStats[] => {
    const statsMap = new Map<string, VendorStats>()

    invoices.forEach((invoice) => {
      const vendor = invoice.vendor_name
      if (!statsMap.has(vendor)) {
        statsMap.set(vendor, {
          vendor_name: vendor,
          invoice_count: 0,
          total_amount: 0,
          paid_amount: 0,
          unpaid_amount: 0,
        })
      }

      const stats = statsMap.get(vendor)!
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
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId)

      if (error) throw error

      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      toast.success(`User role updated to ${newRole}`)
    } catch (error: any) {
      toast.error("Failed to update role: " + error.message)
    }
  }

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    setIsEditDialogOpen(true)
  }

  const handleSaveInvoice = async () => {
    if (!editingInvoice) return

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

  const handleDeleteInvoice = async () => {
    if (!deletingInvoiceId) return

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
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Invoices")
    XLSX.writeFile(wb, `invoices-${new Date().toISOString().split("T")[0]}.xlsx`)
    toast.success("Export successful!")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-500/10 text-green-500"
      case "unpaid":
        return "bg-yellow-500/10 text-yellow-500"
      case "overdue":
        return "bg-red-500/10 text-red-500"
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
            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Total Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{invoices.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Unpaid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-400">
                    {invoices.filter((i) => i.status === "unpaid").length}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    {invoices.filter((i) => i.status === "paid").length}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Total Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    ${invoices.reduce((sum, inv) => sum + Number(inv.amount), 0).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Invoice Management</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage all invoices with filters and bulk operations
                </CardDescription>
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
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
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
                            <TableCell className="text-slate-100 font-mono">{invoice.invoice_number}</TableCell>
                            <TableCell className="text-slate-100">{invoice.vendor_name}</TableCell>
                            <TableCell className="text-slate-300 text-sm">
                              {invoice.profiles?.email || "N/A"}
                            </TableCell>
                            <TableCell className="text-slate-100 font-semibold">
                              ${Number(invoice.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {new Date(invoice.due_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditInvoice(invoice)}
                                  className="h-8 w-8 p-0"
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

          {/* USERS TAB */}
          <TabsContent value="users">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">User Management</CardTitle>
                <CardDescription className="text-slate-400">Total users: {users.length}</CardDescription>
              </CardHeader>
              <CardContent>
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
                      {users.map((user) => (
                        <TableRow key={user.id} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-slate-200">{user.email}</TableCell>
                          <TableCell className="text-slate-200">{user.full_name || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                user.role === "admin"
                                  ? "bg-red-900/30 text-red-200"
                                  : "bg-blue-900/30 text-blue-200"
                              }
                            >
                              {user.role.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {user.role === "user" ? (
                              <Button size="sm" onClick={() => handleUpdateUserRole(user.id, "admin")}>
                                Make Admin
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleUpdateUserRole(user.id, "user")}>
                                Demote to User
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
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
                        <TableHead className="text-slate-200">Vendor Name</TableHead>
                        <TableHead className="text-slate-200">Invoice Count</TableHead>
                        <TableHead className="text-slate-200">Total Amount</TableHead>
                        <TableHead className="text-slate-200">Paid</TableHead>
                        <TableHead className="text-slate-200">Unpaid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorStats.map((vendor) => (
                        <TableRow key={vendor.vendor_name} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-slate-100 font-medium">{vendor.vendor_name}</TableCell>
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
                  value={editingInvoice.amount}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, amount: parseFloat(e.target.value) })}
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
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
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
    </div>
  )
}
