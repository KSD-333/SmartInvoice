import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-balance">AI-Powered Invoice Management</h1>
            <p className="text-xl text-slate-300 text-pretty">
              Upload, extract, organize, and pay invoices with intelligent AI assistance. Get real-time insights about
              your expenses.
            </p>
          </div>

          <div className="flex gap-4 justify-center pt-8">
            <Link href="/auth/login">
              <Button size="lg" variant="default">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button size="lg" variant="outline">
                Create Account
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-20">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Smart OCR</CardTitle>
              <CardDescription className="text-slate-400">Automatically extract invoice data</CardDescription>
            </CardHeader>
            <CardContent className="text-slate-300">
              Upload invoices and let AI extract vendor names, amounts, and due dates instantly.
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>AI Chatbot</CardTitle>
              <CardDescription className="text-slate-400">Ask questions about your invoices</CardDescription>
            </CardHeader>
            <CardContent className="text-slate-300">
              "Show unpaid invoices" or "What's my total due?" Get instant answers from AI.
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Real-time Updates</CardTitle>
              <CardDescription className="text-slate-400">Stay on top of payments</CardDescription>
            </CardHeader>
            <CardContent className="text-slate-300">
              Track payment status, get reminders, and manage overdue invoices efficiently.
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
