import os
import smtplib
import logging
from email.message import EmailMessage


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def is_welcome_email_enabled() -> bool:
    return env_bool("WELCOME_EMAIL_ENABLED", False)


def _smtp_config() -> dict[str, str | int | bool]:
    return {
        "host": os.getenv("SMTP_HOST", "").strip(),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "username": os.getenv("SMTP_USERNAME", "").strip(),
        "password": os.getenv("SMTP_PASSWORD", "").strip(),
        "from_email": os.getenv("SMTP_FROM_EMAIL", "").strip(),
        "from_name": os.getenv("SMTP_FROM_NAME", "DevChat").strip(),
        "use_tls": env_bool("SMTP_USE_TLS", True),
    }


def can_send_email() -> bool:
    cfg = _smtp_config()
    return bool(
        is_welcome_email_enabled()
        and cfg["host"]
        and cfg["from_email"]
    )


def send_welcome_email(recipient_email: str, username: str) -> None:
    cfg = _smtp_config()
    if not can_send_email():
        logging.info(
            "Welcome email skipped for %s: mailer not configured/enabled",
            recipient_email,
        )
        return

    message = EmailMessage()
    sender = cfg["from_email"]
    from_name = cfg["from_name"]
    message["Subject"] = "Welcome to DevChat"
    message["From"] = f"{from_name} <{sender}>"
    message["To"] = recipient_email

    text_body = f"""Welcome to DevChat, {username}.

Your workspace is ready.

With DevChat you can:
- chat with your team in real time
- organize work into projects and rooms
- share and run Python snippets directly in chat

You can sign in anytime at {os.getenv("FRONTEND_URL", "").strip() or "DevChat"}.

We're glad to have you here.

The DevChat Team
"""

    html_body = f"""
<html>
  <body style="margin:0;padding:0;background:#08090c;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f0f2f5;">
    <div style="max-width:620px;margin:0 auto;padding:32px 20px;">
      <div style="border-radius:24px;overflow:hidden;background:linear-gradient(135deg,#5865F2 0%,#7c3aed 55%,#06b6d4 100%);padding:1px;">
        <div style="background:#0f1115;border-radius:23px;padding:36px 32px;">
          <div style="display:inline-block;padding:10px 14px;border-radius:16px;background:rgba(88,101,242,0.14);color:#ffffff;font-weight:700;letter-spacing:0.02em;">
            DevChat
          </div>
          <h1 style="margin:24px 0 12px;font-size:30px;line-height:1.1;">Welcome to DevChat, {username}</h1>
          <p style="margin:0 0 20px;color:#a0a5b3;font-size:16px;line-height:1.7;">
            Your workspace is ready. DevChat gives your team a fast, developer-first place to talk, collaborate, and ship.
          </p>
          <div style="margin:28px 0;padding:20px;border-radius:18px;background:#161820;border:1px solid rgba(255,255,255,0.06);">
            <div style="margin-bottom:10px;">Chat with your team in real time</div>
            <div style="margin-bottom:10px;">Organize work into projects and rooms</div>
            <div>Share and run Python snippets directly in chat</div>
          </div>
          <a href="{os.getenv("FRONTEND_URL", "").strip() or '#'}" style="display:inline-block;margin-top:8px;padding:14px 22px;border-radius:14px;background:linear-gradient(135deg,#5865F2 0%,#7c3aed 100%);color:#ffffff;text-decoration:none;font-weight:700;">
            Open DevChat
          </a>
          <p style="margin:28px 0 0;color:#72767d;font-size:13px;line-height:1.6;">
            We’re glad to have you here.<br/>The DevChat Team
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
"""

    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    timeout = 20
    with smtplib.SMTP(str(cfg["host"]), int(cfg["port"]), timeout=timeout) as server:
        if cfg["use_tls"]:
            server.starttls()
        if cfg["username"]:
            server.login(str(cfg["username"]), str(cfg["password"]))
        server.send_message(message)


def send_welcome_email_safe(recipient_email: str, username: str) -> None:
    try:
        send_welcome_email(recipient_email, username)
    except Exception:
        # Email delivery should never block user registration.
        logging.exception("Failed to send welcome email to %s", recipient_email)
        return
