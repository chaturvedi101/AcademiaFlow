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

## Configuration

### AI Integration
To enable the **GenAI Architect**, you must provide a Google AI API key:
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Generate an API Key.
3. Add the key to your `.env` file:
   ```bash
   GOOGLE_GENAI_API_KEY=your_actual_api_key_here
   ```

## Remote Setup

### 1. Fix Remote URL
If you see "remote origin already exists", run:
```bash
git remote set-url origin https://github.com/chaturvedi101/AcademiaFlow.git
```

### 2. Handle Detached HEAD
If you are in a "detached HEAD" state:
```bash
git switch -c main
```

### 3. Push with Authentication
GitHub requires a **Personal Access Token (PAT)** for authentication in this environment. 
1. Generate a PAT on GitHub (Settings > Developer Settings > Personal Access Tokens).
2. When prompted for credentials during `git push`:
   - **Username**: Your GitHub username
   - **Password**: Your Personal Access Token (NOT your account password)

### 4. Resolve "non-fast-forward" errors
If your push is rejected because the remote is ahead:
```bash
git pull origin main --rebase
git push -u origin main
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file and add your `GOOGLE_GENAI_API_KEY`.

3. **Run development server**:
   ```bash
   npm run dev
   ```
