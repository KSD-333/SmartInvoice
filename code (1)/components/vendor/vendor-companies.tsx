"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Mail, Phone, MapPin, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Company {
  id: string
  name: string
  description: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
}

interface VendorCompanyRelationship {
  id: string
  company_id: string
  status: "pending" | "approved" | "blocked"
  approved_at: string | null
  notes: string | null
  created_at: string
  companies: Company
  invoice_count?: number
}

export default function VendorCompanies() {
  const [relationships, setRelationships] = useState<VendorCompanyRelationship[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompanyRelationships()
  }, [])

  const fetchCompanyRelationships = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error("Please sign in to view companies")
        return
      }

      // Fetch vendor company relationships with company details
      const { data: relationshipsData, error: relError } = await supabase
        .from("vendor_company_relationships")
        .select(`
          id,
          company_id,
          status,
          approved_at,
          notes,
          created_at,
          companies (
            id,
            name,
            description,
            contact_email,
            contact_phone,
            address
          )
        `)
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false })

      if (relError) throw relError

      // Fetch invoice counts per company
      const { data: invoiceCounts, error: countError } = await supabase
        .from("invoices")
        .select("company_id")
        .eq("user_id", user.id)

      if (countError) throw countError

      // Calculate counts
      const countsMap = (invoiceCounts || []).reduce((acc: any, inv) => {
        acc[inv.company_id] = (acc[inv.company_id] || 0) + 1
        return acc
      }, {})

      // Add counts to relationships
      const enrichedData = (relationshipsData || []).map((rel: any) => ({
        ...rel,
        invoice_count: countsMap[rel.company_id] || 0,
      }))

      setRelationships(enrichedData)
    } catch (error: any) {
      console.error("Error fetching companies:", error)
      toast.error("Failed to load companies")
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      approved: { color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle, label: "Approved" },
      pending: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: Clock, label: "Pending" },
      blocked: { color: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle, label: "Blocked" },
    }
    const badge = badges[status as keyof typeof badges] || badges.pending
    const Icon = badge.icon
    return (
      <Badge className={`${badge.color} border flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-50">Companies I Supply To</h2>
          <p className="text-slate-400 text-sm">Manage your relationships with client companies</p>
        </div>
        <Badge variant="outline" className="text-slate-300">
          {relationships.length} {relationships.length === 1 ? "Company" : "Companies"}
        </Badge>
      </div>

      {relationships.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">No Companies Yet</h3>
            <p className="text-slate-400 text-sm">
              Contact your admin to get approved as a vendor for companies
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {relationships.map((relationship) => (
            <Card key={relationship.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-400" />
                    <CardTitle className="text-lg text-slate-50">
                      {relationship.companies.name}
                    </CardTitle>
                  </div>
                  {getStatusBadge(relationship.status)}
                </div>
                {relationship.companies.description && (
                  <CardDescription className="text-slate-400 text-sm mt-2">
                    {relationship.companies.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Contact Information */}
                <div className="space-y-2">
                  {relationship.companies.contact_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-300 truncate">{relationship.companies.contact_email}</span>
                    </div>
                  )}
                  {relationship.companies.contact_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-300">{relationship.companies.contact_phone}</span>
                    </div>
                  )}
                  {relationship.companies.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-slate-500 mt-0.5" />
                      <span className="text-slate-300">{relationship.companies.address}</span>
                    </div>
                  )}
                </div>

                {/* Invoice Count */}
                <div className="pt-3 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Invoices Sent</span>
                    <Badge variant="outline" className="text-slate-300">
                      {relationship.invoice_count || 0}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                {relationship.status === "approved" && (
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => window.location.href = `/dashboard?company=${relationship.company_id}`}
                  >
                    View Invoices
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
