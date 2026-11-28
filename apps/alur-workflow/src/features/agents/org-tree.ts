import {type Edge,type Port,type Step} from "../workflow/flow.ts";

/** Satu kotak di bagan organisasi beserta bawahannya. */
export type TreeNode = {node:Step, port?:Port, children?:TreeNode[]};

export const treeColumnGap = 262, treeRowGap = 108;

/**
 * Menata pohon dari kiri ke kanan seperti bagan organisasi: atasan di kiri, bawahan
 * bertumpuk di kanannya, dan setiap atasan berada di tengah bawahannya. Urutan
 * bawahan menentukan urutan delegasi saat alur diuji.
 */
export function layoutTree(root:TreeNode, left=40, top=40) {
  const nodes:Step[] = [], edges:Edge[] = [];
  let row = 0;
  function place(t:TreeNode, depth:number):number {
    nodes.push(t.node);
    t.node.x = left + depth*treeColumnGap;
    const kids = t.children ?? [];
    if(!kids.length) { t.node.y = top + row*treeRowGap; row++; return t.node.y; }
    const ys = kids.map(k => place(k,depth+1));
    for(const k of kids) edges.push({from:t.node.id,port:k.port ?? "out",to:k.node.id});
    t.node.y = Math.round((ys[0]+ys[ys.length-1])/2);
    return t.node.y;
  }
  place(root,0);
  return {nodes,edges};
}
