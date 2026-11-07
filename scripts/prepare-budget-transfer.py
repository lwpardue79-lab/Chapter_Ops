"""Read the supplied annual-budget template; write a private, reviewable app transfer.

No formulas are evaluated and no records are written to Supabase. Requires only Python stdlib.
"""
import argparse
import decimal
import json
import pathlib
import xml.etree.ElementTree as ET
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('workbook')
parser.add_argument('output')
parser.add_argument('--starts-on', default='2026-07-01')
args = parser.parse_args()
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
z = zipfile.ZipFile(args.workbook)
shared = [''.join(t.itertext()) for t in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns)] if 'xl/sharedStrings.xml' in z.namelist() else []
def sheet(number):
    result = {}
    for cell in ET.fromstring(z.read(f'xl/worksheets/sheet{number}.xml')).findall('m:sheetData/m:row/m:c', ns):
        v, inline = cell.find('m:v', ns), cell.find('m:is', ns)
        value = shared[int(v.text)] if cell.get('t') == 's' and v is not None else ''.join(inline.itertext()) if inline is not None else v.text or '' if v is not None else ''
        result[cell.get('r')] = value
    return result

annual, executive = sheet(1), sheet(4)
columns = ['D','E','F','G','H','I','M','N','O','P','Q','R']
def cents(value):
    return int((decimal.Decimal(str(value or 0)) * 100).quantize(decimal.Decimal('1'), rounding=decimal.ROUND_HALF_UP))
def amounts(row, preserve_blanks=False):
    return [None if preserve_blanks and annual.get(f'{col}{row}', '') == '' else cents(annual.get(f'{col}{row}', '')) for col in columns]

# Deliberate leaf rows only: exclude totals, headcount, forecasts, and the
# Executive Team / Misc subrows already included in Chapter Operating Expenses.
rows = [
    (6,8,'Chef salary','Food and staffing'),(9,11,'Food and groceries','Food and staffing'),
    (13,15,'Cleaning','House and grounds'),(16,18,'Lawn and snow removal','House and grounds'),
    (19,21,'Landscaping','House and grounds'),(23,25,'House repairs and maintenance','House and grounds'),
    (26,28,'House cleaning supplies','House and grounds'),(30,32,'Contract administration','Administration'),
    (34,36,'Fire safety services','Utilities and services'),(37,39,'Electric','Utilities and services'),
    (40,42,'Gas','Utilities and services'),(43,45,'Internet','Utilities and services'),
    (46,48,'Waste removal','Utilities and services'),(49,51,'Water and sewer','Utilities and services'),
    (52,54,'Wi-Fi administration','Utilities and services'),(57,59,'Alumni association','National and affiliation'),
    (60,62,'National annual fees','National and affiliation'),(63,65,'IFC payments','National and affiliation'),
    (67,68,'Chapter operating expenses','Chapter operations'),(74,76,'Bank fees','Administration'),
    (81,83,'Formal','Chapter operations'),(89,91,'Lease expense','Housing'),
    (103,105,'Rent income','Housing income'),(109,111,'Dues income','Dues income'),(113,114,'Interest income','Other income'),
    (78,80,'Miscellaneous credits','Other income')
]
lines = []
for planned, actual, title, category in rows:
    lines.append({'source_key': f'pike-annual-v1:row-{planned}', 'title': title, 'category': category,
        'kind': 'income' if planned in (103,109,113,78) else 'expense',
        'owner_position': 'Treasurer', 'monthly_plan_cents': amounts(planned),
        'actual_cents': [n if i <= 3 else None for i,n in enumerate(amounts(actual, preserve_blanks=True))],
        'source_reference': f'Annual Budget row {planned}; actual row {actual}'})

exec_lines = []
for row, position in [(15,'Internal Vice President'),(16,'External Vice President'),(17,'VPMD'),(18,'New Member Education'),(19,'Health and Safety'),(20,'Executive Team')]:
    plan = [0]*12
    plan[1], plan[6] = cents(executive.get(f'B{row}')), cents(executive.get(f'C{row}'))
    exec_lines.append({'source_key': f'pike-exec-v1:row-{row}', 'title': 'Brotherhood' if position=='VPMD' else position,
        'category': 'Executive allocations', 'owner_position': position, 'kind':'expense', 'monthly_plan_cents':plan})
for source_row, position, raw in [(21,'Recruitment',executive.get('C21')),(8,'Sergeant at Arms',executive.get('B8')),(11,'Public Relations','120')]:
    plan=[0]*12; plan[0]=cents(raw)
    exec_lines.append({'source_key':f'pike-exec-v1:row-{source_row}', 'title':position,
        'category':'Executive allocations', 'owner_position':position, 'kind':'expense', 'monthly_plan_cents':plan})
document = {'format':'ao-command-budget-v1', 'source':pathlib.Path(args.workbook).name, 'budgets':[
    {'name':'Chapter operating budget', 'starts_on':args.starts_on, 'lines':lines, 'warnings':[
        'Imported amounts are cached workbook values, not recalculated formulas. Review them before use.',
        'Opening actuals cover July–October only and are optional. November–June are left unreported.',
        'Forecasts, totals, headcounts, bank transfers, and duplicate executive subrows are excluded.',
        'Miscellaneous credits are shown as income. Review whether these are refunds that should instead reduce expenses.',
        'The workbook contains formula-based planned fees and monthly amounts with sub-cent precision; each month is rounded to cents.',
        'The source annual title says 2026. This transfer uses the user-confirmed July 2026–June 2027 period.'
    ]},
    {'name':'Executive allocations', 'starts_on':args.starts_on, 'lines':exec_lines, 'warnings':[
        'Fall allocations are assigned to August and spring allocations to January. These are allocation dates, not spending dates.',
        'Recruitment is marked year-long in the source and is allocated once in July. Sergeant at Arms and Public Relations use the current listed annual amounts.',
        'The source executive spending sheet has broken references. No executive actual expenses are imported.',
        'Executive allocations may overlap the operating budget. Do not add their totals together.',
        'VPMD owns the Brotherhood allocation; Recruitment is a separate position.'
    ]}
]}
output=pathlib.Path(args.output)
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(document,indent=2))
print(json.dumps({'output':str(output),'budgets':[{'name':b['name'],'lines':len(b['lines'])} for b in document['budgets']]}))
