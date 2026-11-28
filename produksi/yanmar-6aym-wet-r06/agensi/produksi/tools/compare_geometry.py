#!/usr/bin/env python3
"""Compare triangle positions and winding independently of glTF vertex and triangle ordering."""
import argparse
import collections
import hashlib
import json
import struct
from pathlib import Path

class MeshFile:
    def __init__(self, path):
        raw=path.read_bytes()
        self.sha=hashlib.sha256(raw).hexdigest()
        length=struct.unpack_from("<I",raw,12)[0]
        self.data=json.loads(raw[20:20+length])
        self.buffer=memoryview(raw)[28+length:]
        self.meshes={node["name"]:self.data["meshes"][node["mesh"]] for node in self.data["nodes"] if "mesh" in node}

    def elements(self, index):
        accessor=self.data["accessors"][index]
        view=self.data["bufferViews"][accessor["bufferView"]]
        widths={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}
        formats={5121:"B",5123:"H",5125:"I",5126:"f"}
        item=struct.Struct("<"+str(widths[accessor["type"]])+formats[accessor["componentType"]])
        offset=view.get("byteOffset",0)+accessor.get("byteOffset",0)
        stride=view.get("byteStride",item.size)
        if stride==item.size:
            return list(item.iter_unpack(self.buffer[offset:offset+stride*accessor["count"]]))
        return [item.unpack_from(self.buffer,offset+i*stride) for i in range(accessor["count"])]

    def surface(self, prim):
        if prim.get("mode",4)!=4: raise ValueError("Expected triangles")
        vertices=self.elements(prim["attributes"]["POSITION"])
        indices=self.elements(prim["indices"])
        tris=collections.Counter()
        for i in range(0,len(indices),3):
            a,b,c=(vertices[indices[j][0]] for j in range(i,i+3))
            tris[min((a,b,c),(b,c,a),(c,a,b))]+=1
        return collections.Counter(vertices),tris


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference",type=Path)
    parser.add_argument("candidate",type=Path)
    parser.add_argument("--json",type=Path)
    args=parser.parse_args()
    first,second=MeshFile(args.reference),MeshFile(args.candidate)
    missing=sorted(first.meshes.keys()-second.meshes.keys())
    extra=sorted(second.meshes.keys()-first.meshes.keys())
    failed={}
    for key in sorted(first.meshes.keys()&second.meshes.keys()):
        a,b=first.meshes[key]["primitives"],second.meshes[key]["primitives"]
        if len(a)!=len(b):
            failed[key]="primitive count"
            continue
        for x,y in zip(a,b):
            v,w=first.surface(x),second.surface(y)
            if v!=w:
                failed[key]="vertex positions, multiplicity or oriented triangle surface differs"
                break
    report={"reference_sha256":first.sha,"candidate_sha256":second.sha,"same_bytes":first.sha==second.sha,
            "same_glTF_JSON":first.data==second.data,"mesh_count_reference":len(first.meshes),
            "mesh_count_candidate":len(second.meshes),"missing":missing,"extra":extra,"geometry_differences":failed,
            "same_base_triangle_geometry":not (missing or extra or failed),
            "scope":"Exact base vertex positions, duplicate counts and oriented triangles per primitive. Does not compare shading or morph-target values."}
    encoded=json.dumps(report,indent=2,ensure_ascii=False)
    if args.json:args.json.write_text(encoded+"\n",encoding="utf-8")
    print(encoded)
    if not report["same_base_triangle_geometry"]:raise SystemExit(1)

if __name__=="__main__":
    main()
