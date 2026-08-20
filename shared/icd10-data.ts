/**
 * Curated list of common primary care ICD-10 diagnosis codes
 * Includes Thai and English descriptions and categories for fast clinical lookup.
 */
export interface Icd10Entry {
  code: string;
  nameTh: string;
  nameEn: string;
  category: string;
}

export const COMMON_ICD10_LIST: Icd10Entry[] = [
  // Respiratory (ระบบทางเดินหายใจ)
  { code: "J00", nameTh: "หวัดธรรมดา / ช่องจมูกและคออักเสบเฉียบพลัน", nameEn: "Acute nasopharyngitis [common cold]", category: "ระบบทางเดินหายใจ" },
  { code: "J01.9", nameTh: "ไซนัสอักเสบเฉียบพลัน ไม่ระบุรายละเอียด", nameEn: "Acute sinusitis, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "J02.9", nameTh: "คอหอยอักเสบเฉียบพลัน ไม่ระบุรายละเอียด", nameEn: "Acute pharyngitis, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "J03.9", nameTh: "ทอนซิลอักเสบเฉียบพลัน ไม่ระบุรายละเอียด", nameEn: "Acute tonsillitis, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "J04.0", nameTh: "กล่องเสียงอักเสบเฉียบพลัน", nameEn: "Acute laryngitis", category: "ระบบทางเดินหายใจ" },
  { code: "J06.9", nameTh: "การติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน (URI)", nameEn: "Acute upper respiratory infection, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "J11.1", nameTh: "ไข้หวัดใหญ่ที่มีอาการทางเดินหายใจ", nameEn: "Influenza with other respiratory manifestations", category: "ระบบทางเดินหายใจ" },
  { code: "J18.9", nameTh: "ปอดบวม / ปอดอักเสบ ไม่ระบุรายละเอียด", nameEn: "Pneumonia, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "J20.9", nameTh: "หลอดลมอักเสบเฉียบพลัน", nameEn: "Acute bronchitis, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "J30.4", nameTh: "เยื่อจมูกอักเสบจากภูมิแพ้ (ภูมิแพ้อากาศ)", nameEn: "Allergic rhinitis, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "J45.9", nameTh: "โรคหืด ไม่ระบุรายละเอียด", nameEn: "Asthma, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "J44.9", nameTh: "โรคปอดอุดกั้นเรื้อรัง (COPD)", nameEn: "Chronic obstructive pulmonary disease, unspecified", category: "ระบบทางเดินหายใจ" },
  { code: "R05", nameTh: "ไอ", nameEn: "Cough", category: "ระบบทางเดินหายใจ" },

  // Gastrointestinal (ระบบทางเดินอาหาร)
  { code: "A09", nameTh: "อุจจาระร่วงและกระเพาะลำไส้อักเสบจากการติดเชื้อ", nameEn: "Infectious gastroenteritis and colitis, unspecified", category: "ระบบทางเดินอาหาร" },
  { code: "K21.9", nameTh: "โรคกรดไหลย้อน (GERD)", nameEn: "Gastro-esophageal reflux disease without esophagitis", category: "ระบบทางเดินอาหาร" },
  { code: "K29.7", nameTh: "กระเพาะอาหารอักเสบ (โรคกระเพาะ)", nameEn: "Gastritis, unspecified", category: "ระบบทางเดินอาหาร" },
  { code: "K30", nameTh: "อาหารไม่ย่อย / ท้องอืด ท้องเฟ้อ (Dyspepsia)", nameEn: "Functional dyspepsia", category: "ระบบทางเดินอาหาร" },
  { code: "K52.9", nameTh: "ลำไส้อักเสบที่ไม่ใช่จากการติดเชื้อ", nameEn: "Noninfective gastroenteritis and colitis, unspecified", category: "ระบบทางเดินอาหาร" },
  { code: "K58.9", nameTh: "โรคลำไส้แปรปรวน (IBS)", nameEn: "Irritable bowel syndrome without diarrhea", category: "ระบบทางเดินอาหาร" },
  { code: "K59.0", nameTh: "ท้องผูก", nameEn: "Constipation", category: "ระบบทางเดินอาหาร" },
  { code: "K64.9", nameTh: "ริดสีดวงทวาร ไม่ระบุรายละเอียด", nameEn: "Hemorrhoids, unspecified", category: "ระบบทางเดินอาหาร" },
  { code: "R10.4", nameTh: "ปวดท้อง ไม่ระบุสาเหตุ", nameEn: "Other and unspecified abdominal pain", category: "ระบบทางเดินอาหาร" },
  { code: "R11", nameTh: "คลื่นไส้ อาเจียน", nameEn: "Nausea and vomiting", category: "ระบบทางเดินอาหาร" },

  // Cardiovascular & Metabolic (หัวใจและเมตาบอลิซึม)
  { code: "I10", nameTh: "โรคความดันโลหิตสูงปฐมภูมิ", nameEn: "Essential (primary) hypertension", category: "ระบบหัวใจและหลอดเลือด" },
  { code: "I20.9", nameTh: "โรคหลอดเลือดหัวใจตีบ / เจ็บแน่นหน้าอก", nameEn: "Angina pectoris, unspecified", category: "ระบบหัวใจและหลอดเลือด" },
  { code: "E11.9", nameTh: "โรคเบาหวานชนิดที่ 2 ไม่มีภาวะแทรกซ้อน", nameEn: "Type 2 diabetes mellitus without complications", category: "ระบบต่อมไร้ท่อและเมตาบอลิซึม" },
  { code: "E78.0", nameTh: "ไขมันในเลือดสูง (โคเลสเตอรอลสูง)", nameEn: "Pure hypercholesterolemia", category: "ระบบต่อมไร้ท่อและเมตาบอลิซึม" },
  { code: "E78.5", nameTh: "ไขมันในเลือดผิดปกติ ไม่ระบุรายละเอียด", nameEn: "Hyperlipidemia, unspecified", category: "ระบบต่อมไร้ท่อและเมตาบอลิซึม" },
  { code: "E03.9", nameTh: "ภาวะไทรอยด์ทำงานต่ำ", nameEn: "Hypothyroidism, unspecified", category: "ระบบต่อมไร้ท่อและเมตาบอลิซึม" },
  { code: "E05.9", nameTh: "ภาวะต่อมไทรอยด์เป็นพิษ / ทำงานเกิน", nameEn: "Thyrotoxicosis, unspecified", category: "ระบบต่อมไร้ท่อและเมตาบอลิซึม" },
  { code: "E79.0", nameTh: "กรดยูริกในเลือดสูง (เกาต์แฝง)", nameEn: "Hyperuricemia without signs of inflammatory arthritis", category: "ระบบต่อมไร้ท่อและเมตาบอลิซึม" },
  { code: "M10.9", nameTh: "โรคเกาต์ ไม่ระบุรายละเอียด", nameEn: "Gout, unspecified", category: "ระบบกล้ามเนื้อและกระดูก" },

  // Musculoskeletal (ระบบกล้ามเนื้อและกระดูก)
  { code: "M54.5", nameTh: "ปวดหลังส่วนล่าง (Low back pain)", nameEn: "Low back pain", category: "ระบบกล้ามเนื้อและกระดูก" },
  { code: "M54.2", nameTh: "ปวดคอ (Cervicalgia)", nameEn: "Cervicalgia", category: "ระบบกล้ามเนื้อและกระดูก" },
  { code: "M79.1", nameTh: "ปวดกล้ามเนื้อ (Myalgia / กล้ามเนื้ออักเสบ)", nameEn: "Myalgia", category: "ระบบกล้ามเนื้อและกระดูก" },
  { code: "M79.7", nameTh: "โรคปวดกล้ามเนื้อทั่วตัว (Fibromyalgia)", nameEn: "Fibromyalgia", category: "ระบบกล้ามเนื้อและกระดูก" },
  { code: "M77.9", nameTh: "เอ็นอักเสบ / ผังผืดอักเสบ", nameEn: "Enthesopathy, unspecified", category: "ระบบกล้ามเนื้อและกระดูก" },
  { code: "M17.9", nameTh: "ข้อเข่าเสื่อม ไม่ระบุรายละเอียด", nameEn: "Osteoarthritis of knee, unspecified", category: "ระบบกล้ามเนื้อและกระดูก" },
  { code: "M25.5", nameTh: "ปวดข้อ ไม่ระบุรายละเอียด", nameEn: "Pain in joint", category: "ระบบกล้ามเนื้อและกระดูก" },
  { code: "M65.9", nameTh: "ปลอกหุ้มเอ็นอักเสบ (นิ้วล็อก/De Quervain)", nameEn: "Synovitis and tenosynovitis, unspecified", category: "ระบบกล้ามเนื้อและกระดูก" },

  // Neurological & Psychiatric (ระบบประสาทและจิตเวช)
  { code: "G43.9", nameTh: "โรคไมเกรน ไม่ระบุรายละเอียด", nameEn: "Migraine, unspecified", category: "ระบบประสาท" },
  { code: "G44.2", nameTh: "ปวดศีรษะจากความเครียด (Tension-type headache)", nameEn: "Tension-type headache", category: "ระบบประสาท" },
  { code: "R51", nameTh: "ปวดศีรษะ ไม่ระบุรายละเอียด", nameEn: "Headache", category: "ระบบประสาท" },
  { code: "R42", nameTh: "เวียนศีรษะ / บ้านหมุน (Dizziness and giddiness)", nameEn: "Dizziness and giddiness", category: "ระบบประสาท" },
  { code: "H81.1", nameTh: "บ้านหมุนจากตะกอนหินปูนในหูชั้นในหลุด (BPPV)", nameEn: "Benign paroxysmal vertigo", category: "ระบบประสาท" },
  { code: "F41.9", nameTh: "โรควิตกกังวล ไม่ระบุรายละเอียด", nameEn: "Anxiety disorder, unspecified", category: "จิตเวช" },
  { code: "F32.9", nameTh: "โรคซึมเศร้า ไม่ระบุรายละเอียด", nameEn: "Depressive episode, unspecified", category: "จิตเวช" },
  { code: "G47.0", nameTh: "โรคนอนไม่หลับ (Insomnia)", nameEn: "Disorders of initiating and maintaining sleep [insomnias]", category: "ระบบประสาท" },

  // Dermatology (โรคผิวหนัง)
  { code: "L20.9", nameTh: "ผื่นผิวหนังอักเสบจากภูมิแพ้ (Atopic dermatitis)", nameEn: "Atopic dermatitis, unspecified", category: "โรคผิวหนัง" },
  { code: "L23.9", nameTh: "ผื่นผิวหนังอักเสบจากการสัมผัสสารก่อภูมิแพ้", nameEn: "Allergic contact dermatitis, unspecified cause", category: "โรคผิวหนัง" },
  { code: "L24.9", nameTh: "ผื่นผิวหนังอักเสบจากการระคายเคือง", nameEn: "Irritant contact dermatitis, unspecified cause", category: "โรคผิวหนัง" },
  { code: "L50.9", nameTh: "ลมพิษ ไม่ระบุรายละเอียด", nameEn: "Urticaria, unspecified", category: "โรคผิวหนัง" },
  { code: "L70.0", nameTh: "สิวธรรมดา (Acne vulgaris)", nameEn: "Acne vulgaris", category: "โรคผิวหนัง" },
  { code: "B35.9", nameTh: "การติดเชื้อราที่ผิวหนัง (กลาก/เกลื้อน/ฮ่องกงฟุต)", nameEn: "Dermatophytosis, unspecified", category: "โรคผิวหนัง" },
  { code: "B00.9", nameTh: "การติดเชื้อไวรัสเริม", nameEn: "Herpesviral infection, unspecified", category: "โรคผิวหนัง" },
  { code: "B02.9", nameTh: "โรคงูสวัด", nameEn: "Zoster without complication", category: "โรคผิวหนัง" },
  { code: "L02.9", nameTh: "ฝี / แผลหนองที่ผิวหนัง", nameEn: "Cutaneous abscess, furuncle and carbuncle, unspecified", category: "โรคผิวหนัง" },
  { code: "L03.9", nameTh: "เนื้อเยื่อใต้ผิวหนังอักเสบ (Cellulitis)", nameEn: "Cellulitis, unspecified", category: "โรคผิวหนัง" },
  { code: "L30.9", nameTh: "ผิวหนังอักเสบ ไม่ระบุรายละเอียด (Eczema)", nameEn: "Dermatitis, unspecified", category: "โรคผิวหนัง" },

  // Genitourinary (ระบบทางเดินปัสสาวะและสืบพันธุ์)
  { code: "N39.0", nameTh: "การติดเชื้อทางเดินปัสสาวะ (กระเพาะปัสสาวะอักเสบ / UTI)", nameEn: "Urinary tract infection, site not specified", category: "ระบบทางเดินปัสสาวะ" },
  { code: "N30.0", nameTh: "กระเพาะปัสสาวะอักเสบเฉียบพลัน", nameEn: "Acute cystitis", category: "ระบบทางเดินปัสสาวะ" },
  { code: "N40", nameTh: "ต่อมลูกหมากโต (BPH)", nameEn: "Hyperplasia of prostate", category: "ระบบทางเดินปัสสาวะ" },
  { code: "N94.6", nameTh: "ปวดประจำเดือน (Dysmenorrhea)", nameEn: "Dysmenorrhea, unspecified", category: "ระบบทางเดินปัสสาวะ" },
  { code: "N76.0", nameTh: "ช่องคลอดอักเสบเฉียบพลัน (Vaginitis)", nameEn: "Acute vaginitis", category: "ระบบทางเดินปัสสาวะ" },

  // Eye & ENT (ตา หู คอ จมูก)
  { code: "H10.9", nameTh: "เยื่อบุตาอักเสบ (ตาแดง)", nameEn: "Conjunctivitis, unspecified", category: "จักษุและโสตศอนาสิก" },
  { code: "H60.9", nameTh: "หูชั้นนอกอักเสบ", nameEn: "Otitis externa, unspecified", category: "จักษุและโสตศอนาสิก" },
  { code: "H66.9", nameTh: "หูชั้นกลางอักเสบ", nameEn: "Otitis media, unspecified", category: "จักษุและโสตศอนาสิก" },
  { code: "H93.1", nameTh: "เสียงรบกวนในหู (Tinnitus)", nameEn: "Tinnitus", category: "จักษุและโสตศอนาสิก" },
  { code: "K12.0", nameTh: "แผลร้อนในในปาก (Aphthous ulcer)", nameEn: "Recurrent aphthous stomatitis", category: "จักษุและโสตศอนาสิก" },

  // General Symptoms & Injuries (อาการทั่วไปและการบาดเจ็บ)
  { code: "R50.9", nameTh: "ไข้ ไม่ระบุสาเหตุ", nameEn: "Fever, unspecified", category: "อาการทั่วไป" },
  { code: "R53", nameTh: "อ่อนเพลีย เหนื่อยล้า (Fatigue / Malaise)", nameEn: "Malaise and fatigue", category: "อาการทั่วไป" },
  { code: "T14.0", nameTh: "แผลถลอก / ฟกช้ำ ไม่ระบุตำแหน่ง", nameEn: "Superficial injury of unspecified body region", category: "การบาดเจ็บและอุบัติเหตุ" },
  { code: "T14.1", nameTh: "แผลเปิด / แผลฉีกขาด ไม่ระบุตำแหน่ง", nameEn: "Open wound of unspecified body region", category: "การบาดเจ็บและอุบัติเหตุ" },
  { code: "T14.3", nameTh: "ข้อเคล็ด ขัดยอก (Sprain / Strain)", nameEn: "Dislocation, sprain and strain of unspecified body region", category: "การบาดเจ็บและอุบัติเหตุ" },
  { code: "T78.4", nameTh: "อาการแพ้ ไม่ระบุรายละเอียด (Allergy)", nameEn: "Allergy, unspecified", category: "อาการทั่วไป" },
  { code: "Z00.0", nameTh: "การตรวจสุขภาพทั่วไป (General medical examination)", nameEn: "General medical examination", category: "การตรวจสุขภาพ" },
  { code: "Z71.9", nameTh: "การให้คำปรึกษาทางการแพทย์ (Medical consultation)", nameEn: "Counseling, unspecified", category: "การตรวจสุขภาพ" },
];

/**
 * Searches the ICD-10 list by query (matching code prefix, Thai name, English name, or category).
 * Returns up to maxResults entries sorted by relevance.
 */
export function searchIcd10(query: string, maxResults = 15): Icd10Entry[] {
  const term = query.trim().toLowerCase();
  if (!term) return COMMON_ICD10_LIST.slice(0, maxResults);

  const exactCodeMatches: Icd10Entry[] = [];
  const startsWithCodeMatches: Icd10Entry[] = [];
  const textMatches: Icd10Entry[] = [];

  for (const item of COMMON_ICD10_LIST) {
    const codeLower = item.code.toLowerCase();
    const nameThLower = item.nameTh.toLowerCase();
    const nameEnLower = item.nameEn.toLowerCase();
    const catLower = item.category.toLowerCase();

    if (codeLower === term) {
      exactCodeMatches.push(item);
    } else if (codeLower.startsWith(term)) {
      startsWithCodeMatches.push(item);
    } else if (nameThLower.includes(term) || nameEnLower.includes(term) || catLower.includes(term) || codeLower.includes(term)) {
      textMatches.push(item);
    }
  }

  return [...exactCodeMatches, ...startsWithCodeMatches, ...textMatches].slice(0, maxResults);
}
