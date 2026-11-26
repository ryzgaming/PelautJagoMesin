import {step,type Graph} from "./flow.ts";
import {agentKind,agents,type Agent} from "./organization.ts";
import {layoutTree,type TreeNode} from "./org-tree.ts";

export const divisionOrder = ["eksekutif","kurikulum","produk","qa","growth","sales","cs","finance"] as const;
export const organizationId = "organisasi-agen";

const box = (agent:Agent, children?:TreeNode[]):TreeNode => ({node:step(agentKind(agent),"agen-"+agent.id,0,0),children});

/** Bagan organisasi 57 agent: Pemilik → Orchestrator → staf direktur dan kepala divisi → staf divisi. */
export function organizationGraph(): Graph {
  const start = step("trigger","arahan-pemilik",0,0); start.name = "Arahan pemilik";
  const lead = (key:string) => agents.find(a => a.division===key && a.lead)!;
  const staff = (key:string) => agents.filter(a => a.division===key && !a.lead);
  const head = lead("eksekutif");
  const tree:TreeNode = {node:start, children:[box(head,[
    ...staff("eksekutif").map(a => box(a)),
    ...divisionOrder.filter(k => k!=="eksekutif").map(k => box(lead(k), staff(k).map(a => box(a)))),
  ])]};
  const {nodes,edges} = layoutTree(tree);
  return {id:organizationId,name:"Organisasi 57 agent",revision:0,nodes,edges};
}
