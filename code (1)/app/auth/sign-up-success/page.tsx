import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 text-center">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-white">Account Created!</CardTitle>
          <CardDescription className="text-slate-400">Please check your email to confirm your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-300">
            We've sent a confirmation link to your email address. Click the link to verify your account and get started.
          </p>
          <Link href="/auth/login" className="block">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">Back to Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
