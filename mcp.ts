import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Redirect all standard console outputs to stderr to prevent breaking JSON-RPC on stdout
console.log = console.error;
console.info = console.error;
console.warn = console.error;

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "dotenv";
import { readTransactions, appendTransactions } from "./src/lib/sheets.js";
import { summary, filterByMonths, filterByTags, filterByCategories, filterBySearchQuery } from "./src/lib/analytics.js";
import type { Transaction } from "./src/lib/types.js";

// Load environment variables from .env
config();

const server = new Server(
  {
    name: "financial-ledger-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools available to the AI
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_summary",
        description: "특정 월 또는 전체 기간의 가계부 수입/지출/순수지 요약을 조회합니다.",
        inputSchema: {
          type: "object",
          properties: {
            months: {
              type: "array",
              items: { type: "string" },
              description: "조회할 월 목록 (형식: YYYY-MM). 배열이 비어있으면 전체 기간을 조회합니다.",
            },
          },
        },
      },
      {
        name: "get_transactions",
        description: "가계부 지출/수입 상세 내역을 조회합니다. 기간, 태그, 카테고리, 검색어로 세밀하게 필터링할 수 있습니다.",
        inputSchema: {
          type: "object",
          properties: {
            months: { type: "array", items: { type: "string" }, description: "필터링할 월 목록 (예: ['2026-06'])" },
            tags: { type: "array", items: { type: "string" }, description: "필터링할 해시태그 목록 (예: ['간식', '야식'])" },
            categories: { type: "array", items: { type: "string" }, description: "필터링할 카테고리 목록 (예: ['식비', '교통비'])" },
            q: { type: "string", description: "거래 내용(가맹점) 또는 메모에 포함된 검색어" },
          },
        },
      },
      {
        name: "add_transaction",
        description: "새로운 지출 또는 수입 내역을 구글 시트 가계부에 추가합니다.",
        inputSchema: {
          type: "object",
          properties: {
            date: { type: "string", description: "결제일 (형식: YYYY-MM-DD)" },
            time: { type: "string", description: "결제시간 (형식: HH:MM:SS) (선택사항, 기본값 00:00:00)" },
            amount: { type: "number", description: "금액. 지출은 음수(-), 수입은 양수(+)로 입력 필수." },
            merchant: { type: "string", description: "결제처 또는 내용 (예: 스타벅스, 배달의민족)" },
            category: { type: "string", description: "카테고리 (예: 식비, 교통, 주거/통신 등)" },
            memo: { type: "string", description: "추가 메모. 여러 개의 해시태그를 포함할 수 있습니다 (예: '#커피 #간식 맛있음')" },
          },
          required: ["date", "amount", "merchant", "category"],
        },
      },
    ],
  };
});

// Handle tool executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args: any = request.params.arguments || {};
  
  console.error(`[MCP] 🛠️ Tool Executed: ${toolName}`);
  console.error(`[MCP] 📥 Arguments:`, JSON.stringify(args));

  if (toolName === "get_summary") {
    const { months = [] } = args as any;
    const all = await readTransactions();
    const scoped = filterByMonths(all, months);
    const data = summary(scoped);
    
    console.error(`[MCP] 📤 Returning summary for ${months.length ? months.join(", ") : "ALL"} (${scoped.length} txs)`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }

  if (toolName === "get_transactions") {
    const { months = [], tags = [], categories = [], q = "" } = args as any;
    let txs = await readTransactions();
    if (months && months.length > 0) txs = filterByMonths(txs, months);
    if (tags && tags.length > 0) txs = filterByTags(txs, tags);
    if (categories && categories.length > 0) txs = filterByCategories(txs, categories);
    if (q) txs = filterBySearchQuery(txs, q);
    
    const limit = 50;
    const count = txs.length;
    const sliced = txs.slice(0, limit);

    console.error(`[MCP] 📤 Returning ${sliced.length} transactions (Total matched: ${count})`);
    return {
      content: [
        { 
          type: "text", 
          text: JSON.stringify({ 
            total_matches: count, 
            showing: sliced.length, 
            message: count > limit ? `결과가 너무 많아 최신 ${limit}건만 표시합니다.` : "모든 결과 표시",
            transactions: sliced 
          }, null, 2) 
        }
      ],
    };
  }

  if (toolName === "add_transaction") {
    const tx: Transaction = {
      date: args.date,
      time: args.time || "00:00:00",
      amount: args.amount,
      content: args.merchant,
      tags: [],
      memo: args.memo || "",
      type: args.amount < 0 ? "지출" : "수입",
      majorCategory: args.category,
      minorCategory: args.category,
      currency: "KRW",
      payment: "MCP",
    };

    console.error(`[MCP] ⏳ Appending new transaction: ${tx.date} | ${tx.content} | ${tx.amount}`);
    const count = await appendTransactions([tx]);
    console.error(`[MCP] ✅ Successfully appended ${count} transaction(s).`);
    
    return {
      content: [{ type: "text", text: `성공적으로 ${count}건의 내역을 구글 시트에 추가했습니다!` }],
    };
  }

  console.error(`[MCP] ❌ Unknown tool: ${toolName}`);
  throw new Error(`Unknown tool: ${toolName}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Financial Ledger MCP server running on stdio");
}

run().catch(console.error);
