# Dependency Security Audit — Pallop Clinic

> **ประเภทการตรวจ:** Read-only dependency security audit  
> **ขอบเขต:** `pnpm audit --prod`, `package.json`, `pnpm-lock.yaml`, dependency path, metadata จาก npm registry และการตรวจ source ที่ถูก build จริง  
> **วันที่ตรวจ:** 20 สิงหาคม 2026 (GMT+7)  
> **ข้อจำกัดของ task:** ไม่มีการแก้ source code, `package.json`, `pnpm-lock.yaml`, dependency, commit หรือ push

## Executive Summary

ผล `pnpm audit --prod` พบ **72 advisories** ได้แก่ **0 Critical, 17 High, 47 Moderate และ 8 Low** โดยรวมหลาย advisory ที่กระทบ package เดียวกัน การตีความจึงไม่ควรดูจากจำนวน 72 รายการเพียงอย่างเดียว แต่ต้องดูว่า dependency นั้นเป็น direct/transitive, ถูก import ใน production runtime หรือไม่ และมีเส้นทางข้อมูลจากผู้ใช้ไปถึงเงื่อนไขโจมตีหรือไม่ [1]

การตรวจ source พบว่า **Drizzle ORM และ Express อยู่ใน production server path จริง** ขณะที่ Axios, Streamdown/Mermaid/DOMPurify, Recharts/Lodash และ AWS SDK/UUID ติดตั้งอยู่ใน production dependency tree แต่ไม่พบ import จาก application route/page ที่ใช้จริง ณ วันที่ตรวจ ส่วน Nanoid ถูกอ้างอิงใน Vite development bootstrap และ production server เรียก `serveStatic()` แทน `setupVite()` เมื่อ `NODE_ENV` ไม่ใช่ `development`.

ดังนั้น การเปิดใช้งานจริงควรถูก **Block จนกว่าจะมี remediation task ที่อนุมัติ** สำหรับอย่างน้อย Drizzle ORM และ Express dependency chain พร้อม regression test ผล audit ไม่มี Critical และไม่พบหลักฐานว่า SQL identifier หรือ route pattern ที่รับจากผู้ใช้ถูกส่งเข้า vulnerability โดยตรง แต่ระบบจัดการ PHI และการเงินไม่ควรยอมรับความเสี่ยงจาก ORM/HTTP parser ที่ยังมี advisory ระดับสูง/ปานกลางค้างอยู่ [2] [3]

## Method and Evidence

| หัวข้อ | วิธีตรวจ | ข้อจำกัดของข้อสรุป |
|---|---|---|
| Inventory | อ่าน manifest/lockfile และ `pnpm audit --prod` | เป็น snapshot ณ เวลารัน audit; advisory registry เปลี่ยนได้ |
| Direct vs transitive | ใช้ dependency path ที่ audit คืนมา | path ระบุเส้นทางติดตั้ง ไม่ได้พิสูจน์ว่า branch ของ code ถูกเรียกทุกครั้ง |
| Runtime exposure | ตรวจ import, routes, server bootstrap และ page/component ที่ active | เป็น static review; ไม่ใช่ penetration test |
| Compatibility | ตรวจ Node runtime ปัจจุบัน, package metadata และ peer dependency ของรุ่นที่แก้ | ต้องติดตั้งใน branch แยกและรัน test/build จึงยืนยันได้ |
| Exploitability | เทียบเงื่อนไขจาก advisory กับ code path | การไม่มี path ที่พบไม่ใช่หลักฐานว่า exploit เป็นไปไม่ได้ในอนาคต |

## Dependency Inventory

ระบบใช้ Node.js **22.13.0**, `pnpm` ตาม manifest **10.4.1**, React **19.2.1**, Express **4.21.2**, Drizzle ORM **0.44.7**, MySQL2 **3.15.0**, Vite **7.1.7** และ TypeScript **5.9.3**. Direct production dependencies ที่อยู่ใน audit chain มี Axios, Drizzle ORM, Express, Nanoid, Recharts และ Streamdown; package ที่เหลือเป็น transitive dependency ของ direct package เหล่านี้หรือ AWS SDK.

