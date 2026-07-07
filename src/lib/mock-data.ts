import { Program, UserProfile } from "./types";

export const MOCK_USER: UserProfile = {
  id: 'user1',
  email: 'convenor@university.edu',
  displayName: 'Dr. Sarah Smith',
  role: 'bos_convenor'
};

export const MOCK_ADMIN: UserProfile = {
  id: 'admin1',
  email: 'admin@university.edu',
  displayName: 'System Admin',
  role: 'admin'
};

/**
 * Dean Academic: The university-level authority responsible for 
 * final scheme approvals and institutional oversight.
 */
export const MOCK_DEAN_ACADEMIC: UserProfile = {
  id: 'dean_acad_1',
  email: 'dean.academic@rtu.ac.in',
  displayName: 'Dean Academic',
  role: 'dean_academic'
};

export const MOCK_PROGRAMS: Program[] = [
  {
    id: 'btech-cs',
    name: 'BTECH in Computer Science',
    code: 'BTECH-CS',
    totalCredits: 160,
    totalSemesters: 8,
    level: 'UG',
    description: 'Undergraduate engineering program in Computer Science and Engineering.',
    faculty: "Faculty of Computer Science and Communication Engineering",
    branches: ["Computer Science", "Information Technology", "AI & ML"],
    rules: {
      dscMin: 64,
      dscMax: 88,
      experientialMin: 8,
      experientialMax: 12,
      dseMin: 8,
      dseMax: 16,
      ofeMin: 12,
      ofeMax: 24,
      electiveMin: 24,
      electiveMax: 32,
      projectMin: 16,
      projectMax: 32,
      totalRequired: 160,
      vacTotal: 8,
      aecTotal: 8,
      secTotal: 8,
      mdcTotal: 8
    },
    createdAt: null,
    updatedAt: null
  }
];