import { createHmac } from 'node:crypto'

import nodemailer from 'nodemailer'

const HTML_ENTITIES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => HTML_ENTITIES[character]
  )
}

function createVerificationMessage({ email, code, expiresAt, mailFrom }) {
  const expiryDate = new Date(expiresAt)
  if (Number.isNaN(expiryDate.getTime())) {
    throw new TypeError('Verification code expiry is invalid')
  }
  const expiry = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Shanghai'
  }).format(expiryDate)
  const expiryWithZone = `${expiry}（北京时间）`
  const safeCode = escapeHtml(code)
  const safeExpiry = escapeHtml(expiryWithZone)

  return {
    from: mailFrom,
    to: email,
    subject: '国际中文学习平台注册验证码',
    text: `国际中文教育平台
INTERNATIONAL CHINESE EDUCATION

完成你的平台注册

你的注册验证码是：
${code}

有效期 10 分钟，至 ${expiryWithZone}。

请勿向任何人透露此验证码。平台工作人员不会向你索取验证码。
如果这不是你的操作，请忽略本邮件，无需进行任何处理。

这是一封由系统自动发送的事务邮件，请勿直接回复。`,
    headers: {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All'
    },
    html: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>国际中文学习平台注册验证码</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { width: 100% !important; }
        .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
        .brand-title { font-size: 22px !important; }
        .message-title { font-size: 30px !important; line-height: 38px !important; }
        .verification-code { font-size: 36px !important; letter-spacing: 7px !important; }
        .meta-column { display: block !important; width: 100% !important; box-sizing: border-box !important; }
        .meta-column-first { padding: 0 0 16px !important; }
        .meta-column-last { padding: 16px 0 0 !important; border-left: 0 !important; border-top: 1px solid #d7d0bf !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f1eee5;color:#172c35;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      你的注册验证码将在 10 分钟后失效，请及时完成验证。
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1eee5" style="width:100%;border-collapse:collapse;background-color:#f1eee5;">
      <tr>
        <td align="center" style="padding:36px 12px;">
          <!--[if mso]>
          <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
          <![endif]-->
          <table class="email-shell" role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffdf7" style="width:100%;max-width:600px;border-collapse:separate;background-color:#fffdf7;border:1px solid #d7d0bf;">
            <tr>
              <td class="mobile-padding" bgcolor="#172c35" style="padding:34px 40px 30px;background-color:#172c35;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td valign="middle" style="padding:0;">
                      <p style="margin:0 0 7px;color:#c9a86a;font-family:Consolas,Menlo,'Courier New',monospace;font-size:10px;line-height:15px;font-weight:700;letter-spacing:2.1px;text-transform:uppercase;mso-line-height-rule:exactly;">
                        INTERNATIONAL CHINESE EDUCATION
                      </p>
                      <p class="brand-title" style="margin:0;color:#fffdf7;font-family:Georgia,'Songti SC',STSong,serif;font-size:24px;line-height:32px;font-weight:700;letter-spacing:1px;mso-line-height-rule:exactly;">
                        国际中文教育平台
                      </p>
                    </td>
                    <td width="58" valign="middle" align="right" style="width:58px;padding:0 0 0 12px;">
                      <table role="presentation" width="48" cellpadding="0" cellspacing="0" border="0" align="right" bgcolor="#bf3d2f" style="width:48px;border-collapse:separate;background-color:#bf3d2f;border:1px solid #d98273;">
                        <tr>
                          <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;color:#fffdf7;font-family:Georgia,'Songti SC',STSong,serif;font-size:24px;line-height:48px;font-weight:700;mso-line-height-rule:exactly;">
                            文
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td height="1" bgcolor="#c9a86a" style="height:1px;padding:0;background-color:#c9a86a;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" bgcolor="#fffdf7" style="padding:48px 40px 20px;background-color:#fffdf7;">
                <p style="margin:0 0 15px;color:#bf3d2f;font-family:Consolas,Menlo,'Courier New',monospace;font-size:11px;line-height:17px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;mso-line-height-rule:exactly;">
                  REGISTRATION VERIFICATION
                </p>
                <h1 class="message-title" style="margin:0 0 19px;color:#172c35;font-family:Georgia,'Songti SC',STSong,serif;font-size:36px;line-height:46px;font-weight:700;letter-spacing:.2px;mso-line-height-rule:exactly;">
                  完成你的平台注册
                </h1>
                <p style="margin:0;color:#5a696e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:16px;line-height:26px;font-weight:400;mso-line-height-rule:exactly;">
                  欢迎来到国际中文教育平台。请在注册页面输入下面的六位验证码，完成身份确认。
                </p>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" bgcolor="#fffdf7" style="padding:20px 40px 24px;background-color:#fffdf7;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#bf3d2f" style="width:100%;border-collapse:separate;background-color:#bf3d2f;border:1px solid #a93125;">
                  <tr>
                    <td align="center" style="padding:24px 20px 8px;color:#f7d7cf;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.5px;mso-line-height-rule:exactly;">
                      你的验证码
                    </td>
                  </tr>
                  <tr>
                    <td class="verification-code" dir="ltr" align="center" style="padding:0 12px 26px;color:#ffffff;font-family:Consolas,Menlo,'Courier New',monospace;font-size:42px;line-height:52px;font-weight:700;letter-spacing:10px;white-space:nowrap;mso-line-height-rule:exactly;">
                      ${safeCode}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" bgcolor="#fffdf7" style="padding:0 40px 36px;background-color:#fffdf7;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td class="meta-column meta-column-first" width="50%" valign="top" style="width:50%;padding:0 12px 0 0;">
                      <p style="margin:0 0 5px;color:#8a6d3b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:11px;line-height:17px;font-weight:700;letter-spacing:1px;mso-line-height-rule:exactly;">
                        有效期 10 分钟
                      </p>
                      <p style="margin:0;color:#5a696e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:13px;line-height:21px;font-weight:400;mso-line-height-rule:exactly;">
                        ${safeExpiry}
                      </p>
                    </td>
                    <td class="meta-column meta-column-last" width="50%" valign="top" style="width:50%;padding:0 0 0 12px;border-left:1px solid #d7d0bf;">
                      <p style="margin:0 0 5px;color:#8a6d3b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:11px;line-height:17px;font-weight:700;letter-spacing:1px;mso-line-height-rule:exactly;">
                        使用方式
                      </p>
                      <p style="margin:0;color:#5a696e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:13px;line-height:21px;font-weight:400;mso-line-height-rule:exactly;">
                        返回注册页面，输入上方验证码。
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" bgcolor="#fffdf7" style="padding:0 40px 42px;background-color:#fffdf7;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f1e7" style="width:100%;border-collapse:separate;background-color:#f6f1e7;border-left:3px solid #c9a86a;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 5px;color:#172c35;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:13px;line-height:20px;font-weight:700;mso-line-height-rule:exactly;">
                        安全提示
                      </p>
                      <p style="margin:0;color:#66757b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:13px;line-height:21px;font-weight:400;mso-line-height-rule:exactly;">
                        请勿向任何人透露验证码。平台工作人员不会向你索取验证码；如果这不是你的操作，请忽略本邮件。
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" bgcolor="#172c35" style="padding:24px 40px;background-color:#172c35;border-top:1px solid #c9a86a;">
                <p style="margin:0 0 5px;color:#d7d0bf;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:11px;line-height:18px;font-weight:400;mso-line-height-rule:exactly;">
                  这是一封由系统自动发送的事务邮件，请勿直接回复。
                </p>
                <p style="margin:0;color:#8f9a9d;font-family:Consolas,Menlo,'Courier New',monospace;font-size:10px;line-height:16px;font-weight:400;letter-spacing:.7px;mso-line-height-rule:exactly;">
                  INTERNATIONAL CHINESE EDUCATION · LEARN · CONNECT · GROW
                </p>
              </td>
            </tr>
          </table>
          <!--[if mso]>
              </td>
            </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`
  }
}

function createRelayProvider({
  mailRelayUrl,
  mailRelaySecret,
  fetchImpl,
  now,
  relayTimeoutMs
}) {
  return Object.freeze({
    async sendVerificationCode({ email, code, expiresAt }) {
      const rawBody = JSON.stringify({ email, code, expiresAt })
      const timestamp = String(Math.floor(now() / 1000))
      const signature = createHmac('sha256', mailRelaySecret)
        .update(`${timestamp}.`, 'utf8')
        .update(rawBody, 'utf8')
        .digest('hex')

      let response
      try {
        response = await fetchImpl(mailRelayUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mail-relay-timestamp': timestamp,
            'x-mail-relay-signature': `sha256=${signature}`
          },
          body: rawBody,
          signal: globalThis.AbortSignal.timeout(relayTimeoutMs)
        })
      } catch (error) {
        throw new Error('Verification mail relay request failed', {
          cause: error
        })
      }

      if (!response.ok) {
        throw new Error(
          `Verification mail relay rejected the request (${response.status})`
        )
      }

      return { relayed: true, status: response.status }
    }
  })
}

function createSmtpProvider({
  smtpUrl,
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPass,
  mailFrom,
  transportFactory
}) {
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
    async sendVerificationCode(payload) {
      return transporter.sendMail(
        createVerificationMessage({ ...payload, mailFrom })
      )
    }
  })
}

export function createMailProvider({
  mailRelayUrl,
  mailRelaySecret,
  smtpUrl,
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPass,
  mailFrom,
  transportFactory = nodemailer.createTransport,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  relayTimeoutMs = 10_000
} = {}) {
  if (mailRelayUrl && mailRelaySecret) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('Mail relay requires a Fetch-compatible client')
    }
    return createRelayProvider({
      mailRelayUrl,
      mailRelaySecret,
      fetchImpl,
      now,
      relayTimeoutMs
    })
  }

  return createSmtpProvider({
    smtpUrl,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    mailFrom,
    transportFactory
  })
}

export { createVerificationMessage }

export default createMailProvider
