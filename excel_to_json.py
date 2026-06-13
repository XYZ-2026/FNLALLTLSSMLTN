import fitz
import pandas as pd
import re

PDF_FILE = "MHT CET SEAT MERTIC.pdf"

doc = fitz.open(PDF_FILE)

all_rows = []

current_college_code = ""
current_college_name = ""
current_college_type = ""

for page_num in range(len(doc)):

    text = doc[page_num].get_text("text")

    if not text.strip():
        continue

    lines = [line.strip() for line in text.split("\n") if line.strip()]

    # -----------------------------
    # COLLEGE INFO
    # -----------------------------
    for line in lines:

        college_match = re.match(
            r"(\d{5})\s*-\s*(.*)",
            line
        )

        if college_match:
            current_college_code = college_match.group(1)
            current_college_name = college_match.group(2)

        if any(x in line for x in [
            "Government Autonomous",
            "Government-Aided Autonomous",
            "Government",
            "Un-Aided Autonomous",
            "Un-Aided",
            "Minority",
            "Autonomous"
        ]):
            current_college_type = line

    # -----------------------------
    # COURSE LINE
    # -----------------------------
    course_pattern = re.search(
        r"(\d{10})\s+(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)",
        text,
        re.DOTALL
    )

    if not course_pattern:
        continue

    choice_code = course_pattern.group(1)
    course_name = course_pattern.group(2).strip()

    si = course_pattern.group(3)
    ms_seats = course_pattern.group(4)
    minority_seats = course_pattern.group(5)
    all_india_seats = course_pattern.group(6)
    institute_seats = course_pattern.group(7)
    orphan = course_pattern.group(8)

    # -----------------------------
    # STATE LEVEL ROW
    # -----------------------------
    state_match = re.search(
        r"State Level\s+([\d\s]+)",
        text
    )

    state_values = []

    if state_match:
        state_values = re.findall(
            r"\d+",
            state_match.group(1)
        )

    while len(state_values) < 19:
        state_values.append("")

    # -----------------------------
    # PWD ROW
    # -----------------------------
    pwd_match = re.search(
        r"PWD\s+([\d\s]+)",
        text
    )

    pwd_values = []

    if pwd_match:
        pwd_values = re.findall(
            r"\d+",
            pwd_match.group(1)
        )

    while len(pwd_values) < 10:
        pwd_values.append("")

    # -----------------------------
    # DEF ROW
    # -----------------------------
    def_match = re.search(
        r"DEF\s+([\d\s]+)",
        text
    )

    def_values = []

    if def_match:
        def_values = re.findall(
            r"\d+",
            def_match.group(1)
        )

    while len(def_values) < 10:
        def_values.append("")

    # -----------------------------
    # EWS
    # -----------------------------
    ews_match = re.search(
        r"EWS\)\s*Seats:\s*(\d+)",
        text
    )

    ews = ews_match.group(1) if ews_match else ""

    # -----------------------------
    # TFWS
    # -----------------------------
    tfws_match = re.search(
        r"Seats:\s*(\d+)\s*$",
        text,
        re.MULTILINE
    )

    tfws = tfws_match.group(1) if tfws_match else ""

    row = {
        "College Code": current_college_code,
        "College Name": current_college_name,
        "College Type": current_college_type,

        "Choice Code": choice_code,
        "Course Name": course_name,

        "SI": si,
        "MS Seats": ms_seats,
        "Minority Seats": minority_seats,
        "All India Seats": all_india_seats,
        "Institute Seats": institute_seats,
        "Orphan": orphan,

        "OPEN_G": state_values[0],
        "OPEN_L": state_values[1],

        "SC_G": state_values[2],
        "SC_L": state_values[3],

        "ST_G": state_values[4],
        "ST_L": state_values[5],

        "VJDT_G": state_values[6],
        "VJDT_L": state_values[7],

        "NTB_G": state_values[8],
        "NTB_L": state_values[9],

        "NTC_G": state_values[10],
        "NTC_L": state_values[11],

        "NTD_G": state_values[12],
        "NTD_L": state_values[13],

        "OBC_G": state_values[14],
        "OBC_L": state_values[15],

        "SEBC_G": state_values[16],
        "SEBC_L": state_values[17],

        "TOTAL": state_values[18],

        "PWD_OPEN": pwd_values[0],
        "PWD_SC": pwd_values[1],
        "PWD_ST": pwd_values[2],
        "PWD_VJDT": pwd_values[3],
        "PWD_NTB": pwd_values[4],
        "PWD_NTC": pwd_values[5],
        "PWD_NTD": pwd_values[6],
        "PWD_OBC": pwd_values[7],
        "PWD_SEBC": pwd_values[8],
        "PWD_TOTAL": pwd_values[9],

        "DEF_OPEN": def_values[0],
        "DEF_SC": def_values[1],
        "DEF_ST": def_values[2],
        "DEF_VJDT": def_values[3],
        "DEF_NTB": def_values[4],
        "DEF_NTC": def_values[5],
        "DEF_NTD": def_values[6],
        "DEF_OBC": def_values[7],
        "DEF_SEBC": def_values[8],
        "DEF_TOTAL": def_values[9],

        "EWS Seats": ews,
        "TFWS Seats": tfws,
    }

    all_rows.append(row)

# -----------------------------
# EXPORT
# -----------------------------
df = pd.DataFrame(all_rows)

output_file = "MHT_CET_FULL_SEAT_MATRIX.xlsx"

df.to_excel(
    output_file,
    index=False
)

print(f"Done.")
print(f"Rows Extracted: {len(df)}")
print(f"Saved To: {output_file}")