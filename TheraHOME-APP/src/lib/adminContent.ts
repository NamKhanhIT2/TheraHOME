import type { AppLanguage } from '@/store/useAppStore';

type Localized = Record<Exclude<AppLanguage, 'vi'>, string>;
const products: Record<string, Localized> = {
  'neck-plus': { en: 'Neck support device · TheraNECK+', ms: 'Peranti sokongan leher · TheraNECK+' },
  'neck-pro': { en: 'Neck support device · TheraNECK PRO', ms: 'Peranti sokongan leher · TheraNECK PRO' },
  'back-plus': { en: 'Back support device · TheraBACK+', ms: 'Peranti sokongan belakang · TheraBACK+' },
  'back-pro': { en: 'Back support device · TheraBACK PRO', ms: 'Peranti sokongan belakang · TheraBACK PRO' },
};
const phases: Record<string, Localized> = {
  'Giai đoạn 1 · Giảm khó chịu & làm quen': { en: 'Phase 1 · Reduce discomfort & adapt', ms: 'Fasa 1 · Kurangkan ketidakselesaan & penyesuaian' },
  'Giai đoạn 2 · Tăng cường vận động cổ': { en: 'Phase 2 · Improve neck mobility', ms: 'Fasa 2 · Tingkatkan pergerakan leher' },
  'Giai đoạn 2 · Tăng cường sức bền cột sống': { en: 'Phase 2 · Improve spinal endurance', ms: 'Fasa 2 · Tingkatkan daya tahan tulang belakang' },
  'Giai đoạn 3 · Duy trì': { en: 'Phase 3 · Maintain progress', ms: 'Fasa 3 · Kekalkan kemajuan' },
};
const categories: Record<string, Localized> = {
  neck: { en: 'Neck support devices', ms: 'Peranti sokongan leher' },
  back: { en: 'Back support devices', ms: 'Peranti sokongan belakang' },
  accessory: { en: 'Accessories', ms: 'Aksesori' },
};
const itemNames: Record<string, Localized> = {
  patch: { en: 'Vinh Gia herbal patch', ms: 'Tampalan herba Vinh Gia' },
  gel: { en: 'Electrode gel', ms: 'Gel elektrod' },
  pillow: { en: 'Ergonomic pillow', ms: 'Bantal ergonomik' },
  chair: { en: 'Ergonomic chair', ms: 'Kerusi ergonomik' },
};
const descriptions: Record<string, Localized> = {
  'neck-plus': { en: 'Heated massager supporting the neck area', ms: 'Pengurut haba untuk menyokong kawasan leher' },
  'neck-pro': { en: 'Premium version with automatic pressure adjustment', ms: 'Versi premium dengan pelarasan tekanan automatik' },
  'back-plus': { en: 'Heated belt supporting the lower back', ms: 'Tali pinggang haba untuk menyokong belakang bawah' },
  'back-pro': { en: 'Premium version with spinal stretching support', ms: 'Versi premium dengan sokongan regangan tulang belakang' },
  patch: { en: 'Local pain and inflammation relief', ms: 'Melegakan sakit dan keradangan setempat' },
  gel: { en: 'For use with electrical stimulation devices', ms: 'Untuk digunakan dengan peranti rangsangan elektrik' },
  pillow: { en: 'Supports a healthy sleeping posture', ms: 'Menyokong postur tidur yang baik' },
  chair: { en: 'Supports a healthy working posture', ms: 'Menyokong postur duduk semasa bekerja' },
};

function pick(table: Record<string, Localized>, key: string, fallback: string, language: AppLanguage) {
  return language === 'vi' ? fallback : table[key]?.[language] ?? fallback;
}

export const localizeProductName = (id: string, fallback: string, lang: AppLanguage) => pick(products, id, fallback, lang);
export const localizePhaseName = (fallback: string, lang: AppLanguage) => pick(phases, fallback, fallback, lang);
export const localizeCategoryName = (id: string, fallback: string, lang: AppLanguage) => pick(categories, id, fallback, lang);
export const localizeItemName = (id: string, fallback: string, lang: AppLanguage) => pick(itemNames, id, fallback, lang);
export const localizeItemDescription = (id: string, fallback: string, lang: AppLanguage) => pick(descriptions, id, fallback, lang);
