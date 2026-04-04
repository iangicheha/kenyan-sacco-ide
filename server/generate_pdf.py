from fpdf import FPDF
import json
import sys
from datetime import datetime

class PDF(FPDF):
    def header(self):
        self.set_font("Arial", "B", 12)
        self.cell(0, 10, "Meridian AI: Boardroom Financial Audit Report", 0, 1, "C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", 0, 0, "C")

    def chapter_title(self, title):
        self.set_font("Arial", "B", 10)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 6, title, 0, 1, "L", 1)
        self.ln(4)

    def chapter_body(self, body):
        self.set_font("Arial", "", 10)
        self.multi_cell(0, 5, body)
        self.ln()

    def add_table(self, heading, data, col_widths):
        self.set_font("Arial", "B", 8)
        self.cell(0, 6, heading, 0, 1, "L")
        self.ln(2)

        # Table Header
        for i, header in enumerate(data[0]):
            self.cell(col_widths[i], 7, str(header), 1, 0, "C")
        self.ln()

        self.set_font("Arial", "", 8)
        for row in data[1:]:
            for i, item in enumerate(row):
                self.cell(col_widths[i], 6, str(item), 1, 0, "L")
            self.ln()
        self.ln(5)

def generate_report(audit_data_json):
    data = json.loads(audit_data_json)
    audit_logs = data["auditLogs"]
    members = data["members"]
    mpesa_transactions = data["mpesaTransactions"]

    pdf = PDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # Executive Summary
    pdf.chapter_title("Executive Summary")
    total_discrepancies = len(audit_logs)
    total_value_discrepancies = sum(log["amount"] for log in audit_logs if log["type"] == "DISCREPANCY" or log["type"] == "OVERPAYMENT")
    phantom_savings = sum(log["amount"] for log in audit_logs if log["type"] == "DISCREPANCY")
    ghost_accounts = sum(1 for log in audit_logs if log["type"] == "MISSING_RECORD")

    summary_text = f"This report presents the findings of an automated financial audit conducted by Meridian AI. The audit focused on reconciling member records with M-Pesa transactions to identify potential discrepancies, phantom savings, and ghost accounts, ensuring compliance with SASRA regulations.\n\n"
    summary_text += f"Key Findings:\n"
    summary_text += f"* Total Discrepancies Detected: {total_discrepancies}\n"
    summary_text += f"* Total Value of Discrepancies: KES {total_value_discrepancies:,.2f}\n"
    summary_text += f"* Potential Phantom Savings: KES {phantom_savings:,.2f}\n"
    summary_text += f"* Potential Ghost Accounts: {ghost_accounts}\n"
    summary_text += f"* SASRA Compliance Score: Requires further analysis (Placeholder)\n"
    pdf.chapter_body(summary_text)

    # Audit Methodology
    pdf.chapter_title("Audit Methodology")
    methodology_text = "Meridian AI employs a multi-stage audit methodology: Data Ingestion, Semantic Mapping, Forensic Analysis, Regulatory Reasoning, and Report Generation. This ensures comprehensive and accurate financial oversight.\n"
    pdf.chapter_body(methodology_text)

    # Detailed Audit Findings - Discrepancies
    if any(log["type"] == "DISCREPANCY" or log["type"] == "OVERPAYMENT" for log in audit_logs):
        discrepancy_data = [["Member ID", "Member Name", "Phone Number", "Recorded Payments (KES)", "Actual M-Pesa Payments (KES)", "Discrepancy (KES)", "Type", "Description"]]
        for log in audit_logs:
            if log["type"] == "DISCREPANCY" or log["type"] == "OVERPAYMENT":
                member = next((m for m in members if m["memberId"] == log["memberId"]), None)
                actual_mpesa_payments = sum(tx["amount"] for tx in mpesa_transactions if tx["phoneNumber"] == member["phoneNumber"])
                discrepancy_data.append([
                    log["memberId"],
                    member["name"] if member else "N/A",
                    member["phoneNumber"] if member else "N/A",
                    f"{member["recordedPayments"]:,.2f}" if member else "N/A",
                    f"{actual_mpesa_payments:,.2f}",
                    f"{log["amount"]:,.2f}",
                    log["type"],
                    log["description"]
                ])
        pdf.add_table("Discrepancies Detected (Phantom Savings / Overpayments)", discrepancy_data, [20, 30, 30, 30, 35, 25, 20, 50])

    # Detailed Audit Findings - Ghost Accounts
    if any(log["type"] == "MISSING_RECORD" for log in audit_logs):
        ghost_account_data = [["Transaction ID", "Phone Number", "Amount (KES)", "Date", "Description"]]
        for log in audit_logs:
            if log["type"] == "MISSING_RECORD":
                tx = next((t for t in mpesa_transactions if t["transactionId"] == log["id"].replace("ghost-", "")), None)
                ghost_account_data.append([
                    log["id"].replace("ghost-", ""),
                    tx["phoneNumber"] if tx else "N/A",
                    f"{log["amount"]:,.2f}",
                    tx["date"][:10] if tx else "N/A",
                    log["description"]
                ])
        pdf.add_table("Potential Ghost Accounts", ghost_account_data, [30, 30, 25, 20, 85])

    # SASRA Compliance Summary
    pdf.chapter_title("SASRA Compliance Summary")
    sasra_summary_text = "Meridian AI assesses compliance against key SASRA regulations. Based on the audit, the following status is observed:\n"
    sasra_summary_text += "* Provisioning (Form 4): Requires further analysis (Placeholder)\n"
    sasra_summary_text += "* Capital Adequacy (Form 1): Requires further analysis (Placeholder)\n"
    pdf.chapter_body(sasra_summary_text)

    # Recommendations
    pdf.chapter_title("Recommendations")
    recommendations_text = "Based on these findings, we recommend: 1. Investigate all flagged discrepancies and ghost accounts for potential fraud or data entry errors. 2. Implement stricter reconciliation processes for M-Pesa transactions. 3. Regularly update member registers and ensure accurate phone number records. 4. Utilize Meridian AI for continuous monitoring and automated compliance reporting.\n"
    pdf.chapter_body(recommendations_text)

    # Audit Trail & Traceability
    pdf.chapter_title("Audit Trail & Traceability")
    audit_trail_text = "Every data point and finding in this report is traceable to its original source document. For detailed forensic analysis, refer to the interactive SACCO IDE, where each flagged cell provides a direct link to the originating M-Pesa transaction or member record.\n"
    pdf.chapter_body(audit_trail_text)

    pdf.set_font("Arial", "I", 8)
    pdf.cell(0, 10, f"Report Generated by Meridian AI on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}", 0, 1, "L")

    report_path = "/tmp/Meridian_AI_Audit_Report.pdf"
    pdf.output(report_path)
    return report_path

if __name__ == "__main__":
    audit_data_json = sys.stdin.read()
    report_file = generate_report(audit_data_json)
    print(report_file)
