# ALIA: AI Land Investment Analyst 🏗️

> **Turning Complex Zoning into Profitable Clarity with Agentic AI.**

ALIA is an agentic AI solution built for the **Microsoft Hackathon** to transform real estate development. By automating the complex feasibility study process—which traditionally takes weeks of manual data collection—ALIA provides a comprehensive **"Highest and Best Use" (HBU) report in minutes**.

---

## 📑 Project Overview

Real estate feasibility studies are often a bottleneck for developers and urban planners due to fragmented data across government portals and manual financial modeling. ALIA orchestrates specialized agents to evaluate land through **three critical pillars**: Physical, Legal, and Financial.

### Key Features

- **Three-Pillar Analysis Framework:**
  - 🏔️ **Physical** — Evaluates soil conditions, topography, and flood risks.
  - ⚖️ **Legal** — Analyzes zoning (e.g., K-2 Komersial), building parameters (BCR/FAR), and required permits (PBG, AMDAL).
  - 💰 **Financial** — Projects ROI, IRR, Payback Period, and Gross Development Value (GDV).

- **Agentic Orchestration** — Uses a Master Agent to coordinate parallel fetchers and sequential analysis orchestrators.
- **Human-in-the-Loop (HITL)** — Mandatory *User-data checks* and *User-output checks* ensure data integrity and legal accuracy before report generation.
- **Real-time Data Integration** — Leverages MCP-connected agents to fetch live infrastructure and market data from OpenStreetMap and public registries.

---

## 🛠️ Technology Stack

ALIA is built entirely within the **Microsoft ecosystem** to ensure enterprise-grade scalability and security.

| Component | Technology |
|---|---|
| Orchestration | Microsoft Agent Framework |
| AI Platform | Microsoft Foundry |
| Connectivity | Azure MCP (Model Context Protocol) |
| Frontend | React / Next.js (Deployed via Azure App Service) |
| Backend | Python (Agent Logic & Data Processing) |
| Development | VS Code enhanced with GitHub Copilot Agent Mode |

---

## 🔄 Agentic Workflow

The system follows an **Evaluator-Optimizer** pattern to ensure the highest quality of output:

```
User Input → Parallel Fetching → Human Verification → Sequential Analysis → Final Evaluation → Report
```

1. **Input** — User provides site coordinates and basic project data.
2. **Parallel Fetching** — MCP agents simultaneously gather Physical, Legal, and Economic data.
3. **Human Verification** — A check gate ensures gathered data is correct before proceeding.
4. **Sequential Analysis** — Analysis agents process the data to determine feasibility.
5. **Final Evaluation** — A guardrail agent reviews the document for compliance before generating the final PDF.

---

## 📈 Real-World Impact: Kebon Jeruk Case Study

In a test deployment for a **mixed-use tower in Jakarta**, ALIA generated the following insights:

| Dimension | Finding |
|---|---|
| 📊 Market Analysis | Rising market trend — land prices at **Rp 18.000.000/m²** |
| ⚖️ Legal Clarity | Confirmed compliance with **K-2 Komersial Sedang** zoning and 10-floor limits |
| ⚠️ Risk Mitigation | Flagged **AMDAL** as "Hard" difficulty permit, preventing future delays |
| 💹 Financials | Projected **18% IRR** and **100% ROI** |

---

## 🚀 Getting Started

### Prerequisites

- Active **Azure subscription** with Microsoft Foundry enabled
- **Node.js** (v18+) and **Python** (3.10+)
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/naufalfikrii/ALIA.git
   cd ALIA
   ```

2. **Configure environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Fill in your Microsoft Agent Framework keys and Azure credentials
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

4. **Install backend dependencies**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

### Running the App

```bash
# Frontend (from /frontend)
npm run dev

# Backend (from /backend)
python main.py
```

The frontend will be available at `http://localhost:3000`.

---

## 📁 Project Structure

```
ALIA/
├── backend/
│   ├── agents/         # Orchestrator and analysis agents
│   ├── fetchers/       # MCP-connected data fetchers
│   ├── memory/         # Agent memory and state management
│   ├── outputs/        # Generated feasibility reports
│   ├── tools/          # Agent tools and utilities
│   └── .env            # Environment variables (not committed)
└── frontend/
    ├── src/            # Next.js source files
    ├── public/         # Static assets
    └── next.config.ts  # Next.js configuration
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/naufalfikrii/ALIA/issues).

---

## 📄 License

This project was built for the **Microsoft Hackathon**. All rights reserved © 2025 ALIA Team.
