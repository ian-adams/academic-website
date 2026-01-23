#!/usr/bin/env python3
"""
MPV Data Preprocessing Script
Downloads and processes the Mapping Police Violence dataset into optimized JSON for the dashboard.
"""

import json
import re
from datetime import datetime
from pathlib import Path
import urllib.request
import tempfile

# Try to import pandas and openpyxl, provide helpful error if not installed
try:
    import pandas as pd
except ImportError:
    print("Please install pandas: pip install pandas openpyxl")
    exit(1)

SCRIPT_DIR = Path(__file__).parent
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "mpv-data.json"

MPV_URL = "https://mappingpoliceviolence.us/s/MPVDatasetDownload.xlsx"


def download_data():
    """Download the MPV Excel file."""
    print("Downloading MPV data...")
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        urllib.request.urlretrieve(MPV_URL, tmp.name)
        return tmp.name


def clean_column_names(df):
    """Clean column names to be consistent."""
    df.columns = [
        re.sub(r'[^a-z0-9_]', '', col.lower().replace(' ', '_'))
        for col in df.columns
    ]
    return df


def process_data(excel_path):
    """Process the Excel data into the format needed by the dashboard."""
    print("Processing data...")
    df = pd.read_excel(excel_path)
    df = clean_column_names(df)
    print(f"Found {len(df.columns)} columns: {list(df.columns)[:20]}...")

    # Find the date column
    date_col = None
    for col in df.columns:
        if 'date' in col:
            date_col = col
            break

    if date_col is None:
        raise ValueError("Could not find date column")

    # Convert and clean data
    df['date'] = pd.to_datetime(df[date_col], errors='coerce')
    df = df.dropna(subset=['date'])

    df['year'] = df['date'].dt.year.astype(int)
    df['month'] = df['date'].dt.strftime('%b')
    df['day'] = df['date'].dt.strftime('%a')
    df['day_of_year'] = df['date'].dt.dayofyear

    # Clean race
    def clean_race(race):
        if pd.isna(race) or race == '' or race == 'Unknown race':
            return 'Unknown'
        race = str(race)
        if 'White' in race:
            return 'White'
        if 'Black' in race:
            return 'Black'
        if 'Hispanic' in race or 'Latino' in race:
            return 'Hispanic'
        if 'Asian' in race:
            return 'Asian'
        if 'Native American' in race:
            return 'Native American'
        if 'Pacific Islander' in race:
            return 'Pacific Islander'
        return 'Other'

    race_col = None
    for col in df.columns:
        if 'race' in col and 'victim' in col:
            race_col = col
            break
    if race_col is None:
        for col in df.columns:
            if 'race' in col:
                race_col = col
                break

    if race_col:
        df['race_clean'] = df[race_col].apply(clean_race)
    else:
        df['race_clean'] = 'Unknown'

    # Age
    age_col = None
    for col in df.columns:
        if 'age' in col:
            age_col = col
            break
    if age_col:
        df['age_numeric'] = pd.to_numeric(df[age_col], errors='coerce')
    else:
        df['age_numeric'] = None

    # Fleeing status
    fleeing_col = None
    for col in df.columns:
        if 'fleeing' in col:
            fleeing_col = col
            break

    def clean_fleeing(val):
        if pd.isna(val):
            return 'Unknown'
        val = str(val).lower()
        if 'not' in val or 'no' in val:
            return 'Not Fleeing'
        if 'car' in val or 'foot' in val or 'other' in val:
            return 'Fleeing'
        return 'Unknown'

    if fleeing_col:
        df['fleeing_clean'] = df[fleeing_col].apply(clean_fleeing)
    else:
        df['fleeing_clean'] = 'Unknown'

    # Mental illness symptoms
    mental_col = None
    for col in df.columns:
        if 'mental' in col and 'symptom' in col:
            mental_col = col
            break

    def has_mental_symptoms(val):
        if pd.isna(val):
            return False
        val = str(val).lower()
        return 'yes' in val or 'drug' in val or 'alcohol' in val

    if mental_col:
        df['mental_illness_symptoms'] = df[mental_col].apply(has_mental_symptoms)
    else:
        df['mental_illness_symptoms'] = False

    # Other fields
    state_col = next((c for c in df.columns if c == 'state'), None)
    city_col = next((c for c in df.columns if c == 'city'), None)
    # Be more specific with lat/lon to avoid matching columns like "location_type"
    lat_col = next((c for c in df.columns if c == 'latitude' or c.endswith('_lat') or c == 'lat'), None)
    lon_col = next((c for c in df.columns if c == 'longitude' or c.endswith('_lon') or c.endswith('_lng') or c == 'lon' or c == 'lng'), None)
    cause_col = next((c for c in df.columns if 'cause' in c and 'death' in c), None)
    armed_col = next((c for c in df.columns if 'armed' in c and 'unarmed' in c), None)
    weapon_col = next((c for c in df.columns if 'weapon' in c), None)
    bodycam_col = next((c for c in df.columns if 'body' in c and 'camera' in c), None)
    charges_col = next((c for c in df.columns if 'criminal' in c and 'charge' in c), None)
    income_col = next((c for c in df.columns if 'income' in c), None)

    # Build records
    records = []
    for _, row in df.iterrows():
        record = {
            'date': row['date'].strftime('%Y-%m-%d'),
            'year': int(row['year']),
            'month': row['month'],
            'day': row['day'],
            'day_of_year': int(row['day_of_year']),
            'age_numeric': int(row['age_numeric']) if pd.notna(row['age_numeric']) else None,
            'race_clean': row['race_clean'],
            'fleeing_clean': row['fleeing_clean'],
            'mental_illness_symptoms': bool(row['mental_illness_symptoms']),
            'state': str(row.get(state_col, '')) if state_col and pd.notna(row.get(state_col)) else None,
            'city': str(row.get(city_col, '')) if city_col and pd.notna(row.get(city_col)) else None,
            'latitude': float(row.get(lat_col)) if lat_col and pd.notna(row.get(lat_col)) and isinstance(row.get(lat_col), (int, float)) else None,
            'longitude': float(row.get(lon_col)) if lon_col and pd.notna(row.get(lon_col)) and isinstance(row.get(lon_col), (int, float)) else None,
            'cause_of_death': str(row.get(cause_col, '')) if cause_col and pd.notna(row.get(cause_col)) else None,
            'armed_unarmed_status': str(row.get(armed_col, '')) if armed_col and pd.notna(row.get(armed_col)) else None,
            'alleged_weapon': str(row.get(weapon_col, '')) if weapon_col and pd.notna(row.get(weapon_col)) else None,
            'body_camera': bool('true' in str(row.get(bodycam_col, '')).lower() or 'yes' in str(row.get(bodycam_col, '')).lower()) if bodycam_col else False,
            'criminal_charges': str(row.get(charges_col, '')) if charges_col and pd.notna(row.get(charges_col)) else None,
            'median_household_income': float(row.get(income_col)) if income_col and pd.notna(row.get(income_col)) else None,
        }
        records.append(record)

    return records


def main():
    # Download and process
    excel_path = download_data()
    records = process_data(excel_path)

    # Population data
    population = {
        2013: 316128839,
        2014: 318857056,
        2015: 320738994,
        2016: 323071755,
        2017: 325084756,
        2018: 326687501,
        2019: 328239523,
        2020: 331449281,
        2021: 331893745,
        2022: 333287557,
        2023: 334914895,
        2024: 336673595,
        2025: 338289857,
    }

    # Build output
    output = {
        'updated': datetime.utcnow().isoformat() + 'Z',
        'count': len(records),
        'records': records,
        'population': population,
    }

    # Ensure output directory exists
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Write JSON
    print(f"Writing {len(records)} records to {OUTPUT_PATH}")
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, separators=(',', ':'))

    print("Done!")

    # Cleanup
    import os
    os.unlink(excel_path)


if __name__ == "__main__":
    main()
