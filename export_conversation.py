#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CopyCat Media Player — Konversations- & Entwicklungsprotokoll Generator
Liest alle Dialogschritte aus der Antigravity-Transkripthistorie aus und
schreibt ein vollständiges, chronologisches Protokoll in 'CopyCat-Konversationsprotokoll.txt'.
"""

import os
import sys
import json
import re
from datetime import datetime
from collections import Counter

CONVERSATION_ID = "fb4f3e06-9c9c-4258-8fbf-fedb3b540a07"
DEFAULT_TRANSCRIPT_DIR = os.path.expanduser(
    rf"~/.gemini/antigravity/brain/{CONVERSATION_ID}/.system_generated/logs"
)
PROJECT_DIR = r"C:\Users\Schual\Desktop\VLCopyCat-Master"
OUTPUT_FILE = os.path.join(PROJECT_DIR, "CopyCat-Konversationsprotokoll.txt")


def find_transcript_path():
    # Prefer full untruncated transcript
    full_path = os.path.join(DEFAULT_TRANSCRIPT_DIR, "transcript_full.jsonl")
    if os.path.exists(full_path):
        return full_path
    compact_path = os.path.join(DEFAULT_TRANSCRIPT_DIR, "transcript.jsonl")
    if os.path.exists(compact_path):
        return compact_path

    # Search in parent brain directory for newest transcript if ID changed
    brain_root = os.path.expanduser(r"~/.gemini/antigravity/brain")
    if os.path.exists(brain_root):
        candidates = []
        for root, dirs, files in os.walk(brain_root):
            if "transcript_full.jsonl" in files:
                candidates.append(os.path.join(root, "transcript_full.jsonl"))
        if candidates:
            candidates.sort(key=os.path.getmtime, reverse=True)
            return candidates[0]
    return None


def clean_user_prompt(text):
    if not text:
        return ""
    # Strip <USER_REQUEST> tags
    m = re.search(r"<USER_REQUEST>(.*?)</USER_REQUEST>", text, re.DOTALL)
    cleaned = m.group(1).strip() if m else text.strip()
    # Strip any trailing <ADDITIONAL_METADATA> tags
    cleaned = re.sub(r"<ADDITIONAL_METADATA>.*?</ADDITIONAL_METADATA>", "", cleaned, flags=re.DOTALL).strip()
    return cleaned


def build_protocol():
    transcript_path = find_transcript_path()
    if not transcript_path or not os.path.exists(transcript_path):
        print(f"ERROR: Transkriptdatei nicht gefunden unter: {transcript_path}", file=sys.stderr)
        return False

    print(f"Lese Transkript: {transcript_path}")
    dialogues = []
    current_dialogue = None

    with open(transcript_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except Exception:
                continue

            src = ev.get("source")
            typ = ev.get("type")
            step = ev.get("step_index", 0)
            ts = ev.get("created_at", "")
            content = ev.get("content", "")

            if src == "USER_EXPLICIT" or typ == "USER_INPUT":
                if current_dialogue:
                    dialogues.append(current_dialogue)
                cleaned_prompt = clean_user_prompt(content)
                current_dialogue = {
                    "step": step,
                    "timestamp": ts,
                    "user": cleaned_prompt,
                    "responses": [],
                    "tool_counts": Counter(),
                    "media_count": len(ev.get("media", []) or [])
                }
            elif current_dialogue:
                if typ == "PLANNER_RESPONSE":
                    for tc in ev.get("tool_calls", []) or []:
                        name = tc.get("name")
                        if name:
                            current_dialogue["tool_counts"][name] += 1
                    if content and content.strip():
                        current_dialogue["responses"].append(content.strip())

    if current_dialogue:
        dialogues.append(current_dialogue)

    print(f"Erfolgreich aggregiert: {len(dialogues)} Dialogschritte.")

    first_ts = dialogues[0]["timestamp"] if dialogues else "N/A"
    last_ts = dialogues[-1]["timestamp"] if dialogues else "N/A"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    sb = []
    sb.append("================================================================================")
    sb.append("# COPYCAT MEDIA PLAYER — ENTWICKLUNGS- & KONVERSATIONSPROTOKOLL")
    sb.append("# Vollständige Historie aller Benutzeranfragen, Architekturentscheidungen und Code-Updates")
    sb.append("================================================================================")
    sb.append(f"Projekt:            CopyCat Media Player (VLCopyCat)")
    sb.append(f"Konversations-ID:   {CONVERSATION_ID}")
    sb.append(f"Zeitraum:           {first_ts} bis {last_ts}")
    sb.append(f"Gesamtanzahl Turns: {len(dialogues)} Dialogschritte")
    sb.append(f"Zuletzt aktualisiert: {now_str}")
    sb.append("================================================================================\n")

    sb.append("--------------------------------------------------------------------------------")
    sb.append("ÜBERSICHT DER ENTWICKLUNGSPHASEN:")
    sb.append("--------------------------------------------------------------------------------")
    sb.append("• Phase 1 (Schritte 1–13):   VLC-Skin-Grenzen analysiert; Entschluss zur nativen Desktop-App")
    sb.append("• Phase 2 (Schritte 14–45):  Architektur-Setup mit Electron, HTML5-Stage & Custom Styling")
    sb.append("• Phase 3 (Schritte 46–85):  Dark UI, Cat-Branding, Rand-Hover & Auto-Drawer-Mechanik")
    sb.append("• Phase 4 (Schritte 86–135): Audio-DSP: 200% Cone-Boost, 10-Band EQ & Web-Audio Brickwall-Limiter")
    sb.append("• Phase 5 (Schritte 136–185): Queue, Bookmarks, Verlauf & Drag-and-Drop Playlist-Management")
    sb.append("• Phase 6 (Schritte 186–235): Subtitle-Engine: WebVTT/SRT-Parsing, Sync-Offset & Spracherkennung")
    sb.append("• Phase 7 (Schritte 236–285): Lokale HTTP AI Control Bridge (127.0.0.1:4500) & Command Registry")
    sb.append("• Phase 8 (Schritte 286–335): Stream Sniffer & nativer HLS Parallel-Downloader mit AES-128")
    sb.append("• Phase 9 (Schritte 336–365): AniList/AniSkip Integration & automatisches Kapitel-Tagging")
    sb.append("• Phase 10 (Schritte 366–379): IoC Service Container, async I/O, Origin Guard & 36 Testfälle")
    sb.append("• Phase 11 (Schritte 380+):   MPEG-TS Passthrough Streaming, Audio-Labels & Single-Sub UX")
    sb.append("--------------------------------------------------------------------------------\n\n")

    sb.append("================================================================================")
    sb.append("## CHRONOLOGISCHES DIALOGPROTOKOLL")
    sb.append("================================================================================\n")

    for i, d in enumerate(dialogues, start=1):
        step_num = d["step"]
        ts = d["timestamp"]
        media_txt = f" (Anhänge: {d['media_count']})" if d["media_count"] > 0 else ""

        sb.append("--------------------------------------------------------------------------------")
        sb.append(f"[DIALOG #{i}] | Schritt {step_num} | Zeitstempel: {ts}{media_txt}")
        sb.append("--------------------------------------------------------------------------------")
        sb.append("BENUTZER:")
        user_text = d["user"] if d["user"] else "(Kein Textinhalt / Bild- bzw. Medienanhang übertragen)"
        sb.append(user_text)
        sb.append("")

        # Tool summary if any
        if d["tool_counts"]:
            tools_summary = ", ".join(f"{k} ({v})" for k, v in d["tool_counts"].most_common())
            sb.append(f"[Hintergrund-Aktionen: {tools_summary}]")
            sb.append("")

        sb.append("ANTIGRAVITY / ASSISTENT:")
        if d["responses"]:
            # Combine all non-empty responses for this turn
            combined_resp = "\n\n".join(d["responses"])
            sb.append(combined_resp)
        else:
            sb.append("(Turn in Bearbeitung / Analyse aktiv)")
        sb.append("\n")

    output_content = "\n".join(sb)
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out_f:
        out_f.write(output_content)

    file_size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"Protokoll erfolgreich geschrieben nach: {OUTPUT_FILE}")
    print(f"Dateigröße: {file_size_kb:.1f} KB ({len(dialogues)} Dialoge)")
    return True


if __name__ == "__main__":
    success = build_protocol()
    sys.exit(0 if success else 1)
