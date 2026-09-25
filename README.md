# 🤖 White Collar Realty — AI HR Voice Calling Agent

An AI-powered HR Voice Calling Agent designed for **White Collar Realty** to automate candidate engagement, screening, interview scheduling, attendance confirmation, and recruitment follow-ups.

The project demonstrates how an AI-powered virtual HR assistant can support the recruitment workflow and reduce repetitive HR calling and coordination work.

> **Current Status:** Demo / Prototype
> The current version is focused on demonstrating the HR recruitment workflow and conversational experience.

---

## 🚀 Project Overview

Recruitment teams spend significant time on repetitive activities such as:

* Calling candidates
* Initial candidate screening
* Collecting candidate information
* Asking role-specific questions
* Scheduling interviews
* Confirming interview attendance
* Following up with candidates
* Updating HR about candidate status

The **AI HR Voice Calling Agent** is designed to automate these repetitive interactions through an intelligent conversational interface.

### Core Workflow

```text
Candidate
    ↓
Applied Role
    ↓
Role / JD Identification
    ↓
AI Screening Questions
    ↓
Candidate Responses
    ↓
Candidate Qualification
    ↓
Interview Slot Selection
    ↓
Interview Confirmation
    ↓
Reminder / Attendance
    ↓
Follow-up
    ↓
HR Candidate Summary
```

---

## ✨ Key Features

### 👤 Candidate Screening

The agent can conduct an initial HR screening conversation and collect information such as:

* Total work experience
* Current company
* Current designation
* Current location
* Current salary / CTC
* Expected salary
* Notice period
* Earliest joining date
* Interest in the opportunity
* Relevant industry experience

---

### 🎯 Role-Specific Screening

The screening process can adapt questions according to the candidate's applied role.

For example, a **Sales Manager** candidate can be asked about:

* Real estate experience
* Sales team management
* Team size
* Monthly sales targets
* Target achievement
* Sales KPIs
* Lead distribution
* Lead follow-ups
* Site-visit conversion
* Booking conversion
* Handling underperforming salespeople
* Revenue forecasting
* Hiring and onboarding experience

This allows the screening process to go beyond basic HR questions.

---

### 🧠 AI-Based Candidate Evaluation

Candidate responses can be analyzed against predefined role requirements.

The system can generate:

* Screening score
* JD match score
* Qualification decision
* Candidate summary
* Final HR decision

Example:

```text
Candidate
    ↓
Screening Answers
    ↓
AI / Rule-Based Evaluation
    ↓
JD Match Score
    ↓
Qualification
    ↓
Final HR Decision
```

---

### 📅 Interview Scheduling

The demo workflow supports interview coordination, including:

* Selecting an interview slot
* Confirming interview date and time
* Confirming interview location
* Interview confirmation
* Attendance confirmation
* Missed-interview follow-up workflow

---

### 🔔 Candidate Follow-ups

The system is designed to support follow-up scenarios such as:

* Candidate did not answer
* Candidate missed the interview
* Candidate needs interview confirmation
* Candidate needs an interview reminder
* Candidate needs to reschedule
* Candidate needs another follow-up

---

### 🌐 Hindi & English Conversations

The intended assistant experience supports natural candidate conversations in:

* 🇮🇳 Hindi
* 🇬🇧 English
* Hinglish-style conversations

This is particularly useful for recruitment workflows where candidates may naturally switch between Hindi and English.

---

## 🏢 White Collar Realty Use Case

The agent is designed specifically around the HR recruitment workflow of **White Collar Realty**.

The virtual assistant introduces itself as an HR assistant and helps automate the early stages of candidate interaction.

Example:

```text
AI HR Assistant
       ↓
"Hello, I am the virtual HR assistant
from White Collar Realty."
       ↓
Candidate Verification
       ↓
Role Confirmation
       ↓
Screening
       ↓
Qualification
       ↓
Interview Scheduling
       ↓
Confirmation
       ↓
HR Summary
```

---

## 🖥️ Demo

A live demo is available here:

