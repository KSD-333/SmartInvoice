"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Bell, CheckCircle, Clock, AlertCircle, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function NotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
    fetchNotifications(user.id)
  }

  const fetchNotifications = async (userId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setNotifications(data)
    }
    setLoading(false)
  }

  const markAsRead = async (notificationId: string) => {
    const supabase = createClient()
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId)

    setNotifications(notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = async () => {
    if (!user) return
    const supabase = createClient()
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)

    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment_released":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "status_change":
        return <Clock className="h-5 w-5 text-blue-500" />
      case "comment_added":
        return <MessageSquare className="h-5 w-5 text-purple-500" />
      default:
        return <Bell className="h-5 w-5 text-slate-400" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "payment_released":
        return "bg-green-500/10 border-green-500/20"
      case "status_change":
        return "bg-blue-500/10 border-blue-500/20"
      case "comment_added":
        return "bg-purple-500/10 border-purple-500/20"
      default:
        return "bg-slate-500/10 border-slate-500/20"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-slate-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
                <h1 className="text-2xl font-bold text-slate-50">Notifications</h1>
                <p className="text-sm text-slate-400">
                  {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline">
                Mark All as Read
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {notifications.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">
                No notifications yet
              </h3>
              <p className="text-slate-400">
                You'll see updates about your invoices here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`border ${getNotificationColor(notification.type)} ${
                  !notification.read ? "bg-slate-800" : "bg-slate-800/50"
                } cursor-pointer transition-colors hover:bg-slate-800`}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-lg p-2 ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-200 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-slate-400 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        {!notification.read && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
