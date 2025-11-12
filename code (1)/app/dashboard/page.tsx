"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import InvoiceList from "@/components/invoices/invoice-list"
import ChatBot from "@/components/chatbot/chat-bot"
import UploadInvoice from "@/components/invoices/upload-invoice"

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push("/auth/login")
        return
      }

      setUser(user)

      // Fetch user role - select all fields to debug
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      // If profile doesn't exist, create it
      if (profileError && profileError.code === 'PGRST116') {
        console.log("Profile not found, creating...")
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            role: "user",
            full_name: user.email?.split("@")[0]
          })
          .select()
          .single()
        
        if (!createError) {
          profile = newProfile
        } else {
          console.error("Failed to create profile:", createError)
        }
      }

      setUserRole(profile?.role || "user")

      // Fetch invoices
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
      
      setInvoices(invoicesData || [])
      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-slate-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-50">Invoice Manager</h1>
            <span
              className={`px-3 py-1 rounded text-xs font-semibold ${
                userRole === "admin"
                  ? "bg-red-900/30 text-red-200 border border-red-800"
                  : "bg-blue-900/30 text-blue-200 border border-blue-800"
              }`}
            >
              {userRole?.toUpperCase() || "USER"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-300">{user?.email}</span>
            
            {userRole === "admin" && (
              <Button
                variant="outline"
                onClick={() => {
                  router.push("/admin")
                }}
              >
                Admin Panel
              </Button>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push("/")
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="invoices" className="text-slate-300 data-[state=active]:text-slate-50">
              Invoices
            </TabsTrigger>
            {userRole === "admin" && (
              <TabsTrigger value="upload" className="text-slate-300 data-[state=active]:text-slate-50">
                Upload
              </TabsTrigger>
            )}
            <TabsTrigger value="chat" className="text-slate-300 data-[state=active]:text-slate-50">
              AI Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <InvoiceList invoices={invoices} />
          </TabsContent>

          {userRole === "admin" && (
            <TabsContent value="upload">
              <UploadInvoice />
            </TabsContent>
          )}

          <TabsContent value="chat">
            <ChatBot />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
