# Kenyan SACCO IDE: Meridian AI

**Agentic Financial Workspace for Kenyan SACCOs, Powered by Meridian AI**

An AI-powered, high-performance financial IDE designed specifically for Kenyan Savings and Credit Cooperative Organizations (SACCOs). Inspired by Meridian AI, this tool combines the familiar interface of Excel with the intelligence of an agentic AI system to automate data cleaning, compliance reporting, and financial auditing.

## 🎯 Vision: The Meridian AI Transformation

Kenyan SACCOs face critical challenges, drowning in messy data trapped in Excel spreadsheets, PDFs, and M-Pesa statements. This leads to:

-   **Audit Failures:** Manual errors in SASRA compliance reporting.
-   **The "Silent Heist":** Phantom savings and non-remitted deductions costing billions in KES.
-   **Ghost Accounts:** Fraudulent member accounts hidden in spreadsheets.
-   **Regulatory Risk:** SASRA fines and potential savings freezes.

**Meridian AI** within the **Kenyan SACCO IDE** solves this by providing a **"Private AI Workspace"** where SACCOs can upload messy data and instantly receive:

✅ **Clean, Auditable Data** - Normalized and verified against regulatory standards.
✅ **SASRA Compliance Reports** - Automated Form 4 (Provisioning) and Form 1 (Capital Adequacy).
✅ **Forensic Audits** - Detection of phantom savings, ghost accounts, and anomalies.
✅ **Boardroom-Ready Reports** - Professional PDF summaries of financial health and risks.
✅ **Member Analytics** - Risk scoring and dividend calculations.

## 🏗️ Architecture: Local-First, Cloud-Powered AI

The IDE follows a **"Local-First, Cloud-Powered"** architecture with three main components:

### **1. Frontend (React + Tailwind)**

-   **Ribbon Menu:** Excel-like interface with Home, Insert, Data, Audit, and SASRA tabs.
-   **Spreadsheet Grid:** High-performance grid with real-time editing and interactive audit trails.
-   **File Explorer:** Organized file tree for uploaded documents.
-   **Agentic Sidebar:** Real-time AI agent for task automation and natural language interaction.

### **2. Backend (Node.js Express + Groq Cloud API)**

-   **Meridian AI Engine:** Handles multi-file uploads, intelligent data merging, and forensic audit logic.
-   **Groq Cloud API Integration:** Utilizes **Llama-3.3-70B-Versatile** for lightning-fast, high-intelligence financial reasoning and report generation.
-   **SASRA Compliance Engine:** Codifies regulatory rules for automated reporting.
-   **PDF Generation:** Dynamically creates boardroom-ready reports from audit findings.

### **3. Design Philosophy**

-   **Professional Dark Mode:** Financial-grade color scheme (Deep Slate, Sky Blue, Emerald Green).
-   **Meridian-Style Layout:** Three-pane architecture (Explorer | Grid | Agent).
-   **Accessibility First:** Keyboard navigation, clear focus states, high contrast.

### **Technology Stack**
-   **Frontend:** React 19, Tailwind CSS 4, TypeScript, Vite, pnpm.
-   **UI Components:** shadcn/ui (Radix UI primitives), Lucide React.
-   **Backend:** Node.js Express + TypeScript, `groq-sdk`, `multer`, `csv-parser`.
-   **LLM Provider:** Groq (tool-calling, low temperature for deterministic financial outputs).
- **Spreadsheet:** `xlsx` parsing + in-memory cell graph

##  Quick Start

### Prerequisites

