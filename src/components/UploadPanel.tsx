"use client";

import { useCallback, useRef, useState } from "react";
import { parseWorkbook } from "@/lib/parse";
import type { Transaction } from "@/lib/types";
import { ZipReader, BlobReader, Uint8ArrayWriter } from "@zip.js/zip.js";

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
  const [pendingZip, setPendingZip] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processArrayBuffer = useCallback(
    async (buf: ArrayBuffer, fileName: string) => {
      try {
        setStatus({ kind: "parsing", file: fileName });
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

  const handleFile = useCallback(
    async (file: File) => {
      if (file.name.endsWith(".zip")) {
        setPendingZip(file);
        return;
      }
      const buf = await file.arrayBuffer();
      await processArrayBuffer(buf, file.name);
    },
    [processArrayBuffer],
  );

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingZip) return;

    // 비밀번호 상태는 제출 즉시 초기화하여 보안 유지
    const pwd = password;
    setPassword("");
    setPendingZip(null);

    try {
      setStatus({ kind: "parsing", file: pendingZip.name });
      const zipFileReader = new BlobReader(pendingZip);
      const zipReader = new ZipReader(zipFileReader, { password: pwd });
      const entries = await zipReader.getEntries();

      const excelEntry = entries.find((entry) => 
        entry.filename.endsWith(".xlsx") || entry.filename.endsWith(".xls")
      );
      if (!excelEntry) {
        throw new Error("압축 파일 내에 엑셀(.xlsx) 파일이 존재하지 않습니다.");
      }

      // TypeScript가 DirectoryEntry 타입으로 추론하는 것을 방지하기 위해 any로 캐스팅합니다.
      const uint8Array = await (excelEntry as any).getData?.(new Uint8ArrayWriter());
      if (!uint8Array) {
        throw new Error("파일 추출에 실패했습니다. 비밀번호가 틀렸을 수 있습니다.");
      }

      await zipReader.close();
      await processArrayBuffer(uint8Array.buffer, excelEntry.filename);
    } catch (err: any) {
      const errMsg = err.message || "";
      const isPwdError = errMsg.toLowerCase().includes("password");
      setStatus({ 
        kind: "error", 
        message: isPwdError ? "비밀번호가 틀렸습니다." : `압축 해제 오류: ${errMsg}`
      });
    }
  };

  if (pendingZip) {
    return (
      <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-900 p-6 text-center">
        <p className="mb-4 text-sm text-neutral-300">
          <strong className="text-white">{pendingZip.name}</strong> 파일의 비밀번호를 입력해주세요.
        </p>
        <form onSubmit={handleZipSubmit} className="flex flex-col items-center gap-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2 text-white outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingZip(null);
                setPassword("");
              }}
              className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!password}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              확인
            </button>
          </div>
        </form>
      </div>
    );
  }

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
        accept=".xlsx,.xls,.zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <p className="text-sm text-neutral-300">
        뱅크샐러드 엑셀(.xlsx) 또는 암호화된 압축파일(.zip)을 드래그하거나 클릭해서 업로드
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
