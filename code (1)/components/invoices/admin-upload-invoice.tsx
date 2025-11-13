"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { backendAPI } from "@/lib/api/backend"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Upload, FileText, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ExtractedData {
  invoice_number: string | null
  vendor_name: string | null
  amount: number | null
  due_date: string | null
  invoice_date: string | null
}

interface User {
  id: string
  email: string
  full_name?: string
  company_name?: string
}

export default function AdminUploadInvoice({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [vendors, setVendors] = useState<User[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  const [loadingVendors, setLoadingVendors] = useState(true)

  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchVendors = async () => {
    setLoadingVendors(true)
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
      setLoadingVendors(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setExtractedData(null)

      // Create preview for images
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target?.result as string)
        reader.readAsDataURL(selectedFile)
      } else {
        setPreview(null)
      }
    }
  }

  const handleExtractData = async () => {
    if (!file) return

    setExtracting(true)
    try {
      toast.info("Extracting invoice data using AI...")
      console.log('Starting extraction for file:', file.name, file.type)
      
      const response = await backendAPI.extractInvoice(file)
      console.log('Extraction response:', response)
      
      const hasValidData = response.data.invoice_no || response.data.vendor_name || 
                          (response.data.amount && response.data.amount > 0)
      
      if (!hasValidData) {
        console.warn('No valid data extracted, using defaults')
        toast.warning("Extraction completed but found limited data. Please review and edit.")
      } else {
        toast.success("Invoice data extracted successfully!")
      }
      
      const extractedData: ExtractedData = {
        invoice_number: response.data.invoice_no || `INV-${Date.now()}`,
        vendor_name: response.data.vendor_name || "Unknown Vendor",
        amount: response.data.amount || 0,
        due_date: response.data.due_date || new Date().toISOString().split("T")[0],
        invoice_date: response.data.invoice_date || new Date().toISOString().split("T")[0],
      }
      
      console.log('Mapped extracted data:', extractedData)
      setExtractedData(extractedData)
      
    } catch (error: any) {
      console.error("OCR extraction error:", error)
      toast.error("OCR extraction failed: " + (error.message || "Unknown error"))
      setExtractedData({
        invoice_number: `INV-${Date.now()}`,
        vendor_name: "Unknown Vendor",
        amount: 0,
        due_date: new Date().toISOString().split("T")[0],
        invoice_date: new Date().toISOString().split("T")[0],
      })
    } finally {
      setExtracting(false)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedVendorId) {
      toast.error("Please select a vendor")
      return
    }
    
    if (!file) {
      toast.error("Please select a file")
      return
    }

    if (!extractedData) {
      await handleExtractData()
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Get selected vendor info
      const vendor = vendors.find((v) => v.id === selectedVendorId)
      const vendorName = vendor?.full_name || vendor?.company_name || vendor?.email || "Unknown Vendor"

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${selectedVendorId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      console.log("Uploading to storage:", fileName)
      toast.info("Uploading file to storage...")
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("invoices")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("Storage upload error:", uploadError)
        throw new Error(`Storage error: ${uploadError.message}`)
      }
      console.log("File uploaded successfully:", uploadData)

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("invoices").getPublicUrl(fileName)
      console.log("Public URL:", publicUrl)

      // Check for duplicate invoice number
      console.log("Checking for duplicate invoice number:", extractedData.invoice_number)
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .eq("invoice_number", extractedData.invoice_number)
        .single()

      if (existingInvoice) {
        console.error("Duplicate invoice number found:", existingInvoice)
        throw new Error(`Invoice number "${extractedData.invoice_number}" already exists! Please use a unique invoice number.`)
      }

      // Calculate status based on due date (overdue if more than 7 days past due)
      let status = "submitted"
      if (extractedData.due_date) {
        const dueDate = new Date(extractedData.due_date)
        const today = new Date()
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysPastDue > 7) {
          status = "overdue"
          console.log(`Invoice is ${daysPastDue} days past due - marking as overdue`)
        }
      }

      // Create invoice record for the selected vendor
      const invoiceData = {
        user_id: selectedVendorId,
        invoice_number: extractedData.invoice_number,
        vendor_name: vendorName,
        amount: extractedData.amount,
        due_date: extractedData.due_date,
        invoice_date: extractedData.invoice_date,
        file_url: publicUrl,
        status: status,
        description: `Admin uploaded from ${file.name}`,
      }
      
      console.log("Inserting invoice record:", invoiceData)
      toast.info("Saving invoice to database...")
      
      const { data: insertedData, error: insertError } = await supabase
        .from("invoices")
        .insert(invoiceData)
        .select()
        .single()

      if (insertError) {
        console.error("=== DATABASE INSERT ERROR ===")
        console.error("Full error object:", JSON.stringify(insertError, null, 2))
        throw new Error(`Database error: ${insertError.message || insertError.code || 'Unknown error'}`)
      }
      console.log("✅ Invoice saved successfully:", insertedData)

      toast.success(`Invoice uploaded successfully for ${vendorName}!`)
      
      // Reset form
      setFile(null)
      setPreview(null)
      setExtractedData(null)
      setSelectedVendorId("")
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ""
      
      // Callback to refresh parent component
      if (onUploadSuccess) onUploadSuccess()
      
    } catch (err: any) {
      console.error("Upload error:", err)
      toast.error(err.message || "Upload failed. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Admin Upload Invoice
        </CardTitle>
        <CardDescription className="text-slate-400">
          Upload invoice for a vendor - AI will extract data automatically
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-6">
          {/* Vendor Selection */}
          <div className="space-y-2">
            <Label htmlFor="vendor" className="text-slate-200">
              Select Vendor *
            </Label>
            {loadingVendors ? (
              <div className="flex items-center gap-2 p-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading vendors...
              </div>
            ) : (
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId} required>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
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
                        <span>{vendor.full_name || vendor.email}</span>
                        {vendor.company_name && (
                          <span className="text-xs text-slate-500">{vendor.company_name}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file" className="text-slate-200">
              Select Invoice File
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="bg-slate-800 border-slate-600 text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                disabled={loading || extracting}
              />
              {file && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFile(null)
                    setPreview(null)
                    setExtractedData(null)
                  }}
                  disabled={loading || extracting}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-400">Supported: PDF, JPG, PNG (Max 50MB)</p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <Label className="text-slate-200">Preview</Label>
              <div className="rounded-lg border border-slate-600 overflow-hidden">
                <img src={preview} alt="Invoice preview" className="w-full h-auto max-h-64 object-contain bg-slate-800" />
              </div>
            </div>
          )}

          {file && file.type === "application/pdf" && (
            <div className="flex items-center gap-2 p-4 bg-slate-800 rounded-lg border border-slate-600">
              <FileText className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-slate-200">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <div className="space-y-3 p-4 bg-slate-800 rounded-lg border border-slate-600">
              <Label className="text-slate-200">Extracted Data</Label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-400">Invoice #:</span>
                  <p className="text-slate-200 font-medium">{extractedData.invoice_number || "N/A"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Extracted Vendor:</span>
                  <p className="text-slate-200 font-medium">{extractedData.vendor_name || "N/A"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Amount:</span>
                  <p className="text-slate-200 font-medium">
                    ${extractedData.amount !== null ? extractedData.amount.toFixed(2) : "0.00"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Due Date:</span>
                  <p className="text-slate-200 font-medium">
                    {extractedData.due_date ? new Date(extractedData.due_date).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!extractedData && file && (
              <Button
                type="button"
                onClick={handleExtractData}
                disabled={extracting || loading || !selectedVendorId}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting with AI...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Extract Data
                  </>
                )}
              </Button>
            )}

            {extractedData && (
              <Button
                type="submit"
                disabled={loading || extracting || !selectedVendorId}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Save Invoice
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
