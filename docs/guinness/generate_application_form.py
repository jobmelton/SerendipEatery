"""Generate the Guinness World Records application form (print-ready PDF)."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).with_name("SerendipEatery-Guinness-Application-Form.pdf")

ORANGE = colors.HexColor("#F7941D")
NIGHT = colors.HexColor("#0f0a1e")
INK = colors.HexColor("#1a1230")
RULE = colors.HexColor("#c9b8a4")


def styles():
    base = getSampleStyleSheet()
    s = {
        "kicker": ParagraphStyle(
            "kicker", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8, textColor=ORANGE, spaceAfter=4,
        ),
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=16, textColor=NIGHT, leading=20, spaceAfter=4, alignment=TA_LEFT,
        ),
        "sub": ParagraphStyle(
            "sub", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=INK, leading=12, spaceAfter=10,
        ),
        "h": ParagraphStyle(
            "h", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=11, textColor=NIGHT, spaceBefore=12, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, leading=12, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=6,
        ),
        "label": ParagraphStyle(
            "label", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8, textColor=NIGHT, leading=11,
        ),
        "value": ParagraphStyle(
            "value", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=INK, leading=12,
        ),
        "blank": ParagraphStyle(
            "blank", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=colors.HexColor("#888888"), leading=14,
        ),
        "foot": ParagraphStyle(
            "foot", parent=base["Normal"], fontName="Helvetica",
            fontSize=7, textColor=colors.HexColor("#666666"), alignment=TA_CENTER,
        ),
        "li": ParagraphStyle(
            "li", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, leading=12, textColor=INK,
        ),
    }
    return s


def field_table(rows, col1=1.7 * inch, col2=5.0 * inch):
    data = []
    for label, value in rows:
        data.append([
            Paragraph(label, STY["label"]),
            Paragraph(value if value else "________________________________", STY["value"] if value else STY["blank"]),
        ])
    t = Table(data, colWidths=[col1, col2])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, RULE),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#fff8f2")),
        ("BOX", (0, 0), (-1, -1), 0.6, ORANGE),
    ]))
    return t


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NIGHT)
    canvas.rect(0, letter[1] - 28, letter[0], 28, fill=1, stroke=0)
    canvas.setFillColor(ORANGE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(0.7 * inch, letter[1] - 18, "SERENDIPEATERY  ·  GUINNESS WORLD RECORDS APPLICATION")
    canvas.setFillColor(NIGHT)
    canvas.rect(0, 0, letter[0], 22, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(0.7 * inch, 9, "Rules version rps-async-v1  ·  Auto-start at 50,000 verified players")
    canvas.drawRightString(letter[0] - 0.7 * inch, 9, f"Page {doc.page}")
    canvas.restoreState()


STY = styles()


def build():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.5 * inch,
        title="Guinness World Records Application — SerendipEatery",
        author="SerendipEatery",
    )
    story = []

    story.append(Paragraph("OFFICIAL RECORD APPLICATION", STY["kicker"]))
    story.append(Paragraph("Largest online asynchronous rock-paper-scissors tournament", STY["title"]))
    story.append(Paragraph(
        "Submit this packet through the Guinness World Records organisation account, "
        "together with RULES.md, EVIDENCE.md and WITNESS-PLAN.md. Do not start the official "
        "count until written guidelines arrive. The software auto-starts the official bracket "
        "only after 50,000 phone-verified signups.",
        STY["sub"],
    ))

    story.append(Paragraph("1. Applicant", STY["h"]))
    story.append(field_table([
        ("Organisation", "SerendipEatery"),
        ("Contact name", ""),
        ("Role", "Record attempt organiser"),
        ("Email", ""),
        ("Phone", ""),
        ("City / Country", "United States"),
        ("Postal address", ""),
    ]))

    story.append(Paragraph("2. Proposed record", STY["h"]))
    story.append(field_table([
        ("Proposed title", "Largest online asynchronous rock-paper-scissors tournament"),
        ("Related existing title", "Largest Rock, Paper, Scissors tournament — 10,033, Tianjin Joy City, 24 Dec 2019"),
        ("Why a new title", "The existing title is an in-person mass-participation event. This attempt is one global single-elimination tournament, played asynchronously in the official SerendipEatery application, with SMS notification when a player is due to throw."),
        ("Who may attempt", "An organisation"),
        ("Location of attempt", "Online / worldwide. Play is in the official consumer app. Live bracket and counter are public on the web."),
        ("Entry fee / prize", "None. Free to enter. No cash prize."),
    ]))

    story.append(Paragraph("3. How the attempt is measured", STY["h"]))
    story.append(Paragraph(
        "The record number is the count of <b>official participants</b> in a single single-elimination tournament. "
        "An official participant is a unique natural person who (1) registered a legal name, (2) verified a unique "
        "mobile phone by one-time SMS code, (3) attested they meet the minimum age, (4) consented to the official "
        "roster and to SMS, and (5) either locked at least one throw or received a documented first-round bye after freeze. "
        "Duplicate phones, unverified phones, and no-shows who never threw are kept in the audit roster and excluded from the submitted count.",
        STY["body"],
    ))

    story.append(Paragraph("4. Format and automation", STY["h"]))
    story.append(Paragraph(
        "Registration stays open until <b>50,000 phone-verified players</b> are on the roster. At that threshold the system "
        "automatically freezes registration, publishes a freeze seed and roster hash, generates one single-elimination "
        "bracket (byes if the field is not a power of two), and texts every live player that they are up. "
        "Each match is first to two winning throws. Both players independently lock a sealed sequence of three throws. "
        "The server reveals throws in order until one player has two wins. Default deadline: 48 hours per match, with "
        "SMS at match-live, 24 hours remaining, and 1 hour remaining. Auto-forfeit if only one player has locked. "
        "If neither has locked, both are marked no-show; one is advanced by documented coin-flip so the bracket can continue. "
        "No-shows who never threw are not official participants.",
        STY["body"],
    ))
    story.append(Paragraph(
        "While the 50,000 count is filling, any verified registrant may host invite-only friend tournaments "
        "(“winner decides what we do tonight”). Those social brackets use the same engine and are logged as "
        "dry-run evidence (<i>social_bracket_test</i>) before the official freeze.",
        STY["body"],
    ))

    story.append(Paragraph("5. Dates (auto-triggered)", STY["h"]))
    story.append(field_table([
        ("Registration opens", "When this application is accepted and guidelines are received — then the live counter starts"),
        ("Official freeze / Round 1", "Automated: the moment verified signups exceed 50,000"),
        ("Match deadline", "48 hours from a match becoming live"),
        ("Expected duration", "Up to 16 rounds × 48 hours ≈ 32 days after freeze, plus a published buffer for the final"),
        ("Close", "When the final is complete; status becomes pending_verification"),
    ]))

    story.append(PageBreak())
    story.append(Paragraph("6. Evidence (automated)", STY["h"]))
    bullets = [
        "Append-only SHA-256 hash-chained event log (registration, phone verify, freeze, every lock, every result, every forfeit).",
        "Frozen roster CSV with legal name, verified phone, timestamps, IP, user-agent, official-participant flag.",
        "Match log CSV/JSON for the entire bracket.",
        "SMS log (template, destination, provider id, status) proving notification.",
        "Automatic JSON snapshots at freeze, after generation, at the end of every round, and at close.",
        "Public live counter and live bracket.",
        "Video: freeze ceremony, bracket generation, continuous livestream of the live system, and the final.",
        "Two independent witnesses with read-only access for the whole attempt.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(b, STY["li"]), leftIndent=12) for b in bullets],
        bulletType="bullet", leftIndent=18, spaceBefore=2, spaceAfter=8,
    ))

    story.append(Paragraph("7. Independent witnesses", STY["h"]))
    story.append(Paragraph("Name two people who are not employees and have no financial interest in the result.", STY["body"]))
    story.append(field_table([
        ("Witness 1 name", ""),
        ("Witness 1 email / role", ""),
        ("Witness 2 name", ""),
        ("Witness 2 email / role", ""),
        ("Livestream URL", ""),
    ]))

    story.append(Paragraph("8. Questions for Records Management", STY["h"]))
    story.append(Paragraph("Please issue guidelines that specifically address:", STY["body"]))
    qs = [
        "Whether an asynchronous online tournament is accepted as a new title.",
        "Whether a 48-hour per-match deadline and auto-forfeit are permitted.",
        "Whether a first-round bye counts as participation.",
        "Whether a player who wins by opponent no-show counts as an official participant (we count them if they locked throws; we do not count pure no-shows).",
        "Identity standard (phone OTP vs. government ID for the field vs. an audit sample).",
        "Steward ratio for a digital event (in-person titles often require 1:50).",
        "Video for a multi-week attempt: we propose a continuous public livestream of the live system plus dedicated recordings of freeze, generation, and the final.",
        "Whether social/friend tournaments played on the same engine before freeze may be cited as dry-run evidence.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(q, STY["li"]), leftIndent=12) for q in qs],
        bulletType="1", leftIndent=18, start="1",
    ))

    story.append(Paragraph("9. Organiser declaration", STY["h"]))
    story.append(Paragraph(
        "I confirm that the information in this application is true, that SerendipEatery will follow the guidelines "
        "Guinness World Records issues, that the official attempt will not begin until those guidelines are received, "
        "and that the 50,000-player auto-start will be disabled if Guinness requires a different freeze rule.",
        STY["body"],
    ))
    story.append(Spacer(1, 16))
    story.append(field_table([
        ("Organiser signature", ""),
        ("Print name", ""),
        ("Date", ""),
    ]))

    story.append(Spacer(1, 18))
    story.append(HRFlowable(width="100%", thickness=1, color=ORANGE, spaceAfter=8))
    story.append(Paragraph(
        "How to file: create an organisation account at guinnessworldrecords.com → apply for a new title → "
        "upload this form plus docs/guinness/RULES.md, EVIDENCE.md and WITNESS-PLAN.md. "
        "A fillable copy of these fields also lives at /record/apply on the SerendipEatery site.",
        STY["foot"],
    ))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
