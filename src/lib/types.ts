
export type UserRole = 'bos_convenor' | 'bos_member' | 'dean_faculty' | 'dean_academic' | 'admin';

export const FACULTIES = [
  "Faculty of Built Environment",
  "Faculty of Materials Science and Engineering",
  "Faculty of Mechanical and Applied Engineering",
  "Faculty of Computer Science and Communication Engineering",
  "Faculty of Energy and Environment Engineering",
  "Faculty of Management Studies",
  "Faculty of Arts",
  "Faculty of Sciences",
  "University-wide (Common BOS)"
] as const;

export type FacultyName = typeof FACULTIES[number];

export interface ManagedBranch {
  programId: string;
  branch: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  faculty?: FacultyName; // Assigned faculty for dean_faculty or common_bos roles
  managedBranches?: ManagedBranch[];
  createdAt?: any;
}

export type SchemeStatus = 'Draft' | 'Pending Dean' | 'Pending Academics' | 'Approved';

export type SubjectType = 'Theory' | 'Lab/Sessional' | 'Project/Internship' | 'Non Graded';

export type CreditCategory = 'DSC' | 'DSE' | 'OFE' | 'CPF' | 'VAC' | 'AEC' | 'SEC' | 'MDC' | 'PRJ';

export type CorrelationLevel = '1' | '2' | '3' | '-';

export interface CreditRules {
  dscMin: number;
  dscMax: number;
  experientialMin: number;
  experientialMax: number;
  dseMin: number;
  dseMax: number;
  ofeMin: number;
  ofeMax: number;
  electiveMin: number; // Combined DSE + OFE
  electiveMax: number; // Combined DSE + OFE
  projectMin: number;
  projectMax: number;
  totalRequired: number;
  vacTotal: number;
  aecTotal: number;
  secTotal: number;
  mdcTotal: number;
}

export interface Program {
  id: string;
  name: string;
  code: string;
  faculty: FacultyName;
  totalCredits: number;
  totalSemesters: number;
  description: string;
  level: 'UG' | 'PG' | 'Diploma' | 'Certificate';
  branches: string[];
  branchPrefixes?: Record<string, string>;
  rules: CreditRules;
  createdAt: any;
  updatedAt: any;
}

export interface Scheme {
  id: string;
  schemeCode: string; // Composite code: PROGRAM-BRANCH-YEAR
  programId: string;
  branch?: string;
  batchYear: string;
  status: SchemeStatus;
  version: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  hasMultipleExits: boolean;
  exitOptions: string[];
  abcEnabled: boolean;
  isCommonPoolScheme?: boolean; // Flag to indicate if this is the institutional common course scheme
}

export interface SyllabusUnit {
  id: string;
  title: string;
  content: string;
  courseOutcome: string;
}

export interface Syllabus {
  id: string;
  schemeId: string;
  subjectCode: string;
  title: string;
  type: SubjectType;
  lectureCredits: number;
  tutorialCredits: number;
  practicalCredits: number;
  credits: number;
  semester: number;
  prerequisites: string[];
  courseOutcomes: string[];
  units: SyllabusUnit[];
  poMappings?: {
    [unitId: string]: {
      [poCode: string]: CorrelationLevel;
    };
  };
  textBooks: string[];
  referenceBooks: string[];
  nptelLinks?: string[];
  youtubeLinks?: string[];
  creditCategory: CreditCategory;
  isCommonCourse?: boolean;
  followedFromId?: string;
  electiveGroupId?: string; // e.g. "Elective-I"
  electiveGroupName?: string; // e.g. "Cloud Computing Pool"
  isOFESlot?: boolean; // True if this is just a placeholder slot in a scheme
  isOFEContribution?: boolean; // True if this is a course offered by this branch to the global pool
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  actionType: string;
  entityId: string;
  timestamp: any;
  details: string;
}
