import pypdf
import csv
import json
import re
import os
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

PDF_PATH = os.path.join('test', '2026_fe_seatmatrix_V1.pdf')
OUT_JSON = os.path.join('cutoffs 2026', 'MHT_CET_2026_Seat_Matrix.json')
OUT_CSV = os.path.join('cutoffs 2026', 'MHT_CET_Seats_2026.csv')

def parse_page_indices(page_texts):
    records = []
    for text in page_texts:
        if not text:
            continue
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        
        clg_code, clg_name, clg_type = '', '', ''
        choice_code, course_name = '', ''
        cap_seats = '0'
        si, ms, min_s, ai, inst, orphan_i, orphan_n = '0', '0', '0', '0', '0', '0', '0'
        ews_seats = '0'
        tfws_code = ''
        tfws_seats = '0'
        
        for idx, l in enumerate(lines):
            m = re.match(r'^(\d{5})\s*-\s*(.+)', l)
            if m:
                clg_code = m.group(1)
                clg_name = m.group(2)
                if idx > 0 and ('Autonomous' in lines[idx-1] or 'Un-Aided' in lines[idx-1] or 'Government' in lines[idx-1] or 'University' in lines[idx-1]):
                    clg_type = lines[idx-1]
                if idx + 1 < len(lines) and ('Autonomous' in lines[idx+1] or 'Un-Aided' in lines[idx+1] or 'Government' in lines[idx+1] or 'University' in lines[idx+1]):
                    clg_type = (clg_type + ' ' + lines[idx+1]).strip()
            
            if 'CAP Seats' in l:
                m_cap = re.search(r'CAP Seats\s*:\s*(\d+)', l)
                if m_cap:
                    cap_seats = m_cap.group(1)
                elif idx + 1 < len(lines) and lines[idx+1].isdigit():
                    cap_seats = lines[idx+1]

            m_cc = re.match(r'^(\d{9,10})$', l)
            if m_cc and not choice_code:
                choice_code = m_cc.group(1)
                if idx + 1 < len(lines):
                    course_name = lines[idx+1]
                nums = []
                for j in range(idx+2, min(idx+12, len(lines))):
                    if lines[j].isdigit():
                        nums.append(lines[j])
                    else:
                        break
                if len(nums) >= 6:
                    si = nums[0]
                    ms = nums[1]
                    min_s = nums[2]
                    ai = nums[3]
                    inst = nums[4]
                    orphan_i = nums[5]
                    if len(nums) >= 7:
                        orphan_n = nums[6]
            
            if 'Economically Weaker Section' in l or 'EWS' in l:
                m_ews = re.search(r'Seats\s*:\s*(\d+)', l)
                if m_ews:
                    ews_seats = m_ews.group(1)
                elif idx + 1 < len(lines) and lines[idx+1].isdigit():
                    ews_seats = lines[idx+1]

            if 'Tution Fee Waiver' in l or 'Tuition Fee Waiver' in l:
                m_tfws_c = re.search(r'Code\s*:\s*(\w+)', l)
                if m_tfws_c:
                    tfws_code = m_tfws_c.group(1)
                m_tfws_s = re.search(r'Seats\s*:\s*(\d+)', l)
                if m_tfws_s:
                    tfws_seats = m_tfws_s.group(1)

        if not choice_code:
            continue

        # Category Breakdown Rows
        for idx, l in enumerate(lines):
            if l in ['State Level', 'HU', 'OHU', 'PWD', 'DEF']:
                vals = []
                for j in range(idx+1, min(idx+25, len(lines))):
                    if lines[j].isdigit():
                        vals.append(lines[j])
                    else:
                        break
                
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
                
                records.append({
                    "Institute_Type": clg_type,
                    "College_Code": clg_code,
                    "College_Name": clg_name,
                    "CAP_Seats": cap_seats,
                    "Choice_Code": choice_code,
                    "Course_Name": course_name,
                    "SI": si,
                    "MS_Seats": ms,
                    "Minority_Seats": min_s,
                    "All_India": ai,
                    "Institute_Seats": inst,
                    "Orphan": str(int(orphan_i or 0) + int(orphan_n or 0)),
                    "Row_Type": l,
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
                })
    return records

def process_batch(start_idx, end_idx):
    reader = pypdf.PdfReader(PDF_PATH)
    batch_texts = []
    for i in range(start_idx, min(end_idx, len(reader.pages))):
        try:
            batch_texts.append(reader.pages[i].extract_text())
        except Exception:
            batch_texts.append("")
    return parse_page_indices(batch_texts)

def main():
    t0 = time.time()
    reader = pypdf.PdfReader(PDF_PATH)
    total_pages = len(reader.pages)
    print(f"Total PDF pages: {total_pages}")
    
    batch_size = 100
    batches = []
    for i in range(0, total_pages, batch_size):
        batches.append((i, i + batch_size))
        
    all_records = []
    print(f"Parsing in parallel across {len(batches)} batches...")
    
    with ProcessPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process_batch, start, end): (start, end) for start, end in batches}
        for future in as_completed(futures):
            res = future.result()
            all_records.extend(res)
            
    print(f"Parsed {len(all_records)} seat matrix records in {time.time()-t0:.2f}s!")
    
    os.makedirs('cutoffs 2026', exist_ok=True)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, indent=2, ensure_ascii=False)
    print(f"Saved JSON to {OUT_JSON}")

    if all_records:
        fieldnames = list(all_records[0].keys())
        with open(OUT_CSV, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_records)
        print(f"Saved CSV to {OUT_CSV}")

if __name__ == '__main__':
    main()
