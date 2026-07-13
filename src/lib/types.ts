
export type UserRole = 'bos_convenor' | 'bos_member' | 'dean_faculty' | 'dean_academic' | 'admin' | 'monitor' | 'committee_convenor' | 'guest';

export const FACULTIES = [
  "Faculty of Built Environment",
  "Faculty of Materials Science and Engineering",
  "Faculty of Mechanical and Applied Engineering",
  "Faculty of Computer Science and Communication Engineering",
  "Faculty of Energy and Environment Engineering",
  "Faculty of Management Studies",
  "Faculty of Arts",
  "Faculty of Sciences",
  "BTECH (Common BOS)",
  "BBA (Common BOS)",
  "Course Committee - Mathematics",
  "Course Committee - Physics",
  "Course Committee - Chemistry",
  "Course Committee - Humanities",
  "Course Committee - Basic Sciences"
] as const;

export type FacultyName = typeof FACULTIES[number];

export interface ManagedBranch {
  programId: string;
  branch: string;
  role: 'bos_convenor' | 'bos_member' | 'committee_convenor';
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  faculty?: FacultyName; // Assigned faculty for dean_faculty, common_bos, or committee roles
  managedBranches?: ManagedBranch[];
  createdAt?: any;
}

export type SchemeStatus = 'Draft' | 'Pending Dean' | 'Pending Academics' | 'Approved';

export type SubmissionScope = 'Year 1' | 'Year 2' | 'Year 3' | 'Complete';

export type SubjectType = 'Theory' | 'Lab/Sessional';

export type CreditCategory = 'DSC' | 'DSE' | 'OFE' | 'VAC' | 'AEC' | 'SEC' | 'MDC' | 'PRJ';

export type CorrelationLevel = '1' | '2' | '3' | '-';

export const PROGRAM_OUTCOMES = [
  { code: 'PO1', title: 'Engineering Knowledge' },
  { code: 'PO2', title: 'Problem Analysis' },
  { code: 'PO3', title: 'Design/Development' },
  { code: 'PO4', title: 'Investigations' },
  { code: 'PO5', title: 'Tool Usage' },
  { code: 'PO6', title: 'Society' },
  { code: 'PO7', title: 'Environment' },
  { code: 'PO8', title: 'Ethics' },
  { code: 'PO9', title: 'Teamwork' },
  { code: 'PO10', title: 'Communication' },
  { code: 'PO11', title: 'Project Management' },
  { code: 'PO12', title: 'Life-long Learning' },
];

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

export interface ProgramSlotTemplate {
  id: string;
  semester: number;
  creditCategory: CreditCategory;
  credits: number;
  type: SubjectType;
  lectureCredits: number;
  tutorialCredits: number;
  practicalCredits: number;
  subjectCode?: string;
  title?: string;
  electiveGroupId?: string;
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
  slotTemplate?: ProgramSlotTemplate[]; // Master slots inherited by all schemes
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
  submissionScope?: SubmissionScope;
  version: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  hasMultipleExits: boolean;
  exitOptions: string[];
  abcEnabled: boolean;
  isVerticalPool?: boolean; // Flag to indicate if this is a vertical-specific course pool (e.g. BTECH Pool)
  isCommitteePool?: boolean; // Flag to indicate if this is a specialized Course Committee pool
  reversionComments?: string; // Observations from Dean when reverting to Draft
}

export interface SyllabusSubUnit {
  id: string;
  title: string;
  content: string;
  hours: number;
}

export interface SyllabusUnit {
  id: string;
  title: string;
  content: string;
  courseOutcome: string;
  hours: number;
  subUnits?: SyllabusSubUnit[];
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
  websiteLinks?: string[];
  creditCategory: CreditCategory;
  isCommonCourse?: boolean;
  followedFromId?: string;
  parentSchemeId?: string;
  electiveGroupId?: string; // e.g. "Elective-I"
  electiveGroupName?: string; // e.g. "Cloud Computing Pool"
  isSlot?: boolean; // Generic flag for a pre-defined locked slot
  timetableSlot?: string; // e.g. "1", "2" for Theory or "A", "B" for Practical
  isStandardized?: boolean;
  standardizedFrom?: string;
  isInherited?: boolean;
  parentCode?: string;
}

export interface Feedback {
  id?: string;
  name: string;
  email: string;
  phone: string;
  feedback: string;
  schemeId: string;
  createdAt: any;
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

export interface AppHostingConfig {
  minInstances: number;
  maxInstances: number;
  memory: '256Mi' | '512Mi' | '1Gi' | '2Gi';
  cpu: number;
  concurrency: number;
  updatedAt?: any;
  updatedBy?: string;
}
