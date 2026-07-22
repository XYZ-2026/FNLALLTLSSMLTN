"""
Convert 2026 JOSAA and IIT CSV files into JSON files matching the existing 2025 format.

Produces:
  - JOSAA/JOSAA_CUTOFF_CONSOLIDATED_2026.json  (all NITs, IIITs, GFTIs)
  - JOSAA/IIT_ROUND_1_2026.json .. IIT_ROUND_5_2026.json  (IIT per-round files)
  - JOSAA/IIT_ROUND_6_2026.json  (copy of Round 5 data for compatibility)
"""

import csv
import json
import os
import re

JOSAA_CSV = os.path.join('JOSAA', 'JOSAA_Consolidated_2026.csv')
IIT_CSV = os.path.join('JOSAA', 'IITs_Consolidated_2026.csv')
OUTPUT_DIR = 'JOSAA'

# ── State detection from Institute name (mirrors the JS logic) ──
STATE_PATTERNS = [
    ('Andhra Pradesh', ['andhra pradesh', 'warangal', 'tirupati', 'anantapur', 'anantapuramu', 'tadepalligudem']),
    ('Telangana', ['telangana', 'hyderabad', 'warangal']),
    ('Karnataka', ['karnataka', 'surathkal', 'mangalore', 'dharwad', 'bangalore', 'bengaluru', 'raichur', 'mysore', 'mysuru', 'hubli', 'kalaburagi']),
    ('Tamil Nadu', ['tamil nadu', 'trichy', 'tiruchirappalli', 'madurai', 'chennai', 'chengalpattu', 'srirangam', 'dindigul', 'thanjavur', 'kancheepuram', 'coimbatore', 'kanchipuram', 'tiruppatur', 'salem', 'tirunelveli']),
    ('Maharashtra', ['maharashtra', 'nagpur', 'mumbai', 'pune', 'aurangabad']),
    ('Rajasthan', ['rajasthan', 'jaipur', 'jodhpur', 'kota', 'ajmer', 'bikaner']),
    ('Uttar Pradesh', ['allahabad', 'prayagraj', 'agra', 'lucknow', 'uttar pradesh', 'varanasi', 'gorakhpur', 'kanpur', 'aligarh', 'bareilly', 'bhadohi', 'banda', 'sultanpur', 'meerut', 'noida']),
    ('West Bengal', ['durgapur', 'west bengal', 'kolkata', 'shibpur', 'kalyani', 'kharagpur', 'siliguri']),
    ('Bihar', ['bihar', 'patna', 'muzaffarpur', 'bhagalpur', 'gaya', 'ara']),
    ('Odisha', ['odisha', 'rourkela', 'bhubaneswar', 'berhampur']),
    ('Madhya Pradesh', ['bhopal', 'madhya pradesh', 'jabalpur', 'indore', 'gwalior', 'sagar', 'ujjain']),
    ('Kerala', ['kerala', 'calicut', 'kozhikode', 'palakkad', 'kottayam', 'thiruvananthapuram', 'thrissur']),
    ('Gujarat', ['gujarat', 'surat', 'ahmedabad', 'gandhinagar', 'vadodara', 'rajkot']),
    ('Haryana', ['haryana', 'kurukshetra', 'faridabad', 'sonipat', 'rohtak']),
    ('Punjab', ['punjab', 'jalandhar', 'chandigarh', 'bathinda', 'patiala', 'amritsar', 'ropar', 'rupnagar']),
    ('Himachal Pradesh', ['hamirpur', 'himachal', 'shimla', 'kangra', 'mandi', 'una']),
    ('Jharkhand', ['jharkhand', 'jamshedpur', 'ranchi', 'dhanbad', 'mesra', 'deoghar']),
    ('Uttarakhand', ['uttarakhand', 'roorkee', 'srinagar garhwal', 'haldwani', 'dehradun', 'haridwar', 'pauri']),
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
    ('Chandigarh', ['chandigarh']),
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


def read_csv_records(csv_path):
    """Read CSV and return list of dicts."""
    records = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Strip whitespace from keys and values
            cleaned = {}
            for k, v in row.items():
                key = k.strip() if k else k
                val = v.strip() if v else ''
                cleaned[key] = val
            records.append(cleaned)
    return records


def convert_josaa_consolidated():
    """Convert JOSAA_Consolidated_2026.csv to JOSAA_CUTOFF_CONSOLIDATED_2026.json"""
    print(f"Reading {JOSAA_CSV}...")
    records = read_csv_records(JOSAA_CSV)
    print(f"  Read {len(records)} records")

    # Print CSV column names for debugging
    if records:
        print(f"  CSV columns: {list(records[0].keys())}")

    output = []
    for r in records:
        institute = r.get('Institute', '')
        state = detect_state(institute)

        entry = {
            'Institute': institute,
            'State': state,
            'Academic Program Name': r.get('Academic Program Name', ''),
            'Quota': r.get('Quota', ''),
            'Seat Type': r.get('Seat Type', ''),
            'Gender': r.get('Gender', ''),
        }

        # Map round columns - 2026 has 5 rounds
        # CSV headers: "Round 1 - Closing Rank", "Round 2 - Closing Rank", etc.
        for round_num in range(1, 6):
            # Try various possible column name formats
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

        output.append(entry)

    out_path = os.path.join(OUTPUT_DIR, 'JOSAA_CUTOFF_CONSOLIDATED_2026.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({'JOSAA_CUTOFF_CONSOLIDATED_2026': output}, f, ensure_ascii=False, indent=2)

    print(f"  [OK] Written {len(output)} records to {out_path}")
    return output


def convert_iit_rounds():
    """Convert IITs_Consolidated_2026.csv to per-round IIT_ROUND_X_2026.json files"""
    print(f"\nReading {IIT_CSV}...")
    records = read_csv_records(IIT_CSV)
    print(f"  Read {len(records)} records")

    if records:
        print(f"  CSV columns: {list(records[0].keys())}")

    # For each round, produce a separate JSON file
    for round_num in range(1, 6):
        round_data = []

        for r in records:
            institute = r.get('Institute', '')

            # Find the closing rank for this round
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
                continue  # Skip rows with no data for this round

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


if __name__ == '__main__':
    convert_josaa_consolidated()
    convert_iit_rounds()
    print("\n[DONE] All conversions complete!")
