"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  Download,
  FileText,
  Calendar,
  DollarSign,
  User,
  MessageSquare,
  Upload,
  Clock,
  Eye,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params?.id as string

  const [user, setUser] = useState<any>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [statusHistory, setStatusHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newResponse, setNewResponse] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      router.push("/auth/login")
      return
    }

    setUser(user)
    fetchInvoiceDetails(user.id)
  }

  const fetchInvoiceDetails = async (userId: string) => {
    const supabase = createClient()

    // Fetch invoice
    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single()

    if (invoiceError || !invoiceData) {
      toast.error("Invoice not found")
      router.push("/dashboard")
      return
    }

    // Check if user owns this invoice
    if (invoiceData.user_id !== userId) {
      toast.error("Unauthorized access")
      router.push("/dashboard")
      return
    }

    setInvoice(invoiceData)

    // Fetch comments
    const { data: commentsData } = await supabase
      .from("invoice_comments")
      .select("*, profiles(full_name, email, role)")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })

    setComments(commentsData || [])

    // Fetch status history
    const { data: historyData } = await supabase
      .from("invoice_status_history")
      .select("*, profiles(full_name, email)")
      .eq("invoice_id", invoiceId)
      .order("changed_at", { ascending: false })

    setStatusHistory(historyData || [])
    setLoading(false)
  }

  const handleDownloadFile = async () => {
    if (!invoice?.file_url) {
      toast.error("No file attached to this invoice")
      return
    }

    const supabase = createClient()
    const filePath = invoice.file_url.split("/").pop()
    
    const { data, error } = await supabase.storage
      .from("invoices")
      .download(`${user.id}/${filePath}`)

    if (error) {
      toast.error("Failed to download file")
      return
    }

    // Create download link
    const url = URL.createObjectURL(data)
    const a = document.createElement("a")
    a.href = url
    a.download = filePath
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReplaceFile = () => {
    router.push(`/dashboard/invoices/${invoiceId}/replace`)
  }

  const handleSubmitResponse = async () => {
    if (!newResponse.trim()) {
      toast.error("Please enter a response")
      return
    }

    setSubmitting(true)
    const supabase = createClient()

    const { error } = await supabase.from("invoice_comments").insert({
      invoice_id: invoiceId,
      user_id: user.id,
      comment: newResponse,
    })

    if (error) {
      toast.error("Failed to submit response")
    } else {
      toast.success("Response submitted")
      setNewResponse("")
      fetchInvoiceDetails(user.id)
    }
    setSubmitting(false)
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      submitted: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", label: "Pending Review" },
      approved: { color: "bg-green-500/10 text-green-500 border-green-500/20", label: "Approved" },
      paid: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Paid" },
      rejected: { color: "bg-red-500/10 text-red-500 border-red-500/20", label: "Rejected" },
      overdue: { color: "bg-orange-500/10 text-orange-500 border-orange-500/20", label: "Needs Correction" },
    }
    const badge = badges[status] || { color: "bg-slate-500/10 text-slate-500", label: status }
    return (
      <Badge className={`${badge.color} border`}>
        {badge.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-slate-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading invoice details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/dashboard")}
                className="text-slate-300 hover:text-slate-50"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-50">
                  Invoice Details
                </h1>
                <p className="text-sm text-slate-400">#{invoice?.invoice_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {invoice?.file_url && (
                <Button
                  variant="outline"
                  onClick={handleDownloadFile}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
              {(invoice?.status === "overdue" || invoice?.status === "rejected") && (
                <Button onClick={handleReplaceFile} className="bg-blue-600 hover:bg-blue-700">
                  <Upload className="mr-2 h-4 w-4" />
                  Replace File
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Information */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-slate-50">
                    <FileText className="h-5 w-5" />
                    Invoice Information
                  </CardTitle>
                  {getStatusBadge(invoice?.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Invoice Number</Label>
                    <p className="text-slate-50 font-mono">{invoice?.invoice_number}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Vendor Name</Label>
                    <p className="text-slate-50">{invoice?.vendor_name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Amount
                    </Label>
                    <p className="text-slate-50 font-semibold text-lg">
                      ${invoice?.amount?.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Due Date
                    </Label>
                    <p className="text-slate-50">
                      {invoice?.due_date ? format(new Date(invoice.due_date), "PPP") : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Invoice Date</Label>
                    <p className="text-slate-50">
                      {invoice?.invoice_date ? format(new Date(invoice.invoice_date), "PPP") : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Upload Date</Label>
                    <p className="text-slate-50">
                      {format(new Date(invoice?.created_at), "PPP")}
                    </p>
                  </div>
                </div>

                {/* Line Items Section */}
                <Separator className="bg-slate-700" />
                <div className="space-y-3">
                  <Label className="text-slate-400 text-xs">Line Items</Label>
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900/50">
                        <tr className="border-b border-slate-700">
                          <th className="text-left p-3 text-slate-400 font-medium">Description</th>
                          <th className="text-right p-3 text-slate-400 font-medium">Qty</th>
                          <th className="text-right p-3 text-slate-400 font-medium">Rate</th>
                          <th className="text-right p-3 text-slate-400 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-700">
                          <td className="p-3 text-slate-200">Service/Product</td>
                          <td className="text-right p-3 text-slate-200">1</td>
                          <td className="text-right p-3 text-slate-200">
                            ${invoice?.amount?.toFixed(2)}
                          </td>
                          <td className="text-right p-3 text-slate-50 font-semibold">
                            ${invoice?.amount?.toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-slate-900/50">
                        <tr>
                          <td colSpan={3} className="text-right p-3 text-slate-400 font-medium">
                            Total Amount:
                          </td>
                          <td className="text-right p-3 text-slate-50 font-bold text-lg">
                            ${invoice?.amount?.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500">
                    Line item breakdown will be available when AI extraction is enhanced
                  </p>
                </div>

                {invoice?.description && (
                  <>
                    <Separator className="bg-slate-700" />
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">Description</Label>
                      <p className="text-slate-300 text-sm">{invoice.description}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Comments & Discussion */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-50">
                  <MessageSquare className="h-5 w-5" />
                  Comments & Discussion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.length > 0 ? (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`rounded-lg border p-3 ${
                          comment.profiles?.role === "admin"
                            ? "bg-purple-500/5 border-purple-500/20"
                            : "bg-slate-700/50 border-slate-600"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-200">
                              {comment.profiles?.full_name || "Admin"}
                            </span>
                            {comment.profiles?.role === "admin" && (
                              <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {format(new Date(comment.created_at), "PPp")}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">
                    No comments yet
                  </p>
                )}

                {/* Response Form */}
                {(invoice?.status === "overdue" || invoice?.status === "rejected") && (
                  <>
                    <Separator className="bg-slate-700" />
                    <div className="space-y-2">
                      <Label className="text-slate-200">Respond to Admin</Label>
                      <Textarea
                        value={newResponse}
                        onChange={(e) => setNewResponse(e.target.value)}
                        placeholder="Add your response or questions here..."
                        className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
                      />
                      <Button
                        onClick={handleSubmitResponse}
                        disabled={submitting || !newResponse.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {submitting ? "Submitting..." : "Submit Response"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* File Preview */}
            {invoice?.file_url && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-50 text-base">
                    <Eye className="h-4 w-4" />
                    File Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-[3/4] bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                    {invoice.file_url.toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={invoice.file_url}
                        className="w-full h-full"
                        title="Invoice Preview"
                      />
                    ) : (
                      <img
                        src={invoice.file_url}
                        alt="Invoice Preview"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <Button
                    onClick={handleDownloadFile}
                    variant="outline"
                    className="w-full mt-3"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download File
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Status History */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-50 text-base">
                  <Clock className="h-4 w-4" />
                  Status History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusHistory.length > 0 ? (
                  <div className="space-y-3">
                    {statusHistory.map((history, index) => (
                      <div key={history.id} className="relative pl-6 pb-3 border-l-2 border-slate-700 last:border-0 last:pb-0">
                        <div className="absolute -left-2 top-0 h-4 w-4 rounded-full border-2 border-slate-700 bg-slate-800" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                              {history.old_status || "—"}
                            </span>
                            <span className="text-xs text-slate-500">→</span>
                            <Badge className="text-xs">
                              {history.new_status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {format(new Date(history.changed_at), "PPp")}
                          </p>
                          {history.profiles && (
                            <p className="text-xs text-slate-400">
                              by {history.profiles.full_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No history available
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