**[Open the Demo](https://calling-agent-gilt.vercel.app/)**

The repository also contains the frontend application used for the demo.

---

## 🛠️ Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Lucide React
* Motion

### Backend / Server

* Node.js
* Express
* TypeScript

### AI

* Google GenAI

### Development Tools

* Vite
* TypeScript
* TSX
* ESBuild

The current `package.json` confirms the React 19, Vite, Express, Google GenAI, Motion, Tailwind, and TypeScript stack.

---

## 📁 Project Structure

```text
CALLING-AGENT/
│
├── src/
│   └── ...
│
├── .env.example
├── .gitignore
├── index.html
├── metadata.json
├── package.json
├── server.ts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

The repository currently uses `src/main.tsx` as the frontend entry point and includes an Express server entry point in `server.ts`.

---

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/chetandixit2407/CALLING-AGENT.git
```

### 2. Open the project

```bash
cd CALLING-AGENT
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file using the provided example:

```bash
cp .env.example .env
```

On Windows, you can simply copy:

```text
.env.example
```

to:

```text
.env
```

Then configure the required environment variables.

> Never commit API keys or other secrets to GitHub.

---

## ▶️ Run the Project

Start the development environment with:

```bash
npm run dev
```

The repository's current `package.json` maps the development command to `tsx server.ts`.

---

## 🏗️ Build for Deployment

Create a production build with:

```bash
npm run build
```

The current build script builds the Vite frontend and bundles the Express server using ESBuild.

Then start the built application:

```bash
npm start
```

---

## 🔍 Type Checking

Run TypeScript checking with:

```bash
npm run lint
```

---

## 🔐 Environment Variables

The repository includes:

```text
.env.example
```

Use it as the template for local configuration.

Example structure:

```env
# AI configuration
GOOGLE_API_KEY=your_api_key_here

# Other application configuration
# Add required environment variables here
```

> The exact environment variables should always be taken from the current `.env.example` file rather than hard-coded into the application.

---

## 🎬 Example HR Journey

### Step 1 — Candidate

```text
Rahul Sharma
Applied Role: Sales Manager
```

### Step 2 — AI Introduction

```text
AI:
Hello Rahul, I am the virtual HR assistant
from White Collar Realty.
```

### Step 3 — Screening

The agent asks questions such as:

```text
What is your total work experience?

What is your current company and designation?

How many years of real estate experience do you have?

How many people have you directly managed?

What was your team's monthly sales target?

What percentage of your target did your team achieve?

How do you track daily sales performance?
```

### Step 4 — Candidate Evaluation

The system evaluates the collected information against the requirements of the applied role.

### Step 5 — Interview

```text
Interview Date: 25 September 2026
Interview Time: 11:00 AM

Location:
White Collar Realty
M3M Urbana Business Park
Sector 67, Gurugram
```

### Step 6 — Confirmation

```text
Candidate → Confirms attendance
AI → Records confirmation
```

### Step 7 — HR Summary

The system can provide HR with a structured summary of the candidate's screening journey.

---

## 📊 Benefits for HR

The proposed system can help HR teams:

* Reduce repetitive screening calls
* Standardize initial candidate screening
* Ask consistent role-specific questions
* Reduce manual interview coordination
* Improve candidate follow-up
* Reduce missed interview situations
* Collect structured candidate information
* Generate faster candidate summaries
* Improve recruitment workflow visibility

---

## 🔮 Future Scope

The current project is a demo/prototype. Future versions can expand the system with:

* Real outbound phone calling
* Speech-to-text
* Text-to-speech
* Real-time voice conversations
* Candidate CRM integration
* Excel / Google Sheets integration
* Automated call scheduling
* Candidate priority management
* Automated reminders
* WhatsApp integration
* Calendar integration
* Real-time HR dashboards
* Call transcripts
* Conversation analytics
* Advanced JD matching
* Multi-language voice support
* Candidate history and recruitment analytics

---

## ⚠️ Current Scope

This repository is currently intended to demonstrate the **HR Voice Agent concept and recruitment workflow**.

It should not be considered a production-ready autonomous recruitment system.

The current demo uses a controlled workflow and should be validated carefully before being connected to live candidate data or real calling infrastructure.

---

## 👨‍💻 Author

**Chetan Dixit**

AI / ML Engineer | Generative AI | RAG | AI Automation

GitHub:
https://github.com/chetandixit2407

---

## 📄 License

This project does not currently specify a license in the repository.

If you plan to make the project open-source, add an appropriate license file such as `MIT`, `Apache-2.0`, or another license that matches your intended usage.

---

## ⭐ Project Vision

> **Automate repetitive HR calling and screening so HR teams can spend more time on people, decisions, and hiring.**

The long-term vision is to build an AI-powered recruitment assistant capable of handling the repetitive communication layer of the hiring process while keeping HR involved in important hiring decisions.
