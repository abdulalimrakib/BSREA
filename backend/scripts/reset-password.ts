/*--Set a new password for a staff account, from the server's command line (for a forgotten password).

    npm run reset-password                              lists the staff accounts
    npm run reset-password -- --email you@example.com   asks for the new password twice
    npm run reset-password -- --email you@example.com --reset-two-factor   also turns off two-factor login (lost phone)
    npm run reset-password -- --email you@example.com --reactivate         also re-enables a deactivated account

  Only someone who can run commands on the server can do this. The password is typed in hidden,
  never passed on the command line (where it would stay in the shell history). All of the
  account's sessions are logged out, its lockouts are cleared, and the reset is written to the audit log.--*/

import { db } from "../db/database";
import { audit } from "../services/audit";
import { hashPassword, passwordProblem } from "../utils/security";
import { arg, ask, closePrompt } from "./cli";

type Account = {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: number;
  totp_enabled: number;
};

const main = async () => {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) {
    const accounts = db
      .prepare(
        `SELECT id, email, name, role, is_active, totp_enabled FROM staff_users ORDER BY id`,
      )
      .all() as Account[];
    if (!accounts.length) {
      console.log(
        'There are no staff accounts yet. Create the first admin with: npm run seed -- --admin-email you@example.com --admin-name "Your Name"',
      );
      return;
    }
    console.log("Staff accounts:");
    for (const a of accounts) {
      console.log(
        `  ${a.email}  (${a.role}${a.is_active ? "" : ", deactivated"}${a.totp_enabled ? ", two-factor on" : ""})`,
      );
    }
    console.log("\nReset one with: npm run reset-password -- --email <email>");
    return;
  }

  const account = db
    .prepare(
      `SELECT id, email, name, role, is_active, totp_enabled FROM staff_users WHERE email = ?`,
    )
    .get(email) as Account | undefined;
  if (!account) {
    console.error(
      `No staff account with the email ${email}. Run "npm run reset-password" to list them.`,
    );
    process.exit(1);
  }

  const password = await ask("New password: ", true);
  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  if ((await ask("Type it again: ", true)) !== password) {
    console.error("The two passwords are different. Nothing was changed.");
    process.exit(1);
  }

  const resetTwoFactor = process.argv.includes("--reset-two-factor");
  const reactivate = process.argv.includes("--reactivate");
  db.prepare(`UPDATE staff_users SET password_hash = ? WHERE id = ?`).run(
    hashPassword(password),
    account.id,
  );
  if (resetTwoFactor)
    db.prepare(
      `UPDATE staff_users SET totp_enabled = 0, totp_secret_enc = NULL, totp_last_step = NULL WHERE id = ?`,
    ).run(account.id);
  if (reactivate)
    db.prepare(`UPDATE staff_users SET is_active = 1 WHERE id = ?`).run(
      account.id,
    );
  db.prepare(`DELETE FROM login_failures WHERE user_id = ?`).run(account.id);
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(account.id);
  audit(
    null,
    "password.reset_from_server",
    { type: "staff", id: account.id },
    {
      twoFactorReset: resetTwoFactor,
      reactivated: reactivate && !account.is_active,
    },
  );

  console.log(
    `Password changed for ${account.email}. Any open sessions were logged out.`,
  );
  if (resetTwoFactor)
    console.log(
      "Two-factor login was turned off; it will be set up again at the next login if it is required.",
    );
  else if (account.totp_enabled)
    console.log(
      "Two-factor login is still on: the login also needs the code from the authenticator app.",
    );
  if (!account.is_active && reactivate)
    console.log("The account was reactivated.");
  else if (!account.is_active)
    console.log(
      "Note: this account is deactivated, so it still can't log in. Add --reactivate to turn it back on.",
    );
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePrompt);
