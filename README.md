
# Academia Flow

Academia Flow is an enterprise-grade Academic Management System designed for **Rajasthan Technical University** (RTU), Kota. It facilitates the transition to the **NEP 2020** framework, scheme management, and syllabus design with advanced AI assistance.

## 🚀 Key Features

- **AI Syllabus Architect**: Automatically generate syllabus units and course outcomes using Gemini Flash.
- **Institutional Pool**: Standardize VAC, AEC, and MDC courses across the university via a centralized Board of Studies (BOS).
- **Credit Compliance**: Automated validation against RTU-NEP 2020 credit rules (160 credit UG framework).
- **Official Exports**: Professional PDF generation for individual syllabi and complete course structures.

## 💰 Institutional Cost Management (Firebase Blaze)

To keep hosting costs near zero for the university, the following configurations are active:

1.  **Compute Throttling**: The `apphosting.yaml` is configured with `minInstances: 0`. You are only billed for compute when a user is actively browsing.
2.  **Resource Capping**: `maxInstances` is set to 1. This protects the university from viral traffic costs or bot attacks.
3.  **Auto-Session Timeout**: The app automatically logs out users after 5 minutes of inactivity to stop background database listeners.
4.  **Gemini AI Quota**: Uses your **Google AI Studio Key**. Stay on the "Free of charge" tier to avoid API billing.

### 🛡️ Financial Safety Guide
To guarantee zero unexpected costs:
- **Set a Budget Alert**: Go to [Google Cloud Billing](https://console.cloud.google.com/billing) and set an alert for $1.00.
- **Database Indexing**: Avoid adding large amounts of data to collections without proper indexes, as this increases "Read" costs.

## 🔑 AI Configuration

To activate the **AI Architect** features:

1.  **Get an API Key**: Visit [Google AI Studio](https://aistudio.google.com/) and create a free Gemini API key.
2.  **Add the Key**: Open the `.env` file in the root directory and update:
    ```bash
    GOOGLE_GENAI_API_KEY=your_actual_key_here
    ```

## 📦 Git & Authentication Guide

### 🛠 Required Token Permissions
When creating your **Personal Access Token (Classic)** on GitHub, you must select:
- **`repo`** (Full control of private repositories)

### 🚩 Resolving "non-fast-forward" (Rejected) Errors
If your push is rejected, use the **Force Push** to set your local code as the definitive version:
```bash
git push origin HEAD:main --force
```

### ⚡ EMERGENCY: Fixing "ECONNREFUSED" Socket Errors
1. **Reset Git Config**:
   ```bash
   git config --global --unset credential.helper
   ```
2. **Set URL with Token (Nuclear Option)**:
   ```bash
   git remote set-url origin https://<YOUR_GITHUB_TOKEN>@github.com/chaturvedi101/AcademiaFlow.git
   ```
3. **Push Directly**:
   ```bash
   git push origin HEAD:main
   ```
