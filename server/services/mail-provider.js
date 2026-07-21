import nodemailer from 'nodemailer'

export function createMailProvider({
  smtpUrl,
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPass,
  mailFrom,
  transportFactory = nodemailer.createTransport
} = {}) {
  if (!smtpUrl && !(smtpHost && smtpUser && smtpPass)) return null

  const transporter = transportFactory({
    ...(smtpUrl
      ? { url: smtpUrl }
      : {
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: { user: smtpUser, pass: smtpPass }
        }),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    requireTLS: true,
    disableFileAccess: true,
    disableUrlAccess: true
  })

  return Object.freeze({
    async sendVerificationCode({ email, code, expiresAt }) {
      const expiry = new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Shanghai'
      }).format(new Date(expiresAt))

      return transporter.sendMail({
        from: mailFrom,
        to: email,
        subject: '国际中文学习平台注册验证码',
        text: `你的注册验证码是 ${code}，有效期至 ${expiry}。请勿向任何人透露此验证码。`,
        html: `
          <main style="max-width:560px;margin:auto;padding:32px;color:#172c35;font-family:serif">
            <p style="color:#bf3d2f;letter-spacing:.12em">INTERNATIONAL CHINESE PLATFORM</p>
            <h1 style="font-size:28px">完成你的平台注册</h1>
            <p>请在注册页面输入下面的六位验证码：</p>
            <p style="font:700 34px monospace;letter-spacing:.22em">${code}</p>
            <p style="color:#66757b">验证码有效期至 ${expiry}。如果这不是你的操作，请忽略本邮件。</p>
          </main>
        `
      })
    }
  })
}

export default createMailProvider
