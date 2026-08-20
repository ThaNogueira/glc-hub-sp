import nodemailer from "nodemailer";

/**
 * E-mails transacionais (apenas reset de senha — cadastro não exige
 * confirmação de e-mail). Configuração via SMTP_URL
 * (ex.: smtp://user:pass@smtp.resend.com:587).
 * Sem SMTP configurado, o link é impresso no log do servidor.
 */

function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function send(to: string, subject: string, text: string, html: string) {
  const url = process.env.SMTP_URL;
  if (!url) {
    console.log(`[mailer] SMTP não configurado — e-mail para ${to}:\n${subject}\n${text}`);
    return;
  }
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? "GLC Hub SP <no-reply@glchub.local>",
    to,
    subject,
    text,
    html,
  });
}

const wrap = (inner: string) => `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#c73a2b;margin:0 0 12px">GLC Hub SP</h2>
    ${inner}
    <p style="color:#888;font-size:12px;margin-top:24px">
      Se você não solicitou este e-mail, pode ignorá-lo.
    </p>
  </div>`;

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${siteUrl()}/redefinir-senha?token=${token}`;
  await send(
    to,
    "Redefinição de senha — GLC Hub SP",
    `Redefina sua senha acessando: ${link}\n(válido por 1 hora)`,
    wrap(
      `<p>Recebemos um pedido para redefinir sua senha:</p>
       <p><a href="${link}" style="background:#c73a2b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Redefinir senha</a></p>
       <p style="font-size:13px;color:#555">Ou copie o link: ${link}<br>Válido por 1 hora.</p>`,
    ),
  );
}
