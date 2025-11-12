import type React from "react"
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

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "paid":
      return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
    case "pending":
      return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
    case "overdue":
      return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
    default:
      return "bg-slate-500/10 text-slate-500 hover:bg-slate-500/20"
  }
}

interface Invoice {
  id: number
  invoice_number: string
  vendor_name: string
  amount: number
  due_date: string
  status: string
}

interface InvoiceListProps {
  invoices: Invoice[]
}

const InvoiceList: React.FC<InvoiceListProps> = ({ invoices = [] }) => {
  const totalAmount = invoices.reduce((acc, invoice) => acc + invoice.amount, 0)
  const pendingAmount = invoices.reduce((acc, invoice) => acc + (invoice.status === "Pending" ? invoice.amount : 0), 0)

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
            <CardTitle className="text-sm font-medium text-slate-300">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">${pendingAmount.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{invoices.length}</div>
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
                    <TableHead className="text-slate-200 font-semibold">Vendor</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Amount</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Due Date</TableHead>
                    <TableHead className="text-slate-200 font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell className="text-slate-100">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-slate-100">{invoice.vendor_name}</TableCell>
                      <TableCell className="text-slate-100">${invoice.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-slate-100">
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                      </TableCell>
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