-   Node.js 22.13.0 or higher
-   pnpm 10.4.1 or higher
-   Git
-   **Groq API Key:** Obtain a free API key from [https://console.groq.com/keys](https://console.groq.com/keys)

### Installation

```bash
# Clone the repository
git clone https://github.com/iangicheha/kenyan-sacco-ide.git
cd kenyan-sacco-ide

# Install dependencies
pnpm install

# Configure Groq API Key
cp .env.example .env
# Edit .env and replace 'your_groq_api_key_here' with your actual Groq API Key
nano .env

# Start the API server (in a separate terminal or background)
npx tsx server_standalone.js &

# Start the frontend development server
pnpm dev
```

The IDE will be available at `http://localhost:3000` and the API server at `http://localhost:3001`.

##  Backend: Meridian-style Spreadsheet Engine

The backend implements a **staged-diff** spreadsheet workflow (similar to how a code IDE stages edits):

- **Parse**: uploads are parsed into an in-memory `Map<address, Cell>` graph
- **Propose**: the LLM proposes targeted cell-level operations (writes are staged, not committed)
- **Review**: UI shows diffs (old vs new), user accepts/rejects per operation
- **Commit**: accepted ops commit to the live cell graph; rejections are discarded
- **Audit trail**: every accept/reject is logged with timestamp + rationale (SASRA traceability)

### Key backend modules

- `server/cell_graph.ts`: parses xlsx/csv into a live cell graph; supports staged writes (`proposeWrite`), commit/reject, export back to `.xlsx`
- `server/tool_registry.ts`: Kenyan SACCO domain logic exposed as typed tools (`read_cell`, `write_formula`, SASRA provisioning, phone normalization, forensic flags)
- `server/diff_store.ts`: pending operations + accept/reject + audit log (who/when/why)
- `server/semantic_engine.ts`: orchestrator (session init, agent loop with tool calls, export, audit queries)

##  API (Standalone Server)

For quick iteration, `server_standalone.js` exposes a minimal API for the staged spreadsheet engine.

### Run the standalone server

```bash
node server_standalone.js
```

> Ensure `GROQ_API_KEY` is set in your environment (or `.env` if you load it elsewhere).

### Routes

- `POST /upload` → initialize a spreadsheet session (`initSession`)
  - multipart form-data: `file=@your.xlsx`
  - optional: `sessionId` (body or query). If omitted, server generates one.
- `POST /chat` → agent turn (`runAgentTurn`)
  - JSON body: `{ "sessionId": "...", "message": "..." }`
- `POST /accept` → accept a pending operation (`acceptOperation`)
  - JSON body: `{ "sessionId": "...", "operationId": "op_..." }`
- `POST /reject` → reject a pending operation (`rejectOperation`)
  - JSON body: `{ "sessionId": "...", "operationId": "op_..." }`
- `GET /export?sessionId=...` → download the current committed workbook (`exportSession`)
- `GET /audit-log?sessionId=...` → export audit log (accept/reject decisions + rationales)

Convenience routes (useful for UI state + SASRA drilldowns):

- `GET /pending?sessionId=...` → current diff panel items (`getPendingOperations`)
- `GET /cell-history?sessionId=...&address=D47&sheet=Loans` → “why did this cell change?” timeline (`getCellHistory`)
- `GET /summary?sessionId=...` → accepted/rejected/pending counters (`getSessionSummary`)

### Example workflow (curl)

Upload a workbook and start a session:

```bash
curl -s -X POST "http://localhost:3001/upload" ^
  -F "file=@C:\\path\\to\\loan_listing.xlsx"
```

Send a chat instruction:

```bash
curl -s -X POST "http://localhost:3001/chat" ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"YOUR_SESSION\",\"message\":\"Run SASRA Form 4 provisioning for rows 2 to 250\"}"
```

Fetch pending diffs:

```bash
curl -s "http://localhost:3001/pending?sessionId=YOUR_SESSION"
```

Accept one operation:

```bash
curl -s -X POST "http://localhost:3001/accept" ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"YOUR_SESSION\",\"operationId\":\"op_...\"}"
```

Export the committed workbook:

```bash
curl -L "http://localhost:3001/export?sessionId=YOUR_SESSION" -o meridian_export.xlsx
```

### Build for Production

```bash
pnpm build
pnpm start
```

##  Features

### **Ribbon Menu**

-   **Home Tab:** Font formatting, alignment, number formats (Currency, Percentage, Date).
-   **Insert Tab:** Tables, charts, images.
-   **Data Tab:** Sort, filter, data cleaning.
-   **Audit Tab:** Forensic checks, phantom savings detection, ghost account detection.
-   **SASRA Tab:** Form 4 (Provisioning), Form 1 (Capital), compliance checks.

### **Spreadsheet Grid**

-   Excel-like cell navigation (arrow keys, Tab).
-   Double-click to edit, Enter to confirm.
-   Formula bar for complex formulas.
-   Color-coded cells (AI-generated, errors, selected).
-   Support for 50+ rows and columns.

### **File Explorer**

-   Organized folder structure (Projects, Uploads).
-   File metadata (size, modification time).
-   Drag-and-drop upload support.
-   Quick file selection.

### **AI Agent Sidebar (Powered by Groq)**

-   Real-time chat interface with the AI.
-   Quick action buttons (Run Audit, Clean Data, SASRA Form 4, Download Board Report).
-   Message types: User, Agent, Action, Error, Success.
-   Action confirmation and multi-step workflows.

##  Data Privacy & Security

The IDE follows a **"Zero-Knowledge"** privacy model:

-   **Upload-Only:** The AI only reads what is explicitly uploaded; no data crawling or external access.
-   **Isolated Tenancy:** Each SACCO's data is physically separated from others.
-   **Ephemeral Processing:** Data is purged from AI memory after each session.
-   **No Training on Private Data:** Models are pre-trained on public SASRA regulations and anonymized data.
-   **Encrypted Storage:** All data is encrypted in transit and at rest.

##  Project Structure

```
kenyan-sacco-ide/
├── client/                  # Frontend (React, Tailwind, Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── RibbonMenu.tsx
│   │   │   ├── SpreadsheetGrid.tsx
│   │   │   ├── AgentSidebar.tsx
│   │   │   └── FileExplorer.tsx
│   │   ├── pages/           # Page-level components
│   │   │   └── Home.tsx
│   │   ├── contexts/        # React contexts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility helpers
│   │   ├── App.tsx          # Routes and top-level layout
│   │   ├── main.tsx         # React entry point
│   │   └── index.css        # Global styles and design tokens
│   └── index.html           # HTML template
├── server/                  # Backend (agentic spreadsheet engine + API)
├── server_standalone.js      # Standalone API for staged spreadsheet engine
├── shared/                  # Shared types and constants
├── docs/                    # Documentation (Groq setup, etc.)
├── .env.example             # Environment variable example
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
├── README.md
└── LICENSE
```

##  Design System

### **Color Palette**

-   **Primary:** Sky Blue (#0ea5e9) - Trust and professionalism
-   **Accent:** Emerald Green (#10b981) - Success and growth
-   **Background:** Deep Slate (#0f172a) - Professional dark mode
-   **Foreground:** Light Slate (#e2e8f0) - High contrast text

### **Typography**

-   **Font Family:** System sans-serif (Inter, Segoe UI, Roboto)
-   **Heading:** Bold 18px (Logo), Medium 14px (Section headers)
-   **Body:** Regular 14px (Content), Small 12px (Labels)

### **Spacing**

-   **Base Unit:** 4px (Tailwind default)
-   **Padding:** 8px (sm), 12px (md), 16px (lg), 24px (xl)
-   **Gap:** 8px (tight), 12px (normal), 16px (loose)

##  Development

### Available Scripts

```bash
# Start frontend development server with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build locally
pnpm preview

# Type check without emitting files
pnpm check

# Format code with Prettier
pnpm format
```

### Adding New Components

1.  Create a new component in `client/src/components/`
2.  Use shadcn/ui components for consistency
3.  Apply Tailwind utilities for styling
4.  Export from the component file

### Styling Guidelines

-   Use Tailwind CSS utilities for all styling
-   Leverage design tokens in `client/src/index.css`
-   Avoid inline styles; use CSS classes instead
-   Maintain dark mode consistency with theme variables

##  Usage Examples

### Running an Audit

1.  Upload `sample_members.csv` and `sample_mpesa.csv` via the File Explorer.
2.  In the **Agentic Sidebar**, type: *"Run a forensic audit on these files."*
3.  The AI agent (powered by Groq) will analyze the data and report findings.
4.  Click **"Download Board Report"** to get a professional PDF summary.

### Generating SASRA Form 4

1.  Upload your trial balance and loan listing.
2.  Click the **SASRA** tab.
3.  Select **Form 4 (Provisioning)**.
4.  The agent will calculate provisioning percentages based on loan aging.
5.  Export the completed form as Excel.

### Cleaning Messy Data

1.  Upload a messy Excel or PDF with member data.
2.  Click the **Data** tab.
3.  Select **Clean Data**.
4.  The agent will normalize dates, remove duplicates, and fix formatting.
5.  Review and apply changes.

##  Roadmap

### Phase 1 (Completed)

-   ✅ Frontend IDE with ribbon menu and spreadsheet grid
-   ✅ Agentic sidebar for user interaction
-   ✅ File explorer for document management
-   ✅ Backend API with Groq Cloud LLM integration.
-   ✅ Staged-diff spreadsheet engine (cell graph + tools + accept/reject + audit log).
-   ✅ SASRA compliance and forensic helper tools.

### Phase 2 (Planned)

-   Expand spreadsheet tool coverage (more SASRA templates, validation rules, richer diff UX).
-   Persist sessions/audit logs (DB-backed) for multi-user and longer-lived reviews.
-   M-Pesa statement parsing + reconciliation tools.

### Phase 3 (Planned)

-   Mobile app for field audits
-   Integration with Kenyan banking APIs
-   Blockchain-based audit trails
-   Self-hosted deployment option

##  Contributing

Contributions are welcome! Please follow these guidelines:

1.  Fork the repository
2.  Create a feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request

##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

##  Acknowledgments

-   **Meridian AI** - Inspiration for the agentic spreadsheet architecture
-   **SASRA (Savings and Credit Cooperative Societies Regulatory Authority)** - Regulatory framework and compliance guidelines
-   **Kenyan SACCO Community** - For identifying the critical pain points this tool addresses
-   **Groq** - For providing lightning-fast LLM inference
-   **shadcn/ui** - For the excellent UI component library
-   **Tailwind CSS** - For the utility-first CSS framework

##  Support & Contact

For questions, issues, or feedback:

-   **GitHub Issues:** [Report a bug](https://github.com/iangicheha/kenyan-sacco-ide/issues)
-   **Email:** support@saccoide.ke
-   **Documentation:** [Full docs](https://docs.saccoide.ke)

##  Kenyan Financial Sector Context

The Kenyan financial sector is undergoing rapid digital transformation. SACCOs, which serve over 10 million members, are at the forefront of financial inclusion. However, many still rely on manual Excel-based workflows that are error-prone and difficult to audit.

The **Kenyan SACCO IDE** bridges this gap by providing:

-   **Regulatory Compliance:** Automated SASRA reporting to avoid fines and sanctions
-   **Financial Inclusion:** Faster loan approvals through better data quality
-   **Member Protection:** Detection of fraud and mismanagement
-   **Operational Efficiency:** Reduced manual work and faster audits

---

**Built for Kenyan SACCOs**

*"Turning messy data into financial intelligence"*
