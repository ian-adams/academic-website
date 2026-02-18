"""
Prepare case data for the Killing Cascade interactive dashboard.

Reads California DOJ URSUS shooting data, fits the M5 logistic model
(matching the paper specification), computes predicted fatality probabilities,
and outputs de-identified case JSON for the frontend.

Source paper: "The Killing Cascade" (Nix & Adams, 2026)
Data: CA DOJ URSUS, 2016-2024
"""

import json
import random
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

# Paths
CA_DATA = Path(r"C:\dev\research\ca_doj_use_of_force\merged_paper\outputs\study2\california_analysis_ready.csv")
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "data" / "killing-cascade"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Wound location mapping ──────────────────────────────────────────────
# Maps the various formats in received_force_location to SVG body regions
WOUND_MAP = {
    # Head
    "head": "head",
    "HEAD": "head",
    "Head": "head",
    "Head/face/neck": "head",  # overridden by neck below if separate
    # Neck
    "neck_throat": "neck",
    "NECK_THROAT": "neck",
    "Neck/throat": "neck",
    # Chest (front upper torso)
    "front_upper_chest": "chest",
    "FRONT_UPPER_TORSO": "chest",
    "Front upper torso/chest": "chest",
    # Abdomen (front lower torso)
    "front_lower_abdomen": "abdomen",
    "FRONT_LOWER_TORSO": "abdomen",
    "Front lower torso/abdomen": "abdomen",
    # Back upper → mapped to chest (front-only view)
    "rear_upper_back": "chest",
    "REAR_UPPER_TORSO": "chest",
    "Rear upper torso/back": "chest",
    # Back lower → mapped to abdomen (front-only view)
    "rear_lower_back": "abdomen",
    "REAR_LOWER_TORSO": "abdomen",
    "Rear lower torso/back": "abdomen",
    # Arms
    "arms_hands": "arms",
    "ARMS": "arms",
    "Arms/hands": "arms",
    # Legs (front)
    "front_legs": "legs",
    "FRONT_LEGS": "legs",
    "Front legs/feet": "legs",
    # Legs (rear) → mapped to legs
    "rear_legs": "legs",
    "REAR_LEGS": "legs",
    "Rear legs/feet": "legs",
    # Below waist front → mapped to abdomen
    "front_below_waist": "abdomen",
    "FRONT_BELOW_WAIST": "abdomen",
    "Front below waist/groin": "abdomen",
    # Below waist rear → mapped to abdomen
    "rear_below_waist": "abdomen",
    "REAR_BELOW_WAIST": "abdomen",
    "Rear below waist/buttocks": "abdomen",
}


def parse_wound_regions(location_str: str) -> list[str]:
    """Parse received_force_location into a list of unique SVG body regions."""
    if pd.isna(location_str):
        return []
    loc = str(location_str).strip().strip('"')
    if loc.upper() in ("NOT_APPLICABLE", "(NOT APPLICABLE)", "NOT APPLICABLE", ""):
        return []

    tokens = [t.strip().strip('"') for t in loc.split(",") if t.strip()]
    regions = set()
    for token in tokens:
        mapped = WOUND_MAP.get(token)
        if mapped:
            regions.add(mapped)
        else:
            # Try lowercase fallback
            mapped = WOUND_MAP.get(token.lower())
            if mapped:
                regions.add(mapped)
    return sorted(regions)


