from pathlib import Path
import fitz

pdf_path = Path("attached_assets/webbook_1788543240009.pdf")
output_dir = Path(".agents/outputs/webbook-inspection")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(pdf_path)
print("pages:", document.page_count)
print("metadata:", document.metadata)

for index in range(min(3, document.page_count)):
    page = document.load_page(index)
    print(f"\n--- page {index + 1} text ---")
    print(page.get_text("text")[:4000])
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    output_path = output_dir / f"page-{index + 1}.png"
    pixmap.save(output_path)
    print("rendered:", output_path)