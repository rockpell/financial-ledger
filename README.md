# 가계부 대시보드 (Banksalad → Google Sheets → Custom Dashboard)

뱅크샐러드 엑셀 데이터를 정제·누적하여 라이프스타일 중심으로 시각화하는 1인용 커스텀 가계부.

## 스택
- **Next.js 16** (App Router) · **TailwindCSS** · **Recharts** · **xlsx (SheetJS)**
- **Google Sheets** = 마스터 DB (서비스 계정 연동)
- **Vercel** 배포 · **Edge Proxy(미들웨어)** 인증
- (운영) **Cloudflare** WAF / Rate Limit / KR-only

## 동작 흐름
1. 뱅샐 엑셀(.xlsx) 드래그앤드롭 → 브라우저에서 즉시 파싱
2. 메모의 `#해시태그` 추출, `미분류 & 100원 이하` 노이즈 자동 제거
3. 서버가 마스터 시트를 읽어 `날짜+내용+금액+결제수단` 고유키로 **중복 제거**
4. 신규 거래만 마스터 시트 최하단에 누적(append)
5. 대시보드: 다년도 라인 / 고정비·변동비 / 대형 카테고리 / 월별 스택 / Top5 / 태그 필터

## 마스터 시트 스키마 (A~J)
| 날짜 | 시간 | 타입 | 대분류 | 소분류 | 내용 | 금액 | 결제수단 | 메모 | 태그 |
|---|---|---|---|---|---|---|---|---|---|

> 뱅샐 원본에는 `화폐` 컬럼이 있으나 마스터 시트에는 저장하지 않는다(KRW 단일).

## 로컬 실행
\`\`\`bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev
\`\`\`

## 환경변수
| 키 | 설명 |
|---|---|
| \`APP_PASSWORD\` | 로그인 비밀번호 겸 토큰 서명 키 |
| \`GOOGLE_CLIENT_EMAIL\` | GCP 서비스 계정 이메일 |
| \`GOOGLE_PRIVATE_KEY\` | 서비스 계정 private key (\`\n\` 이스케이프) |
| \`GOOGLE_SHEET_ID\` | 마스터 스프레드시트 ID |
| \`GOOGLE_SHEET_NAME\` | 시트(탭) 이름, 기본 \`가계부 내역\` |

## 구글 시트 연동 준비
1. GCP에서 **서비스 계정** 생성 → JSON 키 발급
2. **Google Sheets API** 활성화
3. 마스터 스프레드시트를 서비스 계정 이메일에 **편집자**로 공유
4. 1행에 위 스키마 헤더 입력

## 운영 보안 (Cloudflare / Vercel)
- Cloudflare: KR 외 IP 차단 또는 챌린지, IP당 Rate Limit
- Vercel: **Spend Limit** 설정으로 트래픽 폭주 시 자동 중단
- 인증은 Edge Proxy에서 처리 → 미인증 요청은 Node 서버리스를 깨우지 않고 즉시 차단
