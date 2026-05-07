
export type UserRole = 'bos_convenor' | 'dean_faculty' | 'dean_academics' | 'admin';

export interface ManagedBranch {
  programId: string;
  branch: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  managedBranches?: ManagedBranch[];
  createdAt?: any;
}

export type SchemeStatus = 'Draft' | 'Pending Dean' | 'Pending Academics' | 'Approved';

export type SubjectType = 'Theory' | 'Tutorial' | 'Practical/Lab' | 'Sessional' | 'Skill/IKS/Experiential';

export type CreditCategory = 'DSC' | 'DSE' | 'OFE' | 'CPF' | 'VAC' | 'AEC' | 'SEC' | 'MDC';

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
  totalRequired: number;
}

export interface Program {
  id: string;
  name: string;
  code: string;
  totalCredits: number;
  totalSemesters: number;
  description: string;
  level: 'UG' | 'PG' | 'Diploma' | 'Certificate';
  branches: string[];
  rules: CreditRules;
  createdAt: any;
  updatedAt: any;
}

export interface Scheme {
  id: string;
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
  programOutcomes: string[]; // Legacy - keeping for compatibility
  poMappings?: {
    [unitId: string]: {
      [poCode: string]: CorrelationLevel;
    };
  };
  resources: string[]; // Legacy - general resources
  textBooks: string[];
  referenceBooks: string[];
  creditCategory: CreditCategory;
}

export interface Equivalence {
  id: string;
  oldSubjectId: string;
  oldSubjectCode: string;
  newSubjectId: string;
  newSubjectCode: string;
  mappedAt: any;
  mappedBy: string;
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
