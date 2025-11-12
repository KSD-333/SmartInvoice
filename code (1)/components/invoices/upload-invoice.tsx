"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function UploadInvoice() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setMessage({ type: "error", text: "Please select a file" })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error("Not authenticated")

      // Upload file
      const fileName = `${user.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from("invoices").upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("invoices").getPublicUrl(fileName)

      // Create invoice record (in production, this would extract data via OCR)
      const { error: insertError } = await supabase.from("invoices").insert({
        user_id: user.id,
        invoice_number: `INV-${Date.now()}`,
        vendor_name: "Unknown Vendor",
        amount: 0,
        due_date: new Date().toISOString().split("T")[0],
        file_url: publicUrl,
      })

      if (insertError) throw insertError

      setMessage({
        type: "success",
        text: "Invoice uploaded successfully! OCR processing will extract the details.",
      })
      setFile(null)
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Upload failed",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Upload Invoice</CardTitle>
        <CardDescription className="text-slate-300">
          Upload a PDF or image of an invoice to extract data automatically
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-4">
          {message && (
            <Alert
              variant={message.type === "error" ? "destructive" : "default"}
              className={message.type === "error" ? "bg-red-900/20 border-red-700" : "bg-green-900/20 border-green-700"}
            >
              <AlertDescription className={message.type === "error" ? "text-red-300" : "text-green-300"}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100">Select File</label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500"
              disabled={loading}
            />
            <p className="text-xs text-slate-300">Supported formats: PDF, JPG, PNG (Max 10MB)</p>
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading || !file}>
            {loading ? "Uploading..." : "Upload Invoice"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
