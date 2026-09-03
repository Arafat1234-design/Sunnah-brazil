from pathlib import Path
import fitz

files = [
    "attached_assets/webbook_1788433297444.pdf",
    "attached_assets/Desmistificando_os_islam_-_book_pdf_online_1788433297444.pdf",
    "attached_assets/40-hadith_1788433297444.pdf",
    "attached_assets/LIVRO_-_dr_Turki_Bin_Ibrahim_Al-Khanizani_1788433297444.pdf",
    "attached_assets/book_1788433297445.pdf",
    "attached_assets/o_islam_-_miolo_-_versão_digital_-_10-03-2026_1788433297445.pdf",
]

output_dir = Path(".agents/outputs/uploaded-book-covers")
output_dir.mkdir(parents=True, exist_ok=True)

for index, filename in enumerate(files, start=1):
    path = Path(filename)
    document = fitz.open(path)
    print(f"\nBOOK {index}: {filename}")
    print(f"pages={document.page_count} metadata={document.metadata}")
    for page_index in range(min(3, document.page_count)):
        text = document[page_index].get_text("text").strip()
        print(f"--- page {page_index + 1} text ---")
        print(text[:3000])
    page = document[0]
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    cover_path = output_dir / f"book-{index}-page-1.png"
    pixmap.save(cover_path)
    print(f"cover={cover_path}")
    document.close()