
# Academia Flow

Academia Flow is an enterprise-grade Academic Management System designed for **Rajasthan Technical University** (RTU), Kota. It facilitates the transition to the **NEP 2020** framework with advanced AI assistance and institutional cost optimization.

## 🚀 Key Features

- **AI Syllabus Architect**: Automatically generate syllabus units and course outcomes using Gemini Flash.
- **Institutional Pool**: Standardize VAC, AEC, and MDC courses across the university via a centralized Board of Studies (BOS).
- **Subject Inheritance**: Automatic lookup of existing subject codes to maintain academic consistency.
- **Teaching Hour Audit**: Granular tracking of unit and sub-unit hours with automatic totals.
- **Official Exports**: Professional PDF generation for individual syllabi and scheme structures.

## 💰 Institutional Cost Management (Firebase Blaze)

To keep hosting costs near zero for the university, the following configurations are active:

1.  **Compute Throttling**: The `apphosting.yaml` is configured with `minInstances: 0`. You are only billed when users are active.
2.  **Resource Capping**: `maxInstances` is set to 1. This protects the university from viral traffic costs or bot attacks.
3.  **Auto-Session Timeout**: The app automatically logs out users after 5 minutes of inactivity to stop background database listeners.
4.  **Financial Safety**: Set a budget alert for $1.00 in the Google Cloud Billing console to ensure zero unexpected costs.

## 🔑 AI Configuration (Hosting)

If you see "Key Not Found" in your hosted application, you must configure the API key in the Firebase Console:

1.  Visit [Google AI Studio](https://aistudio.google.com/) and create a free Gemini API key.
2.  Go to the **Firebase Console** > **App Hosting**.
3.  Select your backend > **Dashboard** > **Settings**.
4.  Add an **Environment Variable** or **Secret**:
    - **Key**: `GOOGLE_GENAI_API_KEY`
    - **Value**: `[Your Actual Key]`
5.  Re-deploy the application for the changes to take effect.

For local development, add it to your `.env` file:
```bash
GOOGLE_GENAI_API_KEY=your_actual_key_here
```

## 📦 Institutional Git Sync

### 🛠️ Step 1: Initialize Remote with Token (The Nuclear Option)
Run this to bypass "ECONNREFUSED" and permission errors. Replace `[TOKEN]` with your GitHub Personal Access Token (PAT) with `repo` scope.
```bash
git remote set-url origin https://[TOKEN]@github.com/chaturvedi101/AcademiaFlow.git
```

### 📤 Step 2: Push to Main
Run this command to finalize your sync. This forces the remote repository to match your local state.
```bash
git push origin HEAD:main --force
```

### 🆘 Troubleshooting "ECONNREFUSED"
If your terminal continues to throw socket errors, clear the global credential helper:
```bash
git config --global --unset credential.helper
```
