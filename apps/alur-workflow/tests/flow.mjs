import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,execute,validate} from '../src/flow.ts';
test('email terisi menghasilkan konfirmasi',()=>assert.deepEqual(execute(initial(),{email:'a@example.com',nama:''}).trace.map(x=>x.id),['start','check','ok']));
test('email kosong masuk review',()=>assert.ok(execute(initial(),{email:' ',nama:''}).review));
test('siklus ditolak',()=>{const g=initial();g.edges.push({from:'ok',port:'out',to:'check'});assert.throws(()=>validate(g),/putaran/)});
test('alur terputus ditolak saat dijalankan',()=>{let g=initial();g.edges.pop();assert.throws(()=>execute(g,{nama:'',email:''}))});
