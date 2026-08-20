import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Download, FileBarChart, PackageOpen, Pill, ReceiptText, UsersRound } from "lucide-react";
import React, { useMemo, useState } from "react";

function bangkokDate(offsetDays = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function formatMoney(satang: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(satang / 100);
}

export function csvValue(value: string | number) {
  const text = String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const content = `\uFEFF${rows.map(row => row.map(csvValue).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useAuth();
  const [from, setFrom] = useState(() => bangkokDate(-6));
  const [to, setTo] = useState(() => bangkokDate());
  const range = useMemo(() => ({ from, to }), [from, to]);
  const report = trpc.reports.operationalSummary.useQuery(range, { retry: false });
  const data = report.data;
  const rangeIsInvalid = from > to;

  const exportCsv = () => {
    if (!data) return;
    const rows: Array<Array<string | number>> = [
      ["รายงานสรุปการปฏิบัติงาน (ข้อมูล aggregate เท่านั้น)"],
      ["ช่วงรายงาน", `${data.range.from} ถึง ${data.range.to}`],
      [],
      ["ตัวชี้วัด", "ค่า"],
      ["จำนวน visit", data.summary.visitCount],
      ["ยอดรับชำระ (บาท)", data.summary.paidSatang / 100],
      ["จำนวนธุรกรรมรับชำระ", data.summary.paymentCount],
      ["จำนวนหน่วยยาที่จ่าย", data.summary.dispensedUnits],
      ["จำนวน lot ยาคงเหลือ", data.summary.activeLotCount],
      ["จำนวนหน่วยยาคงคลัง", data.summary.onHandUnits],
      ["lot ใกล้หมดอายุภายใน 30 วัน", data.summary.expiringLotCount],
      [],
      ["รายวัน", "จำนวน visit", "ยอดรับชำระ (บาท)"],
      ...data.daily.map(row => [row.day, row.visitCount, row.paidSatang / 100]),
      [],
      ["ยาที่จ่ายสูงสุด", "รูปแบบ", "ความแรง", "จำนวนหน่วย"],
      ...data.topMedications.map(row => [row.genericName, row.dosageForm, row.strength, row.dispensedUnits]),
    ];
    downloadCsv(`clinic-operational-summary-${data.range.from}-to-${data.range.to}.csv`, rows);
  };

  return <div className="mx-auto max-w-7xl space-y-5 pb-8">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary"><FileBarChart className="h-5 w-5" /><span className="text-xs font-bold tracking-[0.14em]">OPERATIONAL REPORTS</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">รายงานสรุปการปฏิบัติงาน</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">ข้อมูลสรุปตามช่วงวัน ไม่แสดง HN ชื่อผู้รับบริการ เวชระเบียน หมายเลขใบแจ้งหนี้ หรือเลข lot</p>
      </div>
      <Badge variant="outline" className="w-fit border-primary/30 bg-primary/5 px-3 py-1.5 text-primary">สิทธิ์: {user?.role === "SYSTEM_ADMIN" ? "ข้อมูล aggregate เท่านั้น" : "ข้อมูล aggregate ตามบทบาท"}</Badge>
    </header>

    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium">ตั้งแต่<Input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm font-medium">ถึง<Input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label>
        <div className="flex flex-1 items-center gap-2 sm:justify-end"><span className="text-xs text-muted-foreground">แสดงได้ครั้งละไม่เกิน 93 วัน</span><Button onClick={exportCsv} disabled={!data || rangeIsInvalid} variant="outline"><Download className="mr-2 h-4 w-4" />ส่งออก CSV</Button></div>
      </CardContent>
      {rangeIsInvalid ? <CardContent className="pt-0 text-sm text-destructive">วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น</CardContent> : null}
    </Card>

    {report.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div> : null}
    {report.isError ? <Card className="border-destructive/30"><CardContent className="flex gap-3 p-5 text-sm text-destructive"><AlertCircle className="h-5 w-5 shrink-0" />{report.error.message}</CardContent></Card> : null}

    {data ? <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={UsersRound} label="จำนวน visit" value={data.summary.visitCount.toLocaleString("th-TH")} note="ตามวันที่เข้ารับบริการ" />
        <MetricCard icon={ReceiptText} label="ยอดรับชำระ" value={formatMoney(data.summary.paidSatang)} note={`${data.summary.paymentCount.toLocaleString("th-TH")} ธุรกรรมที่รับชำระแล้ว`} />
        <MetricCard icon={Pill} label="ยาที่จ่าย" value={`${data.summary.dispensedUnits.toLocaleString("th-TH")} หน่วย`} note="จากการตัดสต็อกในช่วงรายงาน" />
        <MetricCard icon={PackageOpen} label="คลังยาคงเหลือ" value={`${data.summary.onHandUnits.toLocaleString("th-TH")} หน่วย`} note={`${data.summary.activeLotCount.toLocaleString("th-TH")} lot · ใกล้หมดอายุ ${data.summary.expiringLotCount.toLocaleString("th-TH")} lot`} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 shadow-sm"><CardHeader><CardTitle className="text-base">สรุปรายวัน</CardTitle><CardDescription>จำนวน visit และยอดรับชำระที่ปิดรายการในแต่ละวัน</CardDescription></CardHeader><CardContent>{data.daily.length ? <Table><TableHeader><TableRow><TableHead>วันที่</TableHead><TableHead className="text-right">visit</TableHead><TableHead className="text-right">ยอดรับชำระ</TableHead></TableRow></TableHeader><TableBody>{data.daily.map(row => <TableRow key={row.day}><TableCell className="font-medium">{row.day}</TableCell><TableCell className="text-right tabular-nums">{row.visitCount.toLocaleString("th-TH")}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(row.paidSatang)}</TableCell></TableRow>)}</TableBody></Table> : <EmptyReportState />}</CardContent></Card>
        <Card className="border-border/70 shadow-sm"><CardHeader><CardTitle className="text-base">ยาที่จ่ายสูงสุด</CardTitle><CardDescription>รวมตามยาและจำนวนหน่วย ไม่แสดงข้อมูลผู้รับบริการ</CardDescription></CardHeader><CardContent>{data.topMedications.length ? <Table><TableHeader><TableRow><TableHead>ยา</TableHead><TableHead className="text-right">หน่วย</TableHead></TableRow></TableHeader><TableBody>{data.topMedications.map(row => <TableRow key={row.medicationId}><TableCell><p className="font-medium">{row.genericName}</p><p className="text-xs text-muted-foreground">{row.dosageForm} · {row.strength}</p></TableCell><TableCell className="text-right tabular-nums">{row.dispensedUnits.toLocaleString("th-TH")}</TableCell></TableRow>)}</TableBody></Table> : <EmptyReportState />}</CardContent></Card>
      </section>
    </> : null}
  </div>;
}

function MetricCard({ icon: Icon, label, value, note }: { icon: typeof UsersRound; label: string; value: string; note: string }) {
  return <Card className="border-border/70 shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div></div><p className="mt-3 text-xs text-muted-foreground">{note}</p></CardContent></Card>;
}

function EmptyReportState() {
  return <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงวันที่เลือก</div>;
}
