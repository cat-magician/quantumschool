"""
Кто написал каждое эссе — по самой работе, а не только по форме.

Половина эссе пришла без ФИО: в поле имени вставляли ссылку. Но работы
лежат на Диске, и автор почти всегда виден либо в тексте («Меня зовут Денис
Райвид…»), либо в имени файла (esse_hakimov_timur.pdf, esselarionovandrej.pdf).
Ищем там людей из анкеты — это закрытый список, поэтому поиск надёжный.

На выходе — копия выгрузки эссе, где пустое ФИО заполнено найденным автором,
плюс колонки «Откуда ФИО» и «Дубль строки». Её и нужно грузить в «Разбор
выгрузок» вместо исходной.

    python scripts/essay-authors.py [папка-с-работами]

Папка по умолчанию — Yandex.Forms формы эссе на синхронизированном Диске.
Выгрузки берутся из data.local: самые свежие «…Анкета участника.xlsx» и
«…Мотивационное письмо.xlsx».
"""
import csv
import hashlib
import html
import os
import re
import sys
import zipfile
from urllib.parse import unquote, urlparse, parse_qs

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data.local')
DEFAULT_DISK = os.path.expanduser(
    '~/YandexDisk-quantumschool@rqc.ru/Yandex.Forms/6a7a100c068ff0b13995f129/Files'
)


# ── чтение xlsx без сторонних библиотек ─────────────────────────
def read_xlsx(path):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        xml = z.read('xl/sharedStrings.xml').decode('utf-8')
        for si in re.findall(r'<si>(.*?)</si>', xml, re.S):
            shared.append(unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', si, re.S))))
    sheet = next(n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d*\.xml', n))
    xml = z.read(sheet).decode('utf-8')
    rows = []
    for row in re.findall(r'<row[^>]*>(.*?)</row>', xml, re.S):
        cells = {}
        for ref, attrs, body in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)>(.*?)</c>', row, re.S):
            value = re.search(r'<v>(.*?)</v>', body, re.S)
            inline = re.search(r'<t[^>]*>(.*?)</t>', body, re.S)
            if 't="s"' in attrs and value:
                text = shared[int(value.group(1))]
            elif inline:
                text = unescape(inline.group(1))
            else:
                text = unescape(value.group(1)) if value else ''
            cells[col_index(ref)] = text
        width = max(cells) + 1 if cells else 0
        rows.append([cells.get(i, '') for i in range(width)])
    return rows


def col_index(ref):
    n = 0
    for ch in ref:
        n = n * 26 + ord(ch) - 64
    return n - 1


def unescape(s):
    # Яндекс пишет кириллицу в xlsx числовыми ссылками (&#1042;…), так что
    # нужен полный разбор сущностей, а не пара замен.
    return html.unescape(s)


def latest(pattern):
    names = [n for n in os.listdir(DATA) if re.search(pattern, n)]
    if not names:
        sys.exit(f'В data.local нет файла «{pattern}»')
    return os.path.join(DATA, max(names, key=lambda n: os.path.getmtime(os.path.join(DATA, n))))


# ── текст работы ────────────────────────────────────────────────
def xml_text(z, member):
    xml = z.read(member).decode('utf-8', 'ignore')
    xml = re.sub(r'</(w:p|text:p|a:p)>', '\n', xml)
    return re.sub(r'<[^>]+>', ' ', xml)


def read_text(path):
    ext = os.path.splitext(path)[1].lower().lstrip('.')
    try:
        if ext == 'docx':
            return xml_text(zipfile.ZipFile(path), 'word/document.xml')
        if ext == 'odt':
            return xml_text(zipfile.ZipFile(path), 'content.xml')
        if ext == 'pptx':
            z = zipfile.ZipFile(path)
            return '\n'.join(xml_text(z, n) for n in z.namelist()
                             if re.match(r'ppt/slides/slide\d+\.xml', n))
        if ext == 'pdf':
            import fitz  # pymupdf
            return '\n'.join(page.get_text() for page in fitz.open(path))
        if ext in ('txt', ''):
            raw = open(path, 'rb').read()
            for enc in ('utf-8', 'cp1251'):
                try:
                    return raw.decode(enc)
                except UnicodeDecodeError:
                    pass
    except Exception:
        return ''
    return ''  # картинки: без распознавания текста их не прочесть


# ── сравнение имён ──────────────────────────────────────────────
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
              ['a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'i', 'k', 'l', 'm', 'n', 'o',
               'p', 'r', 's', 't', 'u', 'f', 'h', 'c', 'ch', 'sh', 'shch', '', 'y', '', 'e',
               'yu', 'ya']))


def coarse(s):
    """Огрублённая латиница: Кузнецов, Kuznetsov и Kuznecov сходятся."""
    s = ''.join(TR.get(ch, ch) for ch in s.lower())
    s = re.sub(r'[^a-z]', '', s)
    for a, b in (('shch', 's'), ('sch', 's'), ('kh', 'h'), ('ts', 'c'), ('tc', 'c'),
                 ('ch', 'c'), ('sh', 's'), ('zh', 'z')):
        s = s.replace(a, b)
    s = re.sub(r'[yj]', 'i', s)
    return re.sub(r'(.)\1+', r'\1', s)


def stem(word):
    """Иванов / Иванова / Иванову: у фамилии в тексте меняется хвост."""
    w = word.lower().replace('ё', 'е')
    return w[:-1] if len(w) > 5 else w


