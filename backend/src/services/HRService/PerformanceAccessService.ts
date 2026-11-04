import Employee from "../../models/Employee";

interface RequestUser {
  id: number;
  profile: string;
  super?: boolean;
}

// Painel de Desempenho (RH — Fase 3) — restrição PESSOAL, não de
// módulo: diferente de `EnsureHRAccess` (que é "a empresa tem RH e
// você tem acesso ao módulo"), aqui a pergunta é "você pode ver O
// DESEMPENHO DESTE FUNCIONÁRIO específico" — só Admin/Master ou quem
// é o `managerId` daquele funcionário, premissa fechada com o cliente
// já na Fase 1 (seção 215: "não pra qualquer um com acesso ao RH").
// Usada EM CIMA de `EnsureHRAccess` (ver PerformanceRecordController),
// nunca no lugar dela — RH continua sendo a porta de entrada do
// módulo, isto é a trava de cada sala dentro dele.
export const canAccessEmployeePerformance = (user: RequestUser, employee: Employee): boolean => {
  if (user.super) return true;
  if (user.profile === "admin") return true;
  return employee.managerId === user.id;
};
