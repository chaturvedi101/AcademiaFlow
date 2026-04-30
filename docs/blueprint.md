# **App Name**: Academia Flow

## Core Features:

- Role-Based Access Control: Secure user authentication with Firebase Auth, enforcing specific permissions for bos_convenor, dean_faculty, dean_academics, and admin roles across all application functionalities.
- Scheme & Syllabus Drafting Tool: Dedicated user interface for 'bos_convenor' to create, edit, and manage academic schemes and their associated syllabi, capturing all required details like program info, subject specifics, and learning outcomes.
- Multi-Stage Approval Workflow: Implement a structured approval process for schemes and syllabi (Draft → Pending Dean → Pending Academics → Approved) with strict role-based progression and immutability for approved documents. All status changes will be recorded in an 'auditLogs' collection.
- NEP 2020 Compliance Builder: An interactive UI for 'bos_convenor' to configure NEP 2020 aspects for programs, including multiple entry/exit points, Academic Bank of Credits (ABC) options, and explicit course categorization.
- Equivalence Engine: A UI component to manage and create mappings between old and new subjects. This tool includes front-end and Firestore validation rules, enforcing that equivalent subjects must be in the same semester and only 'Theory' subjects can be mapped.
- Credit Distribution Enforcement: Automated logic to validate the sum of credits within a scheme against the program's total credit requirements (e.g., 160 for B.Tech) and enforce detailed credit distribution for categories like DSC, DSE, OFE, and CPF.
- Outcome-Based Education (OBE) Mapping Tool: A UI where 'bos_convenor' can map 'courseOutcomes' to 'programOutcomes' for each subject, with an AI assistant tool to suggest relevant program outcomes based on the provided course outcome text.

## Style Guidelines:

- Primary color: A deep, professional indigo (#4D1A8C) to convey authority and intellectual depth. This color is saturated enough to provide contrast on a light background.
- Background color: A very light, subtle off-white with a hint of purple (#F6F3F9), ensuring high readability for extensive textual content and a clean academic feel.
- Accent color: A vibrant yet professional mid-tone blue (#3D8FFF), providing an effective visual cue for interactive elements, links, and highlights, drawing attention to key actions.
- Headline font: 'Space Grotesk' (sans-serif) for titles and headings, providing a modern, slightly technical, and precise aesthetic that suits a technical university setting.
- Body font: 'Inter' (sans-serif) for all body text, forms, and data tables, ensuring excellent legibility, neutrality, and professionalism across the application.
- Use a set of professional, minimalist outline icons for clarity and consistency across all management and administrative functions.
- Implement a structured, data-centric layout with a focus on clear forms, tables, and workflow visualizations to handle complex academic information effectively. Prioritize responsiveness for desktop use.