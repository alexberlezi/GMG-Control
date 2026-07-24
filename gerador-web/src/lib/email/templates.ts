export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function newDeviceAlertTemplate(
  userName: string,
  location: string,
  userAgent: string,
  time: string
) {
  const safeName = escapeHtml(userName);
  const safeLoc = escapeHtml(location);
  const safeUa = escapeHtml(userAgent);
  const safeTime = escapeHtml(time);
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f87171; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Novo Acesso Detectado</h2>
      </div>
      <div style="padding: 30px;">
        <p>Olá, <strong>${safeName}</strong>,</p>
        <p>Detectamos um novo login em sua conta a partir de um dispositivo ou localização não reconhecidos.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Localização aproximada:</strong> ${safeLoc}</p>
          <p style="margin: 0 0 10px 0;"><strong>Dispositivo / Navegador:</strong> ${safeUa}</p>
          <p style="margin: 0;"><strong>Data e Hora:</strong> ${safeTime}</p>
        </div>

        <p>Se foi você quem acessou, nenhuma ação é necessária.</p>
        <p style="color: #dc2626; font-weight: bold;">Se você NÃO reconhece este acesso, recomendamos que você altere sua senha imediatamente e verifique os dispositivos conectados no painel.</p>
        
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          Este é um e-mail automático gerado pelo AuthForge. Não responda a este e-mail.
        </p>
      </div>
    </div>
  `;
}
