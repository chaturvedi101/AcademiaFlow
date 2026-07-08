
# Academia Flow

Academia Flow is an enterprise-grade Academic Management System designed for **Rajasthan Technical University** (RTU), Kota. It facilitates the transition to the **NEP 2020** framework with advanced AI assistance and institutional cost optimization.

## 🎓 RTU Course Code Standard

All subjects in the system must follow the official RTU-NEP 2020 nomenclature:
**Format:** `[PREFIX][PEDAGOGY][PILLAR][YEAR][SEQUENCE]`

### 1. Committee Prefixes (First 4 Characters)
- **Mathematics**: `MATH`
- **Physics**: `PHYS`
- **Chemistry**: `CHEM`
- **Humanities**: `HUMA`
- **Basic Sciences**: `BSCI`
- **Common Pools**: `RT` (For VAC, AEC, MDC)
- **Branch Subjects**: Uses Branch Prefix (e.g., `CS`, `ME`, `CA`)

### 2. Pedagogical Methodology
- `L`: Theory (Lecture/Tutorial)
- `P`: Practical (Lab/Sessional)
- `I`: Internship / Industrial / Project

### 3. Credit Pillars (NEP Categories)
- `C`: Discipline Specific Core (DSC)
- `E`: Electives (DSE / OFE)
- `S`: Skill Enhancement (SEC)
- `V`: Value Added (VAC)
- `A`: Ability Enhancement (AEC)
- `M`: Multidisciplinary (MDC)
- `P`: Major/Minor Project (PRJ)

### 4. Year & Sequence
- **Year**: `1`, `2`, `3`, or `4`.
- **Sequence**: `01` to `99`.

**Example:** `MATHLC101` (Math, Theory, Core, 1st Year, Slot 01)

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
