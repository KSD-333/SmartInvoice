"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { backendAPI } from "@/lib/api/backend"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Upload, FileText, Loader2, Building2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface ExtractedData {
  invoice_number: string | null
  vendor_name: string | null
  amount: number | null
  due_date: string | null
  invoice_date: string | null
}

interface Company {
  id: string
  name: string
}

export default function UploadInvoice({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; email: string; id: string } | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  // Fetch vendor profile and approved companies on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Fetch profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("id", user.id)
            .single()
          
          if (profile) {
            setUserProfile(profile)
          }

          // Fetch approved companies for this vendor
          const { data: relationships, error: relError } = await supabase
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

          if (!relError && relationships) {
            const companiesList = relationships
              .map((rel: any) => rel.companies)
              .filter(Boolean)
            setCompanies(companiesList)
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchData()
  }, [])

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
      
      // Check if we got valid data
      const hasValidData = response.data.invoice_no || response.data.vendor_name || 
                          (response.data.amount && response.data.amount > 0)
      
      if (!hasValidData) {
        console.warn('No valid data extracted, using defaults')
        toast.warning("Extraction completed but found limited data. Please review and edit.")
      } else {
        toast.success("Invoice data extracted successfully!")
      }
      
      // Map the response to our format
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
      // Set default values if extraction fails
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
    if (!file) {
      toast.error("Please select a file")
      return
    }

    if (!selectedCompany) {
      toast.error("Please select a company")
      return
    }

    // Extract data first if not already extracted
    if (!extractedData) {
      await handleExtractData()
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      console.log("Getting user...")
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error("Not authenticated")
      console.log("User authenticated:", user.id)

      // Fetch user profile to get vendor name
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single()

      if (profileError) {
        console.error("Profile fetch error:", profileError)
      }

      const vendorName = profile?.full_name || profile?.email || "Unknown Vendor"
      console.log("Using vendor name from profile:", vendorName)

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
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
      const { data: existingInvoice, error: checkError } = await supabase
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

      // Create invoice record with extracted data
      const invoiceData = {
        user_id: user.id,
        company_id: selectedCompany,
        invoice_number: extractedData.invoice_number,
        vendor_name: vendorName, // Use vendor's profile name instead of OCR extracted name
        amount: extractedData.amount, // Keep the extracted amount
        due_date: extractedData.due_date,
        invoice_date: extractedData.invoice_date,
        file_url: publicUrl,
        status: status,
        description: notes || `Auto-uploaded from ${file.name}`,
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
        console.error("Error code:", insertError.code)
        console.error("Error message:", insertError.message)
        console.error("Error details:", insertError.details)
        console.error("Error hint:", insertError.hint)
        console.error("Data attempted to insert:", JSON.stringify(invoiceData, null, 2))
        
        // Check if it's a policy error
        if (insertError.code === '42501' || insertError.message?.includes('policy')) {
          throw new Error("Permission denied: You don't have permission to insert invoices. Please check RLS policies in Supabase.")
        }
        
        throw new Error(`Database error: ${insertError.message || insertError.code || 'Unknown error'}`)
      }
      console.log("✅ Invoice saved successfully:", insertedData)

      toast.success("Invoice uploaded and saved successfully!")
      
      // Reset form
      setFile(null)
      setPreview(null)
      setExtractedData(null)
      setSelectedCompany("")
      setNotes("")
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ""
      
      // Callback to refresh parent component
      if (onUploadSuccess) onUploadSuccess()
      
    } catch (err: any) {
      console.error("Upload error:", err)
      
      // Better error message extraction
      let errorMessage = "Upload failed"
      
      if (err?.message) {
        errorMessage = err.message
      } else if (err?.error_description) {
        errorMessage = err.error_description
      } else if (err?.error) {
        errorMessage = err.error
      } else if (typeof err === 'string') {
        errorMessage = err
      } else if (err?.details) {
        errorMessage = err.details
      } else {
        errorMessage = "Upload failed. Please check your connection and try again."
      }
      
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Invoice
        </CardTitle>
        <CardDescription className="text-slate-400">
          Upload PDF or image - AI will extract invoice data automatically
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-6">
          {/* Company Selection */}
          <div className="space-y-2">
            <Label htmlFor="company" className="text-slate-200 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Select Company *
            </Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany} disabled={loading || extracting}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200">
                <SelectValue placeholder="Choose a company to send invoice to" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {companies.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    No approved companies yet. Contact admin to get approved.
                  </div>
                ) : (
                  companies.map((company) => (
                    <SelectItem key={company.id} value={company.id} className="text-slate-200">
                      {company.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">Companies you are approved to supply to</p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file" className="text-slate-200">
              Select Invoice File *
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

          {/* Optional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-slate-200">
              Optional Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or comments about this invoice..."
              className="bg-slate-800 border-slate-600 text-slate-200 min-h-[80px]"
              disabled={loading || extracting}
            />
            <p className="text-xs text-slate-400">Optional: Add context or special instructions</p>
          </div>

          {/* Vendor Name Display */}
          {userProfile && selectedCompany && (
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <Label className="text-slate-300 text-xs">Invoice Details</Label>
              <div className="mt-1 space-y-1">
                <p className="text-slate-200 text-sm">
                  <span className="text-slate-400">From:</span>{" "}
                  <span className="font-semibold text-blue-400">{userProfile.full_name || userProfile.email}</span>
                </p>
                <p className="text-slate-200 text-sm">
                  <span className="text-slate-400">To:</span>{" "}
                  <span className="font-semibold text-blue-400">
                    {companies.find(c => c.id === selectedCompany)?.name || "Selected Company"}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <div className="space-y-3 p-4 bg-slate-800 rounded-lg border border-slate-600">
              <Label className="text-slate-200">Extracted Data from Invoice</Label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-400">Invoice #:</span>
                  <p className="text-slate-200 font-medium">{extractedData.invoice_number || "N/A"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Amount:</span>
                  <p className="text-slate-200 font-medium">
                    ${extractedData.amount !== null ? extractedData.amount.toFixed(2) : "0.00"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Invoice Date:</span>
                  <p className="text-slate-200 font-medium">
                    {extractedData.invoice_date ? new Date(extractedData.invoice_date).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Due Date:</span>
                  <p className="text-slate-200 font-medium">
                    {extractedData.due_date ? new Date(extractedData.due_date).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Vendor name will be set to: <span className="text-blue-400 font-medium">{userProfile?.full_name || userProfile?.email || "Your Profile Name"}</span></p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Cancel Button - Always visible */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFile(null)
                setPreview(null)
                setExtractedData(null)
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
                if (fileInput) fileInput.value = ""
                toast.info("Upload cancelled")
              }}
              disabled={loading || extracting}
              className="flex-1"
            >
              Cancel
            </Button>

            {/* Re-upload Button - Show after data extracted */}
            {extractedData && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                  setExtractedData(null)
                  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
                  if (fileInput) fileInput.value = ""
                  toast.info("Ready to upload a new file")
                }}
                disabled={loading || extracting}
                className="flex-1 border-blue-500 text-blue-400 hover:bg-blue-500/10"
              >
                <Upload className="h-4 w-4 mr-2" />
                Re-upload
              </Button>
            )}

            {/* Extract Data Button - Show when file selected but not extracted */}
            {!extractedData && file && (
              <Button
                type="button"
                onClick={handleExtractData}
                disabled={extracting || loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Extract Data
                  </>
                )}
              </Button>
            )}

            {/* Save Invoice Button - Show after data extracted */}
            {extractedData && (
              <Button
                type="submit"
                disabled={loading || extracting}
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
