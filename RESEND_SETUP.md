# Resend setup for DevChat welcome emails

This app already supports welcome emails through SMTP, and Resend is the best fit for the current implementation.

## Why Resend

- developer-focused setup
- immediate production access once your domain is verified
- direct SMTP support, so no backend code changes are needed

## Resend values for this app

Use these Render environment variables:

- `WELCOME_EMAIL_ENABLED=true`
- `SMTP_HOST=smtp.resend.com`
- `SMTP_PORT=587`
- `SMTP_USERNAME=resend`
- `SMTP_PASSWORD=<your Resend API key>`
- `SMTP_FROM_EMAIL=welcome@your-domain.com`
- `SMTP_FROM_NAME=DevChat`
- `SMTP_USE_TLS=true`

## Resend dashboard steps

1. Create a Resend account.
2. Add a sending domain.
3. Verify the DNS records for that domain.
4. Create an API key with sending access.
5. Put that API key into `SMTP_PASSWORD` on Render.
6. Set `SMTP_FROM_EMAIL` to an address on the verified domain.

Recommended:

- use a subdomain such as `mail.yourdomain.com` or `updates.yourdomain.com`
- use a sender such as `welcome@updates.yourdomain.com`

## Render deploy step

After setting the env vars, redeploy the backend on Render.

New signups with an email address will then receive the welcome email automatically.

## Official docs

- Resend SMTP: https://resend.com/docs/send-with-smtp
- Resend domains: https://resend.com/docs/dashboard/domains/introduction
- Resend production access: https://resend.com/docs/knowledge-base/does-resend-require-production-approval
