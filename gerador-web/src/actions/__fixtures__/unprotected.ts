'use server';

import { db } from '@/lib/db';

// VULNERABILIDADE DELIBERADA (FIXTURE DE TESTE)
// Esta action retorna todos os usuários sem passar por withAuth ou withPermission.
// O analisador estático (test-actions.ts) DEVE ser capaz de pegá-la, 
// o que é provado pelo script scripts/test-the-gate.ts.

export async function fetchAllUsersUnprotected() {
  return db.user.findMany();
}

export const anotherUnprotectedAction = async () => {
  return "Insecure data";
};
