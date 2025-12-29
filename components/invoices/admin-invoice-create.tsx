"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: string
  email: string
  full_name?: string
  company_name?: string
}

interface AdminInvoiceCreateProps {
  onCreateSuccess: () => void
}

export default function AdminInvoiceCreate({ onCreateSuccess }: AdminInvoiceCreateProps) {
  const [vendors, setVendors] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    user_id: "",
    vendor_name: "",
    invoice_number: "",
    amount: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    description: "",
    status: "submitted",
  })

  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchVendors = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_name")
        .eq("role", "vendor")
        .order("email")

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error("Error fetching vendors:", error)
      toast.error("Failed to load vendors")
    } finally {
      setLoading(false)
    }
  }

  const handleVendorSelect = (userId: string) => {
    const vendor = vendors.find((v) => v.id === userId)
    setFormData({
      ...formData,
      user_id: userId,
      vendor_name: vendor?.company_name || vendor?.full_name || vendor?.email || "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.user_id) {
      toast.error("Please select a vendor")
      return
    }

    if (!formData.vendor_name || !formData.invoice_number || !formData.amount) {
      toast.error("Please fill in all required fields")
      return
    }

    if (parseFloat(formData.amount) <= 0) {
      toast.error("Amount must be greater than 0")
      return
    }

    setSubmitting(true)

    try {
      const supabase = createClient()
      
      // Check for duplicate invoice number
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .eq("invoice_number", formData.invoice_number)
        .single()

      if (existingInvoice) {
        toast.error(`Invoice number "${formData.invoice_number}" already exists! Please use a unique invoice number.`)
        return
      }
      
      // Create invoice on behalf of vendor
      const { error } = await supabase.from("invoices").insert({
        user_id: formData.user_id,
        vendor_name: formData.vendor_name,
        invoice_number: formData.invoice_number,
        amount: parseFloat(formData.amount),
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        description: formData.description,
        status: formData.status,
        file_url: null, // Admin-created invoices have no file
      })

      if (error) throw error

      toast.success("Invoice created successfully!")

      // Reset form
      setFormData({
        user_id: "",
        vendor_name: "",
        invoice_number: "",
        amount: "",
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: "",
        description: "",
        status: "submitted",
      })

      onCreateSuccess()
    } catch (error: any) {
      console.error("Error creating invoice:", error)
      toast.error(error.message || "Failed to create invoice")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            {/* Vendor Selection */}
            <div className="space-y-2">
              <Label htmlFor="vendor" className="text-slate-200">
                Select Vendor *
              </Label>
              <Select value={formData.user_id} onValueChange={handleVendorSelect} required>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Choose a vendor..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {vendors.map((vendor) => (
                    <SelectItem
                      key={vendor.id}
                      value={vendor.id}
                      className="text-slate-300 focus:bg-slate-700"
                    >
                      <div className="flex flex-col">
                        <span>{vendor.email}</span>
                        {vendor.company_name && (
                          <span className="text-xs text-slate-500">{vendor.company_name}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_number" className="text-slate-200">
                  Invoice Number *
                </Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="INV-001"
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor_name" className="text-slate-200">
                  Vendor Name *
                </Label>
                <Input
                  id="vendor_name"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  placeholder="Acme Corp"
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-slate-200">
                Amount ($) *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="1000.00"
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>

            {/* Dates */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_date" className="text-slate-200">
                  Invoice Date *
                </Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date" className="text-slate-200">
                  Due Date *
                </Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status" className="text-slate-200">
                Initial Status *
              </Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="submitted" className="text-slate-300">Submitted</SelectItem>
                  <SelectItem value="approved" className="text-slate-300">Approved</SelectItem>
                  <SelectItem value="paid" className="text-slate-300">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-200">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Invoice description or notes..."
                className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Invoice for Vendor"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
