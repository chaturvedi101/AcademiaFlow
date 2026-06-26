
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

### ⚡ EMERGENCY: Fixing "ECONNREFUSED" Socket Errors
If you see errors like `connect ECONNREFUSED /tmp/vscode-git...`, use the **Nuclear Option** to bypass the broken credential helper:

1. **Set URL with Token**:
   ```bash
   git remote set-url origin https://<YOUR_GITHUB_TOKEN>@github.com/chaturvedi101/AcademiaFlow.git
   ```
2. **Push Directly**:
   ```bash
   git push origin HEAD:main
   ```

### 1. Linking Remote
If the remote repository is not already linked:
```bash
npm run git:setup
```

### 2. Resolving "Invalid username or token" (Detached HEAD)
If you are in a "detached HEAD" state (common when syncing from Studio):
```bash
git push origin HEAD:main
```

### 3. Resolving Authentication Cache Issues
If you see `ECONNREFUSED` or authentication fails repeatedly:
1. **Clear Credential Helper**:
   ```bash
   git config --global --unset credential.helper
   git config --local --unset credential.helper
   ```
2. **Push with the Token**:
   - When asked for a password, **paste the token** instead of your GitHub password.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + ShadCN UI
- **Backend**: Firebase (Authentication, Firestore)
- **AI Engine**: Google Genkit + Gemini 2.5 Flash
- **Exports**: jsPDF with AutoTable
