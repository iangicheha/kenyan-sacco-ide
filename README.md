# Kenyan SACCO IDE

**Agentic Financial Workspace for Kenyan SACCOs**

An AI-powered, high-performance financial IDE designed specifically for Kenyan Savings and Credit Cooperative Organizations (SACCOs). Inspired by Meridian AI, this tool combines the familiar interface of Excel with the intelligence of an agentic AI system to automate data cleaning, compliance reporting, and financial auditing.

## 🎯 Vision

Kenyan SACCOs face a critical challenge: they are drowning in messy data trapped in Excel spreadsheets, PDFs, and M-Pesa statements. This leads to:

- **Audit Failures:** Manual errors in SASRA compliance reporting
- **The "Silent Heist":** Phantom savings and non-remitted deductions costing billions in KES
- **Ghost Accounts:** Fraudulent member accounts hidden in spreadsheets
- **Regulatory Risk:** SASRA fines and potential savings freezes

The **Kenyan SACCO IDE** solves this by providing a **"Private AI Workspace"** where SACCOs can upload messy data and instantly receive:

✅ **Clean, Auditable Data** - Normalized and verified against regulatory standards
✅ **SASRA Compliance Reports** - Automated Form 4 (Provisioning) and Form 1 (Capital Adequacy)
✅ **Forensic Audits** - Detection of phantom savings, ghost accounts, and anomalies
✅ **Member Analytics** - Risk scoring and dividend calculations

## 🏗️ Architecture

The IDE follows a **"Local-First, Cloud-Powered"** architecture with three main components:

### **Frontend (React + Tailwind)**
- **Ribbon Menu:** Excel-like interface with Home, Insert, Data, Audit, and SASRA tabs
- **Spreadsheet Grid:** High-performance grid with real-time editing
- **File Explorer:** Organized file tree for uploaded documents
- **Agentic Sidebar:** Real-time AI agent for task automation

### **Design Philosophy**
- **Professional Dark Mode:** Financial-grade color scheme (Deep Slate, Sky Blue, Emerald Green)
- **Meridian-Style Layout:** Three-pane architecture (Explorer | Grid | Agent)
- **Accessibility First:** Keyboard navigation, clear focus states, high contrast

### **Technology Stack**
- **Frontend:** React 19, Tailwind CSS 4, TypeScript
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Icons:** Lucide React
- **State Management:** React Hooks
- **Build Tool:** Vite
- **Package Manager:** pnpm

## 🚀 Quick Start

### Prerequisites
- Node.js 22.13.0 or higher
- pnpm 10.4.1 or higher
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/kenyan-sacco-ide.git
cd kenyan-sacco-ide

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

The IDE will be available at `http://localhost:3000`

### Build for Production

```bash
pnpm build
pnpm start
```

## 📋 Features

### **Ribbon Menu**
- **Home Tab:** Font formatting, alignment, number formats (Currency, Percentage, Date)
- **Insert Tab:** Tables, charts, images
- **Data Tab:** Sort, filter, data cleaning
- **Audit Tab:** Forensic checks, phantom savings detection, ghost account detection
- **SASRA Tab:** Form 4 (Provisioning), Form 1 (Capital), compliance checks

### **Spreadsheet Grid**
- Excel-like cell navigation (arrow keys, Tab)
- Double-click to edit, Enter to confirm
- Formula bar for complex formulas
- Color-coded cells (AI-generated, errors, selected)
- Support for 50+ rows and columns

### **File Explorer**
- Organized folder structure (Projects, Uploads)
- File metadata (size, modification time)
- Drag-and-drop upload support
- Quick file selection

### **AI Agent Sidebar**
- Real-time chat interface with the AI
- Quick action buttons (Run Audit, Clean Data, SASRA Form 4)
- Message types: User, Agent, Action, Error, Success
- Action confirmation and multi-step workflows

## 🔐 Data Privacy & Security

The IDE follows a **"Zero-Knowledge"** privacy model:

- **Upload-Only:** The AI only reads what is explicitly uploaded; no data crawling or external access
- **Isolated Tenancy:** Each SACCO's data is physically separated from others
- **Ephemeral Processing:** Data is purged from AI memory after each session
- **No Training on Private Data:** Models are pre-trained on public SASRA regulations and anonymized data
- **Encrypted Storage:** All data is encrypted in transit and at rest

## 📚 Project Structure