def found_in_text(text, person):
    t = text.lower().replace('ё', 'е')
    surname = stem(person['surname'])
    if len(surname) < 4 or not re.search(r'(?<![а-я])' + re.escape(surname), t):
        return 0
    first = stem(person['first'])
    return 2 if re.search(r'(?<![а-я])' + re.escape(first), t) else 1


def found_in_file(file_name, person):
    """В имени файла склонений нет, зато слова склеены: esselarionovandrej."""
    c = coarse(file_name)
    surname = coarse(person['surname'])
    if len(surname) < 5 or surname not in c:
        return 0
    return 2 if coarse(person['first'])[:4] in c else 1


def work_file_name(url):
    try:
        path = parse_qs(urlparse(url).query).get('path', [''])[0]
        return unquote(path).rstrip('/').split('/')[-1]
    except Exception:
        return ''


def main():
    disk = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DISK
    if not os.path.isdir(disk):
        sys.exit(f'Нет папки с работами: {disk}')

    anketa = read_xlsx(latest(r'Анкета участника\.xlsx$'))
    essay_path = latest(r'Мотивационное письмо\.xlsx$')
    essay = read_xlsx(essay_path)

    a_head = anketa[0]
    a_name = a_head.index('Ваше ФИО')
    people = []
    seen = set()
    for row in anketa[1:]:
        name = (row[a_name] if a_name < len(row) else '').strip()
        words = name.split()
        if len(words) < 2 or name in seen:
            continue
        seen.add(name)
        people.append({'name': name, 'surname': words[0], 'first': words[1]})

    head = essay[0]
    name_at = head.index('Ваше ФИО')
    work_at = next(i for i, h in enumerate(head) if re.search(r'мотивацион', h, re.I))

    texts = {}
    results = []
    for number, row in enumerate(essay[1:], start=1):
        row = row + [''] * (len(head) - len(row))
        form_name = row[name_at].strip()
        link = row[work_at].strip() if row[work_at].strip().startswith('http') else form_name
        file_name = work_file_name(link) if link.startswith('http') else ''
        text = read_text(os.path.join(disk, file_name)) if file_name else ''
        texts[number] = re.sub(r'\s+', ' ', text).strip()

        bare_file = file_name[24:]
        scored = []
        for person in people:
            by_text = found_in_text(text, person)
            by_file = found_in_file(bare_file, person)
            if by_text or by_file:
                scored.append((max(by_text, by_file) + (1 if by_text and by_file else 0),
                               person['name'], by_text, by_file))
        scored.sort(reverse=True)

        # Берём автора, только если он однозначен: второй кандидат с тем же
        # весом — это уже спорный случай, пусть решает человек.
        author, source = '', ''
        top = scored[0] if scored else None
        unique = top and (len(scored) == 1 or scored[1][0] < top[0])
        # Одна фамилия без имени годится, только если она длинная и больше ни
        # у кого из анкеты не встречается: «golubtsov» — да, «ivanov» — нет.
        lone_surname = top and top[0] == 1 and len(scored) == 1 \
            and len(coarse(top[1].split()[0])) >= 6
        if unique and (top[0] >= 2 or lone_surname):
            _, author, by_text, by_file = top
            source = ' и '.join(s for s, ok in (('текст работы', by_text), ('имя файла', by_file)) if ok)

        valid_form_name = len([w for w in form_name.split() if len(w) >= 2]) >= 2 \
            and not form_name.startswith('http')
        results.append({'row': row, 'number': number, 'form_name': form_name,
                        'valid': valid_form_name, 'author': author, 'source': source})

    # Один и тот же текст — одна и та же работа, отправленная повторно.
    by_hash = {}
    for number, text in texts.items():
        if len(text) > 200:
            by_hash.setdefault(hashlib.md5(text.encode('utf-8')).hexdigest(), []).append(number)

    out_rows = [head + ['Откуда ФИО', 'Дубль строки']]
    filled, conflicts = 0, []
    for r in results:
        row = list(r['row'])
        origin = 'форма' if r['valid'] else ''
        if not r['valid'] and r['author']:
            row[name_at] = r['author']
            origin = r['source']
            filled += 1
        elif r['valid'] and r['author'] and coarse(r['author'].split()[0]) not in {
                coarse(w) for w in r['form_name'].split()}:
            # Порядок слов не важен: «Ратмир Александрович Сорокин» — тот же Сорокин.
            conflicts.append((r['number'], r['form_name'], r['author']))
        elif not r['valid']:
            row[name_at] = ''  # мусор вроде «<h» именем не считаем
        twins = [n for n in next((v for v in by_hash.values() if r['number'] in v), []) if n != r['number']]
        out_rows.append(row + [origin, ', '.join(map(str, twins))])

    out = os.path.splitext(essay_path)[0] + ' — с авторами.csv'
    with open(out, 'w', encoding='utf-8-sig', newline='') as f:
        csv.writer(f, delimiter=';').writerows(out_rows)

    unnamed = sum(1 for r in results if not r['valid'])
    print(f'эссе: {len(results)}, без ФИО в форме: {unnamed}, автор найден: {filled}')
    for number, n in sorted((n, v) for v in by_hash.values() if len(v) > 1 for n in v):
        pass
    dups = [v for v in by_hash.values() if len(v) > 1]
    if dups:
        print('одинаковый текст в строках:', '; '.join(', '.join(map(str, v)) for v in dups))
    for number, form_name, author in conflicts:
        print(f'строка {number}: в форме «{form_name}», а в работе «{author}» — проверьте руками')
    print(f'готово: {os.path.relpath(out, ROOT)}')


if __name__ == '__main__':
    main()
