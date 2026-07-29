'use server';

export async function testAction(message: string) {
  console.log('[Test Action]', message);
  return { success: true, message: `Received: ${message}` };
}
