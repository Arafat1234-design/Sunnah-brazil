from pathlib import Path
import fitz

pdf_path = Path("attached_assets/LIVRO_10042020_1788543524850.pdf")
output_dir = Path(".agents/outputs/new-book-inspection")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(pdf_path)
print("pages:", document.page_count)
print("metadata:", document.metadata)

page = document.load_page(0)
print("--- first page text ---")
print(page.get_text("text")[:5000])
pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
output_path = output_dir / "page-1.png"
pixmap.save(output_path)
print("rendered:", output_path)