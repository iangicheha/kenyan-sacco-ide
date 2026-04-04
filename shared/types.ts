export interface Member {
  memberId: string;
  name: string;
  phoneNumber: string;
  expectedContribution: number;
  recordedPayments: number;
}

export interface MpesaTransaction {
  transactionId: string;
  phoneNumber: string;
  amount: number;
  date: string; // ISO date string
  type: 'PAYMENT' | 'WITHDRAWAL' | 'DEPOSIT';
}

export interface AuditLog {
  id: string;
  type: 'DISCREPANCY' | 'MISSING_RECORD' | 'OVERPAYMENT';
  memberId: string;
  description: string;
  amount: number;
  sourceFile?: string;
  timestamp: string; // ISO date string
}

export interface MergedData {
  members: Member[];
  mpesaTransactions: MpesaTransaction[];
  auditLogs: AuditLog[];
}
