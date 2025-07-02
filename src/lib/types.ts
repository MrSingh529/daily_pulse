
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'Admin' | 'RSM' | 'ASM' | 'User';
export type Region = 'North' | 'South' | 'East' | 'West' | 'HQ';
export type ReportVisibility = 'Own' | 'Region' | 'All';

export interface UserPermissions {
  viewReports: boolean;
  viewAttendance: boolean;
  submitPjp: boolean;
  submitReport: boolean;
  viewPjp: boolean;
  viewAnalysis: boolean;
  doRaEntry: boolean;
  manageUsers: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  photoURL?: string;
  regions?: Region[];
  reportVisibility?: ReportVisibility;
  permissions?: Partial<UserPermissions>;
  fcmTokens?: string[];
}

export interface Remark {
    text: string;
    byName: string;
    byId: string;
    date: Timestamp;
}

export interface Report {
  id?: string;
  date: Timestamp | Date;
  ascName: string;
  outstandingAmount: number;
  oowCollection: number;
  goodInventoryRealme: number;
  defectiveInventoryRealme: number;
  realmeAgreementDispatch: number;
  realmeSdCollection: number;
  multibrandStnDispatched: number;
  multibrandPendingStns: number;
  submittedBy: string; // User UID
  submittedByName: string;
  submittedByRole: string;
  submittedByRegion?: Region;
  remarks?: Remark[];
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  reportId?: string;
  createdAt: Timestamp;
  isRead: boolean;
  type: 'comment' | 'reminder';
}

export interface RAEntry {
  id?: string;
  date: Timestamp;
  oowConsumed: number;
  oowCollected: number;
  submittedBy: string; // Admin UID
  createdAt: Timestamp;
  userId?: string;
  userName?: string;
  userRole?: string;
}

export interface PJP {
  id?: string;
  userId: string;
  userName: string;
  userRegion: Region;
  planDate: Timestamp | Date;
  scName: string;
  remarks: string;
  createdAt: Timestamp;
}