def main():
    print("Loading California data...")
    df = pd.read_csv(CA_DATA)
    print(f"  Total cases: {len(df):,}")

    # ── Build regression sample (matches paper M5 specification) ────────
    main_races = ["White", "Black", "Hispanic"]
    wound_locs = ["Head/Neck", "Chest", "Abdomen", "Extremities"]

    reg_df = df[df["race_std"].isin(main_races)].copy()
    reg_df = reg_df[reg_df["wound_location_std"].isin(wound_locs)]
    reg_df = reg_df.dropna(subset=["age_numeric", "gender_std", "num_involved_officers"])
    reg_df = reg_df[reg_df["gender_std"] != "Unknown"]
    print(f"  Regression sample: {len(reg_df):,}")

    # Create model variables
    reg_df["race_black"] = (reg_df["race_std"] == "Black").astype(int)
    reg_df["race_hispanic"] = (reg_df["race_std"] == "Hispanic").astype(int)
    reg_df["age_10yr"] = reg_df["age_numeric"] / 10
    reg_df["female"] = (reg_df["gender_std"] == "Female").astype(int)
    reg_df["armed_assault"] = reg_df["resistance_std"].isin(
        ["Armed/Deadly Force", "Physical Assault"]
    ).astype(int)
    reg_df["wound_head_neck"] = (reg_df["wound_location_std"] == "Head/Neck").astype(int)
    reg_df["wound_chest"] = (reg_df["wound_location_std"] == "Chest").astype(int)
    reg_df["wound_abdomen"] = (reg_df["wound_location_std"] == "Abdomen").astype(int)

    # ── Fit M5 logistic model ───────────────────────────────────────────
    m5_vars = [
        "race_black", "race_hispanic", "age_10yr", "female",
        "armed_assault", "num_involved_officers",
        "wound_head_neck", "wound_chest", "wound_abdomen",
    ]
    y = reg_df["fatal"]
    X = sm.add_constant(reg_df[m5_vars])
    logit_model = sm.Logit(y, X).fit(disp=0)

    print("\nM5 Logistic Model Summary:")
    print(f"  Pseudo R²: {logit_model.prsquared:.4f}")
    print(f"  N: {int(logit_model.nobs):,}")
    print(f"  Intercept: {logit_model.params['const']:.4f}")
    for var in m5_vars:
        or_val = np.exp(logit_model.params[var])
        print(f"  {var}: OR = {or_val:.3f}, coef = {logit_model.params[var]:.4f}")

    # Predicted probabilities
    reg_df["predicted_p_fatal"] = logit_model.predict(X)

    # ── Parse detailed wound regions for SVG ────────────────────────────
    reg_df["wound_regions"] = reg_df["received_force_location"].apply(parse_wound_regions)

    # For cases with no parsed regions, fall back to wound_location_std
    fallback_map = {
        "Head/Neck": ["head"],
        "Chest": ["chest"],
        "Abdomen": ["abdomen"],
        "Extremities": ["arms"],  # default to arms for extremities
    }
    for idx, row in reg_df.iterrows():
        if not row["wound_regions"] and pd.notna(row["wound_location_std"]):
            reg_df.at[idx, "wound_regions"] = fallback_map.get(
                row["wound_location_std"], []
            )

    # ── Clean contact_reason labels ────────────────────────────────────
    CONTACT_REASON_MAP = {
        "vehicle_bike_pedestrian": "Vehicle/Pedestrian Stop",
        "call_for_service": "Call for Service",
        "in_progress": "Crime in Progress",
        "pre_planned": "Pre-Planned Activity",
        "welfare_check": "Welfare Check",
        "consensual": "Consensual Encounter",
        "ambush": "Ambush",
        "civil_disorder": "Civil Disorder",
        "in_custody_event": "In-Custody Event",
        "CRIMINAL_SUSPICIOUS_ACTIVITY": "Crime in Progress",
        "COURT_ORDER": "Court Order",
        "FOLLOWUP": "Follow-Up",
        "MEDICAL": "Medical Call",
        "OTHER": "Other",
        "ROUTINE_PATROL": "Routine Patrol",
        "TRAFFIC_STOP": "Traffic Stop",
        "UNKNOWN": "Unknown",
        "WARRANT": "Warrant Service",
    }

    def clean_contact_reason(reason):
        if pd.isna(reason):
            return "Unknown"
        r = str(reason).strip()
        if not r:
            return "Unknown"
        # Check map first (for snake_case/uppercase values)
        if r in CONTACT_REASON_MAP:
            return CONTACT_REASON_MAP[r]
        # Already readable — truncate long ones
        return r[:60] if len(r) > 60 else r

    # ── Clean county names ──────────────────────────────────────────────
    def clean_county(county):
        if pd.isna(county):
            return "Unknown"
        c = str(county).strip()
        # Remove " County" suffix, then title-case
        c = c.replace(" County", "").replace(" county", "")
        return c.title()

    # ── Build output JSON ───────────────────────────────────────────────
    cases = []
    indices = list(reg_df.index)
    random.seed(42)
    random.shuffle(indices)

    for i, idx in enumerate(indices):
        row = reg_df.loc[idx]
        case = {
            "id": i + 1,
            "fatal": bool(row["fatal"]),
            "woundRegions": row["wound_regions"],
            "woundCount": int(row["wound_count"]) if pd.notna(row["wound_count"]) else 1,
            "numOfficers": int(row["num_involved_officers"]),
            "race": row["race_std"],
            "age": int(row["age_numeric"]),
            "sex": row["gender_std"],
            "armed": bool(row["armed_assault"]),
            "year": int(row["data_year"]),
            "contactReason": clean_contact_reason(row.get("contact_reason")),
            "county": clean_county(row.get("county")),
            "predictedPFatal": round(float(row["predicted_p_fatal"]), 4),
        }
        cases.append(case)

    # ── Write cases.json ────────────────────────────────────────────────
    cases_path = OUTPUT_DIR / "cases.json"
    with open(cases_path, "w") as f:
        json.dump(cases, f, separators=(",", ":"))
    print(f"\nWrote {len(cases):,} cases to {cases_path}")
    print(f"  File size: {cases_path.stat().st_size / 1024:.1f} KB")

    # ── Write model.json ────────────────────────────────────────────────
    model_info = {
        "name": "M5: Logistic Regression with Wound Location",
        "n": int(logit_model.nobs),
        "pseudoR2": round(logit_model.prsquared, 4),
        "intercept": round(float(logit_model.params["const"]), 4),
        "coefficients": {},
        "oddsRatios": {},
        "overallCFR": round(float(y.mean() * 100), 1),
        "cfrByWound": {
            "Head/Neck": round(float(reg_df[reg_df["wound_head_neck"] == 1]["fatal"].mean() * 100), 1),
            "Chest": round(float(reg_df[reg_df["wound_chest"] == 1]["fatal"].mean() * 100), 1),
            "Abdomen": round(float(reg_df[reg_df["wound_abdomen"] == 1]["fatal"].mean() * 100), 1),
            "Extremities": round(float(
                reg_df[
                    (reg_df["wound_head_neck"] == 0) &
                    (reg_df["wound_chest"] == 0) &
                    (reg_df["wound_abdomen"] == 0)
                ]["fatal"].mean() * 100
            ), 1),
        },
    }
    for var in m5_vars:
        clean = var.replace("race_", "").replace("wound_", "").replace("_", " ").title()
        model_info["coefficients"][clean] = round(float(logit_model.params[var]), 4)
        model_info["oddsRatios"][clean] = round(float(np.exp(logit_model.params[var])), 3)

    model_path = OUTPUT_DIR / "model.json"
    with open(model_path, "w") as f:
        json.dump(model_info, f, indent=2)
    print(f"Wrote model info to {model_path}")

    # ── Summary stats ───────────────────────────────────────────────────
    fatal_cases = sum(1 for c in cases if c["fatal"])
    survived_cases = len(cases) - fatal_cases
    print(f"\nDataset summary:")
    print(f"  Fatal: {fatal_cases:,} ({fatal_cases/len(cases)*100:.1f}%)")
    print(f"  Survived: {survived_cases:,} ({survived_cases/len(cases)*100:.1f}%)")
    print(f"  Mean predicted P(fatal): {np.mean([c['predictedPFatal'] for c in cases]):.3f}")

    # Model accuracy at P>0.5 threshold
    model_correct = sum(
        1 for c in cases
        if (c["predictedPFatal"] > 0.5) == c["fatal"]
    )
    print(f"  Model accuracy (P>0.5): {model_correct}/{len(cases)} = {model_correct/len(cases)*100:.1f}%")


if __name__ == "__main__":
    main()