| Dependency family | Installed | Direct / transitive | ใช้จริงใน production ณ วันที่ตรวจ | หมายเหตุ |
|---|---:|---|---|---|
| `drizzle-orm` | 0.44.7 | Direct | **ใช่** | `server/db.ts` ใช้ Drizzle/MySQL2 กับข้อมูลคลินิก การเงิน และ audit |
| `express` → `path-to-regexp`, `body-parser`, `qs` | 4.21.2 | Express direct; ที่เหลือ transitive | **ใช่** | server รับ HTTP, JSON และ URL-encoded body ก่อน tRPC |
| `axios` → `form-data`, `follow-redirects` | 1.12.2 | Axios direct; ที่เหลือ transitive | ไม่พบ import ใน application route/page | `Map.tsx` ไม่ใช้ Axios และไม่มี route import component template นี้ |
| `nanoid` | 5.1.6 | Direct | ไม่ใช่ production path ที่พบ | อยู่ใน Vite development bootstrap; production ใช้ static serving |
| `recharts` → `lodash` | 2.15.4 / 4.17.21 | Recharts direct; Lodash transitive | ไม่พบ page import `ChartContainer` | มี `components/ui/chart.tsx` แต่ไม่พบการ import ใน active pages |
| `streamdown` → `mermaid`, `dompurify`, `mdast-util-to-hast`, `lodash-es` | 1.4.0 | Streamdown direct; ที่เหลือ transitive | ไม่พบ import ใน `client/src` ที่ active | มีอยู่ใน template metadata แต่ไม่พบ route/page import จริง |
| AWS SDK → `uuid` | 11.1.0 | AWS SDK direct; UUID transitive | ไม่พบ AWS SDK import ใน runtime | storage helper ปัจจุบันเป็น Forge proxy และ file/PHI upload ถูกปิดตาม scope |

## Production Exposure Analysis

### P0 — ต้องแก้ก่อน Production

ไม่มี advisory ที่พิสูจน์ได้จาก static review ว่าถูก exploit แล้ว หรือมี Critical severity. อย่างไรก็ดี การเปิดใช้ระบบกับ PHI ไม่ควรผ่าน go/no-go หากยังไม่มี remediation plan ที่อนุมัติและทดสอบสำหรับ P1 ด้านล่าง

### P1 — ควรแก้ก่อน Production

| Package | Advisory / CVE | Why it matters | ผลกระทบจริง | Priority |
|---|---|---|---|---|
| `drizzle-orm@0.44.7` | [GHSA-gpj5-g38j-94v9][2], CVE-2026-39356; fixed `>=0.45.2` | SQL injection ผ่าน SQL identifiers ที่ escape ไม่ถูกต้อง | **Production runtime / database core.** ไม่พบ source code ที่สร้าง identifier จาก input ผู้ใช้; schema/query ที่พบใช้ column/table ที่ compile-time. ความน่าจะเป็น exploit ปัจจุบันจึงลดลง แต่ผลกระทบหากเกิดสูงมากเพราะเกี่ยวข้องกับ PHI, invoice และ audit | **P1** |
| `express@4.21.2` chain: `path-to-regexp@0.1.12`, `qs@6.13.0`, `body-parser@1.20.3` | [GHSA-37ch-88jc-xwx2][3] (path-to-regexp, High), [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p), [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26) (`qs`, Moderate), [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) (`body-parser`, Low) | เป็น HTTP route/body parsing layer ที่รับ request ก่อน tRPC | **Production runtime / user input.** route application ที่พบเป็น static (`/api/trpc`) และไม่พบ multiple dynamic route parameter ที่เข้ากับ ReDoS condition โดยตรง แต่ `express.urlencoded({ extended: true })` ทำงานกับทุก request และใช้ `qs`; จึงไม่ควร accept risk ก่อน production | **P1** |

### P2 — ควรแก้ แต่ไม่ Block หากยังไม่ถูกใช้งานจริง

