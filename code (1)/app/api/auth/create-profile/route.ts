import { adminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Use admin client to create user profile
    const { data, error } = await adminClient.from("profiles").insert({
      id: userId,
      email,
      role: "user",
      full_name: email.split("@")[0], // Use email prefix as default name
    }).select().single()

    if (error) {
      console.error("Profile creation error:", error)
      throw error
    }

    return NextResponse.json({ success: true, profile: data })
  } catch (error) {
    console.error("Profile creation error:", error)
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
  }
}
