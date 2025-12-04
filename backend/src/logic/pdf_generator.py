from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import textwrap


def generate_pdf_report(data: dict, output_path: str):
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter

    y = height - 50
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "Report")
    y -= 30

    c.setFont("Helvetica", 12)
    c.drawString(
        50, y, f"Confidence: {data['confidence_index']['total']:.1f}/100"
    )
    y -= 20

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Summary:")
    y -= 15
    c.setFont("Helvetica", 10)
    lines = textwrap.wrap(data.get("summary", ""), width=90)
    for line in lines:
        c.drawString(50, y, line)
        y -= 12

    y -= 10

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Key Mistakes:")
    y -= 15
    c.setFont("Helvetica", 10)
    lines = textwrap.wrap(data.get("mistakes", ""), width=90)
    for line in lines:
        c.drawString(50, y, line)
        y -= 12

    y -= 20
    c.drawString(50, y, "Checklist:")
    y -= 15
    checklist = [
        (
            "Reduce filler words"
            if data["fillers_summary"]["ratio"] > 0.05
            else "Filler words count is good"
        ),
        (
            "Improve eye contact"
            if data["confidence_index"]["components"]["gaze_score"] < 50
            else "Eye contact is great"
        ),
        "Watch your tempo",
    ]
    for item in checklist:
        c.drawString(70, y, f"[ ] {item}")
        y -= 15

    c.save()
