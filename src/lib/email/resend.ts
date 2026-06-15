import { Resend } from "resend";

let _client: Resend | null = null;

export function getResend(): Resend {
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY ?? "");
  return _client;
}

export const FROM_EMAIL = "Loop Vocabulary <noreply@loop-vocabulary.app>";
