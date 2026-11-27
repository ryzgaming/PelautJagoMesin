// Pilihan model AI dan batas biaya untuk satu order produksi mesin. Dipakai browser (Agent produksi di Bagan),
// server (functions/api/machines.ts), dan aturan yang sama ditegakkan lagi di SQL (alur_set_machine_options).
// Harga per 1 juta token (input / output). GPT: tarif Standard, konteks pendek,
// https://developers.openai.com/api/docs/pricing (diperiksa 27 November 2026).
// Claude: daftar harga Anthropic yang sudah digunakan proyek, November 2026.

export type AiModel = {id: string, name: string, price: string, note: string};

export const aiModels: AiModel[] = [
  {id: "claude-opus-5-5", name: "Claude Opus 5.5", price: "$4 / $20", note: "Bawaan: seimbang untuk koordinator, pemodel, dan QA"},
  {id: "claude-fable-5-2", name: "Claude Fable 5.2", price: "$8 / $40", note: "Paling cerdas, untuk mesin yang sulit; termahal"},
  {id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", price: "$2 / $10", note: "Lebih hemat untuk sebagian besar pekerjaan"},
  {id: "claude-haiku-5-5", name: "Claude Haiku 5.5", price: "$0,10 / $0,50", note: "Paling hemat; cocok untuk subagen yang banyak membaca"},
  {id: "gpt-6.2-sol", name: "GPT-6.2 Sol", price: "$2 / $10", note: "Untuk coding, pemodelan, dan pekerjaan umum melalui pekerja yang mendukung GPT"},
  {id: "gpt-6.2-astra", name: "GPT-6.2 Astra", price: "$8 / $40", note: "Untuk penalaran kompleks dan pemeriksaan mendalam; biaya lebih tinggi"},
  {id: "gpt-6.1-terra", name: "GPT-6.1 Terra", price: "$1 / $5", note: "Untuk membaca gambar teknik, referensi visual, dan interaksi aplikasi"},
  {id: "gpt-6-luna", name: "GPT-6 Luna", price: "$0,10 / $0,50", note: "Pilihan hemat untuk tugas sederhana dan pengolahan dokumen"},
];
export const defaultAiModel = "claude-opus-5-5";
export const aiModelById = new Map(aiModels.map(m => [m.id, m]));

/** Batas biaya per order dalam dolar AS (bilangan bulat). */
export const budgetLimits = {min: 1, max: 500, initial: 40};

export type ProductionOptions = {ai_model: string, budget_usd: number};

/** Bentuk persis opsi produksi; null bila tidak valid. */
export function productionOptions(value: unknown): ProductionOptions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== "ai_model,budget_usd") return null;
  if (typeof v.ai_model !== "string" || !aiModelById.has(v.ai_model)) return null;
  if (!Number.isInteger(v.budget_usd) || (v.budget_usd as number) < budgetLimits.min || (v.budget_usd as number) > budgetLimits.max) return null;
  return {ai_model: v.ai_model, budget_usd: v.budget_usd as number};
}

/** Opsi dari langkah Agent produksi: model di kolom value, batas biaya di kolom message. */
export function stepOptions(value: string, message: string): ProductionOptions {
  const budget = Number.parseInt(message, 10);
  return {ai_model: aiModelById.has(value) ? value : defaultAiModel,
    budget_usd: Number.isInteger(budget) && budget >= budgetLimits.min && budget <= budgetLimits.max ? budget : budgetLimits.initial};
}

export const optionsLabel = (o: ProductionOptions) => (aiModelById.get(o.ai_model)?.name ?? o.ai_model) + " · batas $" + o.budget_usd;
