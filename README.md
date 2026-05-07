# Academia Flow

Academia Flow is an enterprise-grade Academic Management System designed for technical universities to handle NEP 2020 transitions, scheme management, and syllabus design with AI assistance.

## Features

- **AI Syllabus Architect**: Automatically generate syllabus units and course outcomes using Gemini 2.5 Flash.
- **Smart CO-PO Mapping**: Generate correlation matrices using AI reasoning.
- **NEP 2020 Builder**: Configure multiple entry/exit points and credit frameworks.
- **Secure RBAC**: Role-based access control for BoS Convenors, Deans, and Admins.
- **GitHub Authentication**: Secure sign-in for university personnel.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + ShadCN UI
- **Backend**: Firebase (Auth, Firestore)
- **AI Engine**: Google Genkit + Gemini 2.5 Flash

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/chaturvedi101/AcademiaFlow.git
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Create a `.env` file and add your `GOOGLE_GENAI_API_KEY`.

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Start Genkit UI**:
   ```bash
   npm run genkit:dev
   ```

## Remote Setup

To fix the "remote origin already exists" error and push to your new repository:
1. Run:
   ```bash
   git remote set-url origin https://github.com/chaturvedi101/AcademiaFlow.git
   git branch -M main
   git push -u origin main
   ```
