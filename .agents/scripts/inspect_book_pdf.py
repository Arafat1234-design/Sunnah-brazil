import fitz
from pathlib import Path

path = Path('attached_assets/0_a_jurisprudência_matrimonail_no_islam_-_versão_digital_1788432421264.pdf')
doc = fitz.open(path)
print('pages:', doc.page_count)
print('metadata:', doc.metadata)
for index in range(min(3, doc.page_count)):
    page = doc.load_page(index)
    print(f'--- page {index + 1} text ---')
    print(page.get_text()[:2500])
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    output = Path('.agents/outputs') / f'book-page-{index + 1}.png'
    pix.save(output)
    print('rendered:', output)
