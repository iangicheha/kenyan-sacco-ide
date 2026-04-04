import { Member, MpesaTransaction, AuditLog } from '../shared/types';

/**
 * Meridian AI Semantic Mapping & Regulatory Reasoning Engine
 * 
 * This engine handles:
 * 1. Semantic Mapping: Resolving entities across disparate data sources (e.g., matching "Kipchoge John" to "John Kipchoge").
 * 2. Regulatory Reasoning: Applying SASRA rules (e.g., provisioning percentages) to the mapped data.
 * 3. Forensic Intelligence: Identifying patterns of "Silent Heists" (phantom savings, ghost accounts).
 */

export class MeridianSemanticEngine {
  
  /**
   * Normalizes phone numbers to a standard format (254...)
   */
  static normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '254' + cleaned;
    }
    return cleaned;
  }

  /**
   * Performs semantic fuzzy matching for member names (Simplified for research prototype)
   */
  static isNameMatch(name1: string, name2: string): boolean {
    const n1 = name1.toLowerCase().split(' ').sort().join(' ');
    const n2 = name2.toLowerCase().split(' ').sort().join(' ');
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  }

  /**
   * SASRA Provisioning Logic (Form 4)
   * 0-30 days: 1% (Performing)
   * 31-90 days: 5% (Watch)
   * 91-180 days: 25% (Substandard)
   * 181-360 days: 50% (Doubtful)
   * >360 days: 100% (Loss)
   */
  static calculateProvisioning(daysPastDue: number, amount: number): number {
    if (daysPastDue <= 30) return amount * 0.01;
    if (daysPastDue <= 90) return amount * 0.05;
    if (daysPastDue <= 180) return amount * 0.25;
    if (daysPastDue <= 360) return amount * 0.50;
    return amount * 1.00;
  }

  /**
   * Forensic Analysis for "Silent Heist" Detection
   */
  static analyzeForensics(members: Member[], transactions: MpesaTransaction[]): AuditLog[] {
    const logs: AuditLog[] = [];
    const now = new Date().toISOString();

    // 1. Ghost Account Detection: Transactions with no matching member
    const memberPhones = new Set(members.map(m => this.normalizePhone(m.phoneNumber)));
    const unmatchedTxs = transactions.filter(tx => !memberPhones.has(this.normalizePhone(tx.phoneNumber)));
    
    unmatchedTxs.forEach(tx => {
      logs.push({
        id: `ghost-${tx.transactionId}`,
        type: 'MISSING_RECORD',
        memberId: 'UNKNOWN',
        description: `Potential Ghost Account: M-Pesa payment from ${tx.phoneNumber} has no matching Member ID.`,
        amount: tx.amount,
        sourceFile: 'mpesa_statement.csv',
        timestamp: now
      });
    });

    // 2. Phantom Savings Detection: Recorded > Actual
    members.forEach(member => {
      const actualPayments = transactions
        .filter(tx => this.normalizePhone(tx.phoneNumber) === this.normalizePhone(member.phoneNumber))
        .reduce((sum, tx) => sum + tx.amount, 0);

      if (member.recordedPayments > actualPayments + 10) { // $10 buffer for small variances
        logs.push({
          id: `phantom-${member.memberId}`,
          type: 'DISCREPANCY',
          memberId: member.memberId,
          description: `Phantom Savings Detected: Recorded KES ${member.recordedPayments} vs Actual M-Pesa KES ${actualPayments}.`,
          amount: member.recordedPayments - actualPayments,
          sourceFile: 'member_register.csv',
          timestamp: now
        });
      }
    });

    return logs;
  }
}
