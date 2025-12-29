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
      // Validation
      if (!email || !password) {
        throw new Error("Email and password are required")
      }
      
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters")
      }

      if (!fullName || fullName.trim().length < 2) {
        throw new Error("Please enter your full name")
      }

      const supabase = createClient()
      
      console.log("Attempting to sign up user:", email.trim())
      
      // Sign up the user with auto-confirm
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            company_name: companyName?.trim() || null,
          },
          // This helps with auto-confirmation in development
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      console.log("SignUp response:", { 
        user: data?.user?.id, 
        session: data?.session ? "Session exists" : "No session",
        confirmed: data?.user?.confirmed_at ? "Confirmed" : "Not confirmed",
        error: authError 
      })

      if (authError) {
        console.error("Supabase auth error:", {
          message: authError.message,
          status: authError.status,
          name: authError.name
        })
        
        // Provide user-friendly error messages
        if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
          throw new Error("This email is already registered. Please sign in instead.")
        } else if (authError.message.includes('invalid') || authError.message.includes('email')) {
          throw new Error("Please enter a valid email address")
        } else if (authError.message.includes('Database error')) {
          // User was created despite error - they can login
          console.log("⚠️ Database error but user may be created")
          setError("Account created! Please sign in with your email and password.")
          setTimeout(() => router.push("/auth/login"), 3000)
          return
        } else {
          throw new Error(authError.message || "Sign up failed. Please try again.")
        }
      }

      // Check if user was created
      if (data?.user) {
        console.log("✅ User signed up successfully:", data.user.id)
        
        // Check if we have a session (means auto-confirmed and logged in)
        if (data.session) {
          console.log("✅ User is auto-confirmed with session - creating profile")
          
          // Try to create profile since we're logged in
          try {
            const { error: profileError } = await supabase
              .from("profiles")
              .insert({
                id: data.user.id,
                email: email.trim(),
                full_name: fullName.trim(),
                company_name: companyName?.trim() || null,
                role: "vendor"
              })

            if (profileError) {
              console.error("Profile creation error:", profileError)
              // Profile might exist, try update
              await supabase
                .from("profiles")
                .update({
                  full_name: fullName.trim(),
                  company_name: companyName?.trim() || null,
                })
                .eq("id", data.user.id)
            }
          } catch (err) {
            console.error("Profile operation failed:", err)
          }
          
          // Auto-login successful, go to dashboard
          console.log("✅ Redirecting to dashboard with active session")
          router.push("/dashboard")
        } else {
          // No session means email confirmation required
          console.log("⚠️ No session - email confirmation may be required")
          setError("Account created! Please check your email to confirm, or try signing in.")
          setTimeout(() => router.push("/auth/login"), 3000)
        }
      } else {
        throw new Error("Sign up failed - no user data returned. Please try again.")
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
              <label className="text-sm font-medium text-slate-100">Full Name *</label>
              <Input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-slate-50 placeholder:text-slate-500"
                disabled={loading}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Email *</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-800 border-slate-600 text-slate-50 placeholder:text-slate-500"
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Password *</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800 border-slate-600 text-slate-50 placeholder:text-slate-500"
                disabled={loading}
                required
                minLength={6}
              />
              <p className="text-xs text-slate-400">Minimum 6 characters</p>
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
