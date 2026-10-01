"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, CheckCircle2, Info, AlertCircle } from "lucide-react"

type Status =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "uploading" }
  | { kind: "success"; title: string; pageCount: number | null; chunkCount: number }
  | { kind: "duplicate"; title: string }
  | { kind: "error"; message: string }

function isPdf(file: File): boolean {
  const nameOk = file.name.toLowerCase().endsWith(".pdf")
  const typeOk = file.type === "application/pdf"
  return nameOk && typeOk
}

export function ManualUpload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  async function handleFile(file: File) {
    if (!isPdf(file)) {
      setStatus({ kind: "invalid", message: "Please choose a PDF file." })
      return
    }

    setStatus({ kind: "uploading" })

    const form = new FormData()
    form.append("file", file)

    try {
      const res = await fetch("/api/ai/knowledge/upload", {
        method: "POST",
        body: form,
      })

      let body: {
        title?: string
        pageCount?: number | null
        chunkCount?: number
        error?: string
      } = {}
      try {
        body = await res.json()
      } catch {
        // Non-JSON response — leave body empty and fall through to generic error
      }

      if (res.ok) {
        setStatus({
          kind: "success",
          title: body.title ?? file.name,
          pageCount: body.pageCount ?? null,
          chunkCount: body.chunkCount ?? 0,
        })
        router.refresh()
        return
      }

      if (res.status === 409) {
        setStatus({
          kind: "duplicate",
          title: body.title ?? file.name,
        })
        return
      }

      setStatus({
        kind: "error",
        message: "Something went wrong uploading this manual. Please try again.",
      })
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong uploading this manual. Please try again.",
      })
    }
  }

  function onPick() {
    inputRef.current?.click()
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) void handleFile(file)
  }

  const uploading = status.kind === "uploading"

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-200">Upload a manual</h2>
          <p className="mt-1 text-xs text-gray-500">
            PDF only. The file is indexed so FR0ST can cite it during troubleshooting.
          </p>
        </div>
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="size-4" />
          {uploading ? "Uploading…" : "Choose PDF"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onChange}
          className="hidden"
        />
      </div>

      {status.kind === "uploading" && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-gray-300">
          <span className="inline-block size-3 shrink-0 animate-pulse rounded-full bg-amber-400" />
          Uploading and indexing, this can take up to a minute.
        </div>
      )}

      {status.kind === "success" && (
        <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
            <div>
              <p className="font-medium">Indexed: {status.title}</p>
              <p className="mt-0.5 text-xs text-emerald-300/80">
                {status.pageCount ?? "—"} pages · {status.chunkCount} chunks
              </p>
            </div>
          </div>
        </div>
      )}

      {status.kind === "duplicate" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-gray-300">
          <Info className="mt-0.5 size-4 shrink-0 text-gray-400" />
          <p>
            <span className="font-medium text-gray-200">{status.title}</span> is already indexed.
          </p>
        </div>
      )}

      {status.kind === "invalid" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p>{status.message}</p>
        </div>
      )}

      {status.kind === "error" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-300" />
          <p>{status.message}</p>
        </div>
      )}
    </div>
  )
}
