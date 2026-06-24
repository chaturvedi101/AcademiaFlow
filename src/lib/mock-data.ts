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

export const MOCK_DEAN_ACADEMICS: UserProfile = {
  id: 'dean_acad_1',
  email: 'dean.academics@university.edu',
  displayName: 'Dean of Academics',
  role: 'dean_academics'
};

export const MOCK_PROGRAMS: Program[] = [
  {
    id: 'btech-cs',
    name: 'B.Tech in Computer Science',
    code: 'BTECH-CS',
    totalCredits: 160,
    totalSemesters: 8,
    level: 'UG',
    description: 'Undergraduate engineering program in Computer Science and Engineering.',
    rules: {
      dscMin: 96,
      dscMax: 104,
      experientialMin: 8,
      experientialMax: 12,
      dseMin: 12,
      dseMax: 16,
      ofeMin: 12,
      ofeMax: 16,
      totalRequired: 160
    },
    createdAt: null,
    updatedAt: null
  }
];
