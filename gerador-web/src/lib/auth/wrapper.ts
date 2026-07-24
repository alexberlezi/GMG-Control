import { validateSession, SessionWithUser } from './session';
import { checkPermission } from '@/lib/permissions';

export type ActionError = { success: false; error: string };

/**
 * Envolve uma Server Action exigindo que o usuário esteja autenticado.
 * A action interna receberá a sessão validada como primeiro argumento.
 */
export function withAuth<TArgs extends any[], TReturn>(
  action: (session: SessionWithUser, ...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn | ActionError> => {
    const session = await validateSession();
    if (!session) {
      return { success: false, error: 'Acesso negado. Sessão inválida ou expirada.' };
    }
    return action(session, ...args);
  };
}

/**
 * Envolve uma Server Action exigindo uma permissão específica.
 * A action interna receberá a sessão validada como primeiro argumento.
 */
export function withPermission<TArgs extends any[], TReturn>(
  requiredPermission: string,
  action: (session: SessionWithUser, ...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn | ActionError> => {
    const session = await validateSession();
    if (!session) {
      return { success: false, error: 'Acesso negado. Sessão inválida ou expirada.' };
    }
    
    // O proprietário (Owner) sempre tem permissão total
    if (session.user.isOwner) {
      return action(session, ...args);
    }
    
    const parts = requiredPermission.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      console.error(`[Security] Permissão inválida configurada na action: ${requiredPermission}`);
      return { success: false, error: 'Configuração de segurança inválida.' };
    }
    
    const [reqResource, reqAction] = parts;
    if (!checkPermission(session.user.roles, reqResource, reqAction as any)) {
      return { success: false, error: `Acesso negado. Permissão necessária: ${requiredPermission}` };
    }

    return action(session, ...args);
  };
}
