"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, User, Mail, Building2, Lock, Trash2, Loader2, Phone, CreditCard, MapPin, Map } from "lucide-react"
import { toast } from "sonner"

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: "",
    company_name: "",
    mobile: "",
    gst_number: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      router.push("/auth/login")
      return
    }

    setUser(user)
    fetchProfile(user.id)
  }

  const fetchProfile = async (userId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (!error && data) {
      setProfile(data)
      setFormData({
        full_name: data.full_name || "",
        company_name: data.company_name || "",
        mobile: data.mobile || "",
        gst_number: data.gst_number || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        country: data.country || "India",
      })
    }
    setLoading(false)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name,
        company_name: formData.company_name,
        mobile: formData.mobile,
        gst_number: formData.gst_number,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        country: formData.country,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (error) {
      toast.error("Failed to update profile")
      console.error(error)
    } else {
      toast.success("Profile updated successfully")
      fetchProfile(user.id)
    }
    setSaving(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!passwordData.currentPassword) {
      toast.error("Please enter your current password")
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords don't match")
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setChangingPassword(true)
    const supabase = createClient()

    // First verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: passwordData.currentPassword,
    })

    if (signInError) {
      toast.error("Current password is incorrect")
      setChangingPassword(false)
      return
    }

    // Now update to new password
    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword
    })

    if (error) {
      toast.error("Failed to change password: " + error.message)
    } else {
      toast.success("Password changed successfully")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setShowPasswordForm(false)
    }
    setChangingPassword(false)
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    const supabase = createClient()
    
    // Delete profile (cascades to invoices, comments, etc.)
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id)

    if (profileError) {
      toast.error("Failed to delete account")
      return
    }

    // Sign out and redirect
    await supabase.auth.signOut()
    toast.success("Account deleted successfully")
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-slate-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard")}
              className="text-slate-300 hover:text-slate-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-50">Profile Settings</h1>
              <p className="text-sm text-slate-400">Manage your account preferences</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          {/* Personal Information */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-50">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription className="text-slate-400">
                Update your personal details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-slate-200">
                    Full Name *
                  </Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Doe"
                    className="bg-slate-700 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-slate-200">
                    Company Name
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Acme Corp"
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-slate-200">
                    Mobile Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gst_number" className="text-slate-200">
                    GST Number
                  </Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="gst_number"
                      value={formData.gst_number}
                      onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                      placeholder="22AAAAA0000A1Z5"
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-slate-200">
                    Address
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Main Street"
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-slate-200">
                      City
                    </Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Mumbai"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-slate-200">
                      State
                    </Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="Maharashtra"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pincode" className="text-slate-200">
                      Pincode
                    </Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="400001"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-slate-200">
                      Country
                    </Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="India"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="pl-10 bg-slate-900 border-slate-600 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Email cannot be changed for security reasons
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-50">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription className="text-slate-400">
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showPasswordForm ? (
                <Button
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-slate-200">
                      Current Password *
                    </Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                    <p className="text-xs text-slate-500">
                      You must confirm your current password before changing it
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-slate-200">
                      New Password *
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-200">
                      Confirm New Password *
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForm(false)
                        setPasswordData({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        })
                      }}
                      className="flex-1"
                      disabled={changingPassword}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={changingPassword}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {changingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Changing...
                        </>
                      ) : (
                        "Confirm Change"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-slate-800 border-red-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription className="text-slate-400">
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
                <h4 className="text-sm font-semibold text-red-400 mb-2">
                  Delete Account
                </h4>
                <p className="text-sm text-slate-400 mb-4">
                  Once you delete your account, there is no going back. All your invoices and data will be permanently removed.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete My Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-800 border-slate-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-50">
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        This action cannot be undone. This will permanently delete your account
                        and remove all your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-slate-700 text-slate-200 hover:bg-slate-600">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Yes, delete my account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
