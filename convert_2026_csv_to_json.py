"""
Convert 2026 JoSAA and CSAB CSV files into JSON files required by JoSAA & CSAB tools,
using JOSAA/clgs.json for precise institute classification.

Input files:
  - JOSAA 2026/JOSAA 2026 CUTOFF DATA - JOSAA Consolidated.csv
  - JOSAA 2026/IITs Consolidated.csv
  - CSAB 2026/CSAB Cutoffs 2026 Consolidated - CSAB Consolidated.csv
  - JOSAA/clgs.json

Output files:
  - JOSAA/JOSAA_CUTOFF_CONSOLIDATED_2026.json
  - JOSAA/IIT_ROUND_1_2026.json .. IIT_ROUND_5_2026.json (& IIT_ROUND_6_2026.json)
  - JOSAA/CSAB_CUTOFF_CONSOLIDATED_2026.json
  - josaa.json
"""

import csv
import json
import os

JOSAA_CSV = os.path.join('JOSAA 2026', 'JOSAA 2026 CUTOFF DATA - JOSAA Consolidated.csv')
IIT_CSV = os.path.join('JOSAA 2026', 'IITs Consolidated.csv')
CSAB_CSV = os.path.join('CSAB 2026', 'CSAB Cutoffs 2026 Consolidated - CSAB Consolidated.csv')
CLGS_JSON = os.path.join('JOSAA', 'clgs.json')
OUTPUT_DIR = 'JOSAA'

