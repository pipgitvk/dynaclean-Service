"use client";

import Link from "next/link";
import { ChevronLeft, ReceiptIndianRupee } from "lucide-react";
import AddExpenseForm from "@/components/expenses/SbiAddExpenseForm";

export default function UserDashboardExpenseAddClient() {
  const listHref = "/user-dashboard/expenses";

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-violet-50/50 via-white to-slate-50 pb-12 pt-2 sm:pt-3">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-violet-100/40 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl px-3 sm:px-4">
        <Link
          href={listHref}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 text-sm font-semibold text-violet-700 hover:text-violet-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to My Expenses
        </Link>

        <div className="overflow-visible rounded-2xl border border-violet-100/90 bg-white/95 p-4 shadow-[0_20px_50px_-20px_rgba(91,33,182,0.22)] backdrop-blur-sm sm:p-6">
          <header className="mb-6 flex flex-col gap-3 border-b border-violet-100/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 p-2.5 text-white shadow-lg shadow-violet-500/25">
                <ReceiptIndianRupee className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Add Expense</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  Travel, food, hotel, and other field expenses — same rules as approval dashboard
                </p>
              </div>
            </div>
          </header>

          <AddExpenseForm successRedirect={listHref} uiVariant="sbi" />
        </div>
      </div>
    </div>
  );
}