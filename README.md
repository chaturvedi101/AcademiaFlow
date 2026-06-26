
# Academia Flow

Academia Flow is an enterprise-grade Academic Management System designed for **Rajasthan Technical University** (RTU), Kota. It facilitates the transition to the **NEP 2020** framework, scheme management, and syllabus design with advanced AI assistance.

## 🚀 Key Features

- **AI Syllabus Architect**: Automatically generate syllabus units and course outcomes using Gemini Flash.
- **Institutional Pool**: Standardize VAC, AEC, and MDC courses across the university via a centralized Board of Studies (BOS).
- **Credit Compliance**: Automated validation against RTU-NEP 2020 credit rules (160 credit UG framework).
- **Secure RBAC**: Role-based access control for Convenors, Deans, and Administrators.
- **Official Exports**: Professional PDF generation for individual syllabi and complete course structures.

## 🔑 AI Configuration

To activate the **AI Architect** features:

1.  **Get an API Key**: Visit [Google AI Studio](https://aistudio.google.com/) and create a free Gemini API key.
2.  **Add the Key**: Open the `.env` file in the root directory and update:
    ```bash
    GOOGLE_GENAI_API_KEY=your_actual_key_here
    ```
3.  **Restart**: Run `npm run dev` again. Verify connectivity via the **AI Diagnostics** page in the dashboard.

## 📦 Git & Authentication Guide

### 1. Linking Remote
If the remote repository is not already linked:
```bash
npm run git:setup
```

### 2. Resolving Authentication Errors
If you see **"Invalid username or token"** or **"Password authentication is not supported"**:

1. **Generate a PAT**:
   - Go to GitHub -> Settings -> Developer Settings -> **Personal Access Tokens (Tokens classic)**.
   - Click **Generate new token (classic)**.
   - Select the `repo` scope and generate. **Copy this token immediately.**

2. **Push with the Token**:
   - When you run `git push origin main` and it asks for a password, **paste the token** instead of your GitHub password.

### 3. Resolving "Not currently on a branch" (Detached HEAD)
If you get an error saying you are not on a branch:
```bash
git push origin HEAD:main
```

### 4. Finalizing Changes
To stage and commit all recent academic updates:
```bash
npm run git:commit
```

### 5. Pushing to GitHub
```bash
git push origin main
```

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + ShadCN UI
- **Backend**: Firebase (Authentication, Firestore)
- **AI Engine**: Google Genkit + Gemini 2.5 Flash
- **Exports**: jsPDF with AutoTable