| Package family | Advisories | ผลกระทบจริง ณ วันที่ตรวจ | Priority |
|---|---|---|---|
| `axios@1.12.2` | High 11, Moderate 16, Low 1; target ที่ครอบคลุมทั้งหมด `>=1.18.0` | Direct production dependency แต่ไม่พบ import ใน source route/page จริง. หากในอนาคตใช้ Axios กับ untrusted URL, proxy, redirect, cookie/header หรือ config object จะเกิด exposure ต่อ SSRF/proxy bypass, prototype pollution, credential leak และ DoS | **P2** |
| `form-data@4.0.4`, `follow-redirects@1.15.11` | [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) (High), [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653) (Moderate) | Transitive ผ่าน Axios; ไม่พบ Axios call จึงไม่มี active outbound request path ที่ตรวจพบ | **P2** ร่วมกับ Axios |
| `nanoid@5.1.6` | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) (High); fixed `>=5.1.16` | การเรียกที่พบอยู่ใน Vite dev setup ไม่ใช่ production server bootstrap. Advisory ต้องให้ non-secure generator รับ negative size ซึ่งไม่พบใน application code | **P2** เพื่อ hygiene; ไม่ใช่ production blocker เดี่ยว |

### P3 — รับความเสี่ยงชั่วคราวได้ แต่ต้องติดตาม

| Package family | Advisories | ผลกระทบจริง ณ วันที่ตรวจ | Priority |
|---|---|---|---|
| `recharts@2.15.4` → `lodash@4.17.21` | `lodash`: [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) (High), [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh), [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) (Moderate) | มี chart component จาก template แต่ไม่พบ page ที่ import; code injection advisory ต้องมีการเรียก `_.template` พร้อม input ที่ควบคุมได้ ซึ่งไม่พบ | **P3**; ยกระดับทันทีหากเริ่มใช้ chart/render template จากข้อมูลผู้ใช้ |
| `streamdown@1.4.0` → `mermaid`, `dompurify`, `mdast-util-to-hast`, `lodash-es` | Mermaid Moderate 8 + Low 1, DOMPurify Moderate 14 + Low 4, `mdast-util-to-hast` Moderate 1, `lodash-es` High 1 + Moderate 2 | ไม่พบ import ใน active client source. หากเปิด render untrusted Markdown/diagram ในอนาคต จะยกระดับเป็น client XSS/content-processing risk | **P3**; ห้ามเปิด feature markdown/diagram รับข้อมูลผู้ใช้ก่อน remediation |
| `uuid@11.1.0` | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) (Moderate); fixed `>=11.1.1` | Transitive ผ่าน AWS SDK ที่ไม่พบ import ใน runtime; scope file upload/PHI storage ถูกปิด | **P3** |

## Complete Advisory Register

ตารางนี้ครอบคลุม **ทุก advisory ที่ audit รายงาน** โดยรวม advisory ที่ใช้ package/current version/dependency path เดียวกันไว้ในแถวเดียว แต่ยังแสดง advisory ID ทุกตัว, fixed range ทุกกลุ่ม และสถานะ direct/transitive ชัดเจน. `Current` คือ version ที่ lockfile ติดตั้งจริง ณ เวลาตรวจ ส่วน `Fixed` คือ minimum fixed version ตาม audit; ค่า `<0.0.0` หมายถึง advisory รายงานว่าไม่มี fixed release.

