import type React from "react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  TableBody,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, MessageSquare, Building2 } from "lucide-react"

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":
      return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
    case "approved":
      return "bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20"
    case "paid":
      return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
    case "rejected":
      return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
    case "unpaid":
      return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
    case "overdue":
      return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
    case "pending":
      return "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20"
    default:
      return "bg-slate-500/10 text-slate-500 hover:bg-slate-500/20"
  }
}

interface Invoice {
  id: number | string
  invoice_number: string
  vendor_name: string
  amount: number
  due_date: string
  status: string
  file_url?: string | null
  invoice_date?: string
  description?: string | null
  comments?: string | null
  latest_comment?: { comment: string; created_at: string; user_id: string } | null
  company_id?: string | null
}

interface InvoiceListProps {
  invoices: Invoice[]
  onView?: (invoice: Invoice) => void
}

const InvoiceList: React.FC<InvoiceListProps> = ({ invoices = [], onView }) => {
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchCompanyNames = async () => {
      const supabase = createClient()
      const companyIds = [...new Set(invoices.map(inv => inv.company_id).filter(Boolean))]
      
      if (companyIds.length === 0) return

      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds)

      if (data) {
        const namesMap: Record<string, string> = {}
        data.forEach((company: any) => {
          namesMap[company.id] = company.name
        })
        setCompanyNames(namesMap)
      }
    }

    fetchCompanyNames()
  }, [invoices])

  const totalAmount = invoices.reduce((acc, invoice) => acc + invoice.amount, 0)
  const paidAmount = invoices.reduce((acc, invoice) => acc + (invoice.status.toLowerCase() === "paid" ? invoice.amount : 0), 0)
  const submittedAmount = invoices.reduce((acc, invoice) => acc + (invoice.status.toLowerCase() === "submitted" ? invoice.amount : 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">${submittedAmount.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">${paidAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Invoices</CardTitle>
          <CardDescription className="text-slate-300">All your invoices in one place</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-300 text-lg font-medium">No data available</p>
              <p className="text-slate-400 text-sm mt-1">Upload your first invoice to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-200 font-semibold">Invoice #</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Company</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Vendor</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Amount</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Due Date</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Status</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Comments/Reason</TableHead>
                    {onView && <TableHead className="text-slate-200 font-semibold">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell className="text-slate-100">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        {invoice.company_id && companyNames[invoice.company_id] ? (
                          <div className="flex items-center gap-2 text-slate-100">
                            <Building2 className="h-4 w-4 text-blue-400" />
                            {companyNames[invoice.company_id]}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-100">{invoice.vendor_name}</TableCell>
                      <TableCell className="text-slate-100">${invoice.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-slate-100">
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {invoice.comments || invoice.latest_comment ? (
                          <div className="flex items-start gap-2 max-w-xs">
                            <MessageSquare className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                              <p className="text-slate-300 line-clamp-2">
                                {invoice.comments || invoice.latest_comment?.comment}
                              </p>
                              {invoice.latest_comment?.created_at && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {new Date(invoice.latest_comment.created_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">No comments</span>
                        )}
                      </TableCell>
                      {onView && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onView(invoice)}
                            className="h-8 gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default InvoiceList
