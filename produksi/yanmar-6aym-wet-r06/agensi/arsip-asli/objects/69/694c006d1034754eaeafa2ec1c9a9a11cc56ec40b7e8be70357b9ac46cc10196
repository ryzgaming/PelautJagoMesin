"""Count independently reviewed surface contacts without equating them with defects."""
import json
from pathlib import Path
import sys

*sweep_paths,contact_labels,out=[Path(x) for x in sys.argv[1:]]
sweeps=[json.loads(path.read_text()) for path in sweep_paths]
labels=json.loads(contact_labels.read_text())
assert all(s['hashes']==sweeps[0]['hashes'] for s in sweeps)
contacts={}
for sweep,phase in zip(sweeps,('idle','starter','starter_fine')):
    for column in ('static_pairs','moving_pairs'):
        for contact in sweep[column]:
            k=tuple(contact['parts'])
            p=contacts.setdefault(k, {})
            p[phase]=p.get(phase,{}) | {column:contact}
classified=[]
for pair in sorted(contacts):
    resolved=labels.get(' / '.join(pair),{'status':'UNVERIFIED','reason':'Contact not individually adjudicated.'})
    relative_motion=any('moving_pairs' in sample for sample in contacts[pair].values())
    classified.append({'relative_motion':relative_motion,'parts':pair,'status':resolved['status'],'reason':resolved['reason'],
                       'observations':contacts[pair]})
counts={status:sum(r['status']==status for r in classified) for status in ('INTENTIONAL_FIT','FAIL','UNVERIFIED')}
subtotals={label:{status:sum(r['relative_motion']==relative and r['status']==status for r in classified)
    for status in counts} for label,relative in [('installed_only',False),('relative_moving',True)]}
out.write_text(json.dumps({'motion_subtotals':subtotals,'assets':sweeps[0]['hashes'],'distinct_observed_pairs':len(classified),
    'counts':counts,'pairs':classified},indent=2)+'\n')
print(json.dumps({'observed':len(classified),'counts':counts}))
