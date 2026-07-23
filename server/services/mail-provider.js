import { createHmac } from 'node:crypto'

import nodemailer from 'nodemailer'

function createVerificationMessage({ email, code, expiresAt, mailFrom }) {
  const expiry = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Shanghai'
  }).format(new Date(expiresAt))

  return {
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
