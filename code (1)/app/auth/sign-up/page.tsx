"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          // Don't use emailRedirectTo for local development
          // emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) throw authError

      if (data?.user) {
        // Wait a moment for the user session to be established
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Create profile using the regular client (user is now authenticated)
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: "vendor",
          company_name: companyName || null,
        })

        if (profileError) {
          console.error("Profile creation error details:", {
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint
          })
          // Profile might already exist from trigger or RLS might block, that's okay
          // The user can still log in
        }

        router.push("/auth/sign-up-success")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-700">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-bold text-slate-50">Create Account</CardTitle>
          <CardDescription className="text-slate-300">Sign up to get started with invoice management</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-950 border-red-800">
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Full Name</label>
              <Input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-slate-50 placeholder:text-slate-500"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-800 border-slate-600 text-slate-50 placeholder:text-slate-500"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800 border-slate-600 text-slate-50 placeholder:text-slate-500"
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Company Name (Optional)</label>
              <Input
                type="text"
                placeholder="Your Company Ltd."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-slate-50 placeholder:text-slate-500"
                disabled={loading}
              />
              <p className="text-xs text-slate-400">All accounts are Vendor accounts with full invoice management</p>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <p className="text-center text-sm text-slate-400 mt-4">
            Already have an account?{" "}
            <a href="/auth/login" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
