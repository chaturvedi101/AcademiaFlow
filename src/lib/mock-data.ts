import { Program, UserProfile } from "./types";

export const MOCK_USER: UserProfile = {
  id: 'user1',
  email: 'convenor@university.edu',
  displayName: 'Dr. Sarah Smith',
  role: 'bos_convenor'
};

export const MOCK_PROGRAMS: Program[] = [
  {
    id: 'btech-cs',
    name: 'B.Tech in Computer Science',
    code: 'BTECH-CS',
    totalCredits: 160,
    description: 'Undergraduate engineering program in Computer Science and Engineering.'
  },
  {
    id: 'mba',
    name: 'MBA (General)',
    code: 'MBA',
    totalCredits: 102,
    description: 'Master of Business Administration general program.'
  }
];

export const CREDIT_RULES = {
  UG: {
    total: 160,
    categories: {
      DSC: { min: 96, max: 104 },
      DSE_OFE: { min: 24, max: 32 },
      CPF: { total: 32 }
    }
  }
};
