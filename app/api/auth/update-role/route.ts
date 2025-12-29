import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { userId, newRole } = await request.json()

    if (!userId || !newRole || !["user", "admin"].includes(newRole)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const admin = createAdminClient()

    // Update the user's role in profiles table
    const { error } = await admin.from("profiles").update({ role: newRole }).eq("id", userId)

    if (error) throw error

    return NextResponse.json({ success: true, message: `User role updated to ${newRole}` })
  } catch (error) {
    console.error("[v0] Role update error:", error)
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 })
  }
}
