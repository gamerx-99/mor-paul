import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type PasswordFields = { currentPassword: string; newPassword: string; confirmPassword: string };
const emptyFields: PasswordFields = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [fields, setFields] = useState<PasswordFields>(emptyFields);
  const [error, setError] = useState<string | null>(null);
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setFields(emptyFields);
      setError(null);
      onOpenChange(false);
      toast.success("เปลี่ยนรหัสผ่านแล้ว", { description: "อุปกรณ์อื่นที่ลงชื่อเข้าใช้ด้วยบัญชีนี้ถูกออกจากระบบแล้ว" });
    },
  });

  useEffect(() => {
    if (!open) {
      setFields(emptyFields);
      setError(null);
    }
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (fields.newPassword !== fields.confirmPassword) {
      setError("การยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: fields.currentPassword, newPassword: fields.newPassword });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเปลี่ยนรหัสผ่านได้");
    }
  }

  function updateField(field: keyof PasswordFields, value: string) {
    setFields(current => ({ ...current, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!changePassword.isPending} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เปลี่ยนรหัสผ่าน</DialogTitle>
          <DialogDescription>รหัสผ่านใหม่ต้องยาวอย่างน้อย 12 ตัวอักษร หากสั้นกว่า 16 ตัวอักษร ต้องมีอย่างน้อย 3 ประเภทอักขระ</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <PasswordField label="รหัสผ่านปัจจุบัน" value={fields.currentPassword} onChange={value => updateField("currentPassword", value)} autoComplete="current-password" />
          <PasswordField label="รหัสผ่านใหม่" value={fields.newPassword} onChange={value => updateField("newPassword", value)} autoComplete="new-password" />
          <PasswordField label="ยืนยันรหัสผ่านใหม่" value={fields.confirmPassword} onChange={value => updateField("confirmPassword", value)} autoComplete="new-password" />
          {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={changePassword.isPending}>ยกเลิก</Button>
            <Button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  return <div className="space-y-2"><Label htmlFor={autoComplete}>{label}</Label><Input id={autoComplete} type="password" value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} minLength={12} maxLength={128} required /></div>;
}
