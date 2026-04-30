
export type UserRole = 'bos_convenor' | 'dean_faculty' | 'dean_academics' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: any;
}

export type SchemeStatus = 'Draft' | 'Pending Dean' | 'Pending Academics' | 'Approved';

export type SubjectType = 'Theory' | 'Tutorial' | 'Practical/Lab' | 'Sessional' | 'Skill/IKS/Experiential';

export type CreditCategory = 'DSC' | 'DSE' | 'OFE' | 'CPF' | 'VAC' | 'AEC' | 'SEC' | 'MDC';

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
  rules: CreditRules;
  createdAt: any;
  updatedAt: any;
}

export interface Scheme {
  id: string;
  programId: string;
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
  programOutcomes: string[];
  resources: string[];
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
