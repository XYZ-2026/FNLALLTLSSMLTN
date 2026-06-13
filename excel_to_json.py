import json

with open("cleaned_cet_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

with open("cleaned_cet_data_pretty.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Done")