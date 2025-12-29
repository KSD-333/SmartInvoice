"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send } from "lucide-react"

interface Comment {
  id: string
  comment: string
  created_at: string
  user_id: string
  profiles: {
    email: string
    full_name: string
    role: string
  }
}

interface InvoiceCommentsProps {
  invoiceId: string
}

export default function InvoiceComments({ invoiceId }: InvoiceCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [invoiceId])

  const fetchComments = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("invoice_comments")
        .select(`
          id,
          comment,
          created_at,
          user_id,
          profiles:user_id (
            email,
            full_name,
            role
          )
        `)
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error("Error fetching comments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.error("User not authenticated")
        return
      }

      const { error } = await supabase.from("invoice_comments").insert({
        invoice_id: invoiceId,
        user_id: user.id,
        comment: newComment.trim(),
      })

      if (error) throw error

      setNewComment("")
      await fetchComments()
    } catch (error) {
      console.error("Error adding comment:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-200">Comments & Communication</h3>

      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <p className="text-center text-slate-400">
              No comments yet. Start the conversation!
            </p>
          </Card>
        ) : (
          comments.map((comment) => (
            <Card
              key={comment.id}
              className="p-4 bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 bg-slate-700 flex items-center justify-center">
                  <span className="text-xs font-medium text-slate-300">
                    {comment.profiles.email?.[0]?.toUpperCase() || "?"}
                  </span>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">
                      {comment.profiles.full_name || comment.profiles.email}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        comment.profiles.role === "admin"
                          ? "bg-red-900/30 text-red-200 border-red-800"
                          : "bg-green-900/30 text-green-200 border-green-800"
                      }
                    >
                      {comment.profiles.role}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {comment.comment}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder="Add a comment... (e.g., reason for rejection, clarification request, payment confirmation)"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[100px] bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Post Comment
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
