import { Alert, AlertDescription } from "@/components/ui/alert";

// Повідомлення про помилку зі сторінкових параметрів; нічого не показує без тексту.
export function FlashAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
