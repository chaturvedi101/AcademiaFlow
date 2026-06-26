
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

## 🔑 AI Configuration

Visit [Google AI Studio](https://aistudio.google.com/) and create a free Gemini API key. Add it to your `.env` file:
```bash
GOOGLE_GENAI_API_KEY=your_actual_key_here
```

## 📦 Institutional Git Sync

### EMERGENCY: Fixing "ECONNREFUSED" Socket Errors
Run this to reset broken terminal credentials:
```bash
git config --global --unset credential.helper
```

### The "Nuclear Option" (Direct Token Sync)
If normal push fails, set the remote with your Personal Access Token (PAT):
```bash
git remote set-url origin https://<YOUR_PAT>@github.com/chaturvedi101/AcademiaFlow.git
git push origin HEAD:main --force
```
