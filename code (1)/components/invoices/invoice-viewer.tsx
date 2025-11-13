"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Invoice {
  id: string
  invoice_number: string
  vendor_name: string
  amount: number
  due_date: string
  invoice_date: string
  status: string
  file_url: string | null
  description: string | null
  comments: string | null
  status_history?: any[] | null
}

interface InvoiceViewerProps {
  invoice: Invoice
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvoiceViewer({ invoice, open, onOpenChange }: InvoiceViewerProps) {
  const [loading, setLoading] = useState(true)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  useEffect(() => {
    const getSignedUrl = async () => {
      if (!invoice.file_url || !open) return
      
      setLoading(true)
      const supabase = createClient()
      
      // Extract file path from the public URL
      // Public URL format: https://xxx.supabase.co/storage/v1/object/public/invoices/path/to/file.pdf
      const urlParts = invoice.file_url.split('/invoices/')
      if (urlParts.length < 2) {
        // If URL doesn't match expected format, use it directly
        setFileUrl(invoice.file_url)
        setLoading(false)
        return
      }
      
      const filePath = urlParts[1]
      
      // Get signed URL (valid for 1 hour)
      const { data, error } = await supabase
        .storage
        .from('invoices')
        .createSignedUrl(filePath, 3600)
      
      if (error) {
        console.error('Error getting signed URL:', error)
        // Fall back to public URL
        setFileUrl(invoice.file_url)
      } else {
        setFileUrl(data.signedUrl)
      }
      
      setLoading(false)
    }

    getSignedUrl()
  }, [invoice.file_url, open])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "bg-blue-500/10 text-blue-500 border-blue-500/50"
      case "approved":
        return "bg-cyan-500/10 text-cyan-500 border-cyan-500/50"
      case "paid":
        return "bg-green-500/10 text-green-500 border-green-500/50"
      case "rejected":
        return "bg-red-500/10 text-red-500 border-red-500/50"
      case "unpaid":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/50"
      case "overdue":
        return "bg-orange-500/10 text-orange-500 border-orange-500/50"
      case "pending":
        return "bg-purple-500/10 text-purple-500 border-purple-500/50"
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/50"
    }
  }

  const isPDF = fileUrl?.toLowerCase().endsWith(".pdf")
  const isImage = fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i)

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement("a")
      link.href = fileUrl
      link.download = `${invoice.invoice_number}.${isPDF ? "pdf" : "jpg"}`
      link.click()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] bg-slate-900 border-slate-700 text-white flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Invoice Details</DialogTitle>
          <DialogDescription className="text-slate-400">
            {invoice.invoice_number} - {invoice.vendor_name}
          </DialogDescription>
        </DialogHeader>

        {/* Invoice Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div>
            <p className="text-xs text-slate-400 mb-1">Invoice Number</p>
            <p className="text-sm font-mono text-slate-200">{invoice.invoice_number}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Vendor</p>
            <p className="text-sm text-slate-200">{invoice.vendor_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Amount</p>
            <p className="text-sm font-semibold text-slate-200">${Number(invoice.amount).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Status</p>
            <Badge variant="outline" className={getStatusColor(invoice.status)}>
              {invoice.status.toUpperCase()}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Invoice Date</p>
            <p className="text-sm text-slate-200">{new Date(invoice.invoice_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Due Date</p>
            <p className="text-sm text-slate-200">{new Date(invoice.due_date).toLocaleDateString()}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400 mb-1">Description</p>
            <p className="text-sm text-slate-200">{invoice.description || "No description"}</p>
          </div>
          {invoice.comments && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-xs text-slate-400 mb-1">Comments / Notes</p>
              <div className="bg-slate-900 p-3 rounded border border-slate-600">
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{invoice.comments}</p>
              </div>
            </div>
          )}
        </div>

        {/* File Viewer */}
        <div className="flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 relative">
          {fileUrl ? (
            <>
              {isPDF ? (
                <iframe
                  src={fileUrl}
                  className="w-full h-full"
                  title="Invoice PDF"
                  onLoad={() => setLoading(false)}
                />
              ) : isImage ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                  <img
                    src={fileUrl}
                    alt={`Invoice ${invoice.invoice_number}`}
                    className="max-w-full max-h-full object-contain"
                    onLoad={() => setLoading(false)}
                    onError={(e) => {
                      console.error('Image load error:', e)
                      setLoading(false)
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FileText className="h-16 w-16 mb-4" />
                  <p>File preview not available</p>
                  <Button onClick={handleDownload} variant="outline" className="mt-4">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
              {loading && (isPDF || isImage) && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-slate-300">Loading file...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <FileText className="h-16 w-16 mb-4" />
              <p>No file attached to this invoice</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-700">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {invoice.file_url && (
            <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
