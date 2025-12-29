"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>("")

  const checkSetup = async () => {
    setLoading(true)
    setError("")
    setResult(null)

    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setError("Not authenticated. Please sign in first.")
        return
      }

      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      setResult({
        user: {
          id: user.id,
          email: user.email,
        },
        profile: profile || null,
        profileError: profileError?.message || null,
      })

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createProfile = async () => {
    setLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError("Not authenticated")
        return
      }

      // Try to create profile
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          role: "admin", // Create as admin directly!
          full_name: user.email?.split("@")[0]
        })
        .select()
        .single()

      if (error) {
        setError(`Failed to create profile: ${error.message}`)
      } else {
        setResult({ ...result, profile: data })
        alert("✅ Profile created as ADMIN! Refresh the dashboard page.")
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-50">🔧 Setup Diagnostics</CardTitle>
            <CardDescription className="text-slate-400">
              Check your profile and database setup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={checkSetup} 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "Checking..." : "Check Setup"}
              </Button>

              {result && !result.profile && (
                <Button 
                  onClick={createProfile} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? "Creating..." : "Create Admin Profile"}
                </Button>
              )}
            </div>

            {error && (
              <Alert className="bg-red-900/20 border-red-700">
                <AlertDescription className="text-red-300">
                  ❌ {error}
                </AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-4">
                <Alert className="bg-green-900/20 border-green-700">
                  <AlertDescription className="text-green-300">
                    ✅ User authenticated: {result.user.email}
                  </AlertDescription>
                </Alert>

                {result.profile ? (
                  <Alert className="bg-blue-900/20 border-blue-700">
                    <AlertDescription className="text-blue-300 space-y-2">
                      <div>✅ Profile exists</div>
                      <div className="font-mono text-xs bg-slate-950 p-3 rounded mt-2">
                        ID: {result.profile.id}<br/>
                        Email: {result.profile.email}<br/>
                        Role: <span className={result.profile.role === 'admin' ? 'text-red-400 font-bold' : 'text-yellow-400'}>
                          {result.profile.role?.toUpperCase()}
                        </span><br/>
                        Name: {result.profile.full_name || 'Not set'}
                      </div>
                      {result.profile.role === 'admin' ? (
                        <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded">
                          🎉 You are an ADMIN! Go to <a href="/dashboard" className="underline">Dashboard</a>
                        </div>
                      ) : (
                        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
                          ⚠️ You are a USER. Go to Supabase and change your role to 'admin'
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-yellow-900/20 border-yellow-700">
                    <AlertDescription className="text-yellow-300">
                      ⚠️ No profile found. Click "Create Admin Profile" to create one!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-50">📋 Setup Checklist</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-2">
            <div>1. ✅ Run SQL script in Supabase</div>
            <div>2. ⏳ Check if profile exists (use button above)</div>
            <div>3. ⏳ Make sure role is "admin"</div>
            <div>4. ⏳ Refresh dashboard to see Admin Panel button</div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = "/dashboard"}
            className="border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
