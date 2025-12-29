import { generateText } from "ai"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const { message, userId } = await request.json()

    if (!message || !userId) {
      return Response.json({ error: "Missing message or userId" }, { status: 400 })
    }

    
    const admin = createAdminClient()

    // Fetch user's invoices for context
    const { data: invoices, error: invoiceError } = await admin
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true })

    if (invoiceError) throw invoiceError

    // Build context for AI
    const invoiceContext = invoices
      ?.map(
        (inv) =>
          `Invoice #${inv.invoice_number} from ${inv.vendor_name}: $${inv.amount} (${inv.status}, due ${inv.due_date})`,
      )
      .join("\n")

    const systemPrompt = `You are an intelligent invoice management assistant. Help users understand and manage their invoices. 
    
Current invoices:
${invoiceContext || "No invoices found"}

Provide concise, helpful answers about invoice status, amounts, and due dates.`

    const { text: response } = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      prompt: message,
    })

    return Response.json({ response })
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return Response.json({ error: "Failed to process chat request" }, { status: 500 })
  }
}