| Priority | Package | Severity | Current | Fixed (ครอบคลุมรายการในแถว) | Direct / Transitive | Production impact | Advisory IDs |
|---|---|---|---:|---|---|---|---|
| P2 | Axios | High (11) | 1.12.2 | `>=1.13.5`, `>=1.15.1`, `>=1.15.2`, `>=1.16.0` | Direct | ไม่พบ import active; exposure เมื่อมี outbound HTTP/config ผู้ใช้ | [11 IDs](#axios-advisory-detail) |
| P2 | Axios | Moderate (16) | 1.12.2 | `>=1.15.0`, `>=1.15.1`, `>=1.15.2`, `>=1.16.0`, `>=1.18.0` | Direct | เช่นเดียวกับข้างต้น | [16 IDs](#axios-advisory-detail) |
| P2 | Axios | Low (1) | 1.12.2 | `>=1.15.1` | Direct | เช่นเดียวกับข้างต้น | [GHSA-xhjh-pmcv-23jw](https://github.com/advisories/GHSA-xhjh-pmcv-23jw) |
| P1 | Drizzle ORM | High (1) | 0.44.7 | `>=0.45.2` | Direct | Active server database layer; no untrusted identifier found | [GHSA-gpj5-g38j-94v9][2] |
| P2 | Form-data | High (1) | 4.0.4 | `>=4.0.6` | Transitive: Axios | ไม่มี Axios request path ที่พบ | [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) |
| P3 | Lodash | High (1), Moderate (2) | 4.17.21 | `>=4.17.23`, `>=4.18.0` | Transitive: Recharts | Chart component ไม่ถูก import โดย active page | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh), [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) |
| P3 | Lodash-es | High (1), Moderate (2) | 4.17.21 | `>=4.17.23`, `>=4.18.0` | Transitive: Streamdown → Mermaid | ไม่มี Streamdown active import | IDs เดียวกับ Lodash |
| P2 | Nanoid | High (1) | 5.1.6 | `>=5.1.16` | Direct | พบเฉพาะ Vite dev path | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) |
| P1 | Path-to-regexp | High (1) | 0.1.12 | `>=0.1.13` | Transitive: Express | Active HTTP router; no matching dynamic route pattern found | [GHSA-37ch-88jc-xwx2][3] |
| P1 | QS | Moderate (2), Low (1) | 6.13.0 | `>=6.14.1`, `>=6.14.2`, `>=6.15.2` | Transitive: Express/body parser | Active URL-encoded parser before tRPC | [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p), [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26), [GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883) |
| P1 | Body-parser | Low (1) | 1.20.3 | `>=1.20.6` | Transitive: Express | Active request body parser | [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) |
| P2 | Follow-redirects | Moderate (1) | 1.15.11 | `>=1.16.0` | Transitive: Axios | ไม่มี Axios request path ที่พบ | [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653) |
| P3 | DOMPurify | Moderate (14), Low (4) | 3.3.0 | `>=3.3.2`, `>=3.4.0`, `>=3.4.6`, `>=3.4.7`, `>=3.4.8`, `>=3.4.9`, `>=3.4.11`, `>=3.4.12`, `>=3.4.13`; one unfixed | Transitive: Streamdown/Mermaid | ไม่มี markdown/HTML rendering active | [full register](#streamdown-mermaid-dompurify-advisory-detail) |
| P3 | Mermaid | Moderate (8), Low (1) | 11.12.0 | `>=11.15.0`, `>=11.16.1` | Transitive: Streamdown | ไม่มี Mermaid active import | [full register](#streamdown-mermaid-dompurify-advisory-detail) |
| P3 | mdast-util-to-hast | Moderate (1) | 13.2.0 | `>=13.2.1` | Transitive: Streamdown | ไม่มี markdown processing active | [GHSA-4fh9-h7wg-q85m](https://github.com/advisories/GHSA-4fh9-h7wg-q85m) |
| P3 | UUID | Moderate (1) | 11.1.0 | `>=11.1.1` | Transitive: AWS SDK | AWS SDK ไม่ถูก import ใน runtime ที่พบ | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |

### Axios Advisory Detail

| Severity | Advisory IDs | Fixed minimum |
|---|---|---|
| High | [GHSA-pmwg-cvhr-8vh7](https://github.com/advisories/GHSA-pmwg-cvhr-8vh7), [GHSA-pf86-5x62-jrwf](https://github.com/advisories/GHSA-pf86-5x62-jrwf), [GHSA-6chq-wfr3-2hj9](https://github.com/advisories/GHSA-6chq-wfr3-2hj9) | `>=1.15.1` |
| High | [GHSA-43fc-jf86-j433](https://github.com/advisories/GHSA-43fc-jf86-j433) | `>=1.13.5` |
| High | [GHSA-q8qp-cvcw-x6jj](https://github.com/advisories/GHSA-q8qp-cvcw-x6jj), [GHSA-3g43-6gmg-66jw](https://github.com/advisories/GHSA-3g43-6gmg-66jw) | `>=1.15.2` |
| High | [GHSA-hfxv-24rg-xrqf](https://github.com/advisories/GHSA-hfxv-24rg-xrqf), [GHSA-777c-7fjr-54vf](https://github.com/advisories/GHSA-777c-7fjr-54vf), [GHSA-p92q-9vqr-4j8v](https://github.com/advisories/GHSA-p92q-9vqr-4j8v), [GHSA-j5f8-grm9-p9fc](https://github.com/advisories/GHSA-j5f8-grm9-p9fc), [GHSA-35jp-ww65-95wh](https://github.com/advisories/GHSA-35jp-ww65-95wh) | `>=1.16.0` |
| Moderate | [GHSA-3p68-rc4w-qgx5](https://github.com/advisories/GHSA-3p68-rc4w-qgx5), [GHSA-fvcv-3m26-pcqx](https://github.com/advisories/GHSA-fvcv-3m26-pcqx) | `>=1.15.0` |
| Moderate | [GHSA-w9j2-pvgh-6h63](https://github.com/advisories/GHSA-w9j2-pvgh-6h63), [GHSA-445q-vr5w-6q77](https://github.com/advisories/GHSA-445q-vr5w-6q77), [GHSA-m7pr-hjqh-92cm](https://github.com/advisories/GHSA-m7pr-hjqh-92cm), [GHSA-5c9x-8gcm-mpgx](https://github.com/advisories/GHSA-5c9x-8gcm-mpgx), [GHSA-vf2m-468p-8v99](https://github.com/advisories/GHSA-vf2m-468p-8v99), [GHSA-xx6v-rp6x-q39c](https://github.com/advisories/GHSA-xx6v-rp6x-q39c) | `>=1.15.1` |
| Moderate | [GHSA-3w6x-2g7m-8v23](https://github.com/advisories/GHSA-3w6x-2g7m-8v23) | `>=1.15.2` |
| Moderate | [GHSA-898c-q2cr-xwhg](https://github.com/advisories/GHSA-898c-q2cr-xwhg) | `>=1.16.0` |
| Moderate | [GHSA-62hf-57xw-28j9](https://github.com/advisories/GHSA-62hf-57xw-28j9), [GHSA-42h9-826w-cgv3](https://github.com/advisories/GHSA-42h9-826w-cgv3), [GHSA-pmv8-rq9r-6j72](https://github.com/advisories/GHSA-pmv8-rq9r-6j72), [GHSA-jqh4-m9w3-8hp9](https://github.com/advisories/GHSA-jqh4-m9w3-8hp9), [GHSA-mmx7-hfxf-jppx](https://github.com/advisories/GHSA-mmx7-hfxf-jppx), [GHSA-7q8q-rj6j-mhjq](https://github.com/advisories/GHSA-7q8q-rj6j-mhjq) | `>=1.18.0` |

### Streamdown, Mermaid and DOMPurify Advisory Detail

| Package | Severity | Advisory IDs | Fixed minimum |
|---|---|---|---|
| DOMPurify | Moderate | [GHSA-v2wj-7wpq-c8vv](https://github.com/advisories/GHSA-v2wj-7wpq-c8vv), [GHSA-cjmm-f4jc-qw8r](https://github.com/advisories/GHSA-cjmm-f4jc-qw8r), [GHSA-cj63-jhhr-wcxv](https://github.com/advisories/GHSA-cj63-jhhr-wcxv), [GHSA-h8r8-wccr-v5f2](https://github.com/advisories/GHSA-h8r8-wccr-v5f2) | `>=3.3.2` |
| DOMPurify | Moderate | [GHSA-h7mw-gpvr-xq4m](https://github.com/advisories/GHSA-h7mw-gpvr-xq4m), [GHSA-crv5-9vww-q3g8](https://github.com/advisories/GHSA-crv5-9vww-q3g8), [GHSA-v9jr-rg53-9pgp](https://github.com/advisories/GHSA-v9jr-rg53-9pgp) | `>=3.4.0` |
| DOMPurify | Moderate | [GHSA-hpcv-96wg-7vj8](https://github.com/advisories/GHSA-hpcv-96wg-7vj8), [GHSA-r47g-fvhr-h676](https://github.com/advisories/GHSA-r47g-fvhr-h676) | `>=3.4.6` |
| DOMPurify | Moderate | [GHSA-rp9w-3fw7-7cwq](https://github.com/advisories/GHSA-rp9w-3fw7-7cwq), [GHSA-76mc-f452-cxcm](https://github.com/advisories/GHSA-76mc-f452-cxcm) | `>=3.4.7` |
| DOMPurify | Moderate | [GHSA-cmwh-pvxp-8882](https://github.com/advisories/GHSA-cmwh-pvxp-8882) | `>=3.4.11` |
| DOMPurify | Moderate | [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) | `>=3.4.13` |
| DOMPurify | Low | [GHSA-gvmj-g25r-r7wr](https://github.com/advisories/GHSA-gvmj-g25r-r7wr), [GHSA-vxr8-fq34-vvx9](https://github.com/advisories/GHSA-vxr8-fq34-vvx9), [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4) | `>=3.4.8`, `>=3.4.9`, `>=3.4.12` |
| DOMPurify | Low | [GHSA-x4vx-rjvf-j5p4](https://github.com/advisories/GHSA-x4vx-rjvf-j5p4) | ไม่มี fixed release ตาม audit |
| Mermaid | Moderate | [GHSA-ghcm-xqfw-q4vr](https://github.com/advisories/GHSA-ghcm-xqfw-q4vr), [GHSA-xcj9-5m2h-648r](https://github.com/advisories/GHSA-xcj9-5m2h-648r), [GHSA-6m6c-36f7-fhxh](https://github.com/advisories/GHSA-6m6c-36f7-fhxh), [GHSA-87f9-hvmw-gh4p](https://github.com/advisories/GHSA-87f9-hvmw-gh4p) | `>=11.15.0` |
| Mermaid | Moderate | [GHSA-6x64-9x62-f2gx](https://github.com/advisories/GHSA-6x64-9x62-f2gx), [GHSA-3rrr-jr9j-h3q3](https://github.com/advisories/GHSA-3rrr-jr9j-h3q3), [GHSA-2v8p-3f2j-5mp7](https://github.com/advisories/GHSA-2v8p-3f2j-5mp7), [GHSA-rhh3-jpg6-66xh](https://github.com/advisories/GHSA-rhh3-jpg6-66xh) | `>=11.16.1` |
| Mermaid | Low | [GHSA-c4c3-pg64-4m4v](https://github.com/advisories/GHSA-c4c3-pg64-4m4v) | `>=11.16.1` |

## Remediation Options — No Option Has Been Selected

การเลือกด้านล่างเป็น analysis เพื่อให้เจ้าของโครงการอนุมัติภายหลังเท่านั้น ไม่ได้แนะนำให้รันคำสั่งใดใน task นี้

| Cluster | Option A — Patch/Minor | Option B — Major | Option C — Replace/Remove | Option D — Mitigate without upgrade | Compatibility / risk |
|---|---|---|---|---|---|
| Drizzle ORM | อัปเดตเป็น `>=0.45.2` ใน branch แยก | ย้ายไป series ใหม่กว่าหลังตรวจ migration/query API | เปลี่ยน ORM — ไม่เหมาะกับ scope/ความเสี่ยง | จำกัดให้ identifier เป็น compile-time constant, ห้าม raw SQL identifier จาก input, ยังคง review code | Option A เป็น 0.x minor จึงอาจมี breaking change. npm metadata ยืนยัน peer `mysql2 >=2` ซึ่งเข้ากับ `mysql2 3.15.0`; ต้องรัน typecheck/test/build และ workflow database |
| Express chain | อัปเดต Express 4.x compatible version/lockfile ที่นำ `path-to-regexp`, `body-parser`, `qs` เป็นรุ่น fixed | ย้าย Express major — ไม่จำเป็นก่อนพิสูจน์ว่า patch chain แก้ได้ | เปลี่ยน framework — ไม่อยู่ใน minimal-stack scope | ลด/ปิด URL-encoded parser หากไม่จำเป็น; จำกัด request size/depth/parameter count; แต่ไม่แก้ advisory ใน lockfile | Express 4.22.1 ระบุ Node `>=0.10`, จึงรองรับ Node 22; ต้องตรวจ tRPC middleware, storage proxy, integration และ regression tests |
| Axios family | อัปเดตเป็น `>=1.18.0` เพื่อครอบคลุม advisory ทุกระดับ | เปลี่ยน HTTP client หาก API แตก | ถอน Axios หาก static analysis ยืนยันว่าไม่ใช้ | ห้ามใช้ URL/proxy/redirect/header/config จาก input; ไม่มี mitigation ที่ทำให้ audit สะอาด | Audit target เป็น minor series ใหม่. ต้องตรวจ browser/server adapter, proxy behavior และ test outbound request หากมีการเริ่มใช้ในอนาคต |
| Nanoid | อัปเดต patch เป็น `>=5.1.16` | ไม่จำเป็น | ถอน direct dependency หากยืนยันว่า development tooling ไม่ต้องใช้ | ห้ามส่ง negative size ไป generator | `nanoid@5.1.16` รองรับ Node `^18 || >=20`, จึงเข้ากับ Node 22; risk ต่ำแต่ต้องตรวจ dev/build |
| Recharts/Lodash | อัปเดต Recharts/lockfile แล้วตรวจว่า transitive Lodash ไป fixed version | ย้าย Recharts major เมื่อเริ่มใช้ charts | ถอน Recharts/chart template หากยืนยันว่าไม่มี scope ใช้ | ห้ามเรียก `_.template` ด้วย input ผู้ใช้ | Recharts 2.15.4 รองรับ React/ReactDOM 19 และ Node >=14; ต้องตรวจ visual test หาก charts ถูกเปิดใช้ภายหลัง |
| Streamdown/Mermaid/DOMPurify | อัปเดต Streamdown/chain ไป versions ที่นำ transitive fixes | เปลี่ยน markdown renderer หาก breaking change | ถอน Streamdown และ template-only components หากไม่ใช้ | ห้ามเปิด render untrusted Markdown/HTML/diagram; sanitize-only mitigation ไม่ครอบคลุม all advisories | Streamdown 1.4.0 peer รองรับ React 19; version ใหม่ต้องตรวจ peer dependency, rendering behavior, XSS test และ bundle |
| AWS SDK/UUID | อัปเดต dependency chain ที่นำ UUID `>=11.1.1` | อัปเดต AWS SDK major หาก required | ถอน unused AWS SDK packages หากใช้ Forge storage only | คง file upload disabled และไม่ import AWS SDK | ต้องตรวจ template/storage integration ก่อนถอน; ปัจจุบัน runtime storage path ที่ตรวจใช้ Forge proxy |

## Compatibility Assessment Before Any Future Change

| Area | Finding | Required validation in remediation task |
|---|---|---|
| Node.js | Node 22.13.0 เข้าได้กับ Nanoid 5.1.16 (`^18 || >=20`), Recharts 2.15.4 (`>=14`) และ Express 4.22.1 (`>=0.10`) ตาม package metadata | `node --version`, clean install, `pnpm check`, `pnpm test`, `pnpm build` |
| React | Project React/ReactDOM 19.2.1 อยู่ใน peer range ของ Recharts 2.15.4 และ Streamdown 1.4.0 | build และ chart/markdown test หากเปิดใช้จริง |
| Database | Drizzle 0.45.2 มี peer `mysql2 >=2`; project ใช้ 3.15.0 | typecheck, existing DB transaction tests, invoice/dispense/national-ID UAT flow |
| pnpm | Manifest ระบุ pnpm 10.4.1; package manager ใหม่ต้องใช้ lockfile update แบบ deterministic | `pnpm install --frozen-lockfile` ก่อน/หลัง, review lockfile diff |
| Existing patch | มี `patchedDependencies` สำหรับ `wouter@3.7.1` | ห้าม regenerate/ลบ patch โดยไม่ตรวจ application routing regression |

## Security Status

| Severity | Count | Decision from this audit |
|---|---:|---|
| Critical | 0 | ไม่มี critical advisory จาก audit snapshot |
| High | 17 | 2 clusters อยู่ใน production runtime จริง (Drizzle, Express chain) และต้อง remediation plan ก่อน production; ที่เหลือมี static evidence ว่าไม่ถูก import ใน active runtime หรืออยู่ใน dev-only path |
| Moderate | 47 | ส่วนใหญ่กระจุกใน Axios และ Streamdown/Mermaid/DOMPurify chains; `qs` เป็น production parser exposure ที่ต้องรวมกับ Express remediation |
| Low | 8 | ไม่ใช่ตัวตัดสิน go/no-go เดี่ยว แต่บางรายการอยู่ใน Express chain จึงต้องตาม remediation cluster |

## Production Blockers

1. **P1: Drizzle ORM 0.44.7** เป็น active database layer และยังมี SQL-identifier injection advisory แม้ static review ไม่พบ untrusted identifier path.
2. **P1: Express request parsing/routing chain** มี High/Moderate/Low advisories ใน package ที่ active ก่อน tRPC (`path-to-regexp`, `qs`, `body-parser`).
3. **Governance blocker:** ไม่มี remediation change/test evidence สำหรับ P1 clusters ดังนั้นไม่ควรจัดระบบเป็น production-ready สำหรับ PHI เพียงจากผล static audit นี้.

## Risk if Not Fixed

หากระบบเริ่มใช้ production โดยคง dependency snapshot นี้ไว้ ความเสี่ยงที่สำคัญคือการเปิดช่อง attack surface ของ HTTP parser/routing, ความเสี่ยง SQL injection ในอนาคตเมื่อมี query refactor ที่ใช้ dynamic identifier, และการกลับมาเปิดใช้ template dependency ที่มี advisory อยู่โดยไม่มีการทบทวน. ในระบบคลินิก ผลกระทบอาจรวมถึง confidentiality, integrity และ availability ของ PHI, queue, clinical record, inventory และ billing information แม้ audit นี้ยังไม่พบการ exploit ที่ยืนยันได้ใน source ปัจจุบัน.

## Recommended Next Task

> **เพียง 1 task ที่แนะนำ:** สร้าง **Dependency Remediation Branch for P1 runtime chain** เพื่ออัปเดตและทดสอบ Drizzle ORM กับ Express dependency chain แบบจำกัดขอบเขต โดยเริ่มจาก review changelog/lockfile diff, รัน typecheck/Vitest/build และ UAT เส้นทาง auth, tRPC, patient/EMR, billing/stock ก่อนจึงตัดสินใจ include Axios หรือ dependency ที่ไม่ active.

งานนี้ต้องได้รับการอนุมัติจากเจ้าของโครงการก่อนเริ่ม เพราะจะเปลี่ยน `package.json`/lockfile และอาจกระทบ runtime behavior. ไม่ควรทำ bulk upgrade ทั้ง 72 advisory ในครั้งเดียว

## References

[1]: https://pnpm.io/cli/audit "pnpm audit documentation"
[2]: https://github.com/advisories/GHSA-gpj5-g38j-94v9 "GHSA-gpj5-g38j-94v9 — Drizzle ORM SQL identifier injection"
[3]: https://github.com/advisories/GHSA-37ch-88jc-xwx2 "GHSA-37ch-88jc-xwx2 — path-to-regexp ReDoS"
[4]: https://www.npmjs.com/package/axios "Axios package metadata"
[5]: https://www.npmjs.com/package/drizzle-orm "Drizzle ORM package metadata"
[6]: https://www.npmjs.com/package/express "Express package metadata"
