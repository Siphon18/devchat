import argparse
import sys
from pathlib import Path

# Allow running this script from either repo root or backend directory.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.mailer import can_send_email, send_welcome_email


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send a DevChat welcome email for SMTP verification."
    )
    parser.add_argument("--to", required=True, help="Recipient email address")
    parser.add_argument(
        "--username",
        default="new-user",
        help="Username used in the welcome email template",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only validate mailer config; do not send an email",
    )
    args = parser.parse_args()

    if not can_send_email():
        print("Mailer is not configured/enabled.")
        print("Required: WELCOME_EMAIL_ENABLED=true, SMTP_HOST, SMTP_FROM_EMAIL")
        return 2

    if args.check_only:
        print("Mailer configuration looks valid.")
        return 0

    try:
        send_welcome_email(args.to, args.username)
    except Exception as exc:
        print(f"Failed to send test welcome email: {exc}")
        return 1

    print(f"Welcome email sent to {args.to}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
