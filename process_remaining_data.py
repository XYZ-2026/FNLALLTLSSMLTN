import os
import json
import pandas as pd

def clean_code(x):
    if pd.isna(x):
        return ""
    try:
        val_float = float(x)
        if val_float.is_integer():
            return str(int(val_float))
        else:
            return str(val_float)
    except ValueError:
        return str(x).strip()

def clean_string(x):
    if pd.isna(x):
        return ""
    return str(x).strip()

def main():
    excel_path = "remaining data.xlsx"
    json_path = "cleaned_cet_data.json"
    
    print(f"Reading Excel data from {excel_path}...")
    df = pd.read_excel(excel_path)
    
    # Handle headers if row 0 contains the actual column names
    if 'Unnamed: 0' in df.columns or df.iloc[0].astype(str).str.contains('Choice Code').any():
        print("Detected headers in row 0. Standardizing columns...")
        df.columns = df.iloc[0]
        df = df.iloc[1:].reset_index(drop=True)
    
    print(f"Columns found: {df.columns.tolist()}")
    print(f"Total rows in Excel sheet: {len(df)}")
    
    # Convert and format Excel rows
    new_records = []
    for idx, row in df.iterrows():
        choice_code = clean_code(row.get("Choice Code"))
        inst_code = clean_code(row.get("Institute Code"))
        inst_name = clean_string(row.get("Institute Name"))
        branch = clean_string(row.get("Branch"))
        category = clean_string(row.get("Category"))
        
        # Skip empty rows (e.g., if choice code is missing)
        if not choice_code:
            continue
            
        rounds = {}
        for r in ["R1", "R2", "R3", "R4"]:
            pct_val = row.get(f"{r} Percentile")
            rank_val = row.get(f"{r} Rank")
            
            has_pct = pd.notna(pct_val) and str(pct_val).strip() != ""
            has_rank = pd.notna(rank_val) and str(rank_val).strip() != ""
            
            if has_pct or has_rank:
                round_data = {}
                if has_rank:
                    try:
                        clean_rank = str(rank_val).replace(",", "").strip()
                        round_data["rank"] = int(float(clean_rank))
                    except ValueError:
                        print(f"Warning: could not parse rank '{rank_val}' for Choice Code {choice_code} in round {r}")
                if has_pct:
                    try:
                        clean_pct = str(pct_val).replace(",", "").strip()
                        round_data["percentile"] = float(clean_pct)
                    except ValueError:
                        print(f"Warning: could not parse percentile '{pct_val}' for Choice Code {choice_code} in round {r}")
                
                # Only add the round if we successfully parsed at least one field
                if round_data:
                    rounds[r] = round_data
                    
        new_records.append({
            "choiceCode": choice_code,
            "instituteCode": inst_code,
            "instituteName": inst_name,
            "branch": branch,
            "category": category,
            "rounds": rounds
        })
        
    print(f"Successfully processed {len(new_records)} new records from Excel.")
    
    # Show first 2 records as sample validation
    if new_records:
        print("\nSample records:")
        print(json.dumps(new_records[:2], indent=2))
        
    # Read existing JSON database
    print(f"\nReading existing MHTCET data from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        existing_data = json.load(f)
        
    print(f"Existing records: {len(existing_data)}")
    
    # Append new records
    merged_data = existing_data + new_records
    print(f"Merged records count: {len(merged_data)}")
    
    # Write back to JSON file
    print(f"Writing merged data back to {json_path}...")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(merged_data, f, indent=2, ensure_ascii=False)
        
    print("Done! Data successfully appended.")

if __name__ == "__main__":
    main()