# Load clgs.json mapping if present
def load_clgs_mapping():
    mapping = {}
    if os.path.exists(CLGS_JSON):
        with open(CLGS_JSON, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for inst_type, names in data.items():
                for name in names:
                    mapping[name.strip().lower()] = inst_type
    return mapping

CLGS_MAP = load_clgs_mapping()

# State detection rules
STATE_PATTERNS = [
    ('Andhra Pradesh', ['andhra pradesh', 'warangal', 'tirupati', 'anantapur', 'anantapuramu', 'tadepalligudem', 'kurnool', 'visakhapatnam', 'ongole', 'guntur']),
    ('Telangana', ['telangana', 'hyderabad', 'warangal']),
    ('Karnataka', ['karnataka', 'surathkal', 'mangalore', 'dharwad', 'bangalore', 'bengaluru', 'raichur', 'mysore', 'mysuru', 'hubli', 'kalaburagi']),
    ('Tamil Nadu', ['tamil nadu', 'trichy', 'tiruchirappalli', 'madurai', 'chennai', 'chengalpattu', 'srirangam', 'dindigul', 'thanjavur', 'kancheepuram', 'coimbatore', 'kanchipuram', 'tiruppatur', 'salem', 'tirunelveli']),
    ('Maharashtra', ['maharashtra', 'nagpur', 'mumbai', 'pune', 'aurangabad', 'vnit']),
    ('Rajasthan', ['rajasthan', 'jaipur', 'jodhpur', 'kota', 'ajmer', 'bikaner', 'mnit jaipur']),
    ('Uttar Pradesh', ['allahabad', 'prayagraj', 'agra', 'lucknow', 'uttar pradesh', 'varanasi', 'gorakhpur', 'kanpur', 'aligarh', 'bareilly', 'bhadohi', 'banda', 'sultanpur', 'meerut', 'noida', 'mnnit']),
    ('West Bengal', ['durgapur', 'west bengal', 'kolkata', 'shibpur', 'kalyani', 'kharagpur', 'siliguri', 'iiest']),
    ('Bihar', ['bihar', 'patna', 'muzaffarpur', 'bhagalpur', 'gaya', 'ara']),
    ('Odisha', ['odisha', 'rourkela', 'bhubaneswar', 'berhampur']),
    ('Madhya Pradesh', ['bhopal', 'madhya pradesh', 'jabalpur', 'indore', 'gwalior', 'sagar', 'ujjain', 'manit']),
    ('Kerala', ['kerala', 'calicut', 'kozhikode', 'palakkad', 'kottayam', 'thiruvananthapuram', 'thrissur']),
    ('Gujarat', ['gujarat', 'surat', 'ahmedabad', 'gandhinagar', 'vadodara', 'rajkot', 'svnit']),
    ('Haryana', ['haryana', 'kurukshetra', 'faridabad', 'sonipat', 'rohtak']),
    ('Punjab', ['punjab', 'jalandhar', 'chandigarh', 'bathinda', 'patiala', 'amritsar', 'ropar', 'rupnagar']),
    ('Himachal Pradesh', ['hamirpur', 'himachal', 'shimla', 'kangra', 'mandi', 'una']),
    ('Jharkhand', ['jharkhand', 'jamshedpur', 'ranchi', 'dhanbad', 'mesra', 'deoghar', 'bit mesra']),
    ('Uttarakhand', ['uttarakhand', 'roorkee', 'srinagar garhwal', 'haldwani', 'dehradun', 'haridwar', 'pauri', 'srinagar, uttarakhand']),
    ('Arunachal Pradesh', ['arunachal', 'itanagar']),
    ('Nagaland', ['nagaland', 'dimapur', 'kohima']),
    ('Manipur', ['manipur', 'imphal']),
    ('Tripura', ['tripura', 'agartala']),
    ('Meghalaya', ['meghalaya', 'shillong']),
    ('Mizoram', ['mizoram', 'aizawl']),
    ('Sikkim', ['sikkim', 'gangtok']),
    ('Goa', ['goa']),
    ('Delhi', ['delhi']),
    ('Jammu and Kashmir', ['srinagar', 'jammu', 'kashmir']),
    ('Chhattisgarh', ['chhattisgarh', 'raipur', 'bilaspur', 'durg', 'bhilai']),
    ('Assam', ['assam', 'guwahati', 'silchar', 'tezpur', 'jorhat']),
    ('Chandigarh', ['chandigarh', 'pec']),
    ('Puducherry', ['puducherry', 'pondicherry', 'karaikal']),
    ('Andaman and Nicobar', ['andaman', 'nicobar', 'port blair']),
    ('Ladakh', ['ladakh', 'leh']),
]

def detect_state(institute_name):
    lower = institute_name.lower()
    for state, patterns in STATE_PATTERNS:
        for p in patterns:
            if p in lower:
                return state
    return ''

def get_institute_type(institute_name):
    lower = institute_name.strip().lower()
    if lower in CLGS_MAP:
        return CLGS_MAP[lower]
    if 'indian institute of technology' in lower or ' iit' in lower or lower.startswith('iit'):
        return 'IIT'
    if 'national institute of technology' in lower or ' nit' in lower or lower.startswith('nit'):
        return 'NIT'
    if 'indian institute of information technology' in lower or ' iiit' in lower or lower.startswith('iiit'):
        return 'IIIT'
    return 'GFTI'

def read_csv_records(csv_path):
    records = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = {}
            for k, v in row.items():
                key = k.strip() if k else k
                val = v.strip() if v else ''
                cleaned[key] = val
            records.append(cleaned)
    return records

def convert_josaa_consolidated():
    """Convert JOSAA Consolidated 2026 CSV -> JOSAA/JOSAA_CUTOFF_CONSOLIDATED_2026.json & josaa.json"""
    print(f"Reading {JOSAA_CSV}...")
    records = read_csv_records(JOSAA_CSV)
    print(f"  Read {len(records)} records")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_consolidated = []
    output_josaa_main = []

    for r in records:
        institute = r.get('Institute', '')
        state = detect_state(institute)
        inst_type = get_institute_type(institute)
        prog = r.get('Academic Program Name', '')
        quota = r.get('Quota', '')
        seat_type = r.get('Seat Type', '')
        gender = r.get('Gender', '')

        entry = {
            'Institute': institute,
            'State': state,
            'Type': inst_type,
            'Academic Program Name': prog,
            'Quota': quota,
            'Seat Type': seat_type,
            'Gender': gender,
        }

        r1_val = ''
        r_last_val = ''

        for round_num in range(1, 6):
            val = ''
            for key_format in [
                f'Round {round_num} - Closing Rank',
                f'Round {round_num} -Closing Rank',
                f'Round {round_num} - Closing Rank ',
                f'Round {round_num} -Closing Rank ',
            ]:
                if key_format in r:
                    val = r[key_format]
                    break

            entry[f'Round {round_num} - Closing Rank '] = val

            if round_num == 1 and val:
                r1_val = val
            if val:
                r_last_val = val

        output_consolidated.append(entry)

        if r1_val or r_last_val:
            output_josaa_main.append({
                'Institute': institute,
                'Academic Program Name': prog,
                'Quota': quota,
                'Seat Type': seat_type,
                'Gender': gender,
                'Opening Rank': r1_val if r1_val else r_last_val,
                'Closing Rank': r_last_val if r_last_val else r1_val
            })

    out_path = os.path.join(OUTPUT_DIR, 'JOSAA_CUTOFF_CONSOLIDATED_2026.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({'JOSAA_CUTOFF_CONSOLIDATED_2026': output_consolidated}, f, ensure_ascii=False, indent=2)
    print(f"  [OK] Written {len(output_consolidated)} records to {out_path}")

    josaa_main_path = 'josaa.json'
    with open(josaa_main_path, 'w', encoding='utf-8') as f:
        json.dump({'JOSAA DATA': output_josaa_main}, f, ensure_ascii=False, indent=2)
    print(f"  [OK] Written {len(output_josaa_main)} records to {josaa_main_path}")

def convert_iit_rounds():
    """Convert IITs Consolidated 2026 CSV -> JOSAA/IIT_ROUND_X_2026.json"""
    print(f"\nReading {IIT_CSV}...")
    records = read_csv_records(IIT_CSV)
    print(f"  Read {len(records)} records")

    for round_num in range(1, 6):
        round_data = []
        for r in records:
            institute = r.get('Institute', '')
            val = ''
            for key_format in [
                f'Round {round_num} - Closing Rank',
                f'Round {round_num} -Closing Rank',
                f'Round {round_num} - Closing Rank ',
                f'Round {round_num} -Closing Rank ',
            ]:
                if key_format in r:
                    val = r[key_format]
                    break

            if not val:
                continue

            entry = {
                'Institute': institute,
                'Academic Program Name': r.get('Academic Program Name', ''),
                'Quota': r.get('Quota', ''),
                'Seat Type': r.get('Seat Type', ''),
                'Gender': r.get('Gender', ''),
                'Closing Rank': val,
            }
            round_data.append(entry)

        key = f'IIT_ROUND_{round_num}_2026'
        out_path = os.path.join(OUTPUT_DIR, f'{key}.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump({key: round_data}, f, ensure_ascii=False, indent=2)

        print(f"  [OK] Round {round_num}: {len(round_data)} entries -> {out_path}")

        if round_num == 5:
            key6 = 'IIT_ROUND_6_2026'
            out_path6 = os.path.join(OUTPUT_DIR, f'{key6}.json')
            with open(out_path6, 'w', encoding='utf-8') as f:
                json.dump({key6: round_data}, f, ensure_ascii=False, indent=2)
            print(f"  [OK] Round 6 (copy of 5): {len(round_data)} entries -> {out_path6}")

def convert_csab_consolidated():
    """Convert CSAB Consolidated 2026 CSV -> JOSAA/CSAB_CUTOFF_CONSOLIDATED_2026.json"""
    print(f"\nReading {CSAB_CSV}...")
    records = read_csv_records(CSAB_CSV)
    print(f"  Read {len(records)} records")

    output = []
    for r in records:
        institute = r.get('Institute', '')
        state = detect_state(institute)
        inst_type = get_institute_type(institute)

        r1 = r.get('R1 Rank', '') or r.get('Round 1 Rank', '') or r.get('Round 1 - Closing Rank', '')
        r2 = r.get('R2 Rank', '') or r.get('Round 2 Rank', '') or r.get('Round 2 - Closing Rank', '')

        entry = {
            'Institute': institute,
            'State': state,
            'Type': inst_type,
            'Academic Program Name': r.get('Academic Program Name', ''),
            'Quota': r.get('Quota', ''),
            'Seat Type': r.get('Seat Type', ''),
            'Gender': r.get('Gender', ''),
            'Round 1 - Closing Rank ': r1,
            'Round 2 - Closing Rank ': r2,
        }
        output.append(entry)

    out_path = os.path.join(OUTPUT_DIR, 'CSAB_CUTOFF_CONSOLIDATED_2026.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({'CSAB_CUTOFF_CONSOLIDATED_2026': output}, f, ensure_ascii=False, indent=2)

    print(f"  [OK] CSAB Consolidated: {len(output)} records -> {out_path}")

if __name__ == '__main__':
    print(f"Loaded {len(CLGS_MAP)} institute entries from JOSAA/clgs.json")
    convert_josaa_consolidated()
    convert_iit_rounds()
    convert_csab_consolidated()
    print("\n[DONE] All JoSAA & CSAB CSV to JSON conversions complete!")
