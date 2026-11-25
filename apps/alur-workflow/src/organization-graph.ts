import {step,type Edge,type Graph} from "./flow.ts";
import {agentKind,agents,divisions} from "./organization.ts";

// Urutan baris di kanvas mengikuti aliran kerja: arahan → data & validasi teknis →
// produksi 3D → gerbang QA → penjualan → layanan → keuangan.
export const divisionOrder = ["eksekutif","kurikulum","produk","qa","growth","sales","cs","finance"] as const;
export const organizationId = "organisasi-agen";
const columnGap = 262, rowGap = 150, firstColumn = 320, top = 40;

export function organizationGraph(): Graph {
  const start = step("trigger","arahan-pemilik",40,top);
  start.name = "Arahan pemilik";
  const nodes = [start];
  divisionOrder.forEach((key,row) => {
    const members = agents.filter(agent => agent.division === key);
    members.forEach((agent,column) => {
      const node = step(agentKind(agent),"agen-"+agent.id,firstColumn+column*columnGap,top+row*rowGap);
      nodes.push(node);
    });
  });
  const edges: Edge[] = nodes.slice(1).map((node,i) => ({from:nodes[i].id,port:"out",to:node.id}));
  return {id:organizationId,name:"Organisasi 57 agent",revision:0,nodes,edges};
}

export const organizationSummary = divisions.map(division => ({
  ...division,
  count: agents.filter(agent => agent.division === division.key).length,
}));
