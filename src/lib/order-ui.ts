export const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
export function payLabel(s: string) {
  return s === "paid" ? "Aprovado" : s === "failed" ? "Falhou" : "Aguardando pagamento";
}
