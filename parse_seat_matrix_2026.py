import pdfplumber
import csv
import json
import re
import os
import sys

PDF_PATH = os.path.join('test', '2026_fe_seatmatrix_V1.pdf')
OUT_JSON = os.path.join('cutoffs 2026', 'MHT_CET_2026_Seat_Matrix.json')
OUT_CSV = os.path.join('cutoffs 2026', 'MHT_CET_Seats_2026.csv')

def parse_pdf():
    print(f"Opening PDF {PDF_PATH}...")
    records = []
    
    with pdfplumber.open(PDF_PATH) as pdf:
        total_pages = len(pdf.pages)
        print(f"Total pages to process: {total_pages}")
        
        current_clg_code = ""
        current_clg_name = ""
        current_clg_type = ""
        
        for idx in range(total_pages):
            if (idx + 1) % 200 == 0 or idx == total_pages - 1:
                print(f"Processing page {idx + 1}/{total_pages}...")
                
            page = pdf.pages[idx]
            tables = page.extract_tables()
            if not tables:
                continue
                
            table = tables[0]
            # Clean cells
            rows = []
            for r in table:
                cleaned_row = [c.strip() if c else "" for c in r]
                if any(cleaned_row):
                    rows.append(cleaned_row)
                    
            if not rows:
                continue
                
            # Find institute header info
            # Format: '01002 - Government College of Engineering, Amravati'
            cap_seats = ""
            for r in rows[:4]:
                line = " ".join([c for c in r if c])
                m_clg = re.search(r'^(\d{5})\s*-\s*(.+)', line)
                if m_clg:
                    current_clg_code = m_clg.group(1).strip()
                    current_clg_name = m_clg.group(2).strip()
                if 'Autonomous' in line or 'Un-Aided' in line or 'Government' in line or 'University' in line:
                    if 'CAP Seats' not in line:
                        current_clg_type = line
                if 'CAP Seats' in line:
                    m_cap = re.search(r'CAP Seats\s*:\s*(\d+)', line)
                    if m_cap:
                        cap_seats = m_cap.group(1)
            
            # Find choice code & course metadata
            # Header row contains 'Choice Code', next row contains values
            choice_code = ""
            course_name = ""
            si = "0"
            ms_seats = "0"
            minority_seats = "0"
            all_india = "0"
            inst_seats = "0"
            orphan_i = "0"
            orphan_n = "0"
            
            for i, r in enumerate(rows):
                if len(r) > 1 and r[0] == 'Choice Code':
                    val_row = rows[i+1] if i+1 < len(rows) else []
                    if val_row and len(val_row) >= 2:
                        choice_code = val_row[0]
                        course_name = val_row[1].replace('\n', ' ')
                        # Extract SI, MS Seats, etc. from remaining columns or text
                        for c in val_row[2:]:
                            if c.isdigit():
                                pass
                        # Match numbers in val_row
                        nums = [c for c in val_row if c.isdigit()]
                        if len(nums) >= 6:
                            si = nums[0]
                            ms_seats = nums[1]
                            minority_seats = nums[2]
                            all_india = nums[3]
                            inst_seats = nums[4]
                            orphan_i = nums[5]
                            if len(nums) >= 7:
                                orphan_n = nums[6]
                    break
            
            if not choice_code:
                continue
                
            # Find category matrix rows (State Level, HU, OHU, PWD, DEF)
            # Row categories: OPEN, SC, ST, VJ/DT, NTB, NTC, NTD, OBC, SEBC, Total
            ews_seats = "0"
            tfws_code = ""
            tfws_seats = "0"
            
            for r in rows:
                row_str = " ".join(r)
                if 'Economically Weaker Section' in row_str:
                    m_ews = re.search(r'EWS.*Seats\s*:\s*(\d+)', row_str)
                    if m_ews:
                        ews_seats = m_ews.group(1)
                if 'Tution Fee Waiver Scheme' in row_str or 'Tuition Fee' in row_str:
                    m_tfws_c = re.search(r'Choice Code\s*:\s*(\w+)', row_str)
                    if m_tfws_c:
                        tfws_code = m_tfws_c.group(1)
                    m_tfws_s = re.search(r'Seats\s*:\s*(\d+)', row_str)
                    if m_tfws_s:
                        tfws_seats = m_tfws_s.group(1)

            # Extract data rows for State Level / HU / OHU / PWD / DEF
            # Rows usually start with 'State Level', 'HU', 'OHU', 'PWD', 'DEF'
            for r in rows:
                if not r:
                    continue
                row_label = r[0].strip()
                if row_label in ['State Level', 'HU', 'OHU', 'PWD', 'DEF']:
                    # Values are in r[1:]
                    vals = [c for c in r[1:] if c != '']
                    # We expect 19 values (G, L for 9 categories + Total G+L)
                    open_g = vals[0] if len(vals) > 0 else "0"
                    open_l = vals[1] if len(vals) > 1 else "0"
                    sc_g = vals[2] if len(vals) > 2 else "0"
                    sc_l = vals[3] if len(vals) > 3 else "0"
                    st_g = vals[4] if len(vals) > 4 else "0"
                    st_l = vals[5] if len(vals) > 5 else "0"
                    vj_g = vals[6] if len(vals) > 6 else "0"
                    vj_l = vals[7] if len(vals) > 7 else "0"
                    ntb_g = vals[8] if len(vals) > 8 else "0"
                    ntb_l = vals[9] if len(vals) > 9 else "0"
                    ntc_g = vals[10] if len(vals) > 10 else "0"
                    ntc_l = vals[11] if len(vals) > 11 else "0"
                    ntd_g = vals[12] if len(vals) > 12 else "0"
                    ntd_l = vals[13] if len(vals) > 13 else "0"
                    obc_g = vals[14] if len(vals) > 14 else "0"
                    obc_l = vals[15] if len(vals) > 15 else "0"
                    sebc_g = vals[16] if len(vals) > 16 else "0"
                    sebc_l = vals[17] if len(vals) > 17 else "0"
                    total_gl = vals[18] if len(vals) > 18 else "0"
                    
                    rec = {
                        "Institute_Type": current_clg_type,
                        "College_Code": current_clg_code,
                        "College_Name": current_clg_name,
                        "CAP_Seats": cap_seats,
                        "Choice_Code": choice_code,
                        "Course_Name": course_name,
                        "SI": si,
                        "MS_Seats": ms_seats,
                        "Minority_Seats": minority_seats,
                        "All_India": all_india,
                        "Institute_Seats": inst_seats,
                        "Orphan": str(int(orphan_i or 0) + int(orphan_n or 0)),
                        "Row_Type": row_label,
                        "OPEN_G": open_g, "OPEN_L": open_l,
                        "SC_G": sc_g, "SC_L": sc_l,
                        "ST_G": st_g, "ST_L": st_l,
                        "VJ/DT_G": vj_g, "VJ/DT_L": vj_l,
                        "NTB_G": ntb_g, "NTB_L": ntb_l,
                        "NTC_G": ntc_g, "NTC_L": ntc_l,
                        "NTD_G": ntd_g, "NTD_L": ntd_l,
                        "OBC_G": obc_g, "OBC_L": obc_l,
                        "SEBC_G": sebc_g, "SEBC_L": sebc_l,
                        "Total_G+L": total_gl,
                        "EWS_Seats": ews_seats,
                        "TFWS_Choice_Code": tfws_code,
                        "TFWS_Seats": tfws_seats
                    }
                    records.append(rec)

    print(f"Total parsed records: {len(records)}")
    
    # Save to JSON
    os.makedirs('cutoffs 2026', exist_ok=True)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    print(f"Saved JSON to {OUT_JSON}")
    
    # Save to CSV
    fieldnames = list(records[0].keys()) if records else []
    with open(OUT_CSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    print(f"Saved CSV to {OUT_CSV}")

if __name__ == '__main__':
    parse_pdf()
