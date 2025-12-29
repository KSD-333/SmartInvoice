"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface DashboardStatsProps {
  invoices: any[]
}

export default function DashboardStats({ invoices }: DashboardStatsProps) {
  const totalInvoices = invoices.length
  const pendingReview = invoices.filter(inv => inv.status === "submitted").length
  const approved = invoices.filter(inv => inv.status === "approved" || inv.status === "paid").length
  const rejected = invoices.filter(inv => inv.status === "rejected").length
  const needsCorrection = invoices.filter(inv => inv.status === "overdue").length

  const stats = [
    {
      title: "Total Invoices",
      value: totalInvoices,
      icon: FileText,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      title: "Pending Review",
      value: pendingReview,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/20",
    },
    {
      title: "Approved",
      value: approved,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
    },
    {
      title: "Rejected",
      value: rejected,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
    },
  ]

  if (needsCorrection > 0) {
    stats.push({
      title: "Needs Correction",
      value: needsCorrection,
      icon: AlertCircle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className={`border ${stat.borderColor} bg-slate-800/50 backdrop-blur`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">
              {stat.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{stat.value}</div>
            <p className="text-xs text-slate-400 mt-1">
              {stat.value === 1 ? "invoice" : "invoices"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
