
# Academia Flow

Academia Flow is an enterprise-grade Academic Management System designed for Rajasthan Technical University to handle NEP 2020 transitions, scheme management, and syllabus design with AI assistance.

## 🚀 Key Features

- **AI Syllabus Architect**: Automatically generate syllabus units and course outcomes using Gemini Flash.
- **Smart CO-PO Mapping**: Generate correlation matrices using AI reasoning.
- **Institutional Pool**: Standardize VAC, AEC, and MDC courses across the university.
- **Secure RBAC**: Role-based access control for BoS Convenors, Deans, and Admins.
- **Official Export**: Generate RTU-branded syllabus and structure PDFs.

## 🔑 AI Configuration

To enable the **AI Architect** features, you must provide a Google AI API key:

1.  **Get a Key**: Visit [Google AI Studio](https://aistudio.google.com/) and create a free API key.
2.  **Add Key**: Open the `.env` file in the root folder and add:
    ```bash
    GOOGLE_GENAI_API_KEY=your_actual_key_here
    ```
3.  **Restart**: Run `npm run dev` again to activate AI features.

## 📦 Git & Remote Sync

### 1. Initial Setup
If you haven't linked the remote repository, run:
```bash
npm run git:setup
```

### 2. Committing Changes
You can use the built-in script to stage and commit all recent changes:
```bash
npm run git:commit
```

### 3. Pushing to GitHub
To push your committed changes:
```bash
git push origin main
```
*Note: GitHub requires a **Personal Access Token (PAT)** as the password.*

### 4. Safety Warning
The project includes a `.gitignore` file. **Never** remove `.env` from this list to ensure your API keys stay private.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + ShadCN UI
- **Backend**: Firebase (Auth, Firestore)
- **AI Engine**: Google Genkit + Gemini Flash
- **Exports**: jsPDF with AutoTable
