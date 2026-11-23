import {affiliateRpc,money} from './app.js';
const form = document.querySelector('#affiliate-terms');
const current = form.querySelector('output');
async function load(rate = null) {
  const data = await affiliateRpc('admin',{p_rate:rate});
  current.textContent = data.rate_idr == null ? 'Nominal belum ditetapkan.' : 'Komisi per akun ' + money(data.rate_idr);
  const rows = document.querySelector('#affiliate-totals');
  rows.replaceChildren();
  for (const partner of data.accounts) {
    const row = document.createElement('li');
    row.textContent = partner.email + ' · ' + partner.referrals + ' referral · ' + partner.pending + ' menunggu nominal · ' + (partner.earned_idr ? money(partner.earned_idr) : 'Rp0');
    rows.append(row);
  }
}
form.closest('details').addEventListener('toggle',e => {
  if (e.target.open) load().catch(()=>{current.textContent='Data komisi belum dapat dibuka.';});
});
form.onsubmit = async e => {
  e.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  try { await load(Number(form.elements.rate.value)); }
  catch { current.textContent='Nominal belum tersimpan.'; }
  finally { button.disabled = false; }
};
