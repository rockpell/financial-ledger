"use client";

import { useCallback, useRef, useState } from "react";
import { parseWorkbook } from "@/lib/parse";
import type { Transaction } from "@/lib/types";

interface Props {
  onAppended: () => void; // 업로드 성공 후 대시보드 데이터 새로고침
}

type Status =
  | { kind: "idle" }
  | { kind: "parsing"; file: string }
  | { kind: "uploading"; count: number }
  | { kind: "done"; appended: number; skipped: number; dropped: number }
  | { kind: "error"; message: string };

export function UploadPanel({ onAppended }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setStatus({ kind: "parsing", file: file.name });
        const buf = await file.arrayBuffer();
        const { transactions, droppedNoise } = parseWorkbook(buf);

        if (transactions.length === 0) {
          setStatus({ kind: "error", message: "파싱된 거래가 없습니다. 뱅크샐러드 엑셀이 맞는지 확인하세요." });
          return;
        }

        setStatus({ kind: "uploading", count: transactions.length });
        const res = await fetch("/api/transactions/append", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions } satisfies { transactions: Transaction[] }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `업로드 실패 (${res.status})`);
        }
        const { appended, skipped } = await res.json();
        setStatus({ kind: "done", appended, skipped, dropped: droppedNoise });
        onAppended();
      } catch (err) {
        setStatus({ kind: "error", message: err instanceof Error ? err.message : "알 수 없는 오류" });
      }
    },
    [onAppended],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
        dragging
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-neutral-700 bg-neutral-900 hover:border-neutral-600"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <p className="text-sm text-neutral-300">
        뱅크샐러드 엑셀(.xlsx)을 드래그하거나 클릭해서 업로드
      </p>
      <div className="mt-2 text-xs">
        {status.kind === "idle" && (
          <span className="text-neutral-500">신규 거래만 자동으로 마스터 시트에 누적됩니다.</span>
        )}
        {status.kind === "parsing" && (
          <span className="text-neutral-400">파싱 중… ({status.file})</span>
        )}
        {status.kind === "uploading" && (
          <span className="text-neutral-400">업로드 중… ({status.count}건 검사)</span>
        )}
        {status.kind === "done" && (
          <span className="text-emerald-400">
            ✅ 신규 {status.appended}건 추가 · 중복 {status.skipped}건 스킵 · 노이즈 {status.dropped}건 제거
          </span>
        )}
        {status.kind === "error" && <span className="text-rose-400">⚠️ {status.message}</span>}
      </div>
    </div>
  );
}
