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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { FileText } from "lucide-react"

interface ManualInvoiceCreateProps {
  onCreateSuccess?: () => void
}

export default function ManualInvoiceCreate({ onCreateSuccess }: ManualInvoiceCreateProps) {
  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; email: string } | null>(null)
  const [formData, setFormData] = useState({
    vendor_name: "",
    invoice_number: "",
    amount: "",
    invoice_date: "",
    due_date: "",
    description: "",
    status: "submitted" as string,
  })

  // Fetch user profile and role on mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, role")
            .eq("id", user.id)
            .single()
          
          if (profile) {
            setUserProfile({ full_name: profile.full_name, email: profile.email })
            setUserRole(profile.role)
            
            // Auto-fill vendor name for vendors (not admins)
            if (profile.role !== "admin") {
              const vendorName = profile.full_name || profile.email
              setFormData(prev => ({ ...prev, vendor_name: vendorName }))
            }
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchUserProfile()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = (): boolean => {
    if (!formData.vendor_name.trim()) {
      toast.error("Vendor name is required")
      return false
    }
    if (!formData.invoice_number.trim()) {
      toast.error("Invoice number is required")
      return false
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Valid amount is required")
      return false
    }
    if (!formData.invoice_date) {
      toast.error("Invoice date is required")
      return false
    }
    if (!formData.due_date) {
      toast.error("Due date is required")
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)

    try {
      const supabase = createClient()
      
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("Not authenticated")
      }

      // Check for duplicate invoice number
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .eq("invoice_number", formData.invoice_number.trim())
        .single()

      if (existingInvoice) {
        throw new Error(`Invoice number "${formData.invoice_number}" already exists! Please use a unique invoice number.`)
      }

      // Insert invoice into database
      const { data, error } = await supabase.from("invoices").insert([
        {
          user_id: user.id,
          vendor_name: formData.vendor_name.trim(),
          invoice_number: formData.invoice_number.trim(),
          amount: parseFloat(formData.amount),
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          description: formData.description.trim() || null,
          status: formData.status,
          file_url: null, // Manual entry has no file
        },
      ]).select()

      if (error) {
        console.error("Database error:", error)
        throw error
      }

      toast.success("Invoice created successfully!")
      
      // Reset form
      setFormData({
        vendor_name: "",
        invoice_number: "",
        amount: "",
        invoice_date: "",
        due_date: "",
        description: "",
        status: "submitted",
      })

      if (onCreateSuccess) {
        onCreateSuccess()
      }
    } catch (error: any) {
      console.error("Error creating invoice:", error)
      toast.error("Failed to create invoice: " + (error.message || "Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFormData({
      vendor_name: userRole !== "admin" ? (userProfile?.full_name || userProfile?.email || "") : "",
      invoice_number: "",
      amount: "",
      invoice_date: "",
      due_date: "",
      description: "",
      status: "submitted",
    })
  }

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <FileText className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-white">Create Invoice Manually</CardTitle>
            <CardDescription className="text-slate-400">
              Enter invoice details without uploading a file
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-slate-400">Loading form...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vendor Info Display for Non-Admins */}
            {userRole && userRole !== "admin" && userProfile && (
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <Label className="text-slate-300 text-sm">Your Invoice Will Be Created As</Label>
              <p className="text-blue-400 font-semibold text-lg mt-1">
                {userProfile.full_name || userProfile.email}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">{userProfile.email}</p>
            </div>
          )}

          {/* Vendor and Invoice Number */}
          <div className="grid md:grid-cols-2 gap-4">
            {userRole === "admin" ? (
              <div className="space-y-2">
                <Label htmlFor="vendor_name" className="text-slate-200">
                  Vendor Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="vendor_name"
                  placeholder="Enter vendor/company name"
                  value={formData.vendor_name}
                  onChange={(e) => handleInputChange("vendor_name", e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="vendor_name" className="text-slate-200">
                  Vendor Name <span className="text-slate-400 text-xs">(Auto-filled)</span>
                </Label>
                <Input
                  id="vendor_name"
                  value={formData.vendor_name}
                  className="bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed"
                  disabled
                  readOnly
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="invoice_number" className="text-slate-200">
                Invoice Number <span className="text-red-400">*</span>
              </Label>
              <Input
                id="invoice_number"
                placeholder="INV-001"
                value={formData.invoice_number}
                onChange={(e) => handleInputChange("invoice_number", e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                required
              />
            </div>
          </div>

          {/* Amount and Status */}
          <div className={userRole === "admin" ? "grid md:grid-cols-2 gap-4" : "space-y-4"}>
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-slate-200">
                Amount <span className="text-red-400">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                required
                disabled={loadingProfile}
              />
            </div>
            {userRole === "admin" && (
              <div className="space-y-2">
                <Label htmlFor="status" className="text-slate-200">
                  Status
                </Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
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
            )}
          </div>

          {/* Dates */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_date" className="text-slate-200">
                Invoice Date <span className="text-red-400">*</span>
              </Label>
              <Input
                id="invoice_date"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => handleInputChange("invoice_date", e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date" className="text-slate-200">
                Due Date <span className="text-red-400">*</span>
              </Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleInputChange("due_date", e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-slate-200">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Add any additional notes or description..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="bg-slate-800 border-slate-600 text-white min-h-[100px]"
              rows={4}
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-200">
              <strong>Note:</strong> Manual invoices don't have attached files. You can upload a file later if needed.
              {userRole !== "admin" && " Status will be set to 'Submitted' automatically."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Creating..." : "Create Invoice"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={loading}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Reset
            </Button>
          </div>
        </form>
        )}
      </CardContent>
    </Card>
  )
}
