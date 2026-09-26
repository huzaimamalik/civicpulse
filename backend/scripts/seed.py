"""Seed 30 deterministic complaints into the migrated PostgreSQL database.

Usage from backend/: python scripts/seed.py
"""
from datetime import datetime, timezone
import sys
from pathlib import Path
from uuid import UUID, uuid5

from sqlalchemy import create_engine, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.settings import get_settings
from app.sql_repository import ComplaintRow

NAMESPACE = UUID("5c4c6e19-7d4d-4df0-8ec8-9bce7af0d8f7")

SEED_DATA = [
    ("water", "high", "Water main burst near Saddar bazaar since fajr, road is flooding badly.", "Saddar bazaar"),
    ("water", "normal", "Mohalla tap has no water since yesterday and families are waiting.", "Gulshan Block A"),
    ("water", "low", "Small leakage outside the mosque needs checking when team is free.", "Model Town lane 4"),
    ("water", "high", "Dirty water is coming from the line near school, children are getting sick.", "Iqbal school road"),
    ("water", "normal", "Tube well pressure is very low in the evening, please inspect pump.", "Peco Road"),
    ("electricity", "high", "Transformer is sparking beside the market, this is dangerous for people.", "Anarkali market"),
    ("electricity", "normal", "Light goes off every night in our gali and appliances are damaged.", "Shadman gali 7"),
    ("electricity", "low", "One pole light connection is loose, kindly send electrician.", "Canal View"),
    ("electricity", "high", "Live wire has fallen after rain, please block the street urgently.", "Ravi Road"),
    ("electricity", "normal", "Transformer noise is increasing and voltage is very weak in the homes.", "Johar Town Phase 2"),
    ("sanitation", "high", "Sewage line overflow is entering houses near the school, very bad smell.", "Basti Noor school"),
    ("sanitation", "normal", "Garbage has not been collected for four days, area is becoming unhealthy.", "Green Town street 3"),
    ("sanitation", "low", "Dustbin is damaged and rubbish falls on road, please replace it.", "Garden West"),
    ("sanitation", "high", "Open drain cover is missing outside clinic and someone may fall inside.", "Faisal Colony clinic"),
    ("sanitation", "normal", "Sewer water is standing after rain, machar are increasing in the lane.", "Azam Basti"),
    ("roads", "high", "Large pothole has caused two bike accidents near the bus stop.", "Main GT Road bus stop"),
    ("roads", "normal", "Road has broken after pipeline work and rickshaws cannot pass properly.", "Wapda Town service road"),
    ("roads", "low", "Footpath tiles are loose near the park, please repair when possible.", "Model Colony park"),
    ("roads", "high", "Bridge railing is broken and children cross here daily, urgent repair needed.", "Katchi Pul bridge"),
    ("roads", "normal", "Street becomes muddy whenever it rains, drainage and road both need work.", "Liaquatabad lane 9"),
    ("streetlights", "high", "All lights are off on the road and ladies feel unsafe returning at night.", "University Road"),
    ("streetlights", "normal", "Streetlight near our house has been dead for one week, please replace bulb.", "PECHS block 2"),
    ("streetlights", "low", "Park corner lamp flickers but still gives some light, kindly inspect.", "Nazimabad park"),
    ("streetlights", "high", "Dark turn near hospital is causing near misses, light pole is not working.", "Civil Hospital turn"),
    ("streetlights", "normal", "Three lights are broken in the colony, raat ko road is very dark.", "Defence Phase 5"),
    ("other", "normal", "Public bench outside the union office is broken and needs replacement.", "Civic Centre"),
    ("other", "low", "Tree branch is blocking the signboard at the corner, please trim it.", "North Nazimabad chowk"),
    ("other", "high", "Loose construction material is blocking the emergency access lane.", "Railway quarters gate"),
    ("other", "normal", "Public toilet lock is broken and facility cannot be used safely.", "Jinnah park entrance"),
    ("other", "low", "Name plate is missing from the street, delivery people cannot find houses.", "Saima Avenue street 6"),
]


def main() -> None:
    settings = get_settings()
    if not settings.database_url.startswith("postgresql"):
        raise RuntimeError("DATABASE_URL must point to PostgreSQL")
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    now = datetime.now(timezone.utc)
    rows = []
    for index, (category, priority, complaint_text, location) in enumerate(SEED_DATA, start=1):
        rows.append(
            {
                "id": uuid5(NAMESPACE, str(index)),
                "text": complaint_text,
                "location": location,
                "reporter_contact": None,
                "category": category,
                "priority": priority,
                "status": "open",
                "ai_summary": complaint_text[:140],
                "triaged_by": "rules",
                "triage_latency_ms": 0,
                "created_at": now,
                "updated_at": now,
            }
        )
    with Session(engine) as session:
        before = session.execute(text("SELECT count(*) FROM complaints")).scalar_one()
        statement = insert(ComplaintRow.__table__).values(rows).on_conflict_do_nothing(index_elements=["id"])
        session.execute(statement)
        session.commit()
        total = session.execute(text("SELECT count(*) FROM complaints")).scalar_one()
        print(f"Seed rows inserted: {total - before}")
        print(f"Total complaints: {total}")


if __name__ == "__main__":
    main()