```
kenyan-sacco-ide/
├── client/
│   ├── public/              # Static assets (favicon, robots.txt)
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
├── server/                  # Backend placeholder (for future expansion)
├── shared/                  # Shared types and constants
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
├── README.md
└── LICENSE

```

## 🎨 Design System

### **Color Palette**
- **Primary:** Sky Blue (#0ea5e9) - Trust and professionalism
- **Accent:** Emerald Green (#10b981) - Success and growth
- **Background:** Deep Slate (#0f172a) - Professional dark mode
- **Foreground:** Light Slate (#e2e8f0) - High contrast text

### **Typography**
- **Font Family:** System sans-serif (Inter, Segoe UI, Roboto)
- **Heading:** Bold 18px (Logo), Medium 14px (Section headers)
- **Body:** Regular 14px (Content), Small 12px (Labels)

### **Spacing**
- **Base Unit:** 4px (Tailwind default)
- **Padding:** 8px (sm), 12px (md), 16px (lg), 24px (xl)
- **Gap:** 8px (tight), 12px (normal), 16px (loose)

## 🛠️ Development

### Available Scripts

```bash
# Start development server with hot reload
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

1. Create a new component in `client/src/components/`
2. Use shadcn/ui components for consistency
3. Apply Tailwind utilities for styling
4. Export from the component file

### Styling Guidelines

- Use Tailwind CSS utilities for all styling
- Leverage design tokens in `client/src/index.css`
- Avoid inline styles; use CSS classes instead
- Maintain dark mode consistency with theme variables

## 📖 Usage Examples

### Running an Audit

1. Upload a loan listing CSV or Excel file
2. Click the **Audit** tab in the ribbon menu
3. Select **Forensic Check** to scan for anomalies
4. The AI agent will analyze the data and report findings

### Generating SASRA Form 4

1. Upload your trial balance and loan listing
2. Click the **SASRA** tab
3. Select **Form 4 (Provisioning)**
4. The agent will calculate provisioning percentages based on loan aging
5. Export the completed form as Excel

### Cleaning Messy Data

1. Upload a messy Excel or PDF with member data
2. Click the **Data** tab
3. Select **Clean Data**
4. The agent will normalize dates, remove duplicates, and fix formatting
5. Review and apply changes

## 🔄 Roadmap

### Phase 1 (Current)
- ✅ Frontend IDE with ribbon menu and spreadsheet grid
- ✅ Agentic sidebar for user interaction
- ✅ File explorer for document management
- 🔄 Mock AI responses (ready for backend integration)

### Phase 2 (Planned)
- Backend API with LLM integration (Claude 3.5 Sonnet)
- Real data cleaning and normalization
- SASRA compliance engine
- M-Pesa statement parsing

### Phase 3 (Planned)
- Real-time collaboration (multi-user editing)
- Advanced analytics and member scoring
- Dividend calculation automation
- Export to official SASRA templates

### Phase 4 (Planned)
- Mobile app for field audits
- Integration with Kenyan banking APIs
- Blockchain-based audit trails
- Self-hosted deployment option

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Meridian AI** - Inspiration for the agentic spreadsheet architecture
- **SASRA (Savings and Credit Cooperative Societies Regulatory Authority)** - Regulatory framework and compliance guidelines
- **Kenyan SACCO Community** - For identifying the critical pain points this tool addresses
- **shadcn/ui** - For the excellent UI component library
- **Tailwind CSS** - For the utility-first CSS framework

## 📞 Support & Contact

For questions, issues, or feedback:

- **GitHub Issues:** [Report a bug](https://github.com/yourusername/kenyan-sacco-ide/issues)
- **Email:** support@saccoide.ke
- **Documentation:** [Full docs](https://docs.saccoide.ke)

## 🌍 Kenyan Financial Sector Context

The Kenyan financial sector is undergoing rapid digital transformation. SACCOs, which serve over 10 million members, are at the forefront of financial inclusion. However, many still rely on manual Excel-based workflows that are error-prone and difficult to audit.

The **Kenyan SACCO IDE** bridges this gap by providing:

- **Regulatory Compliance:** Automated SASRA reporting to avoid fines and sanctions
- **Financial Inclusion:** Faster loan approvals through better data quality
- **Member Protection:** Detection of fraud and mismanagement
- **Operational Efficiency:** Reduced manual work and faster audits

---

**Built with ❤️ for Kenyan SACCOs**

*"Turning messy data into financial intelligence"*
