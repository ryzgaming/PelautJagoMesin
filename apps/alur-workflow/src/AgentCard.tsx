import {accuracyStandards,definitionOfDone,divisionByKey,phaseLabels,type Agent} from "./organization";

function List({title,items}:{title:string,items:string[]}) {
  return <><h3>{title}</h3><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></>;
}

export default function AgentCard({agent}:{agent:Agent}) {
  const division=divisionByKey.get(agent.division)!;
  return <div className={"agent-card-panel agent div-"+agent.division}>
    <div className="agent-tags">
      <span>{division.name}</span>
      {agent.lead&&<span>Lead divisi</span>}
      <span>{phaseLabels[agent.phase]}</span>
      {agent.production&&<span>Lini produksi 3D</span>}
    </div>
    <h3>Misi</h3>
    <p className="agent-mission">{agent.mission}</p>
    <List title="Tanggung jawab" items={agent.tasks}/>
    <List title="Output rutin" items={agent.outputs}/>
    <List title="KPI" items={agent.kpi}/>
    <List title="Wajib teliti" items={agent.accuracy}/>
    <h3>Eskalasi</h3>
    <p className="agent-mission">{division.escalation}</p>
    <List title="Larangan" items={division.forbidden}/>
    <details><summary>10 standar ketelitian semua agent</summary><ol>{accuracyStandards.map(rule=><li key={rule}>{rule}</li>)}</ol></details>
    {agent.production&&<details><summary>Definition of done per mesin</summary><ol>{definitionOfDone.map(item=><li key={item}>{item}</li>)}</ol></details>}
  </div>;
}
